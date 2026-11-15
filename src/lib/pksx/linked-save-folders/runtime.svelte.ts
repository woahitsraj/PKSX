import { getLinkedSaveSources } from '$lib/pksx/linked-save-sources/runtime';
import type { LinkedSourceStatus } from '$lib/pksx/linked-save-sources';
import type { StoredSaveFile } from '$lib/pksx/saves';
import { SvelteSet } from 'svelte/reactivity';
import {
	getPkhexEngine,
	getSavesStorage,
	getSavesSnapshot,
	invalidateSavesCache
} from '$lib/pksx/saves-cache';
import {
	saveFolders,
	supportsSaveFolders,
	scanFolder,
	cancellable,
	type FolderLink
} from './index';
import { folderProfile, type EmulatorProfile } from './profiles';

type Notice = (tone: 'success' | 'error', text: string) => void;
export type SourceAttention = Extract<LinkedSourceStatus, { kind: 'changed' | 'recovery' }>;

export class LinkedSaveDiscovery {
	folders = $state<FolderLink[]>([]);
	failed = $state<Record<string, boolean>>({});
	scanning = $state(false);
	picking = $state(false);
	sources = $state<Record<string, SourceAttention>>({});
	sourceBusy = $state(false);
	notify: Notice = () => {};
	#controller: AbortController | undefined;
	#task: Promise<void> | undefined;

	async initialize() {
		if (!supportsSaveFolders()) return;
		try {
			this.folders = (await saveFolders.status()).folders;
			await this.scan();
		} catch (error) {
			this.notify('error', errorMessage(error));
		}
	}

	async link(emulator?: EmulatorProfile) {
		this.picking = true;
		try {
			const result = await saveFolders.pick(emulator ? { emulator } : undefined);
			if (result.cancelled) return;
			this.folders = (await saveFolders.status()).folders;
			this.picking = false;
			await this.scan([result.folder], true);
		} catch (error) {
			this.notify('error', errorMessage(error));
		} finally {
			this.picking = false;
		}
	}

	async unlink(folder: FolderLink) {
		try {
			await saveFolders.unlink({ tree: folder.tree });
			this.folders = this.folders.filter((item) => item.tree !== folder.tree);
			this.notify('success', `Unlinked ${folder.name}`);
		} catch (error) {
			this.notify('error', errorMessage(error));
		}
	}

	async loadExternal(source: SourceAttention & { kind: 'changed' }) {
		await this.#sourceAction(() =>
			getLinkedSaveSources().loadExternal(source.file, source.externalHash, true)
		);
	}

	async recoverSource(source: SourceAttention & { kind: 'recovery' }) {
		await this.#sourceAction(() =>
			getLinkedSaveSources().recover(source.file, source.externalHash)
		);
	}

	async #sourceAction(action: () => Promise<unknown>) {
		this.sourceBusy = true;
		try {
			await action();
			this.notify('success', 'Loaded from emulator');
		} catch (error) {
			this.notify('error', errorMessage(error));
		} finally {
			invalidateSavesCache();
			await this.checkSources().catch(() => undefined);
			this.sourceBusy = false;
		}
	}

	async checkSources(signal?: AbortSignal) {
		const sources: Record<string, SourceAttention> = {};
		for (const file of await getSavesStorage().listSaves()) {
			if (signal?.aborted) return;
			if (!file.linkedDocumentId) continue;
			const observing = getLinkedSaveSources().observe(file);
			const status = signal ? await cancellable(observing, signal) : await observing;
			if ((status.kind === 'changed' && status.valid) || status.kind === 'recovery')
				sources[file.id] = status;
		}
		this.sources = sources;
	}

	cancel() {
		this.#controller?.abort();
		void saveFolders.cancel().catch(() => undefined);
	}

	scan(folders = this.folders, announce = false): Promise<void> {
		if (this.#task) return this.#task;
		this.#controller = new AbortController();
		this.scanning = true;
		const signal = this.#controller.signal;
		this.#task = this.#scan(folders, signal, announce)
			.catch((error) => this.notify('error', errorMessage(error)))
			.finally(() => {
				this.scanning = false;
				this.#task = undefined;
			});
		return this.#task;
	}

	async #scan(folders: FolderLink[], signal: AbortSignal, announce: boolean) {
		const storage = getSavesStorage();
		const known = new SvelteSet((await storage.listSaves()).map((save) => save.linkedDocumentId));
		let added = 0;
		let failed = false;
		for (const folder of folders) {
			if (signal.aborted) break;
			try {
				await scanFolder({
					plugin: saveFolders,
					folder,
					engine: getPkhexEngine(),
					storage,
					signal,
					onProgress: () => {},
					onSave: async (save, bytes) => {
						if (known.has(save.identity)) return;
						await storage.importSave({
							bytes,
							originalFileName: save.name,
							linkedDocumentId: save.identity,
							emulator: folder.emulator ?? folderProfile(folder.tree, folder.name),
							activate: false
						});
						known.add(save.identity);
						added++;
						invalidateSavesCache();
						await getSavesSnapshot();
					}
				});
				this.failed = { ...this.failed, [folder.tree]: false };
			} catch {
				if (signal.aborted) break;
				failed = true;
				this.failed = { ...this.failed, [folder.tree]: true };
				if (announce) this.notify('error', `Couldn't read ${folder.name}`);
			}
		}
		await this.checkSources(signal).catch(() => undefined);
		if (added) this.notify('success', `Found ${added} new ${added === 1 ? 'save' : 'saves'}`);
		else if (announce && !failed && !signal.aborted) this.notify('success', 'No new saves');
	}
}

export function sourceFor(file: StoredSaveFile) {
	return linkedSaveDiscovery.sources[file.id];
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
export const linkedSaveDiscovery = new LinkedSaveDiscovery();
