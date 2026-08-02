import type { Tables, Values } from 'tinybase';

export type WorkspaceStoreContent = [Tables, Values];

export type WorkspaceStorePersistence = {
	load(): Promise<WorkspaceStoreContent | null>;
	save(content: WorkspaceStoreContent): Promise<void>;
};

export class LocalStorageWorkspacePersistence implements WorkspaceStorePersistence {
	constructor(
		private readonly key = 'pksx-active-workspace-v1',
		private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
	) {}

	async load() {
		const value = this.storage.getItem(this.key);
		return value ? (JSON.parse(value) as WorkspaceStoreContent) : null;
	}

	async save(content: WorkspaceStoreContent) {
		this.storage.setItem(this.key, JSON.stringify(content));
	}
}
