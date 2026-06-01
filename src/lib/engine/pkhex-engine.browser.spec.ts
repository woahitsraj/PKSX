import { describe, expect, test } from 'vitest';
import fixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import { createPkhexEngine } from './pkhex-engine';

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
});

function copyBytes(bytes: Uint8Array): Uint8Array {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy;
}
