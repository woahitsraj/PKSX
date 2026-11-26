import { expect, test } from 'vitest';
import emeraldUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import omegaRubyUrl from '../../../test-fixtures/save-files/pkhex-avalonia/gen6-omega-ruby.sav?url';
import moonUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';
import shieldUrl from '../../../test-fixtures/save-files/pkmds-blazor/test-save-shield.sav?url';
import heartGoldUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-heartgold.sav?url';
import whiteUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-white.sav?url';
import legendsArceusUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-legends-arceus-2025-03-24-main.sav?url';
import { createPkhexEngine } from './pkhex-engine';
import { base64ToBytes } from './serialized-save';
import type { BoxSlotSummary, EngineApi } from './types';

const saves = {
	emerald: { url: emeraldUrl, fileName: 'emerald.sav' },
	heartGold: { url: heartGoldUrl, fileName: 'pokemon-heartgold.sav' },
	white: { url: whiteUrl, fileName: 'pokemon-white.sav' },
	omegaRuby: { url: omegaRubyUrl, fileName: 'gen6-omega-ruby.sav' },
	moon: { url: moonUrl, fileName: '011020252257' },
	shield: { url: shieldUrl, fileName: 'test-save-shield.sav' },
	legendsArceus: { url: legendsArceusUrl, fileName: 'pokemon-legends-arceus-2025-03-24-main.sav' }
};
type SaveName = keyof typeof saves;

const toBase64 = (bytes: Uint8Array) =>
	btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));

async function saveBytes(name: SaveName) {
	return new Uint8Array(await (await fetch(saves[name].url)).arrayBuffer());
}

async function findBoxSlot(
	engine: EngineApi,
	name: SaveName,
	bytes: Uint8Array,
	matches: (slot: BoxSlotSummary) => boolean
) {
	const first = await engine.loadSaveWorkspace(bytes, saves[name].fileName, 0);
	if (!first.ok) throw first.error;
	for (let box = 0; box < first.value.summary.boxCount; box += 1) {
		const slots = await engine.listBoxSlots(bytes, saves[name].fileName, box);
		if (!slots.ok) throw slots.error;
		const slot = slots.value.find(matches);
		if (slot) return { box, slot };
	}
	throw new Error(`${name} has no matching Box Slot.`);
}

async function preserve(engine: EngineApi, name: SaveName) {
	const { slot } = await findBoxSlot(
		engine,
		name,
		await saveBytes(name),
		(candidate) => !candidate.isEmpty && !candidate.isEgg && Boolean(candidate.entityBytesBase64)
	);
	const payload = await engine.createPreservationPayload(base64ToBytes(slot.entityBytesBase64!));
	if (!payload.ok) throw payload.error;
	return { slot, payload: payload.value.bytes };
}

async function place(engine: EngineApi, payload: Uint8Array, name: SaveName) {
	const bytes = await saveBytes(name);
	const empty = await findBoxSlot(engine, name, bytes, (candidate) => candidate.isEmpty);
	const destination = { zone: 'box' as const, box: empty.box, slot: empty.slot.slot };
	const result = await engine.importStoredPokemon(
		bytes,
		saves[name].fileName,
		{ preservationPayloadBase64: toBase64(payload), destination },
		empty.box
	);
	if (!result.ok) return { bytes, result, placed: null };
	const slots = await engine.listBoxSlots(result.value.bytes, saves[name].fileName, empty.box);
	if (!slots.ok) throw slots.error;
	return { bytes, result, placed: slots.value[empty.slot.slot] };
}

test('places a same-format Pokemon with its native bytes unchanged', async () => {
	const engine = await createPkhexEngine();
	const { slot, payload } = await preserve(engine, 'emerald');
	const { result, placed } = await place(engine, payload, 'emerald');
	expect(result).toMatchObject({ ok: true, value: { mutated: true } });
	expect(placed?.entityBytesBase64).toBe(slot.entityBytesBase64);
});

test.each([
	['emerald', 'heartGold', 4],
	['heartGold', 'white', 5],
	['omegaRuby', 'moon', 7]
] as const)('converts a %s Pokemon into native %s bytes', async (source, destination, format) => {
	const engine = await createPkhexEngine();
	const { slot, payload } = await preserve(engine, source);
	const expected = await engine.projectPreservationPayload(payload, format);
	if (!expected.ok) throw expected.error;
	const expectedEntity = await engine.readPreservationPayload(expected.value.bytes);
	if (!expectedEntity.ok) throw expectedEntity.error;

	const { result, placed } = await place(engine, payload, destination);
	expect(result).toMatchObject({ ok: true, value: { mutated: true } });
	expect(placed).toMatchObject({ speciesId: slot.speciesId, nickname: slot.nickname });
	expect(placed?.entityBytesBase64).toBe(toBase64(expectedEntity.value.entityBytes));
});

test('places the current snapshot of an edited Storage record', async () => {
	const engine = await createPkhexEngine();
	const { slot, payload } = await preserve(engine, 'emerald');
	const preview = await engine.previewStoredPokemonActions(slot.entityBytesBase64!);
	if (!preview.ok) throw preview.error;
	const choice = preview.value.actions.find((action) => action.kind === 'evolve')?.choices[0];
	const evolved = await engine.applyStoredPokemonAction(slot.entityBytesBase64!, {
		kind: 'evolve',
		choiceId: choice?.id
	});
	if (!evolved.ok) throw evolved.error;
	const edited = await engine.replacePreservationPayloadCurrent(
		payload,
		base64ToBytes(evolved.value.entityBytesBase64)
	);
	if (!edited.ok) throw edited.error;

	const { placed } = await place(engine, edited.value.bytes, 'emerald');
	expect(placed?.speciesId).toBe(choice?.speciesId);
	expect(placed?.entityBytesBase64).not.toBe(slot.entityBytesBase64);
});

test.each([
	['heartGold', 'emerald'],
	['shield', 'legendsArceus']
] as const)('refuses a %s Pokemon in a %s Save File', async (source, destination) => {
	const engine = await createPkhexEngine();
	const { payload } = await preserve(engine, source);
	const { result } = await place(engine, payload, destination);
	expect(result).toMatchObject({ ok: false, error: { code: 'incompatible-stored-pokemon' } });
	expect(result.ok ? '' : result.error.message).not.toBe('');
});

test('refuses bytes that are not a preservation payload', async () => {
	const engine = await createPkhexEngine();
	const { slot } = await preserve(engine, 'emerald');
	const { result } = await place(engine, base64ToBytes(slot.entityBytesBase64!), 'emerald');
	expect(result).toMatchObject({
		ok: false,
		error: { code: 'unsupported-preservation-payload' }
	});
});
