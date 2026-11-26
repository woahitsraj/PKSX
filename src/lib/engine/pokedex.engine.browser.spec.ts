import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';

const enginePromise = createPkhexEngine();

const fixtures = import.meta.glob('../../../test-fixtures/save-files/**/*.{sav,gci}', {
	query: '?url',
	import: 'default',
	eager: true
});
const cases = [
	['pkmds-blazor/pokemon-red.sav', 151],
	['pkmds-blazor/pokemon-blue.sav', 151],
	['pkmds-blazor/pokemon-yellow.sav', 151],
	['pkhex-avalonia/gen2-gold.sav', 251],
	['pkmds-blazor/pokemon-silver.sav', 251],
	['pkmds-blazor/pokemon-crystal-jp.sav', 251],
	['pkmds-blazor/pokemon-ruby.sav', 386],
	['pkmds-blazor/pokemon-sapphire.sav', 386],
	['bl1ndbeholder-pokemon-saves/emerald-011020251345.sav', 386],
	['pkmds-blazor/pokemon-firered.sav', 386],
	['pkmds-blazor/pokemon-leafgreen.sav', 386],
	['pkmds-blazor/pokemon-box-ruby-sapphire.gci', 0],
	['bl1ndbeholder-pokemon-saves/colosseum/011020251345.gci', 0],
	['libpkmn-test-files/pokemon-xd.gci', 0],
	['pkhex-avalonia/gen4-diamond.sav', 493],
	['pkmds-blazor/pokemon-pearl.sav', 493],
	['minna-pokemon-saves/pokemon-soulsilver.sav', 493],
	['pkmds-blazor/pokemon-black.sav', 649],
	['minna-pokemon-saves/pokemon-black-2.sav', 649]
] as const;

for (const [file, count] of cases) {
	test(`Pokedex capabilities and export round trip: ${file}`, async () => {
		const url = fixtures[`../../../test-fixtures/save-files/${file}`];
		if (typeof url !== 'string') throw new Error(`Missing ${file}`);
		const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
		const engine = await enginePromise;
		const loaded = await engine.loadSaveWorkspace(bytes, file, 0);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		const dex = loaded.value.saveFile?.pokedex;
		expect(dex?.status).toBe(count ? 'available' : 'unavailable');
		expect(dex?.species).toHaveLength(count);
		if (!dex) throw new Error('Missing capabilities');
		if (!count) {
			expect(dex.reason).toBeTruthy();
			const rejected = await engine.applySaveFileEditOperation(
				bytes,
				file,
				{ pokedex: { kind: 'seen', species: 1, seen: true } },
				0
			);
			expect(rejected.ok).toBe(false);
			const bulk = await engine.applySaveFileEditOperation(
				bytes,
				file,
				{ pokedex: { kind: 'all-seen' } },
				0
			);
			expect(bulk.ok).toBe(false);
			return;
		}
		expect(dex.fields.map((f) => [f.key, f.species])).toEqual(
			count === 151
				? []
				: count === 251
					? [
							['unown-first', 201],
							['unown-unlocked', 201]
						]
					: count === 386
						? [
								['national', null],
								['unown-pid', 201],
								['spinda-pid', 327]
							]
						: count === 493
							? [
									['national', null],
									...(file.includes('soulsilver') ? [] : [['upgrade', null]]),
									['spinda-pid', 327]
								]
							: [
									['national', null],
									['national-mode', null],
									['opens-on', null],
									['spinda-pid', 327]
								]
		);
		expect(Boolean(dex.flagSets)).toBe(count > 386);
		for (const [kind, flag, other] of [
			['all-seen', 'seen', 'caught'],
			['all-caught', 'caught', 'seen']
		] as const) {
			const bulk = await engine.applySaveFileEditOperation(bytes, file, { pokedex: { kind } }, 0);
			expect(bulk.ok).toBe(true);
			if (!bulk.ok) return;
			const marked = bulk.value.workspace.saveFile?.pokedex?.species ?? [];
			expect(marked.filter((s) => s[flag])).toHaveLength(count);
			expect(marked.map((s) => s[other])).toEqual(dex.species.map((s) => s[other]));
			expect(bulk.value.mutated).toBe(dex.species.some((s) => !s[flag]));
			const again = await engine.applySaveFileEditOperation(
				bulk.value.bytes,
				file,
				{ pokedex: { kind } },
				0
			);
			expect(again.ok).toBe(true);
			if (!again.ok) return;
			expect(again.value.mutated).toBe(false);
			expect(again.value.bytes).toEqual(bulk.value.bytes);
		}
		const before = dex.species[0];
		const seenEdit = await engine.applySaveFileEditOperation(
			bytes,
			file,
			{ pokedex: { kind: 'seen', species: 1, seen: !before.seen } },
			0
		);
		expect(seenEdit.ok).toBe(true);
		if (!seenEdit.ok) return;
		const changed = await engine.applySaveFileEditOperation(
			seenEdit.value.bytes,
			file,
			{ pokedex: { kind: 'caught', species: 1, caught: !before.caught } },
			0
		);
		expect(changed.ok).toBe(true);
		if (!changed.ok) return;
		const exported = await engine.serializeSave(changed.value.bytes, file);
		expect(exported.ok).toBe(true);
		if (!exported.ok) return;
		const reread = await engine.loadSaveWorkspace(
			Uint8Array.from(atob(exported.value.bytesBase64), (c) => c.charCodeAt(0)),
			file,
			0
		);
		expect(reread.ok).toBe(true);
		if (reread.ok)
			expect(reread.value.saveFile?.pokedex?.species[0]).toMatchObject({
				seen: !before.seen,
				caught: !before.caught
			});
		const nationalDex = dex.fields.find((field) => field.key === 'national');
		if (nationalDex) {
			if (file.includes('emerald-')) expect(nationalDex.value).toBe(0);
			const baseline = await engine.serializeSave(bytes, file);
			expect(baseline.ok).toBe(true);
			if (!baseline.ok) return;
			const unchanged = await engine.applySaveFileEditOperation(
				bytes,
				file,
				{ pokedex: { kind: 'field', field: nationalDex.key, value: nationalDex.value } },
				0
			);
			expect(unchanged.ok).toBe(true);
			if (!unchanged.ok) return;
			expect(unchanged.value.mutated).toBe(false);
			expect(unchanged.value.bytes).toEqual(
				Uint8Array.from(atob(baseline.value.bytesBase64), (c) => c.charCodeAt(0))
			);
		}
		for (const field of dex.fields) {
			const value = field.value === field.max ? field.min : field.max;
			const result = await engine.applySaveFileEditOperation(
				bytes,
				file,
				{ pokedex: { kind: 'field', field: field.key, value } },
				0
			);
			expect(result.ok).toBe(true);
			if (result.ok)
				expect(
					result.value.workspace.saveFile?.pokedex?.fields.find((f) => f.key === field.key)?.value
				).toBe(value);
		}
		const rejected = await engine.applySaveFileEditOperation(
			bytes,
			file,
			{ pokedex: { kind: 'caught', species: count + 1, caught: true } },
			0
		);
		expect(rejected.ok).toBe(false);
	}, 60_000);
}

