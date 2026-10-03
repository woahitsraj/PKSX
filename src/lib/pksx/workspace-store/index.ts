import { base64ToBytes, type EngineApi } from '$lib/engine';
import {
	createCleanWorkspaceState,
	createPersistedWorkspaceState,
	type WorkspaceState
} from '$lib/pksx/backup-workflow';
import { bytesEqual, type SavesStorage, type SaveFileId } from '$lib/pksx/saves';
import { createStore, type Store } from 'tinybase';
import type { WorkspaceStorePersistence } from './persistence';
import {
	WORKSPACE_PARSER_VERSION,
	WORKSPACE_SCHEMA_VERSION,
	workspaceTablesSchema,
	workspaceValuesSchema
} from './schema';

type WorkspaceArtifactContext = {
	bytes: Uint8Array;
};

export type ActiveWorkspaceServiceOptions = {
	storage: SavesStorage;
	engine: EngineApi | (() => EngineApi);
	persistence?: WorkspaceStorePersistence;
};

export class ActiveWorkspaceService {
	readonly store: Store;
	private artifact: WorkspaceArtifactContext | null = null;
	private currentState: WorkspaceState | null = null;
	private readonly listeners = new Set<(state: WorkspaceState | null) => void>();
	private persistQueue = Promise.resolve();

	constructor(private readonly options: ActiveWorkspaceServiceOptions) {
		this.store = createStore()
			.setTablesSchema(workspaceTablesSchema)
			.setValuesSchema(workspaceValuesSchema);
	}

	async start() {
		const content = await this.options.persistence?.load();
		if (content) this.store.setContent(content);
		this.store.setValues({
			schemaVersion: WORKSPACE_SCHEMA_VERSION,
			parserVersion: WORKSPACE_PARSER_VERSION
		});
	}

	get current() {
		return this.currentState;
	}

	subscribe(listener: (state: WorkspaceState | null) => void) {
		this.listeners.add(listener);
		listener(this.currentState);
		return () => {
			this.listeners.delete(listener);
		};
	}

	async hydrate(saveFileId: SaveFileId, activeBox = 0) {
		const state = await this.load(saveFileId, activeBox);
		if (state) this.set(state, activeBox);
		return state;
	}

	async load(saveFileId: SaveFileId, activeBox = 0) {
		const [file, persisted] = await Promise.all([
			this.options.storage.getSave(saveFileId),
			this.options.storage.getWorkspace(saveFileId)
		]);
		const bytes = persisted?.bytes ?? (await this.options.storage.getSaveBytes(saveFileId));
		if (!file || !bytes) return null;

		const result = await this.engine.loadSaveWorkspace(
			bytes,
			file.originalFileName ?? undefined,
			activeBox
		);
		if (!result.ok) throw result.error;

		const state = persisted
			? createPersistedWorkspaceState({
					file,
					bytes,
					workspace: result.value,
					dirty: persisted.dirty,
					automaticBackupCreated: persisted.automaticBackupCreated
				})
			: createCleanWorkspaceState({ file, bytes, workspace: result.value });
		return state;
	}

	set(state: WorkspaceState | null, activeBox = 0) {
		if (!state) {
			this.artifact = null;
			this.currentState = null;
			this.store.transaction(() => {
				this.store.delTables().setValues({ activeSaveFileId: '', dirty: false });
			});
			this.queuePersist();
			this.publish();
			return;
		}

		this.artifact = {
			bytes: new Uint8Array(state.bytes)
		};
		const saveFileId = state.file.id;
		const { partySlots, boxSlots, ...workspaceProjection } = state.workspace;
		this.store.transaction(() => {
			this.store.delTables();
			this.store.setRow('workspaces', saveFileId, {
				saveFileId,
				activeBox,
				projection: JSON.stringify(workspaceProjection),
				restoredFromBackup: JSON.stringify(state.restoredFromBackup),
				automaticBackupCreated: state.automaticBackupCreated
			});
			for (let index = 0; index < state.workspace.summary.boxCount; index += 1) {
				this.store.setRow('boxes', `${saveFileId}:${index}`, { saveFileId, index });
			}
			for (const slot of partySlots) {
				const rowId = `${saveFileId}:party:${slot.slot}`;
				const projection = { ...slot };
				delete projection.entityBytesBase64;
				this.store.setRow('slots', rowId, {
					saveFileId,
					zone: 'party',
					box: -1,
					slot: slot.slot,
					projection: JSON.stringify(projection)
				});
			}
			for (const slot of boxSlots) {
				const rowId = `${saveFileId}:box:${slot.box}:${slot.slot}`;
				const projection = { ...slot };
				delete projection.entityBytesBase64;
				this.store.setRow('slots', rowId, {
					saveFileId,
					zone: 'box',
					box: slot.box,
					slot: slot.slot,
					projection: JSON.stringify(projection)
				});
			}
			this.store.setValues({ activeSaveFileId: saveFileId, dirty: state.dirty });
		});
		this.currentState = { ...state, bytes: this.artifact.bytes };
		this.queuePersist();
		this.publish();
	}

	project(state: WorkspaceState) {
		if (
			this.currentState &&
			(this.currentState.file.id !== state.file.id ||
				!bytesEqual(this.currentState.bytes, state.bytes))
		) {
			return;
		}
		this.currentState = state;
	}

	async exportBytes(state = this.currentState) {
		if (!state) throw new Error('Load a Save File before exporting.');
		const result = await this.engine.serializeSave(
			state.bytes,
			state.file.originalFileName ?? undefined
		);
		if (!result.ok) throw result.error;
		return base64ToBytes(result.value.bytesBase64, result.value.byteLength);
	}

	async flushed() {
		await this.persistQueue;
	}

	private publish() {
		for (const listener of this.listeners) listener(this.currentState);
	}

	private queuePersist() {
		if (!this.options.persistence) return;
		const content = this.store.getContent();
		this.persistQueue = this.persistQueue.then(() => this.options.persistence!.save(content));
	}

	private get engine() {
		return typeof this.options.engine === 'function' ? this.options.engine() : this.options.engine;
	}
}

export { LocalStorageWorkspacePersistence } from './persistence';
export {
	WORKSPACE_PARSER_VERSION,
	WORKSPACE_SCHEMA_VERSION,
	workspaceTablesSchema,
	workspaceValuesSchema
} from './schema';
