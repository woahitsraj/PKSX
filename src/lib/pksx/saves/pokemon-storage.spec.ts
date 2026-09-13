import { describe, expect, it } from 'vitest';
import type { StoredPokemonStorage } from './types';
import { clonePokemonStorage, createEmptyPokemonStorage } from './pokemon-storage';

describe('clonePokemonStorage', () => {
	it('normalizes persisted provenance to Pokemon Origin', () => {
		const storage = createEmptyPokemonStorage(1, 1, () => '2026-08-11T00:00:00.000Z');
		storage.boxes[0]!.slots[0]!.pokemon = {
			label: 'ARON',
			detail: 'Lv. 12',
			level: 12,
			experience: 100,
			speciesId: 304,
			form: 0,
			isEgg: false,
			spriteIdentity: null,
			provenance: {
				entryMode: 'moved-in',
				originSaveFileName: 'emerald.sav',
				originGame: 'Pokemon Emerald',
				originalTrainer: 'RAJ',
				trainerId: null,
				enteredAt: '2026-08-11T00:00:00.000Z'
			}
		} as unknown as StoredPokemonStorage['boxes'][number]['slots'][number]['pokemon'];

		const pokemon = clonePokemonStorage(storage).boxes[0]!.slots[0]!.pokemon;

		expect(pokemon?.origin.originSaveFileName).toBe('emerald.sav');
		expect(pokemon).not.toHaveProperty('provenance');
	});

	it('clones cached held-item identity without changing schema version 1', () => {
		const storage = createEmptyPokemonStorage(1, 1, () => '2026-08-11T00:00:00.000Z');
		storage.boxes[0]!.slots[0]!.pokemon = {
			label: 'ARON',
			detail: 'Lv. 12',
			level: 12,
			experience: 100,
			speciesId: 304,
			form: 0,
			isEgg: false,
			spriteIdentity: null,
			heldItem: 'Potion',
			heldItemSpriteIdentity: {
				nativeId: 13,
				canonicalId: 17,
				generation: 3,
				context: 'Gen3',
				gameVersionId: 3
			},
			origin: {
				entryMode: 'moved-in',
				originSaveFileName: 'emerald.sav',
				originGame: 'Pokemon Emerald',
				originalTrainer: 'RAJ',
				trainerId: null,
				enteredAt: '2026-08-11T00:00:00.000Z'
			}
		};

		const cloned = clonePokemonStorage(storage);
		const identity = cloned.boxes[0]!.slots[0]!.pokemon?.heldItemSpriteIdentity;

		expect(cloned.schemaVersion).toBe(1);
		expect(identity).toEqual(storage.boxes[0]!.slots[0]!.pokemon?.heldItemSpriteIdentity);
		expect(identity).not.toBe(storage.boxes[0]!.slots[0]!.pokemon?.heldItemSpriteIdentity);
	});

	it('loads older schema version 1 Pokemon without held-item identity', () => {
		const storage = createEmptyPokemonStorage(1, 1);
		storage.boxes[0]!.slots[0]!.pokemon = {
			label: 'ARON',
			detail: 'Lv. 12',
			level: 12,
			experience: 100,
			speciesId: 304,
			form: 0,
			isEgg: false,
			spriteIdentity: null,
			heldItem: 'Potion',
			origin: {
				entryMode: 'imported',
				originSaveFileName: null,
				originGame: null,
				originalTrainer: null,
				trainerId: null,
				enteredAt: '2026-08-11T00:00:00.000Z'
			}
		};

		expect(
			clonePokemonStorage(storage).boxes[0]!.slots[0]!.pokemon?.heldItemSpriteIdentity
		).toBeNull();
	});
});
