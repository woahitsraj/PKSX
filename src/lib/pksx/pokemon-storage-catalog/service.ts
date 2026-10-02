import { base64ToBytes, type EngineApi } from '$lib/engine';
import type { StoredPokemonStorage } from '$lib/pksx/saves';
import { createStore, type Store } from 'tinybase';
import {
	assertManifest,
	cloneManifest,
	emptyManifest,
	referenceFor,
	resolvePlacements,
	verifyBlob,
	type CatalogPersistence,
	type Placement,
	type PokemonOrigin,
	type PokemonRecord,
	type PokemonStorageManifest,
	type StagedBlob,
	type StorageBox
} from './types';

export class PokemonStorageService {
	readonly #store: Store = createStore();
	#manifest: PokemonStorageManifest | null = null;
	constructor(
		private readonly persistence: CatalogPersistence,
		private readonly engine: Pick<
			EngineApi,
			| 'createPreservationPayload'
			| 'forkPreservationPayload'
			| 'readPreservationPayload'
			| 'replacePreservationPayloadCurrent'
		>,
		private readonly now = () => new Date().toISOString(),
		private readonly id: () => string = () => crypto.randomUUID()
	) {}

	async load(): Promise<PokemonStorageManifest | null> {
		const manifest = await this.persistence.read();
		if (manifest) assertManifest(manifest);
		this.#publish(manifest);
		return manifest ? cloneManifest(manifest) : null;
	}

	get current(): PokemonStorageManifest | null {
		return this.#manifest ? cloneManifest(this.#manifest) : null;
	}
	getRecord(recordId: string): PokemonRecord | null {
		return this.current?.records.find((record) => record.recordId === recordId) ?? null;
	}
	listRecords(): PokemonRecord[] {
		return this.current?.records ?? [];
	}
	listBoxes(): StorageBox[] {
		const manifest = this.current;
		return manifest?.boxOrder.map((id) => manifest.boxes.find((box) => box.id === id)!) ?? [];
	}
	listResolvedPlacements() {
		return this.#manifest ? structuredClone(resolvePlacements(this.#manifest)) : [];
	}
	listTombstones() {
		return this.current?.tombstones ?? [];
	}
	subscribe(listener: () => void): () => void {
		const id = this.#store.addTablesListener(listener);
		return () => this.#store.delListener(id);
	}

	async initialize(storageId: string = this.id()): Promise<PokemonStorageManifest> {
		const manifest = emptyManifest(storageId, this.now(), this.id());
		await this.persistence.commit(null, manifest, []);
		this.#publish(manifest);
		return cloneManifest(manifest);
	}

	async loadOrMigrate(
		readLegacy: () => Promise<StoredPokemonStorage | null>
	): Promise<PokemonStorageManifest> {
		const catalog = await this.load();
		if (catalog) return catalog;
		const legacy = await readLegacy();
		return legacy ? this.migrateLegacy(legacy) : this.initialize();
	}

