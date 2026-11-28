import { describe, expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import type { EngineApi, SaveSlotRef } from './types';
import emeraldUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import xUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav?url';
import moonUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';
import swordUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav?url';
import colosseumUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/colosseum/011020251345.gci?url';
import platinumUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav?url';

const fieldsOf = (changes: { field: string }[]) => changes.map((change) => change.field);

async function fixture(url: string) {
	return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

async function createInFirstEmptySlot(
	engine: EngineApi,
	bytes: Uint8Array,
	name: string,
	speciesId: number
) {
	const workspace = await engine.loadSaveWorkspace(bytes, name, 0);
	if (!workspace.ok) throw new Error(workspace.error.message);
	const empty = workspace.value.boxSlots.find((slot) => slot.isEmpty);
	if (!empty) throw new Error('Expected an empty Box slot.');
	const source: SaveSlotRef = { zone: 'box', box: 0, slot: empty.slot };
	const created = await engine.createPokemon(
		bytes,
		name,
		{ destination: source, speciesId, level: 5 },
		0
	);
	if (!created.ok) throw new Error(created.error.message);
	return { bytes: created.value.bytes, source };
}

async function storedEntity(
	engine: EngineApi,
	bytes: Uint8Array,
	name: string,
	source: SaveSlotRef
) {
	const detail = await engine.loadSlotEditData(bytes, name, source);
	if (!detail.ok || !detail.value.entityBytesBase64) throw new Error('Expected entity bytes.');
	return Uint8Array.from(atob(detail.value.entityBytesBase64), (char) => char.charCodeAt(0));
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function editedPlatinumPokemon(engine: EngineApi) {
	const bytes = await fixture(platinumUrl);
	const workspace = await engine.loadSaveWorkspace(bytes, 'pokemon-platinum-eu.sav', 0);
	if (!workspace.ok) throw new Error(workspace.error.message);
	const caught = workspace.value.boxSlots.find((slot) => !slot.isEmpty);
	if (!caught) throw new Error('Expected a caught Pokemon in Box 1.');
	const entity = await storedEntity(engine, bytes, 'pokemon-platinum-eu.sav', {
		zone: 'box',
		box: 0,
		slot: caught.slot
	});
	const view = new DataView(entity.buffer);
	view.setUint32(0x38, view.getUint32(0x38, true) ^ 1, true);
	view.setUint16(0x0c, 12345, true);
	view.setUint16(0x0e, 54321, true);
	return toBase64(entity);
}

describe('Auto Legal through the browser-wasm bundle', () => {
	test('repairs a newly created Pokemon and applies exactly the previewed candidate', async () => {
		const engine = await createPkhexEngine();
		const { bytes, source } = await createInFirstEmptySlot(engine, await fixture(xUrl), 'X', 25);
		const before = await engine.checkSlotLegality(bytes, 'X', source);
		expect(before.ok && before.value.legal).toBe(false);

		const unchanged = bytes.slice();
		const preview = await engine.previewAutoLegal(bytes, 'X', source);
		if (!preview.ok) throw new Error(preview.error.message);
		expect(bytes).toEqual(unchanged);
		expect(preview.value).toMatchObject({ status: 'repaired', candidate: { legal: true } });
		expect(preview.value.token).toMatch(/^auto-legal:[0-9a-f]{32}$/);
		expect(fieldsOf(preview.value.changes)).toEqual(
			expect.arrayContaining(['PID', 'Encryption Constant', 'Met Location'])
		);
		expect(fieldsOf(preview.value.changes)).toContain('Original Trainer Memory');
		expect(fieldsOf(preview.value.changes)).not.toContain('Original Trainer');

		const applied = await engine.applyPokemonAction(
			bytes.slice(),
			'X',
			{ kind: 'legality-fix', source, choiceId: preview.value.token ?? '' },
			0
		);
		if (!applied.ok) throw new Error(applied.error.message);
		expect(applied.value.changes).toEqual(preview.value.changes);
		expect(toBase64(await storedEntity(engine, applied.value.bytes, 'X', source))).toBe(
			preview.value.candidateBytesBase64
		);
		const after = await engine.checkSlotLegality(applied.value.bytes, 'X', source);
		expect(after.ok && after.value.legal).toBe(true);

		const stale = await engine.applyPokemonAction(
			applied.value.bytes,
			'X',
			{ kind: 'legality-fix', source, choiceId: preview.value.token ?? '' },
			0
		);
		expect(stale).toMatchObject({ ok: false, error: { code: 'stale-pokemon-action-preview' } });
	});

	test('regenerates PID and IVs together for an edited Pokemon and keeps its trainer and origin', async () => {
		const engine = await createPkhexEngine();
		const edited = await editedPlatinumPokemon(engine);

		const preview = await engine.previewStoredAutoLegal(edited);
		if (!preview.ok) throw new Error(preview.error.message);
		expect(preview.value).toMatchObject({
			status: 'repaired',
			method: 'automod-origin',
			candidate: { legal: true }
		});
		expect(fieldsOf(preview.value.changes)).toEqual(expect.arrayContaining(['PID', 'IVs']));
		for (const field of [
			'Species',
			'Original Trainer',
			'Trainer ID',
			'Secret ID',
			'Met Location',
			'Origin Game'
		])
			expect(fieldsOf(preview.value.changes)).not.toContain(field);

		const applied = await engine.applyStoredPokemonAction(edited, {
			kind: 'legality-fix',
			choiceId: preview.value.token ?? ''
		});
		if (!applied.ok) throw new Error(applied.error.message);
		expect(applied.value.entityBytesBase64).toBe(preview.value.candidateBytesBase64);

		const stale = await engine.applyStoredPokemonAction(applied.value.entityBytesBase64, {
			kind: 'legality-fix',
			choiceId: preview.value.token ?? ''
		});
		expect(stale).toMatchObject({ ok: false, error: { code: 'stale-pokemon-action-preview' } });
	});

	test('leaves a Pokemon with an unrepairable finding unchanged and explains why', async () => {
		const engine = await createPkhexEngine();
		const { bytes, source } = await createInFirstEmptySlot(
			engine,
			await fixture(emeraldUrl),
			'Emerald',
			25
		);
		const preview = await engine.previewAutoLegal(bytes, 'Emerald', source);
		if (!preview.ok) throw new Error(preview.error.message);
		expect(preview.value).toMatchObject({
			status: 'unresolved',
			token: null,
			candidate: null,
			changes: []
		});
		expect(preview.value.reason).toMatch(/no legal encounter/);
		expect(preview.value.source.legal).toBe(false);
		expect(preview.value.source.warnings.map((line) => line.message).join(' ')).toMatch(/PID/);
	});

	test('leaves mixed repairable and unrepairable findings unchanged as one result', async () => {
		const engine = await createPkhexEngine();
		const bytes = await fixture(platinumUrl);
		const mew = await storedEntity(engine, bytes, 'pokemon-platinum-eu.sav', {
			zone: 'box',
			box: 2,
			slot: 18
		});
		const preview = await engine.previewStoredAutoLegal(toBase64(mew));
		if (!preview.ok) throw new Error(preview.error.message);
		expect(preview.value).toMatchObject({ status: 'unresolved', token: null, changes: [] });
		const findings = preview.value.source.warnings;
		expect(findings.some((line) => line.fixId === 'move-set')).toBe(true);
		expect(findings.some((line) => line.identifier === 'Encounter')).toBe(true);
	});

	test('uses the targeted fixes alone when they are enough and reports legal Pokemon as legal', async () => {
		const engine = await createPkhexEngine();
		const repaired = await engine.previewStoredAutoLegal(await editedPlatinumPokemon(engine));
		if (!repaired.ok || !repaired.value.candidateBytesBase64)
			throw new Error('Expected a candidate.');
		const entity = Uint8Array.from(atob(repaired.value.candidateBytesBase64), (char) =>
			char.charCodeAt(0)
		);
		const legal = await engine.previewStoredAutoLegal(toBase64(entity));
		expect(legal).toMatchObject({ ok: true, value: { status: 'already-legal', token: null } });

		entity[0x83] = 16; // Cherish Ball is not legal for this encounter.
		const targeted = await engine.previewStoredAutoLegal(toBase64(entity));
		if (!targeted.ok) throw new Error(targeted.error.message);
		expect(targeted.value).toMatchObject({
			status: 'repaired',
			method: 'targeted',
			candidate: { legal: true }
		});
		expect(fieldsOf(targeted.value.changes)).toEqual(['Ball']);
	});

	for (const [name, url, fileName, speciesId] of [
		['Emerald', emeraldUrl, 'Emerald', 265],
		['Moon', moonUrl, 'Moon', 25],
		['Sword', swordUrl, 'Sword', 25]
	] as const) {
		test(`repairs a newly created ${name} Pokemon in its own game`, async () => {
			const engine = await createPkhexEngine();
			const { bytes, source } = await createInFirstEmptySlot(
				engine,
				await fixture(url),
				fileName,
				speciesId
			);
			const preview = await engine.previewAutoLegal(bytes, fileName, source);
			if (!preview.ok) throw new Error(preview.error.message);
			expect(preview.value).toMatchObject({ status: 'repaired', candidate: { legal: true } });
			for (const field of ['Species', 'Original Trainer', 'Trainer ID', 'Origin Game'])
				expect(fieldsOf(preview.value.changes)).not.toContain(field);
		});
	}

	test('reports an AutoMod failure as an unresolved result', async () => {
		const engine = await createPkhexEngine();
		const preview = await engine.previewAutoLegal(
			await fixture(platinumUrl),
			'pokemon-platinum-eu.sav',
			{
				zone: 'box',
				box: 2,
				slot: 19
			}
		);
		if (!preview.ok) throw new Error(preview.error.message);
		expect(preview.value).toMatchObject({ status: 'unresolved', token: null });
		expect(preview.value.reason).toBeTruthy();
	});

	test('finishes hard searches within the attempt time limits', async () => {
		const engine = await createPkhexEngine();
		for (const [url, fileName, speciesId] of [
			[swordUrl, 'Sword', 888],
			[colosseumUrl, '011020251345.gci', 251]
		] as const) {
			const { bytes, source } = await createInFirstEmptySlot(
				engine,
				await fixture(url),
				fileName,
				speciesId
			);
			const preview = await engine.previewAutoLegal(bytes, fileName, source);
			if (!preview.ok) throw new Error(preview.error.message);
			expect(preview.value.elapsedMilliseconds).toBeLessThan(15_000);
		}
	});
});
