import type { PokemonRecord, PokemonStorageManifest } from './types';
import { resolvePlacements } from './types';

export type VirtualLocation = 'all-pokemon' | 'unfiled' | 'overflow';
export type VirtualSort = 'recent' | 'oldest' | 'species' | 'level';
export type VirtualFilters = {
	query: string;
	originGame: string;
	entryMode: string;
	shinyOnly: boolean;
};
export type VirtualViewPreferences = {
	location: VirtualLocation;
	sort: VirtualSort;
	filters: VirtualFilters;
};

export const defaultVirtualViewPreferences: VirtualViewPreferences = {
	location: 'all-pokemon',
	sort: 'recent',
	filters: { query: '', originGame: '', entryMode: '', shinyOnly: false }
};

export function readVirtualViewPreferences(value: string | null): VirtualViewPreferences {
	if (!value) return structuredClone(defaultVirtualViewPreferences);
	try {
		const parsed = JSON.parse(value) as Partial<VirtualViewPreferences>;
		const filters = parsed.filters;
		return {
			location:
				parsed.location === 'unfiled' || parsed.location === 'overflow'
					? parsed.location
					: 'all-pokemon',
			sort: ['recent', 'oldest', 'species', 'level'].includes(parsed.sort ?? '')
				? parsed.sort!
				: 'recent',
			filters: {
				query: typeof filters?.query === 'string' ? filters.query : '',
				originGame: typeof filters?.originGame === 'string' ? filters.originGame : '',
				entryMode: typeof filters?.entryMode === 'string' ? filters.entryMode : '',
				shinyOnly: filters?.shinyOnly === true
			}
		};
	} catch {
		return structuredClone(defaultVirtualViewPreferences);
	}
}

export function virtualRecords(
	manifest: PokemonStorageManifest | null,
	preferences: VirtualViewPreferences
): PokemonRecord[] {
	if (!manifest) return [];
	if (preferences.location === 'overflow') {
		const ids = new Set(
			resolvePlacements(manifest)
				.filter((placement) => placement.overflow)
				.map((placement) => placement.recordId)
		);
		return manifest.records
			.filter((record) => ids.has(record.recordId))
			.sort((a, b) => a.recordId.localeCompare(b.recordId));
	}
	const placements = new Map(
		resolvePlacements(manifest).map(({ recordId, placement }) => [recordId, placement])
	);
	const query = preferences.filters.query.trim().toLocaleLowerCase();
	return manifest.records
		.filter((record) => {
			if (preferences.location === 'unfiled' && placements.get(record.recordId)) return false;
			if (
				preferences.filters.originGame &&
				record.origin.originGame !== preferences.filters.originGame
			)
				return false;
			if (
				preferences.filters.entryMode &&
				record.origin.entryMode !== preferences.filters.entryMode
			)
				return false;
			if (preferences.filters.shinyOnly && !record.projection.spriteIdentity?.isShiny) return false;
			return (
				!query ||
				[
					record.projection.speciesName,
					record.projection.nickname,
					record.origin.originalTrainer,
					record.origin.originSaveFileName
				].some((value) => value?.toLocaleLowerCase().includes(query))
			);
		})
		.sort((a, b) => {
			const sort = preferences.sort;
			const order =
				sort === 'species'
					? (a.projection.speciesName ?? '').localeCompare(b.projection.speciesName ?? '')
					: sort === 'level'
						? (b.projection.level ?? 0) - (a.projection.level ?? 0)
						: sort === 'oldest'
							? a.createdAt.localeCompare(b.createdAt)
							: b.createdAt.localeCompare(a.createdAt);
			return order || a.recordId.localeCompare(b.recordId);
		});
}

export function moveVirtualFocus(
	index: number,
	count: number,
	columns: number,
	direction: 'left' | 'right' | 'up' | 'down'
): number {
	if (count === 0) return 0;
	const stride = direction === 'up' || direction === 'down' ? Math.max(1, columns) : 1;
	const next = index + (direction === 'up' || direction === 'left' ? -stride : stride);
	return Math.max(0, Math.min(count - 1, next));
}