	async migrateLegacy(legacy: StoredPokemonStorage): Promise<PokemonStorageManifest> {
		if (
			legacy.schemaVersion !== 1 ||
			legacy.boxes.length < 1 ||
			legacy.boxes.length !== legacy.boxCount ||
			legacy.boxSlotCount !== 30 ||
			new Set(legacy.boxes.map((box) => box.index)).size !== legacy.boxCount ||
			legacy.boxes.some(
				(box) =>
					box.index < 0 ||
					box.index >= legacy.boxCount ||
					box.slots.length !== 30 ||
					new Set(box.slots.map((slot) => slot.slot)).size !== 30 ||
					box.slots.some((slot) => slot.box !== box.index || slot.slot < 0 || slot.slot >= 30)
			)
		)
			throw new Error('Unsupported legacy Pokemon Storage layout.');
		const existing = await this.persistence.read();
		if (existing) {
			this.#publish(existing);
			return cloneManifest(existing);
		}
		const now = this.now();
		const boxes = [...legacy.boxes]
			.sort((a, b) => a.index - b.index)
			.map((box) => ({
				id: this.id(),
				name: box.name,
				revision: 0,
				createdAt: now,
				updatedAt: now
			}));
		const records: PokemonRecord[] = [];
		const blobs: StagedBlob[] = [];
		for (const [order, box] of [...legacy.boxes].sort((a, b) => a.index - b.index).entries()) {
			for (const slot of box.slots) {
				const pokemon = slot.pokemon;
				if (!pokemon) continue;
				if (!pokemon.entityBytesBase64)
					throw new Error('Legacy Pokemon preservation bytes are unavailable.');
				const entityBytes = base64ToBytes(pokemon.entityBytesBase64);
				const payload = await this.engine.createPreservationPayload(entityBytes);
				if (!payload.ok) throw payload.error;
				const read = await this.engine.readPreservationPayload(payload.value.bytes);
				if (!read.ok) throw read.error;
				if (
					read.value.entityBytes.length !== entityBytes.length ||
					read.value.entityBytes.some((byte, index) => byte !== entityBytes[index])
				)
					throw new Error('Migrated Pokemon content differs from its legacy source.');
				const projection = { ...read.value.projection };
				delete projection.entityBytesBase64;
				const reference = await referenceFor(payload.value.bytes, read.value.summary.version);
				records.push({
					recordId: read.value.summary.recordId,
					payload: reference,
					identityFingerprint: read.value.summary.identityFingerprint,
					projection,
					origin: { ...pokemon.origin, originSaveFileId: null },
					placement: { storageBoxId: boxes[order].id, slot: slot.slot },
					revision: 0,
					createdAt: pokemon.origin.enteredAt,
					updatedAt: now
				});
				blobs.push({ reference, bytes: payload.value.bytes });
			}
		}
		const manifest: PokemonStorageManifest = {
			schemaVersion: 1,
			storageId: this.id(),
			revision: 0,
			createdAt: now,
			updatedAt: now,
			boxOrder: boxes.map((box) => box.id),
			boxes,
			records,
			tombstones: []
		};
		assertManifest(manifest);
		await this.persistence.commit(null, manifest, blobs);
		this.#publish(manifest);
		return cloneManifest(manifest);
	}

	async add(
		entityBytes: Uint8Array,
		origin: PokemonOrigin,
		placement: Placement = null
	): Promise<PokemonRecord> {
		const result = await this.engine.createPreservationPayload(entityBytes);
		if (!result.ok) throw result.error;
		return this.#putPayload(result.value.bytes, origin, placement, null);
	}

	async copy(recordId: string, placement: Placement = null): Promise<PokemonRecord> {
		const source = this.#required(recordId);
		const bytes = await this.readPayload(recordId);
		const result = await this.engine.forkPreservationPayload(bytes);
		if (!result.ok) throw result.error;
		return this.#putPayload(result.value.bytes, source.origin, placement, null);
	}

	async replace(recordId: string, payloadBytes: Uint8Array): Promise<PokemonRecord> {
		const source = this.#required(recordId);
		return this.#putPayload(payloadBytes, source.origin, null, recordId, source.payload.id);
	}

	async replaceCurrent(recordId: string, entityBytes: Uint8Array): Promise<PokemonRecord> {
		const source = this.#required(recordId);
		const payloadBytes = await this.readPayload(recordId);
		const result = await this.engine.replacePreservationPayloadCurrent(payloadBytes, entityBytes);
		if (!result.ok) throw result.error;
		return this.#putPayload(result.value.bytes, source.origin, source.placement, recordId);
	}

	async readPayload(recordId: string): Promise<Uint8Array> {
		const record = this.#required(recordId);
		const bytes = await this.persistence.readBlob(record.payload);
		if (!bytes) throw new Error('Pokemon preservation payload is missing.');
		await verifyBlob(record.payload, bytes);
		return bytes;
	}

