import { describe, expect, test } from 'vitest';
import { buildIdentityMap, type GameIndex, type Item } from './item-sprite-catalog.ts';

const items = new Map<number, Item>([
	[1, { id: 1, slug: 'with-art', name: 'With Art' }],
	[2, { id: 2, slug: 'without-art', name: 'Without Art' }]
]);
const collision: GameIndex[] = [
	{ itemId: 1, generation: 5, nativeId: 25 },
	{ itemId: 2, generation: 5, nativeId: 25 }
];

describe('item sprite identity acquisition', () => {
	test('retains an artless candidate when detecting collisions', () => {
		const result = buildIdentityMap(collision, new Set([1]), items, false, []);

		expect(result.identities).not.toHaveProperty('generation-5-item-25');
		expect(result.ambiguous).toEqual([
			{
				key: 'generation-5-item-25',
				pokeApiItemIds: [1, 2],
				slugs: ['with-art', 'without-art']
			}
		]);
	});

	test('accepts only an explicit override among the source candidates', () => {
		const result = buildIdentityMap(collision, new Set([1]), items, false, [
			{
				key: 'generation-5-item-25',
				pokeApiItemId: 1,
				evidencePaths: ['PKHeX.Core/Items/Example.cs'],
				reason: 'Fixture override.'
			}
		]);

		expect(result.identities).toEqual({ 'generation-5-item-25': 1 });
		expect(result.ambiguous).toEqual([]);
	});
});
