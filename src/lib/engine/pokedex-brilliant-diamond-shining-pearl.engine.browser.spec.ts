import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import type { PokedexEdit, PokedexProjection } from './types';

const enginePromise = createPkhexEngine();
const fixtures = import.meta.glob(
	[
		'../../../test-fixtures/save-files/pkmds-blazor/pokemon-brilliant-diamond.bin',
		'../../../test-fixtures/save-files/pkhex-generated/blank-shining-pearl.sav'
	],
	{ query: '?url', import: 'default', eager: true }
);

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
		labels: (id: number, of: PokedexProjection = dex) =>
			of.flagSets?.[of.species[id - 1].flagSet ?? -1] ?? [],
		field: (key: string, of: PokedexProjection = dex) => of.fields.find((f) => f.key === key),
		async apply(pokedex: PokedexEdit) {
			const result = await engine.applySaveFileEditOperation(current, file, { pokedex }, 0);
			if (!result.ok) throw new Error(result.error.message);
			current = result.value.bytes;
			return result.value;
		},
		async reject(pokedex: PokedexEdit) {
			return (await engine.applySaveFileEditOperation(current, file, { pokedex }, 0)).ok;
		},
		async reread() {
			const exported = await engine.serializeSave(current, file);
			if (!exported.ok) throw new Error(exported.error.message);
			const again = await engine.loadSaveWorkspace(
				Uint8Array.from(atob(exported.value.bytesBase64), (c) => c.charCodeAt(0)),
				file,
				0
			);
			if (!again.ok) throw new Error(again.error.message);
			return again.value.saveFile!.pokedex!;
		}
	};
}

for (const file of [
	'pkmds-blazor/pokemon-brilliant-diamond.bin',
	'pkhex-generated/blank-shining-pearl.sav'
]) {
	test(`Brilliant Diamond and Shining Pearl report Sinnoh, National and species values: ${file}`, async () => {
		const save = await open(file);
		const { dex } = save;
		expect(dex.species).toHaveLength(493);
		expect(dex.fields.filter((f) => f.species === null).map((f) => f.key)).toEqual([
			'regional',
			'national'
		]);
		expect(dex.fields.filter((f) => f.species !== null).map((f) => [f.key, f.species])).toEqual(
			['seen', 'caught'].flatMap((r) => [0, 1, 2, 3].map((g) => [`spinda-${r}-${g}`, 327]))
		);
		// Heard of is offered only below Seen, as the last flag.
		for (const s of dex.species) expect(save.labels(s.id).at(-1) === 'Heard of').toBe(!s.seen);
		const pikachu = save.labels(25);
		expect(pikachu).toEqual(
			expect.arrayContaining([
				'Seen: shiny female',
				'Language: Korean',
				'Language: Chinese (simplified)',
				'Language: Chinese (traditional)'
			])
		);
		expect(save.labels(201).filter((label) => label.startsWith('Form seen shiny:'))).toHaveLength(
			28
		);
		expect(save.labels(128)).not.toContain('Seen: female');
		// Sword and Shield values never appear.
		const everything = [...(dex.flagSets ?? []).flat(), ...dex.fields.map((f) => f.label)];
		expect(everything.filter((l) => /Gigantamax|Displayed|battled|Galar/i.test(l))).toEqual([]);
	}, 60_000);
}

test('Brilliant Diamond edits gender, form, language, Sinnoh and Spinda values, then exports', async () => {
	const save = await open('pkmds-blazor/pokemon-brilliant-diamond.bin');
	const flip = (id: number, label: string) => {
		const flag = save.labels(id).indexOf(label);
		expect(flag).toBeGreaterThanOrEqual(0);
		return { kind: 'flag', species: id, flag, on: save.dex.species[id - 1].flags?.[flag] !== '1' };
	};
	const regional = save.field('regional')!;
	const spinda = save.field('spinda-caught-3')!;
	const edits: PokedexEdit[] = [
		flip(25, 'Seen: shiny female'),
		flip(25, 'Language: Chinese (traditional)'),
		flip(422, 'Form seen shiny: East'),
		{ kind: 'field', field: 'regional', value: 1 - regional.value },
		{ kind: 'field', field: spinda.key, value: spinda.value + 1 },
		{ kind: 'caught', species: 1, caught: !save.dex.species[0].caught }
	] as PokedexEdit[];
	for (const edit of edits) {
		expect((await save.apply(edit)).mutated).toBe(true);
		expect((await save.apply(edit)).mutated).toBe(false);
	}
	const after = await save.reread();
	for (const edit of edits)
		if (edit.kind === 'flag')
			expect(after.species[edit.species - 1].flags?.[edit.flag]).toBe(edit.on ? '1' : '0');
	expect(save.field('regional', after)?.value).toBe(1 - regional.value);
	expect(save.field(spinda.key, after)?.value).toBe(spinda.value + 1);
	expect(after.species[0].caught).toBe(!save.dex.species[0].caught);
	const touched = new Set([1, 25, 422]);
	const untouched = (of: PokedexProjection) =>
		of.species.filter((s) => !touched.has(s.id)).map((s) => [s.seen, s.caught, s.flags]);
	expect(untouched(after)).toEqual(untouched(save.dex));
	expect(await save.reject({ kind: 'field', field: spinda.key, value: 2 ** 32 })).toBe(false);
	expect(await save.reject({ kind: 'seen', species: 494, seen: true })).toBe(false);
	expect(await save.reject({ kind: 'flag', species: 25, flag: 999, on: true })).toBe(false);
}, 60_000);

test('Shining Pearl Seen, Caught and Mark all keep gender and state consistent', async () => {
	const save = await open('pkhex-generated/blank-shining-pearl.sav');
	expect(save.dex.species.some((s) => s.seen)).toBe(false);
	const heard = save.labels(29).indexOf('Heard of');
	expect((await save.apply({ kind: 'flag', species: 29, flag: heard, on: true })).mutated).toBe(
		true
	);
	expect((await save.apply({ kind: 'seen', species: 29, seen: false })).mutated).toBe(false);
	const heardOf = await save.reread();
	expect(heardOf.species[28]).toMatchObject({ seen: false, caught: false });
	expect(heardOf.species[28].flags?.[heard]).toBe('1');
	expect((await save.apply({ kind: 'caught', species: 29, caught: true })).mutated).toBe(true);
	const caught = await save.reread();
	expect(caught.species[28]).toMatchObject({ seen: true, caught: true });
	const nidoran = save.labels(29, caught);
	expect(nidoran).not.toContain('Seen: male');
	expect(caught.species[28].flags?.[nidoran.indexOf('Seen: female')]).toBe('1');
	expect(caught.species[28].flags?.[nidoran.indexOf('Language: English')]).toBe('1');
	await save.apply({ kind: 'caught', species: 29, caught: false });
	await save.apply({ kind: 'seen', species: 29, seen: false });
	const cleared = await save.reread();
	expect(cleared.species[28]).toMatchObject({ seen: false, caught: false });
	expect(cleared.species[28].flags).not.toContain('1');
	for (const kind of ['all-seen', 'all-caught'] as const) {
		expect((await save.apply({ kind })).mutated).toBe(true);
		expect((await save.apply({ kind })).mutated).toBe(false);
	}
	const complete = await save.reread();
	expect(complete.species.every((s) => s.seen && s.caught)).toBe(true);
}, 60_000);