	async place(recordId: string, placement: Placement): Promise<void> {
		await this.#mutate((manifest) => {
			const record = manifest.records.find((item) => item.recordId === recordId);
			if (!record) throw new Error('Pokemon Record ID is unavailable.');
			if (placement && !manifest.boxes.some((box) => box.id === placement.storageBoxId))
				throw new Error('Storage Box is unavailable.');
			if (placement && this.#occupied(manifest, placement, recordId))
				throw new Error('Storage Slot is occupied.');
			record.placement = placement;
			record.revision += 1;
			record.updatedAt = this.now();
		});
	}

	async swap(firstId: string, secondId: string): Promise<void> {
		await this.#mutate((manifest) => {
			const first = manifest.records.find((record) => record.recordId === firstId);
			const second = manifest.records.find((record) => record.recordId === secondId);
			const placements = resolvePlacements(manifest);
			const firstPlacement = placements.find((item) => item.recordId === firstId)?.placement;
			const secondPlacement = placements.find((item) => item.recordId === secondId)?.placement;
			if (!first || !second || !firstPlacement || !secondPlacement || firstId === secondId)
				throw new Error('Storage Slot swap is unavailable.');
			first.placement = secondPlacement;
			second.placement = firstPlacement;
			first.revision += 1;
			second.revision += 1;
			first.updatedAt = second.updatedAt = this.now();
		});
	}

	async addBox(name: string | null = null): Promise<StorageBox> {
		let added!: StorageBox;
		await this.#mutate((manifest) => {
			const now = this.now();
			added = {
				id: this.id(),
				name,
				revision: 0,
				createdAt: now,
				updatedAt: now
			};
			manifest.boxes.push(added);
			manifest.boxOrder.push(added.id);
		});
		return { ...added };
	}

	async renameBox(boxId: string, name: string | null): Promise<void> {
		await this.#mutate((manifest) => {
			const box = manifest.boxes.find((item) => item.id === boxId);
			if (!box) throw new Error('Storage Box is unavailable.');
			box.name = name;
			box.revision += 1;
			box.updatedAt = this.now();
		});
	}

	async reorderBoxes(boxIds: string[]): Promise<void> {
		await this.#mutate((manifest) => {
			if (
				boxIds.length !== manifest.boxes.length ||
				new Set(boxIds).size !== boxIds.length ||
				boxIds.some((id) => !manifest.boxes.some((box) => box.id === id))
			)
				throw new Error('Storage Box order is invalid.');
			manifest.boxOrder = [...boxIds];
		});
	}

	async removeBox(boxId: string): Promise<void> {
		await this.#mutate((manifest) => {
			if (manifest.boxes.length === 1) throw new Error('Pokemon Storage requires one Storage Box.');
			if (
				manifest.records.some((record) => record.placement?.storageBoxId === boxId) ||
				resolvePlacements(manifest).some((item) => item.placement?.storageBoxId === boxId)
			)
				throw new Error('Storage Box must be empty.');
			const index = manifest.boxes.findIndex((box) => box.id === boxId);
			if (index < 0) throw new Error('Storage Box is unavailable.');
			manifest.boxes.splice(index, 1);
			manifest.boxOrder = manifest.boxOrder.filter((id) => id !== boxId);
		});
	}

	async retire(
		recordId: string,
		reason: 'cleared' | 'moved-to-save',
		destinationSaveFileId: string | null = null
	): Promise<void> {
		if (
			(reason === 'moved-to-save' && !destinationSaveFileId?.trim()) ||
			(reason === 'cleared' && destinationSaveFileId !== null)
		)
			throw new Error('Pokemon deletion destination does not match its reason.');
		await this.#mutate((manifest) => {
			const index = manifest.records.findIndex((record) => record.recordId === recordId);
			if (index < 0) throw new Error('Pokemon Record ID is unavailable.');
			const [record] = manifest.records.splice(index, 1);
			manifest.tombstones.push({
				recordId,
				reason,
				destinationSaveFileId,
				deletedAt: this.now(),
				revision: record.revision + 1
			});
		});
	}

	async sweep(): Promise<number> {
		return this.persistence.sweep();
	}

	async #putPayload(
		bytes: Uint8Array,
		origin: PokemonOrigin,
		placement: Placement,
		replacing: string | null,
		expectedPayloadId: string | null = null
	): Promise<PokemonRecord> {
		const parsed = await this.engine.readPreservationPayload(bytes);
		if (!parsed.ok) throw parsed.error;
		const { summary, projection } = parsed.value;
		const structuredProjection = { ...projection };
		delete structuredProjection.entityBytesBase64;
		if (replacing && summary.recordId !== replacing)
			throw new Error('Edited payload changed its Record ID.');
		if (replacing) {
			const previousPayload = await this.readPayload(replacing);
			const previous = await this.engine.readPreservationPayload(previousPayload);
			if (!previous.ok) throw previous.error;
			if (
				previous.value.summary.originalEntitySha256 !== summary.originalEntitySha256 ||
				previous.value.summary.identityFingerprint !== summary.identityFingerprint
			)
				throw new Error('Edited payload changed its preserved Pokemon identity or original bytes.');
		}
		const reference = await referenceFor(bytes, summary.version);
		let saved!: PokemonRecord;
		await this.#mutate(
			(manifest) => {
				const previous = manifest.records.find((record) => record.recordId === summary.recordId);
				if (
					Boolean(previous) !== Boolean(replacing) ||
					manifest.tombstones.some((item) => item.recordId === summary.recordId)
				)
					throw new Error('Pokemon Record ID already exists or is retired.');
				if (previous && previous.payload.id !== expectedPayloadId)
					throw new Error('Pokemon preservation payload changed. Reload before retrying.');
				if (!previous && resolvePlacements(manifest).some((item) => item.overflow))
					throw new Error('Resolve Pokemon Storage overflow before adding a Pokemon.');
				if (!previous && manifest.records.length >= manifest.boxes.length * 30)
					throw new Error('Pokemon Storage is at capacity.');
				if (
					!previous &&
					placement &&
					!manifest.boxes.some((box) => box.id === placement.storageBoxId)
				)
					throw new Error('Storage Box is unavailable.');
				if (!previous && placement && this.#occupied(manifest, placement, summary.recordId))
					throw new Error('Storage Slot is occupied.');
				const now = this.now();
				saved = {
					recordId: summary.recordId,
					payload: reference,
					identityFingerprint: summary.identityFingerprint,
					projection: structuredProjection,
					origin: previous?.origin ?? structuredClone(origin),
					placement: previous ? previous.placement : placement,
					revision: (previous?.revision ?? -1) + 1,
					createdAt: previous?.createdAt ?? now,
					updatedAt: now
				};
				if (previous) manifest.records[manifest.records.indexOf(previous)] = saved;
				else manifest.records.push(saved);
			},
			[{ reference, bytes }]
		);
		return structuredClone(saved);
	}

	#required(recordId: string): PokemonRecord {
		const record = this.#manifest?.records.find((item) => item.recordId === recordId);
		if (!record) throw new Error('Pokemon Record ID is unavailable.');
		return record;
	}

	#occupied(manifest: PokemonStorageManifest, placement: NonNullable<Placement>, except: string) {
		const matches = (candidate: Placement) =>
			candidate?.storageBoxId === placement.storageBoxId && candidate.slot === placement.slot;
		return (
			manifest.records.some((record) => record.recordId !== except && matches(record.placement)) ||
			resolvePlacements(manifest).some(
				(record) => record.recordId !== except && matches(record.placement)
			)
		);
	}

	async #mutate(
		change: (manifest: PokemonStorageManifest) => void,
		blobs: StagedBlob[] = []
	): Promise<void> {
		if (!this.#manifest) throw new Error('Pokemon Storage catalog is not initialized.');
		const next = cloneManifest(this.#manifest);
		change(next);
		next.revision += 1;
		next.updatedAt = this.now();
		assertManifest(next);
		await this.persistence.commit(this.#manifest.revision, next, blobs);
		this.#publish(next);
	}

	#publish(manifest: PokemonStorageManifest | null): void {
		this.#manifest = manifest ? cloneManifest(manifest) : null;
		this.#store.transaction(() => {
			this.#store.delTables();
			if (!manifest) return;
			this.#store.setRow('catalog', manifest.storageId, {
				schemaVersion: manifest.schemaVersion,
				revision: manifest.revision,
				createdAt: manifest.createdAt,
				updatedAt: manifest.updatedAt,
				boxOrder: JSON.stringify(manifest.boxOrder)
			});
			for (const box of manifest.boxes)
				this.#store.setRow('boxes', box.id, {
					name: box.name ?? '',
					revision: box.revision,
					createdAt: box.createdAt,
					updatedAt: box.updatedAt
				});
			for (const record of manifest.records)
				this.#store.setRow('records', record.recordId, {
					payloadId: record.payload.id,
					payloadSha256: record.payload.sha256,
					payloadByteLength: record.payload.byteLength,
					payloadFormat: record.payload.format,
					payloadSchemaVersion: record.payload.schemaVersion,
					identityFingerprint: record.identityFingerprint,
					createdAt: record.createdAt,
					updatedAt: record.updatedAt,
					projection: JSON.stringify(record.projection),
					origin: JSON.stringify(record.origin),
					storageBoxId: record.placement?.storageBoxId ?? '',
					slot: record.placement?.slot ?? -1,
					revision: record.revision
				});
			for (const item of manifest.tombstones)
				this.#store.setRow('tombstones', item.recordId, {
					reason: item.reason,
					destinationSaveFileId: item.destinationSaveFileId ?? '',
					deletedAt: item.deletedAt,
					revision: item.revision
				});
		});
	}
}
