import { getLinkedSaveSources } from '$lib/pksx/linked-save-sources/runtime';
import type { LinkedSourceStatus } from '$lib/pksx/linked-save-sources';
import { SvelteSet } from 'svelte/reactivity';
import { getPkhexEngine, getSavesStorage, invalidateSavesCache } from '$lib/pksx/saves-cache';
import {
	saveFolders,
	supportsSaveFolders,
	scanFolder,
	cancellable,
	type FolderLink,
	type DiscoveredSave
} from './index';

export class LinkedSaveDiscovery {
	folders = $state<FolderLink[]>([]);
	saves = $state<DiscoveredSave[]>([]);
	message = $state('');
	errors = $state<Record<string, string>>({});
	reports = $state<Record<string, string>>({});
	scanning = $state(false);
	picking = $state(false);
	sources = $state<LinkedSourceStatus[]>([]);
	sourceBusy = $state(false);
	#controller: AbortController | undefined;
	#task: Promise<void> | undefined;

	async initialize() {
		if (!supportsSaveFolders()) return;
		try {
			this.folders = (await saveFolders.status()).folders;
			await this.scan();
		} catch (error) {
			this.message = errorMessage(error);
		}
	}

	async chooseFolder() {
		this.picking = true;
		try {
			const result = await saveFolders.pick();
			if (result.cancelled) return;
			this.folders = (await saveFolders.status()).folders;
			this.picking = false;
			await this.scan([result.folder]);
		} catch (error) {
			this.message = errorMessage(error);
		} finally {
			this.picking = false;
		}
	}

	async unlink(folder: FolderLink) {
		try {
			await saveFolders.unlink({ tree: folder.tree });
			this.folders = this.folders.filter((item) => item.tree !== folder.tree);
			this.saves = this.saves.filter((item) => item.folder.tree !== folder.tree);
			this.message = `${folder.name} unlinked. Imported Saves are retained.`;
		} catch (error) {
			this.message = errorMessage(error);
		}
	}

	async loadExternal(
		status: Extract<LinkedSourceStatus, { kind: 'changed' }>,
		allowDirty: boolean
	) {
		this.sourceBusy = true;
		try {
			await getLinkedSaveSources().loadExternal(status.file, status.externalHash, allowDirty);
			this.message =
				'External version loaded. Previous Workspace and imported baseline are preserved in Backups.';
		} catch (error) {
			this.message = errorMessage(error);
		} finally {
			invalidateSavesCache();
			await this.checkSources().catch((error) => {
				this.message = errorMessage(error);
			});
			this.sourceBusy = false;
		}
	}

	async recoverSource(status: Extract<LinkedSourceStatus, { kind: 'recovery' }>) {
		this.sourceBusy = true;
		try {
			await getLinkedSaveSources().recover(status.file, status.externalHash);
			this.message =
				'Original external Backup restored and verified. Current Workspace is retained.';
		} catch (error) {
			this.message = errorMessage(error);
		} finally {
			invalidateSavesCache();
			await this.checkSources().catch((error) => {
				this.message = errorMessage(error);
			});
			this.sourceBusy = false;
		}
	}

	async checkSources(signal?: AbortSignal) {
		const statuses: LinkedSourceStatus[] = [];
		for (const file of await getSavesStorage().listSaves()) {
			if (signal?.aborted) return;
			if (file.linkedDocumentId) {
				const observing = getLinkedSaveSources().observe(file);
				statuses.push(signal ? await cancellable(observing, signal) : await observing);
			}
		}
		this.sources = statuses;
	}

	cancel() {
		this.#controller?.abort();
		void saveFolders.cancel().catch(() => undefined);
	}

	scan(folders = this.folders): Promise<void> {
		if (this.#task) return this.#task;
		this.#controller = new AbortController();
		this.scanning = true;
		const signal = this.#controller.signal;
		this.#task = this.#scan(folders, signal)
			.catch((error) => {
				this.message = errorMessage(error);
			})
			.finally(() => {
				this.scanning = false;
				this.#task = undefined;
			});
		return this.#task;
	}

	async #scan(folders: FolderLink[], signal: AbortSignal) {
		const storage = getSavesStorage();
		const known = new SvelteSet((await storage.listSaves()).map((save) => save.linkedDocumentId));
		let added = 0;
		let unavailable = 0;
		for (const folder of folders) {
			if (signal.aborted) break;
			this.saves = this.saves.filter((item) => item.folder.tree !== folder.tree);
			try {
				await scanFolder({
					plugin: saveFolders,
					folder,
					engine: getPkhexEngine(),
					storage,
					signal,
					onProgress: (message) => {
						this.message = `${folder.name}: ${message}`;
						this.reports = { ...this.reports, [folder.tree]: message };
					},
					onSave: async (save, bytes) => {
						if (!known.has(save.identity)) {
							await storage.importSave({
								bytes,
								originalFileName: save.name,
								linkedDocumentId: save.identity,
								activate: false
							});
							known.add(save.identity);
							added++;
							invalidateSavesCache();
						}
						this.saves = [
							...this.saves.filter((item) => item.identity !== save.identity),
							{ ...save, imported: true }
						];
					}
				});
				const { [folder.tree]: cleared, ...remaining } = this.errors;
				void cleared;
				this.errors = remaining;
			} catch (error) {
				if (signal.aborted) break;
				unavailable++;
				this.errors = { ...this.errors, [folder.tree]: errorMessage(error) };
			}
		}
		await this.checkSources(signal).catch((error) => {
			if (!signal.aborted) throw error;
		});
		this.message = signal.aborted
			? `Scan cancelled. ${added} new saves added. Discovered saves remain in Saves.`
			: `Scan finished. ${added} new saves added. ${unavailable ? `${unavailable} folders need attention. ` : ''}Open them from Saves.`;
	}
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
export const linkedSaveDiscovery = new LinkedSaveDiscovery();
