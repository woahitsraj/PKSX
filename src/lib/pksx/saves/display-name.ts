import type { StoredSaveFile } from './types';

export function getSaveDisplayName(file: Pick<StoredSaveFile, 'originalFileName' | 'displayName'>) {
	return file.displayName ?? file.originalFileName ?? 'Save File';
}

export function normalizeSaveDisplayName(name: string | null) {
	if (name === null) return null;
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Enter a name for this Save File.');
	return trimmed;
}
