import { base64ToBytes, type EngineApi } from '$lib/engine';
import type { StoredPokemonStorage } from '$lib/pksx/saves';
import { createStore, type Store } from 'tinybase';
import { decodeStorageArchive, encodeStorageArchive } from './archive';
import {
	assertManifest,
	cloneManifest,
	CatalogOutcomeUnknownError,
	emptyManifest,
	referenceFor,
	recoveryAvailable,
	referencedPayloads,
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

export type CatalogCarrySource = {
	storageId: string;
	recordId: string;
	revision: number;
	payloadId: string;
	placement: Placement;
};

type RecordUndo = {
	recordId: string;
	before: Placement;
	after: Placement;
	beforeRevision: number;
	expectedRevision: number;
};
type UndoEntry =
	| { kind: 'placement'; records: RecordUndo[] }
	| {
			kind: 'rename';
			boxId: string;
			before: string | null;
			after: string | null;
			beforeRevision: number;
			expectedRevision: number;
	  }
	| { kind: 'order'; before: string[]; after: string[] }
	| { kind: 'delete-box'; box: StorageBox; before: string[]; after: string[] };

const samePlacement = (a: Placement, b: Placement) =>
	a?.storageBoxId === b?.storageBoxId && a?.slot === b?.slot;
const sameOrder = (a: string[], b: string[]) =>
	a.length === b.length && a.every((id, index) => id === b[index]);

export class PokemonStorageService {
	readonly #store: Store = createStore();
	#manifest: PokemonStorageManifest | null = null;
	#pendingReplacement = false;
	#undo: UndoEntry[] = [];
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
		this.#pendingReplacement = false;
		if (this.#manifest?.storageId !== manifest?.storageId) this.#undo = [];
		this.#publish(manifest);
		return manifest ? cloneManifest(manifest) : null;
	}

	get current(): PokemonStorageManifest | null {
		return this.#manifest ? cloneManifest(this.#manifest) : null;
	}
	get canUndo(): boolean {
		return !this.#pendingReplacement && this.#undo.length > 0;
	}
	async exportArchive(): Promise<Uint8Array> {
		this.#assertReady();
		if (!this.#manifest) throw new Error('Pokemon Storage catalog is not initialized.');
		return encodeStorageArchive(
			this.#manifest,
			await this.#collectBlobs(this.#manifest),
			this.now()
		);
	}
	async inspectArchive(bytes: Uint8Array) {
		const archive = await decodeStorageArchive(bytes);
		await this.#validateArchivePayloads(archive.manifest, archive.blobs);
		return {
			exportedAt: archive.exportedAt,
			pokemonCount: archive.manifest.records.length,
			boxCount: archive.manifest.boxes.length,
			recentlyDeletedCount: archive.manifest.tombstones.filter((item) => item.recovery).length
		};
	}
	async restoreArchive(bytes: Uint8Array): Promise<void> {
		const archive = await decodeStorageArchive(bytes);
		await this.#validateArchivePayloads(archive.manifest, archive.blobs);
		await this.#replaceCollection(archive.manifest, archive.blobs);
	}
	async preRestoreRecovery() {
		return this.persistence.readRecovery();
	}
	async recoverPreRestore(): Promise<void> {
		const recovery = await this.persistence.readRecovery();
		if (!recovery) throw new Error('No pre-restore Pokemon Storage snapshot is available.');
		const blobs = await this.#collectBlobs(recovery.manifest);
		await this.#validateArchivePayloads(recovery.manifest, blobs);
		await this.#replaceCollection(recovery.manifest, blobs);
	}
	async #replaceCollection(source: PokemonStorageManifest, blobs: StagedBlob[]) {
		this.#assertReady();
		const current = this.#manifest;
		if (!current) throw new Error('Pokemon Storage catalog is not initialized.');
		await this.#collectBlobs(current);
		const next = cloneManifest(source);
		next.storageId = current.storageId;
		next.revision = current.revision + 1;
		next.createdAt = current.createdAt;
		next.updatedAt = this.now();
		try {
			await this.persistence.replace(current.revision, next, blobs, {
				createdAt: this.now(),
				manifest: cloneManifest(current)
			});
		} catch (error) {
			if (error instanceof CatalogOutcomeUnknownError) {
				this.#pendingReplacement = true;
				this.#undo = [];
			}
			throw error;
		}
		this.#publish(next);
		this.#undo = [];
	}
	#assertReady() {
		if (this.#pendingReplacement) throw new CatalogOutcomeUnknownError();
	}
	async #collectBlobs(manifest: PokemonStorageManifest): Promise<StagedBlob[]> {
		const references = new Map(referencedPayloads(manifest).map((item) => [item.id, item]));
		const blobs: StagedBlob[] = [];
		for (const reference of references.values()) {
			const bytes = await this.persistence.readBlob(reference);
			if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
			await verifyBlob(reference, bytes);
			blobs.push({ reference, bytes });
		}
		return blobs;
	}
	async #validateArchivePayloads(manifest: PokemonStorageManifest, blobs: StagedBlob[]) {
		const byId = new Map(blobs.map((blob) => [blob.reference.id, blob.bytes]));
		for (const record of [
			...manifest.records,
			...manifest.tombstones.flatMap((item) => (item.recovery ? [item.recovery] : []))
		]) {
			const bytes = byId.get(record.payload.id);
			if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
			const parsed = await this.engine.readPreservationPayload(bytes);
			if (
				!parsed.ok ||
				parsed.value.summary.recordId !== record.recordId ||
				parsed.value.summary.identityFingerprint !== record.identityFingerprint ||
				parsed.value.summary.version !== record.payload.schemaVersion
			)
				throw new Error('Pokemon Storage archive payload does not match its record.');
		}
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
	listRecentlyDeleted() {
		return this.listTombstones().filter((item) => recoveryAvailable(item, this.now()));
	}
	subscribe(listener: () => void): () => void {
		const id = this.#store.addTablesListener(listener);
		return () => this.#store.delListener(id);
	}

	async initialize(storageId: string = this.id()): Promise<PokemonStorageManifest> {
		const manifest = emptyManifest(storageId, this.now(), this.id());
		await this.persistence.commit(null, manifest, []);
		this.#undo = [];
		this.#publish(manifest);
		return cloneManifest(manifest);
	}

	async loadOrMigrate(
		readLegacy: () => Promise<StoredPokemonStorage | null>
	): Promise<PokemonStorageManifest> {
		const catalog = await this.load();
		if (catalog) {
			await this.expireRecoveries().catch(() => undefined);
			return this.current!;
		}
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
		this.#undo = [];
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

	carrySource(recordId: string): CatalogCarrySource {
		const record = this.#required(recordId);
		const placement =
			this.listResolvedPlacements().find((item) => item.recordId === recordId)?.placement ?? null;
		return {
			storageId: this.#manifest!.storageId,
			recordId,
			revision: record.revision,
			payloadId: record.payload.id,
			placement
		};
	}

	assertCarrySource(source: CatalogCarrySource): void {
		if (!this.#manifest) throw new Error('Pokemon Storage catalog is not initialized.');
		this.#checkCarrySource(this.#manifest, source);
	}

	async assertDurableCarrySource(source: CatalogCarrySource): Promise<void> {
		const manifest = await this.persistence.read();
		if (!manifest) throw new Error('Pokemon Storage source changed.');
		this.#checkCarrySource(manifest, source);
	}

	async commitCarry(
		source: CatalogCarrySource,
		mode: 'move' | 'copy',
		destination: NonNullable<Placement>
	): Promise<void> {
		if (mode === 'copy') {
			const bytes = await this.readPayload(source.recordId);
			const fork = await this.engine.forkPreservationPayload(bytes);
			if (!fork.ok) throw fork.error;
			await this.#putPayload(
				fork.value.bytes,
				this.#required(source.recordId).origin,
				destination,
				null,
				null,
				(manifest) => this.#checkCarrySource(manifest, source)
			);
			return;
		}
		await this.#mutate((manifest) => {
			const record = this.#checkCarrySource(manifest, source);
			if (!manifest.boxes.some((box) => box.id === destination.storageBoxId))
				throw new Error('Storage Box is unavailable.');
			const placements = resolvePlacements(manifest);
			const occupant = placements.find(
				(item) =>
					item.placement?.storageBoxId === destination.storageBoxId &&
					item.placement.slot === destination.slot
			);
			if (occupant?.recordId === source.recordId) return;
			if (occupant) {
				if (!source.placement) throw new Error('Choose an empty destination Slot.');
				const other = manifest.records.find((item) => item.recordId === occupant.recordId)!;
				if (!other.placement) throw new Error('Storage Slot swap is unavailable.');
				other.placement = { ...source.placement };
				other.revision += 1;
				other.updatedAt = this.now();
			}
			record.placement = destination;
			record.revision += 1;
			record.updatedAt = this.now();
		});
	}

	#checkCarrySource(manifest: PokemonStorageManifest, source: CatalogCarrySource): PokemonRecord {
		return requireCarrySource(manifest, source);
	}

	async replace(recordId: string, payloadBytes: Uint8Array): Promise<PokemonRecord> {
		const source = this.#required(recordId);
		return this.#putPayload(payloadBytes, source.origin, null, recordId, source.payload.id);
	}

	async replaceCurrent(recordId: string, entityBytes: Uint8Array): Promise<PokemonRecord> {
		const source = this.#required(recordId);
		const payloadBytes = await this.persistence.readBlob(source.payload);
		if (!payloadBytes) throw new Error('Pokemon preservation payload is missing.');
		await verifyBlob(source.payload, payloadBytes);
		const result = await this.engine.replacePreservationPayloadCurrent(payloadBytes, entityBytes);
		if (!result.ok) throw result.error;
		return this.#putPayload(result.value.bytes, source.origin, null, recordId, source.payload.id);
	}

	async readPayload(recordId: string): Promise<Uint8Array> {
		const record = this.#required(recordId);
		const bytes = await this.persistence.readBlob(record.payload);
		if (!bytes) throw new Error('Pokemon preservation payload is missing.');
		await verifyBlob(record.payload, bytes);
		return bytes;
	}

	async place(recordId: string, placement: Placement): Promise<void> {
		await this.#mutate(
			(manifest) => {
				const record = manifest.records.find((item) => item.recordId === recordId);
				if (!record) throw new Error('Pokemon Record ID is unavailable.');
				if (placement && !manifest.boxes.some((box) => box.id === placement.storageBoxId))
					throw new Error('Storage Box is unavailable.');
				if (placement && this.#occupied(manifest, placement, recordId))
					throw new Error('Storage Slot is occupied.');
				record.placement = placement;
				record.revision += 1;
				record.updatedAt = this.now();
			},
			[],
			(before, after) => ({
				kind: 'placement',
				records: [this.#recordUndo(before, after, recordId)]
			})
		);
	}

	async storeAutomatically(
		recordId: string,
		lastUsedBoxId: string | null,
		expectedRevision: number
	): Promise<NonNullable<Placement>> {
		let destination!: NonNullable<Placement>;
		await this.#mutate((manifest) => {
			const record = manifest.records.find((item) => item.recordId === recordId);
			if (!record) throw new Error('Pokemon Record ID is unavailable.');
			if (record.revision !== expectedRevision)
				throw new Error('Pokemon record changed. Reload before retrying.');
			const occupied = new Set(
				[
					...manifest.records.map((item) => item.placement),
					...resolvePlacements(manifest).map((item) => item.placement)
				]
					.filter((placement): placement is NonNullable<Placement> => placement !== null)
					.map((placement) => `${placement.storageBoxId}:${placement.slot}`)
			);
			const start = Math.max(0, manifest.boxOrder.indexOf(lastUsedBoxId ?? ''));
			for (let offset = 0; offset < manifest.boxOrder.length && !destination; offset += 1) {
				const storageBoxId = manifest.boxOrder[(start + offset) % manifest.boxOrder.length];
				for (let slot = 0; slot < 30; slot += 1) {
					const candidate = { storageBoxId, slot };
					if (!occupied.has(`${storageBoxId}:${slot}`)) {
						destination = candidate;
						break;
					}
				}
			}
			if (!destination) {
				const now = this.now();
				const storageBoxId = this.id();
				manifest.boxes.push({
					id: storageBoxId,
					name: null,
					revision: 0,
					createdAt: now,
					updatedAt: now
				});
				manifest.boxOrder.push(storageBoxId);
				destination = { storageBoxId, slot: 0 };
			}
			record.placement = destination;
			record.revision += 1;
			record.updatedAt = this.now();
		});
		return destination;
	}

	async swap(firstId: string, secondId: string): Promise<void> {
		await this.#mutate(
			(manifest) => {
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
			},
			[],
			(before, after) => ({
				kind: 'placement',
				records: [
					this.#recordUndo(before, after, firstId),
					this.#recordUndo(before, after, secondId)
				]
			})
		);
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
		await this.#mutate(
			(manifest) => {
				const box = manifest.boxes.find((item) => item.id === boxId);
				if (!box) throw new Error('Storage Box is unavailable.');
				box.name = name;
				box.revision += 1;
				box.updatedAt = this.now();
			},
			[],
			(before, after) => {
				const previous = before.boxes.find((box) => box.id === boxId)!;
				const current = after.boxes.find((box) => box.id === boxId)!;
				return {
					kind: 'rename',
					boxId,
					before: previous.name,
					after: current.name,
					beforeRevision: previous.revision,
					expectedRevision: current.revision
				};
			}
		);
	}

	async reorderBoxes(boxIds: string[]): Promise<void> {
		await this.#mutate(
			(manifest) => {
				if (
					boxIds.length !== manifest.boxes.length ||
					new Set(boxIds).size !== boxIds.length ||
					boxIds.some((id) => !manifest.boxes.some((box) => box.id === id))
				)
					throw new Error('Storage Box order is invalid.');
				manifest.boxOrder = [...boxIds];
			},
			[],
			(before, after) => ({ kind: 'order', before: before.boxOrder, after: after.boxOrder })
		);
	}

	async removeBox(boxId: string): Promise<void> {
		await this.#mutate(
			(manifest) => {
				if (manifest.boxes.length === 1)
					throw new Error('Pokemon Storage requires one Storage Box.');
				if (
					manifest.records.some((record) => record.placement?.storageBoxId === boxId) ||
					resolvePlacements(manifest).some((item) => item.placement?.storageBoxId === boxId)
				)
					throw new Error('Storage Box must be empty.');
				const index = manifest.boxes.findIndex((box) => box.id === boxId);
				if (index < 0) throw new Error('Storage Box is unavailable.');
				manifest.boxes.splice(index, 1);
				manifest.boxOrder = manifest.boxOrder.filter((id) => id !== boxId);
			},
			[],
			(before, after) => ({
				kind: 'delete-box',
				box: before.boxes.find((box) => box.id === boxId)!,
				before: before.boxOrder,
				after: after.boxOrder
			})
		);
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
				revision: record.revision + 1,
				...(reason === 'cleared' ? { recovery: record } : {})
			});
		});
	}

	async prepareSaveDeletion(
		entityBytes: Uint8Array,
		origin: PokemonOrigin
	): Promise<{
		expectedRevision: number;
		recordId: string;
		manifest: PokemonStorageManifest;
		payload: StagedBlob;
	}> {
		if (!this.#manifest) throw new Error('Pokemon Storage catalog is not initialized.');
		const created = await this.engine.createPreservationPayload(entityBytes);
		if (!created.ok) throw created.error;
		const read = await this.engine.readPreservationPayload(created.value.bytes);
		if (!read.ok) throw read.error;
		if (
			read.value.entityBytes.length !== entityBytes.length ||
			read.value.entityBytes.some((byte, index) => byte !== entityBytes[index])
		)
			throw new Error('Preserved Pokemon bytes differ from the Save File Slot.');
		const { summary, projection } = read.value;
		const cleanProjection = { ...projection };
		delete cleanProjection.entityBytesBase64;
		const reference = await referenceFor(created.value.bytes, summary.version);
		const manifest = cloneManifest(this.#manifest);
		if (
			manifest.records.some((record) => record.recordId === summary.recordId) ||
			manifest.tombstones.some((item) => item.recordId === summary.recordId)
		)
			throw new Error('Pokemon Record ID already exists or is retired.');
		const now = this.now();
		const recovery: PokemonRecord = {
			recordId: summary.recordId,
			payload: reference,
			identityFingerprint: summary.identityFingerprint,
			projection: cleanProjection,
			origin: {
				...origin,
				originSaveSlot: origin.originSaveSlot ? { ...origin.originSaveSlot } : null
			},
			placement: null,
			revision: 0,
			createdAt: now,
			updatedAt: now
		};
		manifest.tombstones.push({
			recordId: summary.recordId,
			reason: 'cleared',
			destinationSaveFileId: null,
			deletedAt: now,
			revision: 1,
			recovery
		});
		manifest.revision += 1;
		manifest.updatedAt = now;
		assertManifest(manifest);
		return {
			expectedRevision: this.#manifest.revision,
			recordId: summary.recordId,
			manifest,
			payload: { reference, bytes: created.value.bytes }
		};
	}

	async readPersistedSaveDeletion(recordId: string): Promise<PokemonStorageManifest | null> {
		const manifest = await this.persistence.read();
		const recovery = manifest?.tombstones.find((item) => item.recordId === recordId)?.recovery;
		if (!recovery) return null;
		const bytes = await this.persistence.readBlob(recovery.payload);
		if (!bytes) throw new Error('Committed Pokemon preservation payload is missing.');
		await verifyBlob(recovery.payload, bytes);
		return manifest;
	}

	publishCommittedDeletion(manifest: PokemonStorageManifest): void {
		this.#publish(manifest);
	}

	async restore(recordId: string): Promise<PokemonRecord> {
		const recovery = this.#manifest?.tombstones.find(
			(item) => item.recordId === recordId
		)?.recovery;
		if (!recovery) throw new Error('Pokemon recovery is unavailable.');
		const bytes = await this.persistence.readBlob(recovery.payload);
		if (!bytes) throw new Error('Pokemon preservation payload is missing.');
		await verifyBlob(recovery.payload, bytes);
		let restored!: PokemonRecord;
		await this.#mutate((manifest) => {
			const index = manifest.tombstones.findIndex((item) => item.recordId === recordId);
			const tombstone = manifest.tombstones[index];
			if (!tombstone || !recoveryAvailable(tombstone, this.now()) || !tombstone.recovery)
				throw new Error('Pokemon recovery is unavailable.');
			if (manifest.records.length >= manifest.boxes.length * 30)
				throw new Error('Pokemon Storage is at capacity.');
			if (resolvePlacements(manifest).some((item) => item.overflow))
				throw new Error('Resolve Pokemon Storage overflow before restoring a Pokemon.');
			const previous = tombstone.recovery.placement;
			const placement =
				previous &&
				manifest.boxes.some((box) => box.id === previous.storageBoxId) &&
				!this.#occupied(manifest, previous, recordId)
					? previous
					: null;
			restored = {
				...tombstone.recovery,
				placement,
				revision: tombstone.revision + 1,
				updatedAt: this.now()
			};
			manifest.tombstones.splice(index, 1);
			manifest.records.push(restored);
		});
		return structuredClone(restored);
	}

	async deletePermanently(recordId: string): Promise<void> {
		await this.#mutate((manifest) => {
			const tombstone = manifest.tombstones.find((item) => item.recordId === recordId);
			if (!tombstone?.recovery) throw new Error('Pokemon recovery is unavailable.');
			delete tombstone.recovery;
			tombstone.revision += 1;
		});
		void this.persistence.sweep().catch(() => undefined);
	}

	async emptyRecentlyDeleted(): Promise<void> {
		await this.#mutate((manifest) => {
			for (const tombstone of manifest.tombstones) {
				if (!tombstone.recovery) continue;
				delete tombstone.recovery;
				tombstone.revision += 1;
			}
		});
		void this.persistence.sweep().catch(() => undefined);
	}

	async expireRecoveries(): Promise<void> {
		if (
			!this.#manifest?.tombstones.some(
				(item) => item.recovery && !recoveryAvailable(item, this.now())
			)
		)
			return;
		await this.#mutate((manifest) => {
			for (const tombstone of manifest.tombstones) {
				if (tombstone.recovery && !recoveryAvailable(tombstone, this.now())) {
					delete tombstone.recovery;
					tombstone.revision += 1;
				}
			}
		});
		void this.persistence.sweep().catch(() => undefined);
	}

	async sweep(): Promise<number> {
		return this.persistence.sweep();
	}

	async #putPayload(
		bytes: Uint8Array,
		origin: PokemonOrigin,
		placement: Placement,
		replacing: string | null,
		expectedPayloadId: string | null = null,
		guard?: (manifest: PokemonStorageManifest) => void
	): Promise<PokemonRecord> {
		this.#assertReady();
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
				guard?.(manifest);
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

	#recordUndo(
		before: PokemonStorageManifest,
		after: PokemonStorageManifest,
		recordId: string
	): RecordUndo {
		const previous = before.records.find((record) => record.recordId === recordId)!;
		const current = after.records.find((record) => record.recordId === recordId)!;
		return {
			recordId,
			before: previous.placement,
			after: current.placement,
			beforeRevision: previous.revision,
			expectedRevision: current.revision
		};
	}

	async undo(): Promise<void> {
		const entry = this.#undo.at(-1);
		if (!entry) throw new Error('There is no Pokemon Storage change to undo.');
		await this.#mutate((manifest) => {
			const stale = () => {
				throw new Error('Pokemon Storage changed. This undo is no longer available.');
			};
			if (entry.kind === 'placement') {
				const affected = new Set(entry.records.map((item) => item.recordId));
				for (const item of entry.records) {
					const record = manifest.records.find((candidate) => candidate.recordId === item.recordId);
					if (
						!record ||
						record.revision !== item.expectedRevision ||
						!samePlacement(record.placement, item.after)
					)
						stale();
					if (item.before && !manifest.boxes.some((box) => box.id === item.before?.storageBoxId))
						stale();
				}
				const resolved = resolvePlacements(manifest);
				for (const item of entry.records) {
					if (!item.before) continue;
					if (
						manifest.records.some(
							(record) =>
								!affected.has(record.recordId) && samePlacement(record.placement, item.before)
						) ||
						resolved.some(
							(record) =>
								!affected.has(record.recordId) && samePlacement(record.placement, item.before)
						)
					)
						throw new Error('The former Storage Slot is occupied.');
				}
				for (const item of entry.records) {
					const record = manifest.records.find(
						(candidate) => candidate.recordId === item.recordId
					)!;
					record.placement = item.before;
					record.revision += 1;
					record.updatedAt = this.now();
				}
			} else if (entry.kind === 'rename') {
				const box = manifest.boxes.find((item) => item.id === entry.boxId);
				if (!box || box.revision !== entry.expectedRevision || box.name !== entry.after)
					throw new Error('Pokemon Storage changed. This undo is no longer available.');
				box.name = entry.before;
				box.revision += 1;
				box.updatedAt = this.now();
			} else if (entry.kind === 'order') {
				const ids = new Set(entry.after);
				if (
					!sameOrder(
						manifest.boxOrder.filter((id) => ids.has(id)),
						entry.after
					)
				)
					stale();
				let index = 0;
				manifest.boxOrder = manifest.boxOrder.map((id) =>
					ids.has(id) ? entry.before[index++] : id
				);
			} else {
				if (
					manifest.boxes.some((box) => box.id === entry.box.id) ||
					manifest.records.some((record) => record.placement?.storageBoxId === entry.box.id)
				)
					stale();
				const ids = new Set(entry.after);
				if (
					!sameOrder(
						manifest.boxOrder.filter((id) => ids.has(id)),
						entry.after
					)
				)
					stale();
				const nextId = entry.before[entry.before.indexOf(entry.box.id) + 1];
				const previousId = entry.before[entry.before.indexOf(entry.box.id) - 1];
				const insertAt = nextId
					? manifest.boxOrder.indexOf(nextId)
					: manifest.boxOrder.indexOf(previousId) + 1;
				if (insertAt < 0) stale();
				manifest.boxes.push(structuredClone(entry.box));
				manifest.boxOrder.splice(insertAt, 0, entry.box.id);
			}
		});
		this.#undo.pop();
		if (entry.kind === 'placement') {
			for (const item of entry.records) {
				for (let index = this.#undo.length - 1; index >= 0; index -= 1) {
					const older = this.#undo[index];
					if (older.kind !== 'placement') continue;
					const record = older.records.find((candidate) => candidate.recordId === item.recordId);
					if (
						record?.expectedRevision === item.beforeRevision &&
						samePlacement(record.after, item.before)
					) {
						record.expectedRevision = this.#required(item.recordId).revision;
						break;
					}
				}
			}
		} else if (entry.kind === 'rename') {
			for (let index = this.#undo.length - 1; index >= 0; index -= 1) {
				const older = this.#undo[index];
				if (
					older.kind === 'rename' &&
					older.boxId === entry.boxId &&
					older.expectedRevision === entry.beforeRevision &&
					older.after === entry.before
				) {
					older.expectedRevision = this.#manifest!.boxes.find(
						(box) => box.id === entry.boxId
					)!.revision;
					break;
				}
			}
		}
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
		blobs: StagedBlob[] = [],
		undo?: (before: PokemonStorageManifest, after: PokemonStorageManifest) => UndoEntry
	): Promise<void> {
		this.#assertReady();
		if (!this.#manifest) throw new Error('Pokemon Storage catalog is not initialized.');
		const before = this.#manifest;
		const next = cloneManifest(before);
		change(next);
		next.revision += 1;
		next.updatedAt = this.now();
		assertManifest(next);
		await this.persistence.commit(before.revision, next, blobs);
		if (undo) this.#undo.push(undo(before, next));
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

export function requireCarrySource(
	manifest: PokemonStorageManifest,
	source: CatalogCarrySource
): PokemonRecord {
	const record = manifest.records.find((item) => item.recordId === source.recordId);
	const placement =
		resolvePlacements(manifest).find((item) => item.recordId === source.recordId)?.placement ??
		null;
	if (
		manifest.storageId !== source.storageId ||
		!record ||
		record.revision !== source.revision ||
		record.payload.id !== source.payloadId ||
		placement?.storageBoxId !== source.placement?.storageBoxId ||
		placement?.slot !== source.placement?.slot
	)
		throw new Error('Pokemon Storage source changed.');
	return record;
}
