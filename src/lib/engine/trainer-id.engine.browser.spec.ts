import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import emeraldUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import xUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav?url';
import moonUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/moon/011020252257.sav?url';

for (const [name, url, modern] of [
	['Emerald', emeraldUrl, false],
	['X', xUrl, false],
	['Moon', moonUrl, true]
] as const) {
	test(`${name} Original Trainer IDs use the display domain and round-trip`, async () => {
		const engine = await createPkhexEngine();
		const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
		const workspace = await engine.loadSaveWorkspace(bytes, name, 0);
		if (!workspace.ok) throw new Error(workspace.error.message);
		const empty = workspace.value.boxSlots.find((slot) => slot.isEmpty);
		if (!empty) throw new Error('Expected an empty Box slot.');
		const source = { zone: 'box', box: 0, slot: empty.slot } as const;
		const created = await engine.createPokemon(
			bytes,
			name,
			{ destination: source, speciesId: 25, level: 5 },
			0
		);
		if (!created.ok) throw new Error(created.error.message);
		bytes.set(created.value.bytes);
		const detail = await engine.loadSlotEditData(bytes, name, source);
		if (!detail.ok) throw new Error(detail.error.message);
		const constraints = detail.value.originalTrainerEditConstraints;
		if (!constraints) throw new Error('Expected Trainer constraints.');
		expect(constraints.maxTrainerId).toBe(modern ? 999_999 : 65_535);
		expect(constraints.maxSecretId).toBe(modern ? 4_294 : 65_535);
		const entity = detail.value.entityBytesBase64;
		if (!entity) throw new Error('Expected native entity bytes.');
		const nativeBytes = Uint8Array.from(atob(entity), (char) => char.charCodeAt(0));
		const rawId = new DataView(nativeBytes.buffer).getUint32(name === 'Emerald' ? 4 : 0x0c, true);
		expect(constraints.currentTrainerId).toBe(modern ? rawId % 1_000_000 : rawId & 0xffff);
		expect(constraints.currentSecretId).toBe(modern ? Math.floor(rawId / 1_000_000) : rawId >>> 16);
		const retained = await engine.applyPokemonEditOperation(
			bytes.slice(),
			name,
			{
				source,
				originalTrainer: { name: constraints.currentName, trainerId: modern ? 123_456 : 123 }
			},
			0
		);
		if (!retained.ok) throw new Error(retained.error.message);
		const retainedDetail = await engine.loadSlotEditData(retained.value.bytes, name, source);
		expect(retainedDetail).toMatchObject({
			ok: true,
			value: {
				originalTrainerEditConstraints: {
					currentSecretId: constraints.currentSecretId
				}
			}
		});

		for (const [trainerId, secretId] of modern
			? [
					[0, 1],
					[999_999, 0],
					[967_294, 4_294]
				]
			: [
					[1, 2],
					[65_535, 65_534],
					[65_534, 65_535]
				]) {
			const edited = await engine.applyPokemonEditOperation(
				bytes.slice(),
				name,
				{
					source,
					originalTrainer: { name: constraints.currentName, trainerId, secretId }
				},
				0
			);
			if (!edited.ok) throw new Error(edited.error.message);
			const reopened = await engine.loadSlotEditData(edited.value.bytes, name, source);
			expect(reopened).toMatchObject({
				ok: true,
				value: {
					originalTrainerEditConstraints: {
						currentTrainerId: trainerId,
						currentSecretId: secretId
					}
				}
			});
		}
		for (const [trainerId, secretId] of modern
			? [
					[1_000_000, 0],
					[0, 4_295],
					[967_296, 4_294],
					[-1, 0]
				]
			: [
					[65_536, 0],
					[0, 65_536],
					[-1, 0]
				]) {
			const rejected = await engine.applyPokemonEditOperation(
				bytes.slice(),
				name,
				{
					source,
					originalTrainer: { name: constraints.currentName, trainerId, secretId }
				},
				0
			);
			expect(rejected).toMatchObject({ ok: false, error: { code: 'invalid-pokemon-edit' } });
		}
	});
}

test('combined origin and Trainer edits preserve the staged ID domain in both directions', async () => {
	const engine = await createPkhexEngine();
	const bytes = new Uint8Array(await (await fetch(moonUrl)).arrayBuffer());
	const source = { zone: 'box', box: 0, slot: 2 } as const;
	const created = await engine.createPokemon(
		bytes,
		'Moon',
		{ destination: source, speciesId: 25, level: 5 },
		0
	);
	if (!created.ok) throw new Error(created.error.message);
	const seeded = await engine.previewPokemonEditOperation(
		created.value.bytes,
		'Moon',
		{
			source,
			originalTrainer: { name: 'RAJAN', trainerId: 123_456, secretId: 432 }
		},
		0
	);
	if (!seeded.ok) throw new Error(seeded.error.message);
	let current = seeded.value.bytes;
	for (const originGameId of [24, 32]) {
		const detail = await engine.loadSlotEditData(current, 'Moon', source);
		if (!detail.ok) throw new Error(detail.error.message);
		const trainer = detail.value.originalTrainerEditConstraints;
		const met = detail.value.metDataEditConstraints;
		const location = met?.locationGroups.find((group) => group.originGameId === originGameId)
			?.options[0];
		if (!trainer || !met || !location) throw new Error('Expected edit choices for origin game.');
		// Preview exercises structural mutation without rejecting the intentionally changed encounter.
		const edited = await engine.previewPokemonEditOperation(
			current,
			'Moon',
			{
				source,
				originalTrainer: {
					name: 'RAJAN',
					trainerId: trainer.currentTrainerId,
					secretId: trainer.currentSecretId
				},
				metData: {
					originGameId,
					locationId: location.id,
					metLevel: met.currentMetLevel,
					metDate: met.currentMetDate
				}
			},
			0
		);
		if (!edited.ok) throw new Error(edited.error.message);
		current = edited.value.bytes;
		const reopened = await engine.loadSlotEditData(current, 'Moon', source);
		if (!reopened.ok || !reopened.value.entityBytesBase64)
			throw new Error('Expected edited entity.');
		const native = Uint8Array.from(atob(reopened.value.entityBytesBase64), (char) =>
			char.charCodeAt(0)
		);
		expect(new DataView(native.buffer).getUint32(0x0c, true)).toBe(432_123_456);
		expect(reopened.value.metDataEditConstraints?.currentOriginGameId).toBe(originGameId);
	}
});
