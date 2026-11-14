import { Capacitor, registerPlugin } from '@capacitor/core';
import type { EngineApi } from '$lib/engine';
import type { SavesStorage } from '$lib/pksx/saves';
import { folderProfile, skipFolder } from './profiles';

export type FolderLink = { tree: string; name: string };
export type FolderEntry = { id: string; name: string; directory: boolean; size: number };
export type DiscoveredSave = {
	id: string;
	name: string;
	path: string;
	imported: boolean;
	folder: FolderLink;
	identity: string;
};
export interface SaveFoldersPlugin {
	status(): Promise<{ folders: FolderLink[] }>;
	pick(): Promise<{ cancelled: true } | { cancelled: false; folder: FolderLink }>;
	unlink(options: { tree: string }): Promise<void>;
	cancel(): Promise<void>;
	list(options: {
		tree: string;
		documentId?: string;
	}): Promise<{ entries: FolderEntry[]; truncated: boolean }>;
	read(options: {
		tree: string;
		documentId: string;
	}): Promise<{ base64: string; identity: string }>;
}
export const saveFolders = registerPlugin<SaveFoldersPlugin>('SaveFolders');
export const supportsSaveFolders = () => Capacitor.getPlatform() === 'android';

export function candidateFile(name: string) {
	return /(?:\.(?:gci|sav|dat|bin|dsv|srm|bak|main)$|^[^.]+$)/i.test(name);
}

export function documentBytes(base64: string) {
	return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
	});
}

export async function scanFolder(options: {
	plugin: SaveFoldersPlugin;
	folder: FolderLink;
	engine: EngineApi;
	storage: SavesStorage;
	signal: AbortSignal;
	onSave: (save: DiscoveredSave, bytes: Uint8Array) => void | Promise<void>;
	onProgress: (message: string) => void;
}) {
	const { plugin, folder: linkedFolder, engine, storage, signal, onSave, onProgress } = options;
	const profile = folderProfile(linkedFolder.tree, linkedFolder.name);
	const imported = new Set((await storage.listSaves()).map((save) => save.linkedDocumentId));
	const queue: { id?: string; path: string; depth: number }[] = [{ path: '', depth: 0 }];
	const visited = new Set<string>();
	let count = 0;
	let skipped = 0;
	let limited = false;
	while (queue.length && count < 2000) {
		signal.throwIfAborted();
		const folder = queue.shift()!;
		onProgress(`Scanning ${folder.path || 'selected folder'}…`);
		let listing;
		try {
			listing = await cancellable(
				plugin.list({ tree: linkedFolder.tree, documentId: folder.id }),
				signal
			);
		} catch (error) {
			if (!folder.id) throw error;
			signal.throwIfAborted();
			skipped++;
			continue;
		}
		limited ||= listing.truncated;
		for (const entry of listing.entries) {
			signal.throwIfAborted();
			if (visited.has(entry.id)) continue;
			visited.add(entry.id);
			if (++count > 2000) {
				limited = true;
				break;
			}
			const path = `${folder.path}${entry.name}`;
			if (entry.directory) {
				if (skipFolder(entry.name, profile, folder.path)) continue;
				if (folder.depth >= 12) {
					limited = true;
					continue;
				}
				queue.push({ id: entry.id, path: path + '/', depth: folder.depth + 1 });
				continue;
			}
			if (!candidateFile(entry.name) || entry.size === 0 || entry.size > 16 * 1024 * 1024) continue;
			let recognized: DiscoveredSave;
			let bytes: Uint8Array;
			try {
				const document = await cancellable(
					plugin.read({ tree: linkedFolder.tree, documentId: entry.id }),
					signal
				);
				signal.throwIfAborted();
				bytes = documentBytes(document.base64);
				const validation = await cancellable(
					engine.loadSaveWorkspace(bytes, entry.name, 0, { background: true }),
					signal
				);
				signal.throwIfAborted();
				if (!validation.ok) {
					skipped++;
					continue;
				}
				recognized = {
					id: entry.id,
					name: entry.name,
					path,
					folder: linkedFolder,
					identity: document.identity,
					imported: imported.has(document.identity)
				};
			} catch {
				signal.throwIfAborted();
				skipped++;
				continue;
			}
			await onSave(recognized, bytes);
		}
	}
	limited ||= queue.length > 0;
	onProgress(
		`Scan complete. ${count} entries checked. ${skipped} unreadable or unrecognized files/folders skipped.${limited ? ' Scan limit reached. Select a smaller folder to find more saves.' : ''}`
	);
}

export async function importLinkedSave(
	plugin: SaveFoldersPlugin,
	engine: EngineApi,
	storage: SavesStorage,
	save: DiscoveredSave
) {
	const document = await plugin.read({ tree: save.folder.tree, documentId: save.id });
	const bytes = documentBytes(document.base64);
	const validation = await engine.loadSaveWorkspace(bytes, save.name, 0, { background: true });
	if (!validation.ok) throw new Error(validation.error.message);
	return storage.importSave({
		bytes,
		originalFileName: save.name,
		linkedDocumentId: document.identity
	});
}
