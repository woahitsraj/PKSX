import type { BoxSlotSummary, SaveSlotRef } from '$lib/engine';

export const POKEMON_STORAGE_CATALOG_VERSION = 1;
export type BlobReference = {
	id: string;
	sha256: string;
	byteLength: number;
	format: 'pkhex-preservation-payload';
	schemaVersion: number;
};
export type PokemonOrigin = {
	entryMode: 'moved-in' | 'copied-in' | 'imported' | 'transferred-in' | 'deleted-from-save';
	originSaveFileId: string | null;
	originSaveSlot?: SaveSlotRef | null;
	originSaveFileName: string | null;
	originGame: string | null;
	originalTrainer: string | null;
	trainerId: string | null;
	enteredAt: string;
};
export type Placement = { storageBoxId: string; slot: number } | null;
export type PokemonRecord = {
	recordId: string;
	payload: BlobReference;
	identityFingerprint: string;
	projection: Omit<BoxSlotSummary, 'entityBytesBase64'>;
	origin: PokemonOrigin;
	placement: Placement;
	revision: number;
	createdAt: string;
	updatedAt: string;
};
export type StorageBox = {
	id: string;
	name: string | null;
	revision: number;
	createdAt: string;
	updatedAt: string;
};
export type DeletionTombstone = {
	recordId: string;
	reason: 'cleared' | 'moved-to-save';
	destinationSaveFileId: string | null;
	deletedAt: string;
	revision: number;
	recovery?: PokemonRecord;
};
export const RECOVERY_DAYS = 30;
export function recoveryAvailable(tombstone: DeletionTombstone, now: string): boolean {
	return Boolean(
		tombstone.reason === 'cleared' &&
		tombstone.recovery &&
		Date.parse(tombstone.deletedAt) + RECOVERY_DAYS * 86400000 > Date.parse(now)
	);
}
export function referencedPayloads(manifest: PokemonStorageManifest): BlobReference[] {
	return [
		...manifest.records.map((record) => record.payload),
		...manifest.tombstones.flatMap((item) => (item.recovery ? [item.recovery.payload] : []))
	];
}
export type PokemonStorageManifest = {
	schemaVersion: typeof POKEMON_STORAGE_CATALOG_VERSION;
	storageId: string;
	revision: number;
	createdAt: string;
	updatedAt: string;
	boxOrder: string[];
	boxes: StorageBox[];
	records: PokemonRecord[];
	tombstones: DeletionTombstone[];
};
export type StagedBlob = { reference: BlobReference; bytes: Uint8Array };
export type StorageRecovery = { createdAt: string; manifest: PokemonStorageManifest };
export type CatalogPersistence = {
	read(): Promise<PokemonStorageManifest | null>;
	readBlob(reference: BlobReference): Promise<Uint8Array | null>;
	commit(
		expectedRevision: number | null,
		manifest: PokemonStorageManifest,
		blobs: StagedBlob[]
	): Promise<void>;
	readRecovery(): Promise<StorageRecovery | null>;
	replace(
		expectedRevision: number,
		manifest: PokemonStorageManifest,
		blobs: StagedBlob[],
		recovery: StorageRecovery
	): Promise<void>;
	sweep(): Promise<number>;
};
export class CatalogConflictError extends Error {
	constructor() {
		super('Pokemon Storage changed. Reload before retrying.');
	}
}
export class CatalogOutcomeUnknownError extends Error {
	constructor() {
		super('Pokemon Storage replacement is awaiting confirmation. Reload before changing Storage.');
	}
}
export async function referenceFor(
	bytes: Uint8Array,
	schemaVersion: number
): Promise<BlobReference> {
	const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
	const sha256 = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	return {
		id: sha256,
		sha256,
		byteLength: bytes.byteLength,
		format: 'pkhex-preservation-payload',
		schemaVersion
	};
}
export async function verifyBlob(reference: BlobReference, bytes: Uint8Array): Promise<void> {
	const actual = await referenceFor(bytes, reference.schemaVersion);
	if (
		reference.format !== actual.format ||
		reference.id !== actual.id ||
		reference.sha256 !== actual.sha256 ||
		reference.byteLength !== actual.byteLength
	) {
		throw new Error('Pokemon preservation payload checksum or format mismatch.');
	}
}
export function emptyManifest(
	storageId: string,
	now: string,
	boxId: string
): PokemonStorageManifest {
	return {
		schemaVersion: POKEMON_STORAGE_CATALOG_VERSION,
		storageId,
		revision: 0,
		createdAt: now,
		updatedAt: now,
		boxOrder: [boxId],
		boxes: [{ id: boxId, name: null, revision: 0, createdAt: now, updatedAt: now }],
		records: [],
		tombstones: []
	};
}
export function assertManifest(manifest: PokemonStorageManifest): void {
	if (
		manifest.schemaVersion !== POKEMON_STORAGE_CATALOG_VERSION ||
		!manifest.storageId ||
		!Number.isSafeInteger(manifest.revision) ||
		!manifest.createdAt ||
		!manifest.updatedAt
	)
		throw new Error('Unsupported Pokemon Storage catalog version.');
	if (manifest.boxes.length < 1) throw new Error('Pokemon Storage requires one Storage Box.');
	const boxes = new Set<string>();
	for (const box of manifest.boxes) {
		if (boxes.has(box.id)) throw new Error('Duplicate Storage Box ID.');
		boxes.add(box.id);
	}
	if (
		!Array.isArray(manifest.boxOrder) ||
		manifest.boxOrder.length !== boxes.size ||
		new Set(manifest.boxOrder).size !== boxes.size ||
		manifest.boxOrder.some((id) => !boxes.has(id))
	)
		throw new Error('Storage root Box order is invalid.');
	const records = new Set<string>();
	for (const record of manifest.records) {
		if (records.has(record.recordId)) throw new Error('Duplicate Pokemon Record ID.');
		records.add(record.recordId);
		const payload = record.payload;
		if (
			payload.format !== 'pkhex-preservation-payload' ||
			payload.id !== payload.sha256 ||
			!/^[a-f0-9]{64}$/.test(payload.sha256) ||
			!Number.isSafeInteger(payload.byteLength) ||
			payload.byteLength < 1 ||
			!Number.isSafeInteger(payload.schemaVersion) ||
			payload.schemaVersion < 1
		)
			throw new Error('Invalid preservation payload reference.');
		if (record.placement) {
			if (
				!Number.isInteger(record.placement.slot) ||
				record.placement.slot < 0 ||
				record.placement.slot >= 30
			)
				throw new Error('Invalid Storage Slot.');
		}
	}
	const deleted = new Set<string>();
	for (const tombstone of manifest.tombstones) {
		if (records.has(tombstone.recordId) || deleted.has(tombstone.recordId))
			throw new Error('Invalid Pokemon deletion tombstone.');
		if (
			(tombstone.reason === 'moved-to-save' && !tombstone.destinationSaveFileId?.trim()) ||
			(tombstone.reason === 'cleared' && tombstone.destinationSaveFileId !== null) ||
			(tombstone.reason !== 'moved-to-save' && tombstone.reason !== 'cleared')
		)
			throw new Error('Pokemon deletion destination does not match its reason.');
		if (
			!Number.isFinite(Date.parse(tombstone.deletedAt)) ||
			(tombstone.recovery &&
				(tombstone.reason !== 'cleared' || tombstone.recovery.recordId !== tombstone.recordId))
		)
			throw new Error('Invalid Pokemon deletion recovery.');
		deleted.add(tombstone.recordId);
	}
}
export type ResolvedPlacement = {
	recordId: string;
	placement: Placement;
	displaced: boolean;
	overflow: boolean;
};
export function resolvePlacements(manifest: PokemonStorageManifest): ResolvedPlacement[] {
	const boxes = manifest.boxOrder.map((id) => manifest.boxes.find((box) => box.id === id)!);
	const slots = boxes.flatMap((box) =>
		Array.from({ length: 30 }, (_, slot) => ({ storageBoxId: box.id, slot }))
	);
	const used = new Set<string>();
	const result = new Map<string, ResolvedPlacement>();
	const displaced: PokemonRecord[] = [];
	for (const record of [...manifest.records].sort((a, b) => a.recordId.localeCompare(b.recordId))) {
		const placement = record.placement;
		if (!placement) {
			result.set(record.recordId, {
				recordId: record.recordId,
				placement: null,
				displaced: false,
				overflow: false
			});
			continue;
		}
		const key = `${placement.storageBoxId}:${placement.slot}`;
		if (!boxes.some((box) => box.id === placement.storageBoxId) || used.has(key)) {
			displaced.push(record);
			continue;
		}
		used.add(key);
		result.set(record.recordId, {
			recordId: record.recordId,
			placement,
			displaced: false,
			overflow: false
		});
	}
	for (const record of displaced) {
		const start = slots.findIndex(
			(slot) =>
				slot.storageBoxId === record.placement?.storageBoxId && slot.slot === record.placement?.slot
		);
		const ordered = [
			...slots.slice(start < 0 ? 0 : start + 1),
			...slots.slice(0, start < 0 ? 0 : start + 1)
		];
		const placement =
			ordered.find((slot) => !used.has(`${slot.storageBoxId}:${slot.slot}`)) ?? null;
		if (placement) used.add(`${placement.storageBoxId}:${placement.slot}`);
		result.set(record.recordId, {
			recordId: record.recordId,
			placement,
			displaced: true,
			overflow: !placement
		});
	}
	return [...result.values()].sort((a, b) => a.recordId.localeCompare(b.recordId));
}

export function cloneManifest(manifest: PokemonStorageManifest): PokemonStorageManifest {
	return structuredClone(manifest);
}
