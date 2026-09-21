import { describe, expect, it, vi } from 'vitest';
import { createMockEngine, type SaveWorkspace, type SlotOperationResult } from '$lib/engine';
import {
	createCleanWorkspaceState,
	prepareAutomaticBackup,
	type WorkspaceState
} from '$lib/pksx/backup-workflow';
import { applyPokemonAction } from '$lib/pksx/pokemon-actions';
import {
	applySaveFileLegalityFixBatch,
	type SaveFileLegalityFixableEntry
} from '$lib/pksx/save-file-legality-report';
import { CapacitorSavesStorage, type NativeFileStore } from '$lib/pksx/saves/capacitor-storage';
import { WorkspaceRevisionConflictError } from '$lib/pksx/saves';
import { SaveFileEditCoordinator } from '$lib/pksx/save-file-edit-coordinator';
import { applyStorageOperation } from '$lib/pksx/storage-operations';

describe('automatic Backup mutation integration', () => {
	it('repairs a stale cached marker from authoritative storage before Engine work', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const prepared = await prepareAutomaticBackup({
			storage,
			state: { ...state, automaticBackupCreated: true },
			reason: 'trainer-editing'
		});

		expect(prepared.established).toBe(true);
		expect(prepared.state.automaticBackupCreated).toBe(true);
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
		expect((await storage.getWorkspace(state.file.id))?.automaticBackupCreated).toBe(true);
	});

	it('creates one stable Backup after storage and coordinator recreation', async () => {
		const backend = createFileBackend();
		const firstStorage = createStorage(backend);
		const state = await importWorkspace(firstStorage);
		const engine = createMockEngine({
			applySaveFileEditOperation: vi.fn(async () => ({
				ok: true as const,
				value: { bytes: new Uint8Array([2]), workspace: state.workspace, mutated: true },
				error: null
			}))
		});
		backend.failCatalogWrites = 1;
		const firstCoordinator = new SaveFileEditCoordinator({ storage: firstStorage, engine });
		await expect(
			firstCoordinator.enqueueEdit(firstCoordinator.openWorkspace(state), {
				key: 'money',
				operation: { money: 200 }
			})
		).resolves.toMatchObject({ ok: false, code: 'backup-write-failed' });
		expect([...backend.values.keys()].filter((path) => path.startsWith('backups/'))).toEqual([]);

		const recreatedStorage = createStorage(backend);
		const recreatedCoordinator = new SaveFileEditCoordinator({
			storage: recreatedStorage,
			engine
		});
		await expect(
			recreatedCoordinator.enqueueEdit(recreatedCoordinator.openWorkspace(state), {
				key: 'money',
				operation: { money: 200 }
			})
		).resolves.toMatchObject({ ok: true, status: 'committed' });
		expect(await recreatedStorage.listBackups(state.file.id)).toHaveLength(1);
		expect([...backend.values.keys()].filter((path) => path.startsWith('backups/'))).toHaveLength(
			1
		);
	});

	it('rejects reverse stale overwrite from a Slot operation after a concurrent Workspace write', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const started = deferred<void>();
		const engineResult = deferred<{
			ok: true;
			value: SlotOperationResult;
			error: null;
		}>();
		const engine = createMockEngine({
			applySlotOperation: vi.fn(async () => {
				started.resolve();
				return engineResult.promise;
			})
		});
		const pending = applyStorageOperation({
			state,
			operation: {
				kind: 'move',
				source: { zone: 'box', box: 0, slot: 0 },
				destination: { zone: 'box', box: 0, slot: 1 }
			},
			activeBox: 0,
			sourceSlot: { kind: 'pokemon' },
			destinationSlot: { kind: 'empty' },
			partyCount: 1,
			services: {
				engine,
				prepareAutomaticBackup: (workspace) =>
					prepareAutomaticBackup({ storage, state: workspace, reason: 'pokemon-movement' }),
				persistWorkspace: async (workspace, expectedUpdatedAt) => {
					await storage.putWorkspace({
						saveFileId: workspace.file.id,
						bytes: workspace.bytes,
						dirty: workspace.dirty,
						automaticBackupCreated: workspace.automaticBackupCreated,
						expectedUpdatedAt
					});
				},
				locationForSlotRef: () => 'Box 1'
			}
		});
		await started.promise;
		const prepared = await storage.getWorkspace(state.file.id);
		if (!prepared) throw new Error('Expected prepared Workspace.');
		const concurrent = await storage.putWorkspace({
			saveFileId: state.file.id,
			bytes: new Uint8Array([9]),
			dirty: true,
			automaticBackupCreated: true,
			expectedUpdatedAt: prepared.updatedAt
		});
		engineResult.resolve({
			ok: true,
			value: { bytes: new Uint8Array([2]), workspace: state.workspace, mutated: true },
			error: null
		});

		await expect(pending).rejects.toBeInstanceOf(WorkspaceRevisionConflictError);
		expect(await storage.getWorkspace(state.file.id)).toEqual(concurrent);
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
	});

	it('rejects reverse stale overwrite from a Pokemon action after a concurrent Workspace write', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const started = deferred<void>();
		const engineResult = deferred<ReturnType<typeof successfulPokemonAction>>();
		const engine = createMockEngine({
			applyPokemonAction: vi.fn(async () => {
				started.resolve();
				return engineResult.promise;
			})
		});
		const pending = applyPokemonAction(
			engine,
			{
				owner: 'save-file',
				workspace: state,
				source: { zone: 'box', box: 0, slot: 0 },
				activeBox: 0
			},
			{ kind: 'legality-fix' },
			{
				prepareAutomaticBackup: (workspace, reason) =>
					prepareAutomaticBackup({ storage, state: workspace, reason }),
				persistWorkspace: async (workspace, expectedUpdatedAt) => {
					await storage.putWorkspace({
						saveFileId: workspace.file.id,
						bytes: workspace.bytes,
						dirty: workspace.dirty,
						automaticBackupCreated: workspace.automaticBackupCreated,
						expectedUpdatedAt
					});
				},
				persistStoredPokemon: vi.fn()
			}
		);
		await started.promise;
		const prepared = await storage.getWorkspace(state.file.id);
		if (!prepared) throw new Error('Expected prepared Workspace.');
		const concurrent = await storage.putWorkspace({
			saveFileId: state.file.id,
			bytes: new Uint8Array([9]),
			dirty: true,
			automaticBackupCreated: true,
			expectedUpdatedAt: prepared.updatedAt
		});
		engineResult.resolve(successfulPokemonAction(state.workspace));

		await expect(pending).rejects.toBeInstanceOf(WorkspaceRevisionConflictError);
		expect(await storage.getWorkspace(state.file.id)).toEqual(concurrent);
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
	});

	it('exports the Workspace bytes committed by the native adapter', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const engine = createMockEngine({
			applySaveFileEditOperation: vi.fn(async () => ({
				ok: true as const,
				value: { bytes: new Uint8Array([2]), workspace: saveWorkspace(), mutated: true },
				error: null
			}))
		});
		const coordinator = new SaveFileEditCoordinator({ storage, engine });
		const origin = coordinator.openWorkspace(state);

		await expect(
			coordinator.enqueueEdit(origin, { key: 'money', operation: { money: 200 } })
		).resolves.toMatchObject({ ok: true, status: 'committed' });

		expect(await coordinator.export(origin)).toEqual(new Uint8Array([2]));
	});

	it('retains one automatic Backup and its marker when Engine work fails', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const engine = createMockEngine({
			applySaveFileEditOperation: vi.fn(async () => {
				throw new Error('worker stopped');
			})
		});
		const coordinator = new SaveFileEditCoordinator({ storage, engine });
		const origin = coordinator.openWorkspace(state);

		await expect(
			coordinator.enqueueEdit(origin, { key: 'money', operation: { money: 200 } })
		).resolves.toMatchObject({ ok: false, code: 'engine-unavailable' });

		const workspace = await storage.getWorkspace(state.file.id);
		expect(workspace).toMatchObject({
			bytes: new Uint8Array([1]),
			dirty: false,
			automaticBackupCreated: true
		});
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
	});

	it('keeps batch Legality Fix bytes uncommitted when a later Pokemon fails', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const preview = legalityFixBatchPreview();
		const applyPokemonAction = vi
			.fn()
			.mockResolvedValueOnce(successfulPokemonAction(state.workspace, 2))
			.mockResolvedValueOnce({
				ok: false,
				value: null,
				error: { code: 'stale-pokemon-action-preview', message: 'Second preview is stale.' }
			});

		const result = await applySaveFileLegalityFixBatch({
			engine: createMockEngine({ applyPokemonAction }),
			workspace: state,
			preview,
			activeBox: 0,
			isCurrent: () => true,
			prepareAutomaticBackup: (workspace) =>
				prepareAutomaticBackup({ storage, state: workspace, reason: 'legality-fix' }),
			persistWorkspace: (workspace, expectedUpdatedAt) =>
				storage
					.putWorkspace({
						saveFileId: workspace.file.id,
						bytes: workspace.bytes,
						dirty: workspace.dirty,
						automaticBackupCreated: workspace.automaticBackupCreated,
						expectedUpdatedAt
					})
					.then(() => undefined)
		});

		expect(result).toMatchObject({ status: 'error', message: 'Second preview is stale.' });
		expect(applyPokemonAction).toHaveBeenCalledTimes(2);
		expect(await storage.getWorkspace(state.file.id)).toMatchObject({
			bytes: new Uint8Array([1]),
			dirty: false,
			automaticBackupCreated: true
		});
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
	});

	it('rejects a reverse stale batch commit after a concurrent Workspace write', async () => {
		const storage = createStorage();
		const state = await importWorkspace(storage);
		const started = deferred<void>();
		const engineResult = deferred<ReturnType<typeof successfulPokemonAction>>();
		const entry = legalityFixEntry('Pikachu', 0);
		const engine = createMockEngine({
			applyPokemonAction: vi.fn(async () => {
				started.resolve();
				return engineResult.promise;
			})
		});
		const pending = applySaveFileLegalityFixBatch({
			engine,
			workspace: state,
			preview: {
				status: 'complete',
				entries: [entry]
			},
			activeBox: 0,
			isCurrent: () => true,
			prepareAutomaticBackup: (workspace) =>
				prepareAutomaticBackup({ storage, state: workspace, reason: 'legality-fix' }),
			persistWorkspace: (workspace, expectedUpdatedAt) =>
				storage
					.putWorkspace({
						saveFileId: workspace.file.id,
						bytes: workspace.bytes,
						dirty: workspace.dirty,
						automaticBackupCreated: workspace.automaticBackupCreated,
						expectedUpdatedAt
					})
					.then(() => undefined)
		});
		await started.promise;
		const prepared = await storage.getWorkspace(state.file.id);
		if (!prepared) throw new Error('Expected prepared Workspace.');
		const concurrent = await storage.putWorkspace({
			saveFileId: state.file.id,
			bytes: new Uint8Array([9]),
			dirty: true,
			automaticBackupCreated: true,
			expectedUpdatedAt: prepared.updatedAt
		});
		engineResult.resolve(successfulPokemonAction(state.workspace, 2));

		await expect(pending).resolves.toMatchObject({
			status: 'error',
			message: 'The persisted Workspace changed before this write.'
		});
		expect(await storage.getWorkspace(state.file.id)).toEqual(concurrent);
		expect(await storage.listBackups(state.file.id)).toHaveLength(1);
	});
});

