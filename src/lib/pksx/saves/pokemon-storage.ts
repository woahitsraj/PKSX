import type { StoredPokemonStorage, StoredPokemonStoragePokemon } from './types';

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

export function clonePokemonStorage(storage: StoredPokemonStorage): StoredPokemonStorage {
	return {
		...storage,
		boxes: storage.boxes.map((box) => ({
			...box,
			slots: box.slots.map((slot) => ({
				...slot,
				pokemon: slot.pokemon ? clonePokemon(slot.pokemon) : null
			}))
		}))
	};
}

function clonePokemon(pokemon: StoredPokemonStoragePokemon): StoredPokemonStoragePokemon {
	const { provenance, ...current } = pokemon as Omit<StoredPokemonStoragePokemon, 'origin'> & {
		origin?: StoredPokemonStoragePokemon['origin'];
		provenance?: StoredPokemonStoragePokemon['origin'];
	};
	const origin = current.origin ?? provenance;
	if (!origin) throw new Error('Stored Pokemon origin is unavailable.');

	return {
		...current,
		spriteIdentity: current.spriteIdentity ? { ...current.spriteIdentity } : null,
		heldItemSpriteIdentity: current.heldItemSpriteIdentity
			? { ...current.heldItemSpriteIdentity }
			: null,
		origin: { ...origin }
	};
}
