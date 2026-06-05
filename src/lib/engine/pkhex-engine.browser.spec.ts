import { describe, expect, test } from 'vitest';
import colosseumFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/colosseum/011020251345.gci?url';
import fixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import moonFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';
import sunMoonDemoFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/sun-moon-demo/181020251439.sav?url';
import ultraMoonFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/ultra-moon/011020252224.sav?url';
import ultraSunFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/ultra-sun/011020252224.sav?url';
import xFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav?url';
import pocketMonstersWhite2JpFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pocket-monsters-white-2-jp.sav?url';
import heartGoldFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-heartgold.sav?url';
import platinumEuFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav?url';
import white2FixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-white-2.sav?url';
import whiteFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-white.sav?url';
import legendsArceusFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-legends-arceus-2025-03-24-main.sav?url';
import letsGoEeveeFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin?url';
import scarletFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav?url';
import swordFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav?url';
import { createPkhexEngine } from './pkhex-engine';

const supportedFixtureCases = [
	{ name: 'Emerald', fileName: '011020251345.sav', url: fixtureUrl, byteLength: 131088 },
	{ name: 'Colosseum', fileName: '011020251345.gci', url: colosseumFixtureUrl, byteLength: 393280 },
	{ name: 'X', fileName: '011020252224', url: xFixtureUrl, byteLength: 415232 },
	{ name: 'Moon', fileName: '011020252257', url: moonFixtureUrl, byteLength: 441856 },
	{
		name: 'Sun/Moon demo',
		fileName: '181020251439',
		url: sunMoonDemoFixtureUrl,
		byteLength: 441856
	},
	{ name: 'Ultra Sun', fileName: '011020252224', url: ultraSunFixtureUrl, byteLength: 445440 },
	{ name: 'Ultra Moon', fileName: '011020252224', url: ultraMoonFixtureUrl, byteLength: 445440 }
] as const;

const rajSaveFixtureCases = [
	{
		name: 'HeartGold',
		fileName: 'pokemon-heartgold.sav',
		url: heartGoldFixtureUrl,
		byteLength: 524288,
		generation: 4
	},
	{
		name: 'Platinum EU',
		fileName: 'pokemon-platinum-eu.sav',
		url: platinumEuFixtureUrl,
		byteLength: 524288,
		generation: 4
	},
	{
		name: 'White',
		fileName: 'pokemon-white.sav',
		url: whiteFixtureUrl,
		byteLength: 524288,
		generation: 5
	},
	{
		name: 'White 2',
		fileName: 'pokemon-white-2.sav',
		url: white2FixtureUrl,
		byteLength: 524288,
		generation: 5
	},
	{
		name: 'Pocket Monsters White 2 JP',
		fileName: 'pocket-monsters-white-2-jp.sav',
		url: pocketMonstersWhite2JpFixtureUrl,
		byteLength: 524288,
		generation: 5
	},
	{
		name: 'Sword',
		fileName: 'pokemon-sword-2025-03-24-main.sav',
		url: swordFixtureUrl,
		byteLength: 1603146,
		generation: 8
	},
	{
		name: "Let's Go Eevee",
		fileName: 'pokemon-lets-go-eevee-2025-03-24-savedata.bin',
		url: letsGoEeveeFixtureUrl,
		byteLength: 1048576,
		generation: 7
	},
	{
		name: 'Legends Arceus',
		fileName: 'pokemon-legends-arceus-2025-03-24-main.sav',
		url: legendsArceusFixtureUrl,
		byteLength: 1289478,
		generation: 8
	},
	{
		name: 'Scarlet',
		fileName: 'pokemon-scarlet-2025-03-24-main.sav',
		url: scarletFixtureUrl,
		byteLength: 4435304,
		generation: 9
	}
] as const;