function legalityFixBatchPreview() {
	return {
		status: 'complete' as const,
		entries: [legalityFixEntry('Pikachu', 0), legalityFixEntry('Mew', 1)]
	};
}

function legalityFixEntry(pokemonLabel: string, slot: number): SaveFileLegalityFixableEntry {
	return {
		result: {
			id: `party:${slot}`,
			source: { zone: 'party', slot },
			location: `Party, Slot ${slot + 1}`,
			pokemonLabel,
			speciesName: pokemonLabel,
			classification: 'illegal',
			firstIssue: 'Example issue.',
			report: {
				legal: false,
				judgement: 'Illegal',
				summary: 'This Pokemon has legality issues.',
				fixableProblems: ['Move Set'],
				warnings: [],
				messages: []
			}
		},
		status: 'fixable',
		operation: { kind: 'legality-fix', choiceId: `fix:${slot}` },
		changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
	};
}

async function importWorkspace(storage: CapacitorSavesStorage): Promise<WorkspaceState> {
	const bytes = new Uint8Array([1]);
	const file = await storage.importSave({ bytes, originalFileName: 'emerald.sav' });
	return createCleanWorkspaceState({ file, bytes, workspace: saveWorkspace() });
}

type FileBackend = {
	values: Map<string, string | Uint8Array>;
	fileStore: NativeFileStore;
	failCatalogWrites: number;
};

