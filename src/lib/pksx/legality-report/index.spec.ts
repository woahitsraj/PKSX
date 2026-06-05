import { describe, expect, it, vi } from 'vitest';
import { createMockEngine, type SaveWorkspace } from '$lib/engine';
import type { SlotView } from '$lib/components/pksx/types';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	createLegalityReportUnavailableState,
	requestLegalityReport
} from '$lib/pksx/legality-report';

const pokemonSlot: SlotView = {
	slot: 0,
	label: 'Pikachu',
	detail: 'Lv. 5',
	level: 5,
	speciesId: 25,
	form: 0,
	isEgg: false,
	spriteIdentity: {
		speciesId: 25,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default'
	},
	kind: 'pokemon'
};

const emptySlot: SlotView = {
	slot: 1,
	label: 'Empty',
	detail: '',
	level: null,
	speciesId: null,
	form: null,
	isEgg: false,
	spriteIdentity: null,
	kind: 'empty'
};

const workspace = {
	file: {
		id: 'save-1',
		originalFileName: 'main.sav',
		byteLength: 3,
		importedAt: '2026-06-05T00:00:00.000Z',
		updatedAt: '2026-06-05T00:00:00.000Z'
	},
	bytes: new Uint8Array([1, 2, 3]),
	workspace: {
		summary: {
			fileName: 'main.sav',
			saveType: 'SAV9SV',
			gameVersion: 'SV',
			gameVersionId: 45,
			generation: 9,
			trainerName: 'PKSX',
			trainerId: 41203,
			playTime: '47:12',
			playedHours: 47,
			playedMinutes: 12,
			partyCount: 1,
			boxCount: 1,
			boxSlotCount: 30
		},
		partySlots: [],
		boxSlots: []
	} satisfies SaveWorkspace,
	dirty: false,
	restoredFromBackup: null,
	automaticBackupCreated: false
} satisfies WorkspaceState;

describe('legality report state', () => {
	it('marks empty Slots unavailable before calling the engine', async () => {
		expect.assertions(2);
		const engine = createMockEngine({ checkSlotLegality: vi.fn() });

		const result = await requestLegalityReport({
			workspace,
			engine,
			slot: emptySlot,
			source: { zone: 'box', box: 0, slot: 1 },
			location: 'Box 1, slot 2'
		});

		expect(result.state).toEqual(createLegalityReportUnavailableState(emptySlot, 'Box 1, slot 2'));
		expect(engine.checkSlotLegality).not.toHaveBeenCalled();
	});

	it('uses the PKHeX Engine facade and returns report lines for occupied Slots', async () => {
		expect.assertions(4);
		const engine = createMockEngine({
			checkSlotLegality: vi.fn(async () => ({
				ok: true as const,
				value: {
					legal: false,
					judgement: 'Illegal',
					summary: 'PKHeX found legality issues for this Pokemon.',
					warnings: [{ severity: 'Fishy', identifier: 'Encounter', message: 'Encounter warning.' }],
					messages: [{ severity: 'Invalid', identifier: 'Moves', message: 'Invalid move.' }]
				},
				error: null
			}))
		});

		const result = await requestLegalityReport({
			workspace,
			engine,
			slot: pokemonSlot,
			source: { zone: 'box', box: 0, slot: 0 },
			location: 'Box 1, slot 1'
		});

		expect(engine.checkSlotLegality).toHaveBeenCalledWith(workspace.bytes, 'main.sav', {
			zone: 'box',
			box: 0,
			slot: 0
		});
		expect(result.state).toMatchObject({
			status: 'ready',
			report: { legal: false, warnings: [{ message: 'Encounter warning.' }] }
		});
		expect(result.dirtyChanged).toBe(false);
		expect(result.bytesChanged).toBe(false);
	});

	it('surfaces unsupported formats as unavailable feedback', async () => {
		expect.assertions(1);
		const engine = createMockEngine({
			checkSlotLegality: vi.fn(async () => ({
				ok: false as const,
				value: null,
				error: {
					code: 'unsupported-save' as const,
					message: 'PKHeX.Core could not recognize this save file.'
				}
			}))
		});

		await expect(
			requestLegalityReport({
				workspace,
				engine,
				slot: pokemonSlot,
				source: { zone: 'box', box: 0, slot: 0 },
				location: 'Box 1, slot 1'
			})
		).resolves.toMatchObject({
			state: {
				status: 'unavailable',
				message: 'PKHeX.Core could not recognize this save file.'
			}
		});
	});

	it('does not mutate the Workspace dirty flag or bytes', async () => {
		expect.assertions(3);
		const originalBytes = workspace.bytes;
		const engine = createMockEngine();

		const result = await requestLegalityReport({
			workspace,
			engine,
			slot: pokemonSlot,
			source: { zone: 'box', box: 0, slot: 0 },
			location: 'Box 1, slot 1'
		});

		expect(result.dirtyChanged).toBe(false);
		expect(result.bytesChanged).toBe(false);
		expect(workspace).toMatchObject({ dirty: false, bytes: originalBytes });
	});
});