describe('PKHeX Engine browser runtime smoke', () => {
	test('parses the Emerald Save File fixture through the published browser-wasm bundle', async () => {
		expect.assertions(13);

		const [engine, fixtureResponse] = await Promise.all([
			createPkhexEngine('/pkhex-engine'),
			fetch(fixtureUrl)
		]);
		const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());

		const version = await engine.getVersion();
		expect(version).toMatchObject({
			ok: true,
			value: { pkhexCoreVersion: expect.stringMatching(/^26\.5\.5\./) }
		});

		const save = await engine.summarizeSave(fixtureBytes, '011020251345.sav');
		expect(save).toStrictEqual({
			ok: true,
			value: {
				fileName: '011020251345.sav',
				saveType: 'SAV3E',
				gameVersion: 'E',
				gameVersionId: 3,
				generation: 3,
				trainerName: 'DIXIE',
				trainerId: expect.any(Number),
				playTime: expect.any(String),
				playedHours: expect.any(Number),
				playedMinutes: expect.any(Number),
				partyCount: 5,
				boxCount: 14,
				boxSlotCount: 30
			},
			error: null
		});

		const slots = await engine.listBoxSlots(fixtureBytes, '011020251345.sav', 0);
		expect(slots.ok).toBe(true);
		if (!slots.ok) {
			throw new Error('Expected fixture box slot summary to succeed.');
		}

		expect(slots.value).toHaveLength(30);
		expect(slots.value[0]).toMatchObject({
			box: 0,
			slot: 0,
			speciesId: 304,
			form: 0,
			format: 3,
			level: 11,
			nickname: 'ARON',
			isEgg: false,
			isEmpty: false
		});
		expect(slots.value[0]).toMatchObject({
			types: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
			stats: expect.arrayContaining([
				expect.objectContaining({ key: 'HP', value: expect.any(Number) })
			]),
			moves: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })])
		});
		expect(slots.value[1]).toMatchObject({
			box: 0,
			slot: 1,
			speciesId: 314,
			form: 0,
			format: 3,
			level: 14,
			nickname: 'ILLUMISE',
			isEgg: false,
			isEmpty: false
		});
		expect(slots.value[2]).toMatchObject({
			box: 0,
			slot: 2,
			speciesId: 0,
			level: 0,
			isEmpty: true
		});
		expect(slots.value[29]).toMatchObject({ box: 0, slot: 29 });
		expect(fixtureBytes.byteLength).toBe(131088);

		const workspace = await engine.loadSaveWorkspace(fixtureBytes, '011020251345.sav', 0);
		expect(workspace).toMatchObject({
			ok: true,
			value: {
				summary: { saveType: 'SAV3E', partyCount: 5, boxCount: 14 },
				partySlots: expect.arrayContaining([
					expect.objectContaining({ slot: 0, speciesId: expect.any(Number) })
				]),
				boxSlots: expect.arrayContaining([
					expect.objectContaining({ box: 0, slot: 0, speciesId: 304 })
				])
			}
		});

		const serialized = await engine.serializeSave(fixtureBytes, '011020251345.sav');
		expect(serialized).toMatchObject({
			ok: true,
			value: { byteLength: 131088 }
		});
		if (!serialized.ok) {
			throw new Error('Expected fixture serialization to succeed.');
		}
		expect(serialized.value.bytesBase64.length).toBeGreaterThan(0);
	});

	test.each(supportedFixtureCases)(
		'parses and loads the $name Save File fixture',
		async (fixture) => {
			const [engine, fixtureResponse] = await Promise.all([
				createPkhexEngine('/pkhex-engine'),
				fetch(fixture.url)
			]);
			const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());
			expect(fixtureBytes.byteLength).toBe(fixture.byteLength);

			const summary = await engine.summarizeSave(fixtureBytes, fixture.fileName);
			expect(summary.ok, JSON.stringify(summary.error)).toBe(true);
			if (!summary.ok) {
				throw new Error(`Expected ${fixture.name} summary to succeed.`);
			}
			expect(summary.value.boxCount).toBeGreaterThan(0);
			expect(summary.value.generation).toBeGreaterThan(0);

			const workspace = await engine.loadSaveWorkspace(fixtureBytes, fixture.fileName, 0);
			expect(workspace.ok, JSON.stringify(workspace.error)).toBe(true);
			if (!workspace.ok) {
				throw new Error(`Expected ${fixture.name} workspace load to succeed.`);
			}
			expect(workspace.value.summary.saveType).toBe(summary.value.saveType);
			expect(workspace.value.boxSlots.length).toBeGreaterThan(0);
		}
	);

	test.each(rajSaveFixtureCases)(
		"parses and loads Raj's $name Save File fixture",
		async (fixture) => {
			const [engine, fixtureResponse] = await Promise.all([
				createPkhexEngine('/pkhex-engine'),
				fetch(fixture.url)
			]);
			const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());
			expect(fixtureBytes.byteLength).toBe(fixture.byteLength);

			const summary = await engine.summarizeSave(fixtureBytes, fixture.fileName);
			expect(summary.ok, JSON.stringify(summary.error)).toBe(true);
			if (!summary.ok) {
				throw new Error(`Expected ${fixture.name} summary to succeed.`);
			}
			expect(summary.value.generation).toBe(fixture.generation);
			expect(summary.value.boxCount).toBeGreaterThan(0);
			expect(summary.value.boxSlotCount).toBeGreaterThan(0);

			const workspace = await engine.loadSaveWorkspace(fixtureBytes, fixture.fileName, 0);
			expect(workspace.ok, JSON.stringify(workspace.error)).toBe(true);
			if (!workspace.ok) {
				throw new Error(`Expected ${fixture.name} workspace load to succeed.`);
			}
			expect(workspace.value.summary.saveType).toBe(summary.value.saveType);
			expect(workspace.value.summary.gameVersion).toBe(summary.value.gameVersion);
			expect(workspace.value.boxSlots).toHaveLength(summary.value.boxSlotCount);

			const serialized = await engine.serializeSave(fixtureBytes, fixture.fileName);
			expect(serialized.ok, JSON.stringify(serialized.error)).toBe(true);
			if (!serialized.ok) {
				throw new Error(`Expected ${fixture.name} serialization to succeed.`);
			}
			expect(serialized.value.byteLength).toBeGreaterThan(0);
		}
	);

	test('applies Save File slot operations through the browser-wasm bundle', async () => {
		expect.assertions(13);

		const [engine, fixtureResponse] = await Promise.all([
			createPkhexEngine('/pkhex-engine'),
			fetch(fixtureUrl)
		]);
		const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());

		const moved = await engine.applySlotOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				kind: 'move',
				source: { zone: 'box', box: 0, slot: 0 },
				destination: { zone: 'box', box: 0, slot: 2 }
			},
			0
		);
		expect(moved.ok).toBe(true);
		if (!moved.ok) throw new Error('Expected move to succeed.');
		expect(moved.value.mutated).toBe(true);
		expect(moved.value.workspace.boxSlots[0]).toMatchObject({ slot: 0, isEmpty: true });
		expect(moved.value.workspace.boxSlots[2]).toMatchObject({ slot: 2, nickname: 'ARON' });

		const copied = await engine.applySlotOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				kind: 'copy',
				source: { zone: 'box', box: 0, slot: 0 },
				destination: { zone: 'box', box: 0, slot: 2 }
			},
			0
		);
		expect(copied.ok).toBe(true);
		if (!copied.ok) throw new Error('Expected copy to succeed.');
		expect(copied.value.mutated).toBe(true);
		expect(copied.value.workspace.boxSlots[0]).toMatchObject({ slot: 0, nickname: 'ARON' });
		expect(copied.value.workspace.boxSlots[2]).toMatchObject({ slot: 2, nickname: 'ARON' });

		const cleared = await engine.applySlotOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				kind: 'clear',
				source: { zone: 'box', box: 0, slot: 0 }
			},
			0
		);
		expect(cleared.ok).toBe(true);
		if (!cleared.ok) throw new Error('Expected clear to succeed.');
		expect(cleared.value.mutated).toBe(true);
		expect(cleared.value.workspace.boxSlots[0]).toMatchObject({ slot: 0, isEmpty: true });

		const occupiedCopy = await engine.applySlotOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				kind: 'copy',
				source: { zone: 'box', box: 0, slot: 0 },
				destination: { zone: 'box', box: 0, slot: 1 }
			},
			0
		);
		expect(occupiedCopy).toMatchObject({
			ok: false,
			error: { code: 'occupied-destination-slot' }
		});

		const emptySource = await engine.applySlotOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				kind: 'move',
				source: { zone: 'box', box: 0, slot: 2 },
				destination: { zone: 'box', box: 0, slot: 3 }
			},
			0
		);
		expect(emptySource).toMatchObject({
			ok: false,
			error: { code: 'empty-source-slot' }
		});
	});

	test('applies Save File Pokemon edits through the browser-wasm bundle', async () => {
		expect.assertions(14);

		const [engine, fixtureResponse] = await Promise.all([
			createPkhexEngine('/pkhex-engine'),
			fetch(fixtureUrl)
		]);
		const fixtureBytes = new Uint8Array(await fixtureResponse.arrayBuffer());

		const edited = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 0 },
				level: 25
			},
			0
		);
		expect(edited.ok).toBe(true);
		if (!edited.ok) throw new Error('Expected Pokemon level edit to succeed.');
		expect(edited.value.mutated).toBe(true);
		expect(edited.value.workspace.boxSlots[0]).toMatchObject({
			slot: 0,
			nickname: 'ARON',
			level: 25,
			experience: expect.any(Number),
			experienceProjection: expect.objectContaining({
				minLevel: 1,
				maxLevel: 100,
				currentLevelMinExperience: expect.any(Number)
			}),
			stats: expect.arrayContaining([
				expect.objectContaining({ key: 'HP', value: expect.any(Number) })
			])
		});
		expect(edited.value.workspace.boxSlots[0]?.experience ?? 0).toBeGreaterThan(0);

		const invalidLevel = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 0 },
				level: 101
			},
			0
		);
		expect(invalidLevel).toMatchObject({
			ok: false,
			error: { code: 'invalid-pokemon-edit' }
		});

		const currentLevelMinExperience =
			edited.value.workspace.boxSlots[0]?.experienceProjection?.currentLevelMinExperience;
		if (typeof currentLevelMinExperience !== 'number') {
			throw new Error('Expected edited Pokemon experience projection to be available.');
		}
		const explicitExperience = currentLevelMinExperience + 1;
		const experienceEdited = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 0 },
				experience: explicitExperience
			},
			0
		);
		expect(experienceEdited.ok).toBe(true);
		if (!experienceEdited.ok) {
			throw new Error('Expected Pokemon experience edit to succeed.');
		}
		expect(experienceEdited.value.mutated).toBe(true);
		expect(experienceEdited.value.workspace.boxSlots[0]).toMatchObject({
			slot: 0,
			nickname: 'ARON',
			experience: explicitExperience
		});

		const nicknameEdited = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 0 },
				nickname: 'RON',
				level: 25
			},
			0
		);
		expect(nicknameEdited.ok).toBe(true);
		if (!nicknameEdited.ok) {
			throw new Error('Expected Pokemon nickname edit to succeed.');
		}
		expect(nicknameEdited.value.mutated).toBe(true);
		expect(nicknameEdited.value.workspace.boxSlots[0]).toMatchObject({
			slot: 0,
			nickname: 'RON',
			level: 25
		});

		const emptySource = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 2 },
				level: 20
			},
			0
		);
		expect(emptySource).toMatchObject({
			ok: false,
			error: { code: 'empty-source-slot' }
		});

		const conflictingPayload = await engine.applyPokemonEditOperation(
			copyBytes(fixtureBytes),
			'011020251345.sav',
			{
				source: { zone: 'box', box: 0, slot: 0 },
				level: 20,
				experience: 1000
			},
			0
		);
		expect(conflictingPayload).toMatchObject({
			ok: false,
			error: { code: 'invalid-pokemon-edit' }
		});
		expect(fixtureBytes.byteLength).toBe(131088);
	});
});

function copyBytes(bytes: Uint8Array): Uint8Array {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy;
}