function createFileBackend(): FileBackend {
	const backend = {
		values: new Map<string, string | Uint8Array>(),
		fileStore: null as unknown as NativeFileStore,
		failCatalogWrites: 0
	};
	const fileStore: NativeFileStore = {
		async readText(path) {
			const value = backend.values.get(path);
			return typeof value === 'string' ? value : null;
		},
		async writeText(path, value) {
			if (path.startsWith('catalog.') && backend.failCatalogWrites > 0) {
				backend.failCatalogWrites -= 1;
				throw new Error('catalog unavailable');
			}
			backend.values.set(path, value);
		},
		async readBytes(path) {
			const value = backend.values.get(path);
			return value instanceof Uint8Array ? new Uint8Array(value) : null;
		},
		async writeBytes(path, value) {
			backend.values.set(path, new Uint8Array(value));
		},
		async delete(path) {
			backend.values.delete(path);
		},
		async list(path) {
			const prefix = `${path}/`;
			return [
				...new Set(
					[...backend.values.keys()]
						.filter((candidate) => candidate.startsWith(prefix))
						.map((candidate) => candidate.slice(prefix.length).split('/')[0])
				)
			];
		}
	};
	backend.fileStore = fileStore;
	return backend;
}

function createStorage(backend = createFileBackend()) {
	return new CapacitorSavesStorage({
		fileStore: backend.fileStore,
		idFactory: () => 'save-1',
		now: () => '2026-09-10T12:00:00.000Z'
	});
}

