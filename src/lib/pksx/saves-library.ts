import { getSaveDisplayName, type StoredSaveFile } from './saves';
import type { SaveCardDetailsState } from './saves-cache';
import type { SavesEntry } from './saves-navigation';

export type SavesSort = 'alphabetical' | 'recently-opened';
export type SavesView = 'flat' | 'by-game';
const sortKey = 'pksx-saves-sort-v1';
const viewKey = 'pksx-saves-view-v1';

const gameNames: Record<string, string> = {
	RB: 'Pokemon Red / Blue',
	RD: 'Pokemon Red',
	BU: 'Pokemon Blue',
	GN: 'Pokemon Green',
	YW: 'Pokemon Yellow',
	GS: 'Pokemon Gold / Silver',
	GD: 'Pokemon Gold',
	SI: 'Pokemon Silver',
	C: 'Pokemon Crystal',
	RS: 'Pokemon Ruby / Sapphire',
	R: 'Pokemon Ruby',
	S: 'Pokemon Sapphire',
	E: 'Pokemon Emerald',
	'Pokémon Unbound': 'Pokémon Unbound',
	FR: 'Pokemon FireRed / LeafGreen',
	LG: 'Pokemon LeafGreen',
	DP: 'Pokemon Diamond / Pearl',
	D: 'Pokemon Diamond',
	P: 'Pokemon Pearl',
	Pt: 'Pokemon Platinum',
	HG: 'Pokemon HeartGold',
	SS: 'Pokemon SoulSilver',
	B: 'Pokemon Black',
	W: 'Pokemon White',
	B2: 'Pokemon Black 2',
	W2: 'Pokemon White 2',
	GP: 'Pokemon Let’s Go Pikachu',
	GE: 'Pokemon Let’s Go Eevee',
	SW: 'Pokemon Sword',
	SH: 'Pokemon Shield',
	BD: 'Pokemon Brilliant Diamond',
	SP: 'Pokemon Shining Pearl',
	ZA: 'Pokemon Legends Z-A',
	PLA: 'Pokemon Legends Arceus',
	SL: 'Pokemon Scarlet',
	VL: 'Pokemon Violet',
	RSBOX: 'Pokemon Box Ruby / Sapphire',
	COLO: 'Pokemon Colosseum',
	BATREV: 'Pokemon Battle Revolution',
	XD: 'Pokemon XD',
	X: 'Pokemon X',
	Y: 'Pokemon Y',
	OR: 'Pokemon Omega Ruby',
	AS: 'Pokemon Alpha Sapphire',
	SN: 'Pokemon Sun',
	MN: 'Pokemon Moon',
	US: 'Pokemon Ultra Sun',
	UM: 'Pokemon Ultra Moon',
	SV: 'Pokemon Scarlet / Violet'
};

export function getSaveGameTitle(version: string) {
	return gameNames[version] ?? 'Pokemon ' + version;
}

export function filterSortSaves({
	files,
	details,
	query,
	sort
}: {
	files: StoredSaveFile[];
	details: Record<string, SaveCardDetailsState>;
	query: string;
	sort: SavesSort;
}) {
	const needle = query.trim().toLowerCase();
	return files
		.filter((file) => {
			const state = details[file.id];
			const summary = state?.status === 'ready' ? state.details.summary : null;
			return (
				[
					file.originalFileName,
					file.displayName,
					summary?.trainerName,
					summary?.gameVersion,
					summary ? getSaveGameTitle(summary.gameVersion) : null
				].some((value) => value?.toLowerCase().includes(needle)) || !needle
			);
		})
		.sort((left, right) => {
			if (sort === 'recently-opened') {
				const recent = (right.lastOpenedAt ?? '').localeCompare(left.lastOpenedAt ?? '');
				if (recent) return recent;
			}
			return (
				getSaveDisplayName(left)
					.toLowerCase()
					.localeCompare(getSaveDisplayName(right).toLowerCase(), 'en') ||
				(left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
			);
		});
}

export function readSavesSort(): SavesSort {
	try {
		return localStorage.getItem(sortKey) === 'recently-opened' ? 'recently-opened' : 'alphabetical';
	} catch {
		return 'alphabetical';
	}
}

export function writeSavesSort(sort: SavesSort) {
	try {
		localStorage.setItem(sortKey, sort);
	} catch {
		/* Storage may be unavailable. */
	}
}

/** The engine's game identity, or null while details are loading or unavailable. */
export function saveGameOf(details: SaveCardDetailsState | undefined) {
	return (details?.status === 'ready' && details.details.summary.gameVersion) || null;
}

/** Groups already sorted Save Files by game; each group sits where its first member sorts. */
export function groupSaves(
	files: StoredSaveFile[],
	details: Record<string, SaveCardDetailsState>,
	view: SavesView
): SavesEntry[] {
	const byGame = new Map<string, StoredSaveFile[]>();
	if (view === 'by-game') {
		for (const file of files) {
			const game = saveGameOf(details[file.id]);
			if (game) byGame.set(game, [...(byGame.get(game) ?? []), file]);
		}
	}
	const entries: SavesEntry[] = [];
	for (const file of files) {
		const game = saveGameOf(details[file.id]);
		const members = game ? byGame.get(game) : undefined;
		if (!game || !members || members.length < 2) {
			entries.push({ kind: 'save-file', saveFile: file, game });
		} else if (members[0] === file) {
			entries.push({ kind: 'game', game, saveFiles: members });
		}
	}
	return entries;
}

export function readSavesView(): SavesView {
	try {
		return localStorage.getItem(viewKey) === 'by-game' ? 'by-game' : 'flat';
	} catch {
		return 'flat';
	}
}

export function writeSavesView(view: SavesView) {
	try {
		localStorage.setItem(viewKey, view);
	} catch {
		/* Storage may be unavailable. */
	}
}
