import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import emeraldUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import redUrl from '../../../test-fixtures/save-files/pkmds-blazor/pokemon-red.sav?url';

async function fixture(url: string) {
	return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

test('Search entries list engine-read Advanced Search facts for every occupied Slot', async () => {
	const engine = await createPkhexEngine();
	const bytes = await fixture(emeraldUrl);
	const listed = await engine.listSearchEntries(bytes, 'emerald.sav', false);
	if (!listed.ok) throw new Error(listed.error.message);
	const aron = listed.value.entries.find(
		(entry) => entry.zone === 'box' && entry.box === 0 && entry.slot === 0
	);

	expect(listed.value.unavailable).toEqual([]);
	expect(aron).toMatchObject({ speciesName: 'Aron', formName: 'Default', legal: null });
	expect(aron?.ivs).toHaveLength(6);
	expect(aron?.evs).toHaveLength(6);
	expect(aron?.nature).toEqual(expect.any(String));
	expect(aron?.originGame).toEqual(expect.any(String));
	expect(listed.value.entries.some((entry) => entry.zone === 'party')).toBe(true);

	const checked = await engine.listSearchEntries(bytes, 'emerald.sav', true);
	if (!checked.ok) throw new Error(checked.error.message);
	expect(checked.value.entries.every((entry) => typeof entry.legal === 'boolean')).toBe(true);
	expect(checked.value.entries).toHaveLength(listed.value.entries.length);
});

test('Search entries report the criteria a Generation 1 Save File cannot supply', async () => {
	const engine = await createPkhexEngine();
	const listed = await engine.listSearchEntries(await fixture(redUrl), 'red.sav', false);
	if (!listed.ok) throw new Error(listed.error.message);

	expect(listed.value.unavailable.map(({ criterion }) => criterion).sort()).toEqual([
		'ability',
		'heldItem',
		'nature',
		'originGame'
	]);
	expect(listed.value.entries.every((entry) => entry.nature === null)).toBe(true);
});
