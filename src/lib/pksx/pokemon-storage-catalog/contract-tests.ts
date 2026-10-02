import { describe, expect, it } from 'vitest';
import type { EngineApi, PreservationPayloadSummary } from '$lib/engine';
import { createMockEngine } from '$lib/engine/mock-engine';
import { PokemonStorageService } from './service';
import { createEmptyPokemonStorage } from '$lib/pksx/saves';
import { referenceFor, type CatalogPersistence, type PokemonOrigin } from './types';

const origin: PokemonOrigin = {
	entryMode: 'imported',
	originSaveFileId: null,
	originSaveFileName: null,
	originGame: null,
	originalTrainer: null,
	trainerId: null,
	enteredAt: '2026-10-02T00:00:00Z'
};
const bytes = (...values: number[]) => new Uint8Array(values);
function fakeEngine(): Pick<
	EngineApi,
	| 'createPreservationPayload'
	| 'forkPreservationPayload'
	| 'readPreservationPayload'
	| 'replacePreservationPayloadCurrent'
> & {
	editPayload(recordId: string, entity: Uint8Array): Uint8Array;
} {
	let sequence = 0;
	const payloads = new Map<string, { entity: Uint8Array; summary: PreservationPayloadSummary }>();
	const create = async (entity: Uint8Array) => {
		const id = `record-${++sequence}`;
		const payload = bytes(sequence, ...entity);
		const summary = {
			version: 1,
			recordId: id,
			identityFingerprint: `fingerprint-${entity[0]}`,
			identityBaseSpeciesId: 1,
			originalEntityFormat: 'PK9',
			originalFormat: 9,
			originalContext: 'PK9',
			currentEntityFormat: 'PK9',
			currentFormat: 9,
			currentContext: 'PK9',
			originalByteLength: entity.length,
			currentByteLength: entity.length,
			originalEntitySha256: 'test'
		};
		payloads.set([...payload].join(','), { entity: new Uint8Array(entity), summary });
		return { ok: true as const, value: { bytes: payload, summary }, error: null };
	};
	return {
		editPayload(recordId, entity) {
			const existing = [...payloads.values()].find((item) => item.summary.recordId === recordId);
			if (!existing) throw new Error('Unknown Record ID');
			const payload = bytes(++sequence, ...entity);
			payloads.set([...payload].join(','), {
				entity: new Uint8Array(entity),
				summary: existing.summary
			});
			return payload;
		},
		createPreservationPayload: create,
		forkPreservationPayload: async (payload) => {
			const found = payloads.get([...payload].join(','));
			if (!found) throw new Error('Unknown preservation payload');
			const id = `record-${++sequence}`;
			const forked = bytes(sequence, ...found.entity);
			const summary = { ...found.summary, recordId: id };
			payloads.set([...forked].join(','), { entity: new Uint8Array(found.entity), summary });
			return { ok: true as const, value: { bytes: forked, summary }, error: null };
		},
		replacePreservationPayloadCurrent: async (payload, entity) => {
			const found = payloads.get([...payload].join(','));
			if (!found) throw new Error('Unknown preservation payload');
			const updated = bytes(++sequence, ...entity);
			payloads.set([...updated].join(','), {
				entity: new Uint8Array(entity),
				summary: found.summary
			});
			return { ok: true as const, value: { bytes: updated, summary: found.summary }, error: null };
		},
		readPreservationPayload: async (payload) => {
			const found = payloads.get([...payload].join(','));
			if (!found)
				return {
					ok: false as const,
					value: null,
					error: { code: 'malformed-preservation-payload' as const, message: 'Invalid payload' }
				};
			return {
				ok: true as const,
				value: {
					entityBytes: new Uint8Array(found.entity),
					summary: found.summary,
					projection: { slot: 0, box: 0, speciesName: 'Test', entityBytesBase64: 'AQID' } as never
				},
				error: null
			};
		}
	};
}
export function catalogContract(
	name: string,
	create: () => CatalogPersistence,
	corrupt: (persistence: CatalogPersistence, id: string) => Promise<void>
) {
	describe(`${name} Pokemon Storage contract`, () => {
		it('keeps legacy empty boxes and gives only a new library one box', async () => {
			const legacy = createEmptyPokemonStorage(3);
			const migrated = await new PokemonStorageService(create(), fakeEngine()).loadOrMigrate(
				async () => legacy
			);
			expect(migrated.boxes.map((box) => box.name)).toEqual(['Box 01', 'Box 02', 'Box 03']);
			expect(migrated.records).toEqual([]);
			const fresh = await new PokemonStorageService(create(), fakeEngine()).loadOrMigrate(
				async () => null
			);
			expect(fresh.boxes).toHaveLength(1);
			expect(fresh.boxes[0].name).toBeNull();
		});
		it('migrates occupied and empty boxes with names, order, origins and engine projections', async () => {
			const persistence = create();
			const legacy = createEmptyPokemonStorage(3, 30, () => origin.enteredAt);
			legacy.boxes[0].name = 'Favorites';
			legacy.boxes[1].name = 'Empty collection';
			legacy.boxes[2].name = 'Favorites';
			legacy.boxes[0].slots[4].pokemon = {
				label: 'Old label',
				detail: '',
				level: null,
				experience: null,
				speciesId: null,
				form: null,
				isEgg: false,
				spriteIdentity: null,
				entityBytesBase64: 'AQID',
				origin: {
					entryMode: 'moved-in',
					originSaveFileName: 'source.sav',
					originGame: 'SV',
					originalTrainer: 'Trainer',
					trainerId: '123',
					enteredAt: origin.enteredAt
				}
			};
			legacy.boxes[2].slots[29].pokemon = {
				...structuredClone(legacy.boxes[0].slots[4].pokemon!),
				entityBytesBase64: 'BAUG',
				origin: { ...legacy.boxes[0].slots[4].pokemon!.origin, entryMode: 'copied-in' }
			};
			const before = structuredClone(legacy);
			const service = new PokemonStorageService(
				persistence,
				fakeEngine(),
				() => origin.enteredAt,
				(() => {
					let id = 0;
					return () => `id-${++id}`;
				})()
			);
			const migrated = await service.migrateLegacy(legacy);
			expect(legacy).toEqual(before);
			expect(migrated.boxes.map((box) => box.name)).toEqual([
				'Favorites',
				'Empty collection',
				'Favorites'
			]);
			expect(migrated.records.map((record) => record.placement)).toEqual([
				{ storageBoxId: migrated.boxes[0].id, slot: 4 },
				{ storageBoxId: migrated.boxes[2].id, slot: 29 }
			]);
			expect(migrated.records[0].origin).toMatchObject(before.boxes[0].slots[4].pokemon!.origin);
			expect(migrated.records[0].projection.speciesName).toBe('Test');
			expect(JSON.stringify(migrated)).not.toContain('entityBytesBase64');
			expect(await service.readPayload(migrated.records[0].recordId)).toBeTruthy();
			const reopened = new PokemonStorageService(persistence, fakeEngine());
			expect(await reopened.migrateLegacy(legacy)).toEqual(migrated);
		});
		it('leaves legacy readable and retries after a failed catalog commit', async () => {
			const persistence = create();
			const legacy = createEmptyPokemonStorage(1);
			legacy.boxes[0].slots[0].pokemon = {
				label: 'Stored',
				detail: '',
				level: 1,
				experience: null,
				speciesId: 1,
				form: 0,
				isEgg: false,
				spriteIdentity: null,
				entityBytesBase64: 'AQID',
				origin: { ...origin, entryMode: 'imported' }
			};
			const source = structuredClone(legacy);
			let fail = true;
			const failing: CatalogPersistence = {
				...persistence,
				read: () => persistence.read(),
				readBlob: (ref) => persistence.readBlob(ref),
				commit: async (revision, manifest, blobs) => {
					if (fail) {
						fail = false;
						throw new Error('Injected migration failure');
					}
					await persistence.commit(revision, manifest, blobs);
				},
				sweep: () => persistence.sweep()
			};
			const service = new PokemonStorageService(failing, fakeEngine());
			await expect(service.migrateLegacy(legacy)).rejects.toThrow('Injected migration failure');
			expect(legacy).toEqual(source);
			expect(await persistence.read()).toBeNull();
			expect((await service.migrateLegacy(legacy)).records).toHaveLength(1);
		});
		it('persists engine Record IDs, independent copies, origin, boxes and placements', async () => {
			const persistence = create();
			const service = new PokemonStorageService(
				persistence,
				fakeEngine(),
				() => '2026-10-02T00:00:00Z',
				() => 'new-id'
			);
			await service.initialize('storage-id');
			let changes = 0;
			const unsubscribe = service.subscribe(() => {
				changes += 1;
			});
			const box = service.listBoxes()[0];
			const first = await service.add(bytes(1, 2), origin, { storageBoxId: box.id, slot: 0 });
			const copy = await service.copy(first.recordId);
			expect(copy.recordId).not.toBe(first.recordId);
			expect(copy.identityFingerprint).toBe(first.identityFingerprint);
			expect(copy.origin).toEqual(first.origin);
			expect(copy.placement).toBeNull();
			await service.place(first.recordId, { storageBoxId: box.id, slot: 1 });
			await service.renameBox(box.id, 'Favorites');
			expect(changes).toBeGreaterThan(0);
			unsubscribe();
			expect(JSON.stringify(service.current)).not.toContain('entityBytesBase64');
			const reopened = new PokemonStorageService(persistence, fakeEngine());
			await reopened.load();
			expect(reopened.getRecord(first.recordId)?.placement?.slot).toBe(1);
			expect(reopened.listBoxes()[0].name).toBe('Favorites');
			expect(reopened.current?.schemaVersion).toBe(1);
		});
		it('keeps resolved placement queries detached from the catalog', async () => {
			const service = new PokemonStorageService(create(), fakeEngine());
			await service.initialize();
			const boxId = service.listBoxes()[0].id;
			const record = await service.add(bytes(1), origin, { storageBoxId: boxId, slot: 0 });
			service.listResolvedPlacements()[0].placement!.slot = 5;
			expect(service.getRecord(record.recordId)?.placement).toEqual({
				storageBoxId: boxId,
				slot: 0
			});
		});
		it('keeps the previous manifest on conflict and failed blob verification', async () => {
			const persistence = create();
			const engine = fakeEngine();
			const first = new PokemonStorageService(persistence, engine);
			await first.initialize();
			const stale = new PokemonStorageService(persistence, engine);
			await stale.load();
			await first.add(bytes(1), origin);
			await expect(stale.add(bytes(2), origin)).rejects.toThrow();
			expect((await persistence.read())?.records).toHaveLength(1);
			const reference = await referenceFor(bytes(9), 1);
			await expect(
				persistence.commit(
					(await persistence.read())!.revision,
					{ ...(await persistence.read())!, revision: 2 },
					[{ reference, bytes: bytes(8) }]
				)
			).rejects.toThrow();
			expect((await persistence.read())?.records).toHaveLength(1);
		});
		it('keeps at least one box and deletes only an empty box', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const first = service.listBoxes()[0];
			await expect(service.removeBox(first.id)).rejects.toThrow();
			const second = await service.addBox();
			const record = await service.add(bytes(4), origin, { storageBoxId: second.id, slot: 0 });
			await expect(service.removeBox(second.id)).rejects.toThrow();
			await service.place(record.recordId, null);
			await service.removeBox(second.id);
			expect(service.listBoxes()).toHaveLength(1);
		});
		it('counts unfiled Pokemon toward local capacity', async () => {
			const service = new PokemonStorageService(create(), fakeEngine());
			await service.initialize();
			const first = await service.add(bytes(4), origin);
			for (let index = 1; index < 30; index += 1) await service.copy(first.recordId);
			expect(service.listRecords()).toHaveLength(30);
			await expect(service.add(bytes(5), origin)).rejects.toThrow(/capacity/);
			await expect(service.copy(first.recordId)).rejects.toThrow(/capacity/);
			await service.addBox();
			await service.copy(first.recordId);
			expect(service.listRecords()).toHaveLength(31);
		});
		it('protects resolved slots held by displaced records', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const boxId = service.listBoxes()[0].id;
			const first = await service.add(bytes(1), origin, { storageBoxId: boxId, slot: 0 });
			const displaced = await service.add(bytes(2), origin);
			const moving = await service.add(bytes(3), origin);
			const manifest = service.current!;
			manifest.records.find((record) => record.recordId === displaced.recordId)!.placement = {
				storageBoxId: boxId,
				slot: 0
			};
			manifest.revision += 1;
			await persistence.commit(service.current!.revision, manifest, []);
			await service.load();
			expect(
				service.listResolvedPlacements().find((item) => item.recordId === displaced.recordId)
					?.placement
			).toEqual({ storageBoxId: boxId, slot: 1 });
			await expect(
				service.place(moving.recordId, { storageBoxId: boxId, slot: 1 })
			).rejects.toThrow(/occupied/);
			await expect(service.add(bytes(4), origin, { storageBoxId: boxId, slot: 1 })).rejects.toThrow(
				/occupied/
			);
			await service.place(moving.recordId, { storageBoxId: boxId, slot: 2 });
			expect(service.getRecord(first.recordId)?.placement?.slot).toBe(0);
		});
		it('validates deletion reasons and destinations on mutation and persistence', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const record = await service.add(bytes(1), origin);
			await expect(service.retire(record.recordId, 'moved-to-save')).rejects.toThrow(/destination/);
			await expect(service.retire(record.recordId, 'cleared', 'save-id')).rejects.toThrow(
				/destination/
			);
			const manifest = service.current!;
			manifest.records = [];
			manifest.tombstones = [
				{
					recordId: record.recordId,
					reason: 'moved-to-save',
					destinationSaveFileId: null,
					deletedAt: 'now',
					revision: 1
				}
			];
			manifest.revision += 1;
			await expect(persistence.commit(service.current!.revision, manifest, [])).rejects.toThrow(
				/destination/
			);
			manifest.tombstones[0] = {
				...manifest.tombstones[0],
				reason: 'cleared',
				destinationSaveFileId: 'save-id'
			};
			await expect(persistence.commit(service.current!.revision, manifest, [])).rejects.toThrow(
				/destination/
			);
			await service.retire(record.recordId, 'moved-to-save', 'save-id');
			expect(service.listTombstones()[0].destinationSaveFileId).toBe('save-id');
		});
		it('swaps two occupied physical placements without replacing either record', async () => {
			const service = new PokemonStorageService(create(), fakeEngine());
			await service.initialize();
			const boxId = service.listBoxes()[0].id;
			const first = await service.add(bytes(1), origin, { storageBoxId: boxId, slot: 0 });
			const second = await service.add(bytes(2), origin, { storageBoxId: boxId, slot: 1 });
			await service.swap(first.recordId, second.recordId);
			expect(service.getRecord(first.recordId)?.placement).toEqual({
				storageBoxId: boxId,
				slot: 1
			});
			expect(service.getRecord(second.recordId)?.placement).toEqual({
				storageBoxId: boxId,
				slot: 0
			});
			expect(service.getRecord(first.recordId)?.payload).toEqual(first.payload);
			expect(service.getRecord(second.recordId)?.payload).toEqual(second.payload);
		});
		it('derives collisions and overflow without changing record placement', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const first = await service.add(bytes(8), origin);
			const boxId = service.listBoxes()[0].id;
			const manifest = service.current!;
			manifest.records = Array.from({ length: 31 }, (_, index) => ({
				...structuredClone(first),
				recordId: `record-${String(index).padStart(2, '0')}`,
				placement: { storageBoxId: boxId, slot: 0 }
			}));
			manifest.revision += 1;
			await persistence.commit(service.current!.revision, manifest, []);
			await service.load();
			const resolved = service.listResolvedPlacements();
			expect(resolved.filter((item) => item.overflow)).toHaveLength(1);
			expect(resolved[0].placement).toEqual({ storageBoxId: boxId, slot: 0 });
			expect(resolved[1].placement).toEqual({ storageBoxId: boxId, slot: 1 });
			expect(service.getRecord('record-01')?.placement).toEqual({ storageBoxId: boxId, slot: 0 });
			await expect(service.add(bytes(9), origin)).rejects.toThrow(/overflow/);
			await expect(
				service.place('record-01', { storageBoxId: 'missing-box', slot: 0 })
			).rejects.toThrow(/unavailable/);
			const extra = await service.addBox();
			expect(
				service.listResolvedPlacements().some((item) => item.placement?.storageBoxId === extra.id)
			).toBe(true);
			await expect(service.removeBox(extra.id)).rejects.toThrow(/empty/);
		});
		it('replaces a payload immutably without changing origin or independent copies', async () => {
			const persistence = create();
			const engine = fakeEngine();
			const service = new PokemonStorageService(persistence, engine);
			await service.initialize();
			const first = await service.add(bytes(5), origin);
			const copy = await service.copy(first.recordId);
			const updated = await service.replace(
				first.recordId,
				engine.editPayload(first.recordId, bytes(6))
			);
			expect(updated.payload.id).not.toBe(first.payload.id);
			expect(updated.recordId).toBe(first.recordId);
			expect(updated.origin).toEqual(first.origin);
			expect(service.getRecord(copy.recordId)?.payload.id).toBe(copy.payload.id);
			expect(await persistence.readBlob(first.payload)).not.toBeNull();
			expect(await service.readPayload(first.recordId)).not.toEqual(
				await persistence.readBlob(first.payload)
			);
			const current = await service.replaceCurrent(first.recordId, bytes(8));
			expect(current.recordId).toBe(first.recordId);
			expect(current.origin).toEqual(origin);
			expect(current.payload.id).not.toBe(updated.payload.id);
			expect(service.getRecord(copy.recordId)?.payload.id).toBe(copy.payload.id);
		});
		it.each([1, null])('keeps the latest placement after a move to %s', async (slot) => {
			const engine = fakeEngine();
			let resume!: () => void;
			let parsing!: () => void;
			const paused = new Promise<void>((resolve) => (resume = resolve));
			const started = new Promise<void>((resolve) => (parsing = resolve));
			const edited = { payload: null as Uint8Array | null };
			const service = new PokemonStorageService(create(), {
				...engine,
				async readPreservationPayload(payload) {
					if (payload === edited.payload) {
						parsing();
						await paused;
					}
					return engine.readPreservationPayload(payload);
				}
			});
			await service.initialize();
			const boxId = service.listBoxes()[0].id;
			const record = await service.add(bytes(1), origin, { storageBoxId: boxId, slot: 0 });
			edited.payload = engine.editPayload(record.recordId, bytes(2));
			const replacement = service.replace(record.recordId, edited.payload);
			await started;
			const placement = slot === null ? null : { storageBoxId: boxId, slot };
			await service.place(record.recordId, placement);
			await service.add(bytes(3), origin, { storageBoxId: boxId, slot: 0 });
			resume();
			expect((await replacement).placement).toEqual(placement);
			expect(service.listResolvedPlacements().every((item) => !item.displaced)).toBe(true);
		});
		it('rejects an edit based on a superseded payload', async () => {
			const engine = fakeEngine();
			let resume!: () => void;
			let parsing!: () => void;
			const paused = new Promise<void>((resolve) => (resume = resolve));
			const started = new Promise<void>((resolve) => (parsing = resolve));
			const delayed = { payload: null as Uint8Array | null };
			const service = new PokemonStorageService(create(), {
				...engine,
				async readPreservationPayload(payload) {
					if (payload === delayed.payload) {
						parsing();
						await paused;
					}
					return engine.readPreservationPayload(payload);
				}
			});
			await service.initialize();
			const record = await service.add(bytes(1), origin);
			delayed.payload = engine.editPayload(record.recordId, bytes(2));
			const stale = service.replace(record.recordId, delayed.payload);
			await started;
			const latest = await service.replace(
				record.recordId,
				engine.editPayload(record.recordId, bytes(3))
			);
			resume();
			await expect(stale).rejects.toThrow(/payload changed/);
			expect(service.getRecord(record.recordId)?.payload.id).toBe(latest.payload.id);
		});
		it('sweeps only uncommitted blobs after a conditional conflict', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const record = await service.add(bytes(7), origin);
			const orphan = bytes(9, 9);
			const reference = await referenceFor(orphan, 1);
			await expect(
				persistence.commit(0, { ...service.current!, revision: service.current!.revision + 1 }, [
					{ reference, bytes: orphan }
				])
			).rejects.toThrow();
			expect(await service.sweep()).toBe(name === 'browser' ? 1 : 0);
			expect(await persistence.readBlob(reference)).toBeNull();
			expect(await service.readPayload(record.recordId)).toBeTruthy();
		});
		it('rejects corrupted blob reads and sweeps unreferenced staged blobs', async () => {
			const persistence = create();
			const service = new PokemonStorageService(persistence, fakeEngine());
			await service.initialize();
			const record = await service.add(bytes(3), origin);
			await corrupt(persistence, record.payload.id);
			await expect(service.readPayload(record.recordId)).rejects.toThrow();
		});
		it('keeps box order and timestamps on the Storage root', async () => {
			const persistence = create();
			let now = 'created';
			const service = new PokemonStorageService(persistence, fakeEngine(), () => now);
			await service.initialize();
			const first = service.listBoxes()[0];
			now = 'added';
			const second = await service.addBox('Second');
			const before = service.current!;
			now = 'reordered';
			await service.reorderBoxes([second.id, first.id]);
			const after = service.current!;
			expect(after.boxOrder).toEqual([second.id, first.id]);
			expect(after.createdAt).toBe('created');
			expect(after.updatedAt).toBe('reordered');
			expect(after.revision).toBe(before.revision + 1);
			expect(after.boxes).toEqual(before.boxes);
			expect(service.listBoxes().map((box) => box.id)).toEqual(after.boxOrder);
			expect((await persistence.read())?.boxOrder).toEqual(after.boxOrder);
			await expect(
				persistence.commit(
					after.revision,
					{ ...after, revision: after.revision + 1, boxOrder: [first.id, first.id] },
					[]
				)
			).rejects.toThrow(/order/);
		});
		it('copies independent engine payloads with createMockEngine', async () => {
			const engine = createMockEngine();
			const service = new PokemonStorageService(create(), engine);
			await service.initialize();
			const first = await service.add(bytes(1, 2, 3), origin);
			const copy = await service.copy(first.recordId);
			expect(copy.recordId).not.toBe(first.recordId);
			expect(copy.identityFingerprint).toBe(first.identityFingerprint);
			expect(await service.readPayload(copy.recordId)).not.toEqual(
				await service.readPayload(first.recordId)
			);
			const copied = await engine.readPreservationPayload(await service.readPayload(copy.recordId));
			expect(copied).toMatchObject({
				ok: true,
				value: { summary: { recordId: copy.recordId }, entityBytes: bytes(1, 2, 3) }
			});
		});
	});
}
