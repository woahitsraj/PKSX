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
	['pkhex-avalonia/gen4-diamond.sav', 0]
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
				{ pokedex: { species: 1, seen: true } },
				0
			);
			expect(rejected.ok).toBe(false);
			return;
		}
		expect(dex.fields.map((f) => f.key)).toEqual(
			count === 151
				? []
				: count === 251
					? ['unown-first', 'unown-unlocked']
					: ['national', 'unown-pid', 'spinda-pid']
		);
		const before = dex.species[0];
		const changed = await engine.applySaveFileEditOperation(
			bytes,
			file,
			{ pokedex: { species: 1, seen: !before.seen, caught: !before.caught } },
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
				{ pokedex: { field: nationalDex.key, value: nationalDex.value } },
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
				{ pokedex: { field: field.key, value } },
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
			{ pokedex: { species: count + 1, caught: true } },
			0
		);
		expect(rejected.ok).toBe(false);
	}, 60_000);
}