function saveWorkspace(): SaveWorkspace {
	return {
		summary: {
			saveType: 'SAV3E',
			gameVersion: 'E',
			gameVersionId: 3,
			generation: 3,
			trainerName: 'RED',
			trainerId: 1,
			playTime: '1:00',
			playedHours: 1,
			playedMinutes: 0,
			partyCount: 1,
			boxCount: 1,
			boxSlotCount: 30
		},
		partySlots: [],
		boxSlots: [],
		boxNames: { supported: true, names: ['BOX 1'], unsupportedReason: null },
		saveFile: {
			trainerProfile: {
				trainerName: 'RED',
				trainerNameSupported: true,
				trainerNameMaxLength: 7,
				trainerNameUnsupportedReason: null,
				gender: 'male',
				genderSupported: true,
				genderUnsupportedReason: null,
				trainerId: 1,
				gameVersion: 'E',
				generation: 3
			},
			money: { value: 100, min: 0, max: 999999, supported: true, unsupportedReason: null },
			inventory: { supported: true, unsupportedReason: null, pockets: [] }
		}
	};
}

function successfulPokemonAction(workspace: SaveWorkspace, byte = 2) {
	return {
		ok: true as const,
		value: {
			bytes: new Uint8Array([byte]),
			workspace,
			mutated: true,
			changes: []
		},
		error: null
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((accept) => {
		resolve = accept;
	});
	return { promise, resolve };
}
