import { describe, expect, test } from 'vitest';
import colosseumFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/colosseum/011020251345.gci?url';
import fixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import moonFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';
import sunMoonDemoFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/sun-moon-demo/181020251439.sav?url';
import ultraMoonFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/ultra-moon/011020252224.sav?url';
import ultraSunFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/ultra-sun/011020252224.sav?url';
import xFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav?url';
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
});
