import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import type { PokedexEdit, PokedexProjection } from './types';

const enginePromise = createPkhexEngine();
const fixtures = import.meta.glob('../../../test-fixtures/save-files/pkmds-blazor/*.sav', {
	query: '?url',
	import: 'default',
	eager: true
});
const violet = 'pkmds-blazor/pokemon-violet.sav';
const za = 'pkmds-blazor/pokemon-legends-za.sav';

async function open(file: string) {
	const url = fixtures[`../../../test-fixtures/save-files/${file}`];
	if (typeof url !== 'string') throw new Error(`Missing ${file}`);
	const engine = await enginePromise;
	let current = new Uint8Array(await (await fetch(url)).arrayBuffer());
	const loaded = await engine.loadSaveWorkspace(current, file, 0);
	if (!loaded.ok) throw new Error(loaded.error.message);
	const dex = loaded.value.saveFile?.pokedex;
	if (dex?.status !== 'available') throw new Error('Pokedex unavailable');
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

async function roundTrip(file: string, species: number, label: string, field: string) {
	const save = await open(file);
	const flag = save.labels(species).indexOf(label);
	expect(flag).toBeGreaterThanOrEqual(0);
	const before = save.entry(species)!;
	const display = save.dex.fields.find((f) => f.key === `${field}-${species}`)!;
	const edits: PokedexEdit[] = [
		{ kind: 'flag', species, flag, on: before.flags![flag] !== '1' },
		{ kind: 'field', field: display.key, value: display.value === 0 ? 1 : 0 }
	];
	for (const edit of edits) {
		const result = await save.apply(edit);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.mutated).toBe(true);
		const again = await save.apply(edit);
		expect(again.ok && !again.value.mutated).toBe(true);
	}
	const after = await save.reread();
	expect(save.entry(species, after)?.flags?.[flag]).toBe(before.flags![flag] === '1' ? '0' : '1');
	expect(after.fields.find((f) => f.key === display.key)?.value).toBe(display.value === 0 ? 1 : 0);
	const untouched = (of: PokedexProjection) =>
		of.species.filter((s) => s.id !== species).map((s) => [s.seen, s.caught, s.flags]);
	expect(untouched(after)).toEqual(untouched(save.dex));
	expect((await save.apply({ kind: 'flag', species, flag: 999, on: true })).ok).toBe(false);
	return save;
}

test('Scarlet and Violet report their own Pokedex state and none from Legends: Z-A', async () => {
	const { dex, entry, labels } = await open(violet);
	expect(dex.species).toHaveLength(733);
	// Mew has no regional number but the game still records it; Caterpie is not in the game.
	expect(entry(151)).toBeDefined();
	expect(entry(10)).toBeUndefined();
	expect(labels(25)).toEqual(
		expect.arrayContaining([
			'Form seen: Normal',
			'Seen: female',
			'Seen: shiny',
			'Language: Chinese (traditional)',
			'Paldea Pokedex: displayed shiny'
		])
	);
	expect(labels(1)).toContain('Blueberry Pokedex: displayed shiny');
	expect(labels(1)).not.toContain('Paldea Pokedex: displayed shiny');
	expect(labels(132)).not.toContain('Seen: female');
	const all = new Set(dex.flagSets?.flat());
	for (const absent of ['Seen: Alpha', 'Shown as new', 'Language: Spanish (Latin America)'])
		expect(all.has(absent)).toBe(false);
	expect(dex.fields.filter((f) => f.species === null)).toEqual([]);
	expect(dex.fields.some((f) => f.key.startsWith('za-'))).toBe(false);
	expect(dex.fields.find((f) => f.key === 'paldea-gender-25')?.label).toBe(
		'Paldea Pokedex: displayed gender (0 = male, 1 = female, 2 = genderless)'
	);
});

test('Scarlet and Violet edits Seen, Caught, flags and displayed values, then exports', async () => {
	const save = await roundTrip(violet, 25, 'Seen: shiny', 'paldea-gender');
	const missing = save.dex.species.find((s) => !s.seen)!;
	for (const edit of [
		{ kind: 'caught', species: missing.id, caught: true },
		{ kind: 'seen', species: 25, seen: false },
		{ kind: 'all-seen' },
		{ kind: 'all-caught' }
	] as PokedexEdit[]) {
		const result = await save.apply(edit);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.mutated).toBe(true);
	}
	expect((await save.apply({ kind: 'all-caught' })).ok).toBe(true);
	const after = await save.reread();
	expect(after.species.every((s) => s.seen && s.caught)).toBe(true);
	expect((await save.apply({ kind: 'seen', species: 10, seen: true })).ok).toBe(false);
}, 60_000);

test('Legends: Z-A reports Mega, Alpha and display state and none from Scarlet and Violet', async () => {
	const { dex, entry, labels } = await open(za);
	expect(dex.species).toHaveLength(364);
	expect(entry(1)).toBeDefined();
	expect(entry(10)).toBeUndefined();
	expect(labels(6)).toEqual(
		expect.arrayContaining([
			'Form seen: Mega X',
			'Form seen shiny: Normal',
			'Seen: Mega X',
			'Seen: Mega Y',
			'Seen: Alpha',
			'Language: Spanish (Latin America)',
			'Displayed shiny',
			'Shown as new'
		])
	);
	expect(labels(978)).toEqual(expect.arrayContaining(['Seen: Curly-Mega', 'Seen: Stretchy-Mega']));
	expect(labels(25).some((label) => label.startsWith('Seen: Mega'))).toBe(false);
	const all = new Set(dex.flagSets?.flat());
	for (const absent of ['Seen: shiny', 'Form known', 'Paldea Pokedex: displayed shiny'])
		expect([...all].some((label) => label.startsWith(absent))).toBe(false);
	expect(dex.fields.every((f) => f.key.startsWith('za-'))).toBe(true);
});

test('Legends: Z-A edits Seen, Mega and displayed values, then exports', async () => {
	const save = await roundTrip(za, 6, 'Seen: Mega Y', 'za-form');
	const cleared = await save.apply({ kind: 'seen', species: 25, seen: false });
	expect(cleared.ok && cleared.value.mutated).toBe(true);
	const bulk = await save.apply({ kind: 'all-caught' });
	expect(bulk.ok && bulk.value.mutated).toBe(true);
	const after = await save.reread();
	expect(save.entry(25, after)).toMatchObject({ seen: true, caught: true });
	expect((await save.apply({ kind: 'caught', species: 10, caught: true })).ok).toBe(false);
}, 60_000);
