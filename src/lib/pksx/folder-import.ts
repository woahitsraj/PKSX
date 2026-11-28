import { Capacitor } from '@capacitor/core';
import type { EngineApi } from '$lib/engine';
import type { SavesStorage, StoredSaveFile } from '$lib/pksx/saves';
import { getSaveGameTitle } from '$lib/pksx/saves-library';
import { cancellable, candidateFile } from '$lib/pksx/linked-save-folders';

export type FolderCandidate = {
	path: string;
	name: string;
	folder: string;
	file: File;
	status: 'recognized' | 'unsupported' | 'unreadable';
	game?: string;
	trainer?: string;
	result?: { ok: true; save: StoredSaveFile } | { ok: false; error: string };
};

const maxSaveBytes = 16 * 1024 * 1024;

// Null in the native apps, where this web picker does not apply.
export const supportsFolderSelection = () =>
	Capacitor.isNativePlatform()
		? null
		: typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype;

// webkitRelativePath starts with the selected folder's own name.
export function relativePath(file: File) {
	return file.webkitRelativePath.split('/').slice(1).join('/') || file.name;
}

export async function scanFolderFiles(
	files: File[],
	engine: EngineApi,
	signal: AbortSignal,
	onCandidate: (candidate: FolderCandidate) => void
) {
	let rejected = 0;
	const sorted = files
		.map((file) => ({ file, path: relativePath(file) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	for (const { file, path } of sorted) {
		signal.throwIfAborted();
		if (!candidateFile(file.name) || file.size === 0 || file.size > maxSaveBytes) {
			rejected++;
			continue;
		}
		const base = { path, name: file.name, folder: path.slice(0, -file.name.length - 1), file };
		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(await cancellable(file.arrayBuffer(), signal));
		} catch {
			signal.throwIfAborted();
			onCandidate({ ...base, status: 'unreadable' });
			continue;
		}
		const result = await cancellable(
			engine.loadSaveWorkspace(bytes, file.name, 0, { background: true }),
			signal
		);
		if (result.ok)
			onCandidate({
				...base,
				status: 'recognized',
				game: getSaveGameTitle(result.value.summary.gameVersion),
				trainer: result.value.summary.trainerName
			});
		else
			onCandidate({
				...base,
				status: result.error.code === 'unsupported-save' ? 'unsupported' : 'unreadable'
			});
	}
	return rejected;
}

// Imports in the given order and stops between candidates once cancelled. The last success becomes active.
export async function importFolderCandidates(
	storage: SavesStorage,
	engine: EngineApi,
	candidates: FolderCandidate[],
	signal: AbortSignal,
	onResult: (candidate: FolderCandidate) => void
) {
	const imported: StoredSaveFile[] = [];
	for (const candidate of new Set(candidates)) {
		if (signal.aborted) break;
		try {
			const bytes = new Uint8Array(await candidate.file.arrayBuffer());
			const validation = await engine.loadSaveWorkspace(bytes, candidate.name, 0);
			if (!validation.ok) throw new Error(validation.error.message);
			const save = await storage.importSave({
				bytes,
				originalFileName: candidate.name,
				activate: false
			});
			imported.push(save);
			candidate.result = { ok: true, save };
		} catch (error) {
			candidate.result = {
				ok: false,
				error: error instanceof Error ? error.message : 'Could not read this file.'
			};
		}
		onResult(candidate);
	}
	const last = imported.at(-1);
	if (last) await storage.setActiveSaveFileId(last.id);
	return imported;
}
