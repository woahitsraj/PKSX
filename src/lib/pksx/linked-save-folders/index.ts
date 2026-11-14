import { Capacitor, registerPlugin } from '@capacitor/core';
import type { EngineApi } from '$lib/engine';
import type { SavesStorage } from '$lib/pksx/saves';

export type FolderMode = 'dolphin' | 'generic';
export type FolderLink = {
	tree: string | null;
	mode: FolderMode;
	name?: string;
	cancelled?: boolean;
};
export type FolderEntry = { id: string; name: string; directory: boolean; size: number };
export type DiscoveredSave = { id: string; name: string; path: string; imported: boolean };
export interface SaveFoldersPlugin {
	status(): Promise<FolderLink>;
	pick(options: { mode: FolderMode }): Promise<FolderLink>;
	unlink(): Promise<void>;
	cancel(): Promise<void>;
	list(options: { documentId?: string }): Promise<{ entries: FolderEntry[]; truncated: boolean }>;
	read(options: { documentId: string }): Promise<{ base64: string; identity: string }>;
}
export const saveFolders = registerPlugin<SaveFoldersPlugin>('SaveFolders');
export const supportsSaveFolders = () => Capacitor.getPlatform() === 'android';
const ignoredFolders =
	/^(?:cache|caches|logs|shaders|textures|covers|screenshots|statesaves|load|dump|wii|games|resourcepacks)$/i;

export function candidateFile(name: string, mode: FolderMode) {
	if (/\.(?:raw|gcp)$/i.test(name)) return false;
	return mode === 'dolphin'
		? /\.gci$/i.test(name)
		: /(?:\.(?:gci|sav|dat|bin|dsv|srm)$|^[^.]+$)/i.test(name);
}

export function documentBytes(base64: string) {
	return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		signal.addEventListener('abort', abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

export async function scanFolder(options: {
	plugin: SaveFoldersPlugin;
	mode: FolderMode;
	engine: EngineApi;
	storage: SavesStorage;
	signal: AbortSignal;
	onSave: (save: DiscoveredSave) => void;
	onProgress: (message: string) => void;
}) {
	const { plugin, mode, engine, storage, signal, onSave, onProgress } = options;
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
			listing = await cancellable(plugin.list({ documentId: folder.id }), signal);
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
				if (mode === 'dolphin' && ignoredFolders.test(entry.name)) continue;
				if (folder.depth >= 12) {
					limited = true;
					continue;
				}
				queue.push({ id: entry.id, path: path + '/', depth: folder.depth + 1 });
				continue;
			}
			if (!candidateFile(entry.name, mode) || entry.size > 16 * 1024 * 1024) continue;
			try {
				const document = await cancellable(plugin.read({ documentId: entry.id }), signal);
				signal.throwIfAborted();
				const validation = await cancellable(
					engine.loadSaveWorkspace(documentBytes(document.base64), entry.name, 0, {
						background: true
					}),
					signal
				);
				signal.throwIfAborted();
				if (validation.ok)
					onSave({
						id: entry.id,
						name: entry.name,
						path,
						imported: imported.has(document.identity)
					});
				else skipped++;
			} catch {
				signal.throwIfAborted();
				skipped++;
			}
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
	const document = await plugin.read({ documentId: save.id });
	const bytes = documentBytes(document.base64);
	const validation = await engine.loadSaveWorkspace(bytes, save.name, 0, { background: true });
	if (!validation.ok) throw new Error(validation.error.message);
	return storage.importSave({
		bytes,
		originalFileName: save.name,
		linkedDocumentId: document.identity
	});
}
