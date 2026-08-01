import type { StoredPokemonStorage } from './types';

export function createEmptyPokemonStorage(
	boxCount = 3,
	boxSlotCount = 30,
	now = () => new Date().toISOString()
): StoredPokemonStorage {
	return {
		id: 'pokemon-storage',
		schemaVersion: 1,
		boxCount,
		boxSlotCount,
		updatedAt: now(),
		boxes: Array.from({ length: boxCount }, (_, box) => ({
			index: box,
			name: `Box ${String(box + 1).padStart(2, '0')}`,
			slots: Array.from({ length: boxSlotCount }, (_, slot) => ({ box, slot, pokemon: null }))
		}))
	};
}