// One representative save per block layout: the flags each game reports, and one edit of each kind.
for (const [file, absent, present] of [
	['pkhex-avalonia/gen4-diamond.sav', [479, 'Form seen'], [422, 'First seen form is East']],
	['minna-pokemon-saves/pokemon-soulsilver.sav', [1, 'Korean'], [172, 'Form seen: Spiky']],
	['pkmds-blazor/pokemon-black.sav', [641, 'Form seen'], [201, 'Form displayed shiny: A']],
	['minna-pokemon-saves/pokemon-black-2.sav', [494, 'Language'], [641, 'Form seen: Therian']]
] as const) {
	test(`Pokedex gender, form and language flags: ${file}`, async () => {
		const url = fixtures[`../../../test-fixtures/save-files/${file}`];
		if (typeof url !== 'string') throw new Error(`Missing ${file}`);
		let bytes: Uint8Array = new Uint8Array(await (await fetch(url)).arrayBuffer());
		const engine = await enginePromise;
		const loaded = await engine.loadSaveWorkspace(bytes, file, 0);
		if (!loaded.ok) throw new Error(loaded.error.message);
		let dex = loaded.value.saveFile?.pokedex;
		const labels = (id: number) => {
			const set = dex?.species[id - 1].flagSet;
			return typeof set === 'number' ? (dex?.flagSets?.[set] ?? []) : [];
		};
		expect(labels(absent[0]).filter((label) => label.includes(absent[1]))).toEqual([]);
		expect(labels(present[0]).some((label) => label.startsWith(present[1]))).toBe(true);
		const gen4 = dex?.species.length === 493;
		// PKHeX orders German and Italian differently in each generation's language block.
		expect(labels(25).filter((label) => /German|Italian/.test(label))).toEqual(
			gen4 ? ['Language: German', 'Language: Italian'] : ['Language: Italian', 'Language: German']
		);
		const edits = [
			[present[0], labels(present[0]).findIndex((label) => label.startsWith(present[1]))],
			[25, labels(25).indexOf('Language: French')],
			[25, labels(25).indexOf(gen4 ? 'Second seen gender is female' : 'Seen: shiny female')]
		];
		const expected = edits.map(([id, flag]) => {
			expect(flag).toBeGreaterThanOrEqual(0);
			return dex?.species[id - 1].flags?.[flag] !== '1';
		});
		for (const [index, [species, flag]] of edits.entries()) {
			const edit = { pokedex: { kind: 'flag', species, flag, on: expected[index] } } as const;
			const result = await engine.applySaveFileEditOperation(bytes, file, edit, 0);
			if (!result.ok) throw new Error(result.error.message);
			expect(result.value.mutated).toBe(true);
			const again = await engine.applySaveFileEditOperation(result.value.bytes, file, edit, 0);
			expect(again.ok && !again.value.mutated).toBe(true);
			bytes = result.value.bytes;
		}
		const exported = await engine.serializeSave(bytes, file);
		if (!exported.ok) throw new Error(exported.error.message);
		const reread = await engine.loadSaveWorkspace(
			Uint8Array.from(atob(exported.value.bytesBase64), (c) => c.charCodeAt(0)),
			file,
			0
		);
		if (!reread.ok) throw new Error(reread.error.message);
		const before = dex;
		dex = reread.value.saveFile?.pokedex;
		for (const [index, [id, flag]] of edits.entries())
			expect(dex?.species[id - 1].flags?.[flag]).toBe(expected[index] ? '1' : '0');
		// Every flag outside the edited species keeps its imported value.
		const touched = new Set(edits.map(([id]) => id));
		expect(dex?.species.filter((s) => !touched.has(s.id)).map((s) => s.flags)).toEqual(
			before?.species.filter((s) => !touched.has(s.id)).map((s) => s.flags)
		);
		const rejected = await engine.applySaveFileEditOperation(
			bytes,
			file,
			{ pokedex: { kind: 'flag', species: 25, flag: 999, on: true } },
			0
		);
		expect(rejected.ok).toBe(false);
	}, 60_000);
}
