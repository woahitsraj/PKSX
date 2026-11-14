import { base64ToBytes, type EngineApi } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import type { PokemonStorageService } from '$lib/pksx/pokemon-storage-catalog';
import { bytesEqual, type SavesStorage } from '$lib/pksx/saves';

export class BatchCommitUncertainError extends Error {
	constructor() {
		super('Batch persistence could not be verified. Reload before retrying.');
	}
}

export type BatchSource = { box: number; slot: number };
export type SaveStorageBatch = Awaited<ReturnType<typeof previewSaveStorageBatch>>;

export async function previewSaveStorageBatch(input: {
	state: WorkspaceState;
	sources: BatchSource[];
	mode: 'copy' | 'move';
	startingBoxId: string;
	engine: EngineApi;
	catalog: PokemonStorageService;
}) {
	const { state, sources, mode, startingBoxId, engine, catalog } = input;
	if (
		!sources.length ||
		new Set(sources.map((ref) => `${ref.box}:${ref.slot}`)).size !== sources.length
	)
		throw new Error('Select distinct occupied Box Slots.');
	const items = [];
	const labels: string[] = [];
	for (const box of new Set(sources.map((ref) => ref.box))) {
		const loaded = await engine.loadSaveWorkspace(
			state.bytes,
			state.file.originalFileName ?? undefined,
			box
		);
		if (!loaded.ok) throw loaded.error;
		for (const source of sources.filter((ref) => ref.box === box)) {
			const slot = loaded.value.boxSlots.find(
				(item) => item.box === box && item.slot === source.slot
			);
			if (!slot || slot.isEmpty || !slot.entityBytesBase64)
				throw new Error('A selected Slot changed or has no Pokemon bytes. Select Pokemon again.');
			items.push({
				bytes: base64ToBytes(slot.entityBytesBase64),
				origin: {
					entryMode: mode === 'move' ? ('moved-in' as const) : ('copied-in' as const),
					originSaveFileId: state.file.id,
					originSaveSlot: { zone: 'box' as const, ...source },
					originSaveFileName: state.file.originalFileName,
					originGame: loaded.value.summary.gameVersion,
					originalTrainer: slot.originalTrainer ?? loaded.value.summary.trainerName ?? null,
					trainerId: String(loaded.value.summary.trainerId),
					enteredAt: new Date().toISOString()
				}
			});
			labels.push(`Box ${box + 1}, Slot ${source.slot + 1}`);
		}
	}
	const prepared = await catalog.prepareSaveBatch(items, startingBoxId);
	let bytes = state.bytes;
	let workspace = state.workspace;
	if (mode === 'move') {
		for (const source of sources) {
			const result = await engine.applySlotOperation(
				bytes,
				state.file.originalFileName ?? undefined,
				{ kind: 'clear', source: { zone: 'box', ...source } },
				source.box
			);
			if (!result.ok) throw result.error;
			if (
				!result.value.mutated ||
				!result.value.workspace.boxSlots.find(
					(slot) => slot.box === source.box && slot.slot === source.slot
				)?.isEmpty
			)
				throw new Error('The engine could not clear a selected Slot. Nothing was applied.');
			bytes = result.value.bytes;
			workspace = result.value.workspace;
		}
	}
	return { state, mode, prepared, bytes, workspace, labels };
}

export async function applySaveStorageBatch(
	batch: SaveStorageBatch,
	storage: SavesStorage,
	catalog: PokemonStorageService
): Promise<WorkspaceState> {
	if (!storage.commitPreservedSaveDeletion)
		throw new Error('Atomic batch transfers are unavailable on this platform.');
	const { state, prepared } = batch;
	const owner = await storage.getSave(state.file.id);
	if (!owner || owner.importedAt !== state.file.importedAt)
		throw new Error('The source Save File changed. Preview again.');
	const previous = await storage.getWorkspace(owner.id);
	const currentBytes = previous?.bytes ?? (await storage.getSaveBytes(owner.id));
	if (
		!currentBytes ||
		!bytesEqual(currentBytes, state.bytes) ||
		(previous?.dirty ?? false) !== state.dirty ||
		(previous?.automaticBackupCreated ?? false) !== state.automaticBackupCreated
	)
		throw new Error('The source Save File changed. Select Pokemon and preview again.');
	const [payload, ...additionalPayloads] = prepared.payloads;
	if (!payload) throw new Error('No Pokemon were prepared.');
	try {
		await storage.commitPreservedSaveDeletion({
			saveFileId: owner.id,
			importedAt: owner.importedAt,
			expectedUpdatedAt: previous?.updatedAt ?? null,
			expectedBytes: state.bytes,
			expectedDirty: state.dirty,
			bytes: batch.bytes,
			dirty: batch.mode === 'move' || state.dirty,
			reason: 'pokemon-movement',
			expectedCatalogRevision: prepared.expectedRevision,
			manifest: prepared.manifest,
			payload,
			additionalPayloads,
			preserveWorkspace: batch.mode === 'copy'
		});
	} catch (error) {
		try {
			const manifest = await catalog.load();
			const workspace = await storage.getWorkspace(owner.id);
			const expectedWorkspace = batch.mode === 'copy' ? state.bytes : batch.bytes;
			const persistedBytes = workspace?.bytes ?? (await storage.getSaveBytes(owner.id));
			const committed =
				manifest?.revision === prepared.manifest.revision &&
				prepared.manifest.records.every((record) =>
					manifest.records.some(
						(item) => item.recordId === record.recordId && item.payload.id === record.payload.id
					)
				) &&
				persistedBytes &&
				bytesEqual(persistedBytes, expectedWorkspace);
			if (committed) {
				for (const record of prepared.manifest.records.slice(-prepared.payloads.length))
					await catalog.readPayload(record.recordId);
			} else if (
				manifest?.revision === prepared.expectedRevision &&
				persistedBytes &&
				bytesEqual(persistedBytes, state.bytes) &&
				(workspace?.updatedAt ?? null) === (previous?.updatedAt ?? null)
			)
				throw error;
			else throw new BatchCommitUncertainError();
		} catch (reconciliationError) {
			if (reconciliationError === error) throw error;
			throw new BatchCommitUncertainError();
		}
	}
	try {
		await catalog.load();
	} catch {
		throw new BatchCommitUncertainError();
	}
	return batch.mode === 'copy'
		? state
		: {
				...state,
				bytes: batch.bytes,
				workspace: batch.workspace,
				dirty: true,
				automaticBackupCreated: true,
				restoredFromBackup: null
			};
}
