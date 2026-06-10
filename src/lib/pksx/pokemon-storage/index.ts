export const STORAGE_BOX_CAPACITY = 30;

export type StorageBoxId = string;

export type StorageBox = {
	id: StorageBoxId;
	position: number;
	name: string | null;
};

export type BoxSourceKey = 'save-file' | 'pokemon-storage';

export function storageBoxLabel(box: Pick<StorageBox, 'position' | 'name'>): string {
	return box.name ?? `Storage ${String(box.position + 1).padStart(2, '0')}`;
}

export function createInitialStorageBoxes(idFactory: () => StorageBoxId): StorageBox[] {
	return [{ id: idFactory(), position: 0, name: null }];
}

/**
 * Changing the active Box Source preserves the active box number when the new
 * source has a matching box, and clamps to the nearest available box otherwise.
 */
export function clampBoxToSource(activeBox: number, boxCount: number): number {
	return Math.max(0, Math.min(activeBox, boxCount - 1));
}

export function sortStorageBoxes<T extends Pick<StorageBox, 'position'>>(boxes: T[]): T[] {
	return [...boxes].sort((left, right) => left.position - right.position);
}
