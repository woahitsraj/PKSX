import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import type { PokedexEdit, PokedexProjection } from './types';

const enginePromise = createPkhexEngine();
const fixtures = import.meta.glob('../../../test-fixtures/save-files/**/*shield*.sav', {
	query: '?url',
	import: 'default',
	eager: true
});

async function open(file: string) {
	const url = fixtures[`../../../test-fixtures/save-files/${file}`];
	if (typeof url !== 'string') throw new Error(`Missing ${file}`);
	const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
	const engine = await enginePromise;
	const loaded = await engine.loadSaveWorkspace(bytes, file, 0);
	if (!loaded.ok) throw new Error(loaded.error.message);
	const dex = loaded.value.saveFile?.pokedex;
	if (dex?.status !== 'available') throw new Error('Pokedex unavailable');
	let current: Uint8Array = bytes;
	return {
		dex,
		entry: (id: number, of: PokedexProjection = dex) => of.species.find((s) => s.id === id),
		labels: (id: number) =>
			dex.flagSets?.[dex.species.find((s) => s.id === id)?.flagSet ?? -1] ?? [],
		async apply(pokedex: PokedexEdit) {
			const result = await engine.applySaveFileEditOperation(current, file, { pokedex }, 0);
			if (result.ok) current = result.value.bytes;
			return result;
		},
		async reread() {
			const exported = await engine.serializeSave(current, file);
			if (!exported.ok) throw new Error(exported.error.message);
			const bytes = Uint8Array.from(atob(exported.value.bytesBase64), (c) => c.charCodeAt(0));
			const again = await engine.loadSaveWorkspace(bytes, file, 0);
			if (!again.ok) throw new Error(again.error.message);
			return again.value.saveFile!.pokedex!;
		}
	};
}

test('Sword and Shield list Galar and expansion species with their regional numbers', async () => {
	const { dex, entry } = await open('pkmds-blazor/test-save-shield.sav');
	expect(dex.regions).toEqual([
		{ label: 'Galar Pokedex', count: 400, available: true, reason: null },
		{ label: 'Isle of Armor Pokedex', count: 211, available: true, reason: null },
		{ label: 'Crown Tundra Pokedex', count: 210, available: true, reason: null }
	]);
	expect(dex.species).toHaveLength(584);
	expect(entry(150)).toBeUndefined();
	expect(entry(810)?.regional).toBe('Galar 001');
	expect(entry(1)?.regional).toMatch(/^Isle of Armor \d{3}$/);
	expect(entry(898)?.regional).toMatch(/^Crown Tundra \d{3}$/);
	expect(entry(25)?.regional).toMatch(/^Galar \d{3}, Isle of Armor \d{3}$/);
	expect(dex.fields.filter((f) => f.species === null)).toEqual([]);
});

test('Sword and Shield edits Seen, Caught, gender, Gigantamax and battled count, then exports', async () => {
	const save = await open('pkmds-blazor/test-save-shield.sav');
	const labels = save.labels(812);
	expect(labels).toEqual(
		expect.arrayContaining([
			'Seen: female',
			'Seen Gigantamax: shiny male or genderless',
			'Caught Gigantamaxed',
			'Language: Korean'
		])
	);
	expect(save.labels(25)).toContain('Seen Partner: female');
	expect(save.labels(898)).not.toContain('Seen: female');
	const female = labels.indexOf('Seen: female');
	const gmax = labels.indexOf('Caught Gigantamaxed');
	const before = save.entry(812)!;
	const battled = save.dex.fields.find((f) => f.key === 'battled-812')!;
	const edits: PokedexEdit[] = [
		{ kind: 'flag', species: 812, flag: female, on: before.flags![female] !== '1' },
		{ kind: 'flag', species: 812, flag: gmax, on: before.flags![gmax] !== '1' },
		{ kind: 'field', field: battled.key, value: battled.value + 1 },
		{ kind: 'caught', species: 810, caught: false },
		{ kind: 'seen', species: 811, seen: false }
	];
	for (const edit of edits) {
		const result = await save.apply(edit);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.mutated).toBe(true);
		expect((await save.apply(edit)).ok).toBe(true);
	}
	const after = await save.reread();
	const rillaboom = save.entry(812, after)!;
	expect(rillaboom.flags![female]).toBe(before.flags![female] === '1' ? '0' : '1');
	expect(rillaboom.flags![gmax]).toBe(before.flags![gmax] === '1' ? '0' : '1');
	expect(after.fields.find((f) => f.key === battled.key)?.value).toBe(battled.value + 1);
	expect(save.entry(810, after)).toMatchObject({ caught: false });
	expect(save.entry(811, after)).toMatchObject({ seen: false });
	const untouched = (of: PokedexProjection) =>
		of.species
			.filter((s) => ![810, 811, 812].includes(s.id))
			.map((s) => [s.seen, s.caught, s.flags]);
	expect(untouched(after)).toEqual(untouched(save.dex));
	expect((await save.apply({ kind: 'seen', species: 150, seen: true })).ok).toBe(false);
	expect((await save.apply({ kind: 'flag', species: 812, flag: 999, on: true })).ok).toBe(false);
});

test('A Sword or Shield save without Crown Tundra data reports that Pokedex as missing', async () => {
	const save = await open('pkhex-generated/shield-without-crown-tundra.sav');
	expect(save.dex.regions?.[2]).toEqual({
		label: 'Crown Tundra Pokedex',
		count: 210,
		available: false,
		reason: 'This Save File has no Crown Tundra Pokedex data.'
	});
	expect(save.dex.species).toHaveLength(510);
	expect(save.entry(898)).toBeUndefined();
	expect(save.dex.species.some((s) => s.regional?.includes('Crown Tundra'))).toBe(false);
	expect((await save.apply({ kind: 'seen', species: 898, seen: true })).ok).toBe(false);
	const cleared = await save.apply({ kind: 'seen', species: 25, seen: false });
	expect(cleared.ok && cleared.value.mutated).toBe(true);
	const bulk = await save.apply({ kind: 'all-seen' });
	if (!bulk.ok) throw new Error(bulk.error.message);
	expect(bulk.value.mutated).toBe(true);
	const again = await save.apply({ kind: 'all-seen' });
	expect(again.ok && again.value.mutated).toBe(false);
	const after = await save.reread();
	expect(after.species.every((s) => s.seen)).toBe(true);
	expect(after.regions?.[2].available).toBe(false);
}, 60_000);
