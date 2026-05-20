import { describe, expect, test } from 'vitest';
import { createMockEngine } from './mock-engine';
import type { EngineApi } from './types';

describe('createMockEngine', () => {
	test('implements the async EngineApi contract', async () => {
		expect.assertions(8);

		const engine: EngineApi = createMockEngine();

		await expect(engine.getVersion()).resolves.toMatchObject({
			ok: true,
			value: { pkhexCoreVersion: 'mock', facadeVersion: 'mock' }
		});

		const save = await engine.summarizeSave(new Uint8Array([1, 2, 3]), 'main');

		expect(save.ok).toBe(true);
		if (!save.ok) {
			throw new Error('Expected mock save summary to succeed.');
		}

		expect(save.value).toMatchObject({
			fileName: 'main',
			gameVersion: 'SV',
			gameVersionId: expect.any(Number)
		});
		expect(save.value.gameVersionId).toBeGreaterThan(0);

		const slots = await engine.listBoxSlots(new Uint8Array(), undefined, 0);

		expect(slots).toMatchObject({ ok: true });
		if (!slots.ok) {
			throw new Error('Expected mock box slots to succeed.');
		}

		expect(slots.value).toEqual(
			expect.arrayContaining([expect.objectContaining({ box: 0, slot: 0, speciesId: 25 })])
		);

		const workspace = await engine.loadSaveWorkspace(new Uint8Array(), 'main', 0);
		expect(workspace).toMatchObject({
			ok: true,
			value: {
				summary: { fileName: 'main' },
				partySlots: expect.arrayContaining([expect.objectContaining({ slot: 0, speciesId: 25 })]),
				boxSlots: expect.arrayContaining([
					expect.objectContaining({ box: 0, slot: 0, speciesId: 25 })
				])
			}
		});

		await expect(engine.serializeSave(new Uint8Array([1, 2, 3]), 'main')).resolves.toMatchObject({
			ok: true,
			value: { bytesBase64: 'AQID', byteLength: 3 }
		});
	});

	test('returns a typed failure for an invalid box', async () => {
		expect.assertions(1);

		const engine = createMockEngine();

		await expect(engine.listBoxSlots(new Uint8Array(), undefined, 1)).resolves.toMatchObject({
			ok: false,
			error: { code: 'invalid-box' }
		});
	});
});
