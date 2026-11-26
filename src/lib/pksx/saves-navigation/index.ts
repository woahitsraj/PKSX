import type { SaveFileId, StoredSaveFile } from '$lib/pksx/saves';

export type SavesTarget =
	| { kind: 'save-file'; id: SaveFileId }
	| { kind: 'game'; game: string }
	| { kind: 'pokemon-storage' }
	| { kind: 'import' };
export type SavesDirection = 'left' | 'right' | 'up' | 'down';
/** A Saves card: one Save File, or a game group holding two or more Save Files. */
export type SavesEntry =
	| { kind: 'save-file'; saveFile: StoredSaveFile; game: string | null }
	| { kind: 'game'; game: string; saveFiles: StoredSaveFile[] };

export function savesEntryTargets(entries: SavesEntry[]): SavesTarget[] {
	return [
		...entries.map(
			(entry): SavesTarget =>
				entry.kind === 'game'
					? { kind: 'game', game: entry.game }
					: { kind: 'save-file', id: entry.saveFile.id }
		),
		{ kind: 'pokemon-storage' },
		{ kind: 'import' }
	];
}

/** Maps a target to the card that now shows it, so focus follows identity across grouping changes. */
export function normalizeSavesTarget(entries: SavesEntry[], target: SavesTarget): SavesTarget {
	if (target.kind === 'save-file') {
		const group = entries.find(
			(entry) => entry.kind === 'game' && entry.saveFiles.some((file) => file.id === target.id)
		);
		return group?.kind === 'game' ? { kind: 'game', game: group.game } : target;
	}
	if (target.kind !== 'game' || entries.some((e) => e.kind === 'game' && e.game === target.game))
		return target;
	const member = entries.find((entry) => entry.kind === 'save-file' && entry.game === target.game);
	return member?.kind === 'save-file' ? { kind: 'save-file', id: member.saveFile.id } : target;
}

export function resolveSavesEntryTarget(
	entries: SavesEntry[],
	remembered: SavesTarget | null,
	activeSaveFileId: SaveFileId | null
): SavesTarget {
	const targets = savesEntryTargets(entries);
	const candidates: SavesTarget[] = [
		...(remembered ? [remembered] : []),
		...(activeSaveFileId ? [{ kind: 'save-file' as const, id: activeSaveFileId }] : [])
	].map((candidate) => normalizeSavesTarget(entries, candidate));
	return (
		candidates.find((candidate) => targetIndex(targets, candidate) >= 0) ??
		resolveSavesTarget(targets, null, null)
	);
}

export function resolveSavesTarget(
	targets: SavesTarget[],
	remembered: SavesTarget | null,
	activeSaveFileId: SaveFileId | null
): SavesTarget {
	if (remembered && targetIndex(targets, remembered) >= 0) return remembered;

	const active = activeSaveFileId
		? targets.find((target) => target.kind === 'save-file' && target.id === activeSaveFileId)
		: null;
	return (
		active ??
		targets.find((target) => target.kind === 'save-file' || target.kind === 'game') ??
		targets.find((target) => target.kind === 'import') ?? { kind: 'pokemon-storage' }
	);
}

export function moveSavesTarget(
	targets: SavesTarget[],
	current: SavesTarget,
	columns: number,
	direction: SavesDirection
): SavesTarget {
	const index = targetIndex(targets, current);
	if (index < 0 || targets.length === 0) return current;

	const width = Math.max(1, Math.floor(columns));
	const row = Math.floor(index / width);
	const column = index % width;
	let nextIndex = index;

	switch (direction) {
		case 'left':
			if (column > 0) nextIndex = index - 1;
			break;
		case 'right':
			if (column < width - 1 && index + 1 < targets.length) nextIndex = index + 1;
			break;
		case 'up':
			if (row > 0) nextIndex = index - width;
			break;
		case 'down': {
			const nextRowStart = (row + 1) * width;
			if (nextRowStart < targets.length) {
				nextIndex = Math.min(nextRowStart + column, targets.length - 1);
			}
			break;
		}
	}

	return targets[nextIndex] ?? current;
}

export function deleteSavesTarget(
	preDeleteTargets: SavesTarget[],
	deleted: Extract<SavesTarget, { kind: 'save-file' }>
): SavesTarget {
	const saveFiles = preDeleteTargets.filter(
		(target) => target.kind === 'save-file' || target.kind === 'game'
	);
	const deletedIndex = targetIndex(saveFiles, deleted);
	const remaining = saveFiles.filter((target) => !sameSavesTarget(target, deleted));
	return (
		remaining[deletedIndex] ??
		remaining[deletedIndex - 1] ??
		preDeleteTargets.find((target) => target.kind === 'pokemon-storage') ?? { kind: 'import' }
	);
}

export function sameSavesTarget(left: SavesTarget, right: SavesTarget) {
	if (left.kind === 'save-file') return right.kind === 'save-file' && left.id === right.id;
	if (left.kind === 'game') return right.kind === 'game' && left.game === right.game;
	return left.kind === right.kind;
}

function targetIndex(targets: SavesTarget[], target: SavesTarget) {
	return targets.findIndex((candidate) => sameSavesTarget(candidate, target));
}
