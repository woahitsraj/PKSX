import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import moonUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';

test('Species and Form changes reset Furfrou timers through exported Save File bytes', async () => {
	const engine = await createPkhexEngine('/pkhex-engine');
	const bytes = new Uint8Array(await (await fetch(moonUrl)).arrayBuffer());
	const workspace = await engine.loadSaveWorkspace(bytes, 'Moon', 0);
	if (!workspace.ok) throw new Error(workspace.error.message);
	const empty = workspace.value.boxSlots.find((slot) => slot.isEmpty);
	if (!empty) throw new Error('Expected an empty Box slot.');
	const source = { zone: 'box', box: 0, slot: empty.slot } as const;
	const created = await engine.createPokemon(
		bytes,
		'Moon',
		{ destination: source, speciesId: 676, level: 10 },
		0
	);
	if (!created.ok) throw new Error(created.error.message);
	let current = created.value.bytes;
	for (const [speciesId, form, remaining] of [
		[676, 1, 5],
		[676, 0, 0],
		[676, 1, 5],
		[25, 0, 0]
	]) {
		const edited = await engine.applyPokemonEditOperation(
			current.slice(),
			'Moon',
			{ source, speciesId, form },
			0
		);
		if (!edited.ok) throw new Error(edited.error.message);
		current = edited.value.bytes;
		const reopened = await engine.loadSlotEditData(current, 'Moon', source);
		if (!reopened.ok) throw new Error(reopened.error.message);
		expect(reopened.value).toMatchObject({ speciesId, form });
		const entity = reopened.value.entityBytesBase64;
		if (!entity) throw new Error('Expected native PK7 bytes.');
		const native = Uint8Array.from(atob(entity), (char) => char.charCodeAt(0));
		expect(new DataView(native.buffer).getUint32(0x3c, true)).toBe(remaining);
		const unchanged = await engine.applyPokemonEditOperation(
			current.slice(),
			'Moon',
			{ source, speciesId, form },
			0
		);
		if (!unchanged.ok) throw new Error(unchanged.error.message);
		expect(unchanged.value.mutated).toBe(false);
	}
});
