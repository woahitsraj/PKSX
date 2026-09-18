import { describe, expect, it, vi } from 'vitest';
import { createMockEngine, type LegalityReport, type SaveWorkspace } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	filterSaveFileLegalityResults,
	scanSaveFileLegality,
	type SaveFileLegalityResult
} from '.';

const workspace = {
	file: {
		id: 'save-1',
		originalFileName: 'main.sav',
		byteLength: 3,
		importedAt: '2026-09-18T00:00:00.000Z',
		updatedAt: '2026-09-18T00:00:00.000Z'
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
			playTime: '1:00',
			playedHours: 1,
			playedMinutes: 0,
			partyCount: 1,
			boxCount: 1,
			boxSlotCount: 30
		},
		boxNames: { supported: true, names: ['BOX 1'], unsupportedReason: null },
		partySlots: [],
		boxSlots: []
	} satisfies SaveWorkspace,
	dirty: false,
	restoredFromBackup: null,
	automaticBackupCreated: false
} satisfies WorkspaceState;

const legalReport: LegalityReport = {
	legal: true,
	judgement: 'Legal',
	summary: 'This Pokemon is legal.',
	fixableProblems: [],
	warnings: [],
	messages: [{ severity: 'Valid', identifier: 'Encounter', message: 'Encounter is valid.' }]
};

describe('Save File-wide Legality Report', () => {
	it('scans Party and every occupied Box Slot without mutating the Workspace', async () => {
		const checks: string[] = [];
		const progress: string[] = [];
		const engine = createMockEngine({
			checkSlotLegality: vi.fn(async (_bytes, _fileName, source) => {
				checks.push(
					source.zone === 'party' ? `party:${source.slot}` : `box:${source.box}:${source.slot}`
				);
				return { ok: true as const, value: legalReport, error: null };
			})
		});
		const beforeBytes = workspace.bytes;

		const result = await scanSaveFileLegality({
			engine,
			workspace,
			onProgress: ({ checked, total }) => progress.push(`${checked}/${total}`)
		});

		expect(result).toMatchObject({ status: 'complete', total: 2 });
		expect(checks).toEqual(['party:0', 'box:0:0']);
		expect(progress).toEqual(['0/2', '1/2', '2/2']);
		expect(workspace).toMatchObject({ dirty: false, bytes: beforeBytes });
	});

	it('stops between worker-backed Legality Checks when cancelled', async () => {
		const controller = new AbortController();
		const checkSlotLegality = vi.fn(async () => ({
			ok: true as const,
			value: legalReport,
			error: null
		}));
		const engine = createMockEngine({ checkSlotLegality });

		const result = await scanSaveFileLegality({
			engine,
			workspace,
			signal: controller.signal,
			onProgress: ({ checked }) => {
				if (checked === 1) controller.abort();
			}
		});

		expect(result).toMatchObject({ status: 'cancelled', checked: 1, total: 2 });
		expect(checkSlotLegality).toHaveBeenCalledTimes(1);
	});

	it('classifies and filters Legal, warning-grade, and Illegal results', () => {
		const results = [
			result('legal', 'Pikachu'),
			result('warning', 'Eevee'),
			result('illegal', 'Mew')
		];

		expect(filterSaveFileLegalityResults(results, 'all')).toHaveLength(3);
		expect(filterSaveFileLegalityResults(results, 'warning')).toMatchObject([
			{ pokemonLabel: 'Eevee' }
		]);
		expect(filterSaveFileLegalityResults(results, 'illegal')).toMatchObject([
			{ pokemonLabel: 'Mew' }
		]);
	});
});

function result(
	classification: SaveFileLegalityResult['classification'],
	pokemonLabel: string
): SaveFileLegalityResult {
	return {
		id: pokemonLabel,
		source: { zone: 'party', slot: 0 },
		location: 'Party, Slot 1',
		pokemonLabel,
		speciesName: pokemonLabel,
		classification,
		firstIssue: classification === 'legal' ? 'No issues found.' : 'Example issue.',
		report: legalReport
	};
}
