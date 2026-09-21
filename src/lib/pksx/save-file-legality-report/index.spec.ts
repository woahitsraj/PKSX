import { describe, expect, it, vi } from 'vitest';
import { createMockEngine, type LegalityReport, type SaveWorkspace } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	applySaveFileLegalityFixBatch,
	filterSaveFileLegalityResults,
	previewSaveFileLegalityFixBatch,
	scanSaveFileLegality,
	type SaveFileLegalityFixableEntry,
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

	it('previews only Illegal Pokemon and explains unsupported entries', async () => {
		const results = [
			result('illegal', 'Pikachu', 0),
			result('warning', 'Eevee', 1),
			result('illegal', 'Mew', 2)
		];
		const previewPokemonActions = vi.fn(async (_bytes, _fileName, source) => ({
			ok: true as const,
			value: {
				legalityReport: legalReport,
				actions: [
					{
						kind: 'legality-fix' as const,
						available: source.slot === 0,
						unavailableReason:
							source.slot === 0 ? null : 'The remaining legality issue has no supported fix.',
						applyAllToken: source.slot === 0 ? 'all-fixes:token' : null,
						changes:
							source.slot === 0
								? [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
								: [],
						choices: [],
						fixes: []
					}
				]
			},
			error: null
		}));
		const engine = createMockEngine({ previewPokemonActions });

		const preview = await previewSaveFileLegalityFixBatch({ engine, workspace, results });

		expect(preview.status).toBe('complete');
		if (preview.status !== 'complete') throw new Error('Expected a complete preview.');
		expect(preview.entries).toMatchObject([
			{
				result: { pokemonLabel: 'Pikachu' },
				status: 'fixable',
				changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
			},
			{
				result: { pokemonLabel: 'Mew' },
				status: 'unfixable',
				reason: 'The remaining legality issue has no supported fix.'
			}
		]);
		expect(previewPokemonActions).toHaveBeenCalledTimes(2);
		expect(previewPokemonActions.mock.calls.map((call) => call[2])).toEqual([
			{ zone: 'party', slot: 0 },
			{ zone: 'party', slot: 2 }
		]);
	});

	it('applies all previewed fixes to copied bytes and persists one dirty Workspace', async () => {
		const preview = fixBatchPreview();
		const applyPokemonAction = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				value: {
					bytes: new Uint8Array([4, 2, 3]),
					mutated: true,
					workspace: workspace.workspace,
					changes: preview.entries[0].changes
				},
				error: null
			})
			.mockResolvedValueOnce({
				ok: true,
				value: {
					bytes: new Uint8Array([4, 5, 3]),
					mutated: true,
					workspace: workspace.workspace,
					changes: preview.entries[1].changes
				},
				error: null
			});
		const engine = createMockEngine({ applyPokemonAction });
		const prepareAutomaticBackup = vi.fn(async () => ({
			state: { ...workspace, automaticBackupCreated: true },
			revision: 'revision-1',
			established: true
		}));
		const commitOrder: string[] = [];
		const persistWorkspace = vi.fn(async () => {
			commitOrder.push('persist');
		});

		const applied = await applySaveFileLegalityFixBatch({
			engine,
			workspace,
			preview,
			activeBox: 0,
			isCurrent: () => true,
			onCommitting: () => commitOrder.push('committing'),
			prepareAutomaticBackup,
			persistWorkspace
		});

		expect(applied).toMatchObject({ status: 'complete', applied: preview.entries });
		expect(prepareAutomaticBackup).toHaveBeenCalledOnce();
		expect(applyPokemonAction).toHaveBeenCalledTimes(2);
		expect(applyPokemonAction.mock.calls[0][0]).toEqual(new Uint8Array([1, 2, 3]));
		expect(applyPokemonAction.mock.calls[1][0]).toEqual(new Uint8Array([4, 2, 3]));
		expect(workspace.bytes).toEqual(new Uint8Array([1, 2, 3]));
		expect(persistWorkspace).toHaveBeenCalledOnce();
		expect(commitOrder).toEqual(['committing', 'persist']);
		expect(persistWorkspace).toHaveBeenCalledWith(
			expect.objectContaining({
				bytes: new Uint8Array([4, 5, 3]),
				dirty: true,
				automaticBackupCreated: true
			}),
			'revision-1'
		);
	});

	it('does not commit partial results when one fix fails', async () => {
		const preview = fixBatchPreview();
		const applyPokemonAction = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				value: {
					bytes: new Uint8Array([4, 2, 3]),
					mutated: true,
					workspace: workspace.workspace,
					changes: preview.entries[0].changes
				},
				error: null
			})
			.mockResolvedValueOnce({
				ok: false,
				value: null,
				error: { code: 'stale-pokemon-action-preview', message: 'The preview is stale.' }
			});
		const persistWorkspace = vi.fn();

		const applied = await applySaveFileLegalityFixBatch({
			engine: createMockEngine({ applyPokemonAction }),
			workspace,
			preview,
			activeBox: 0,
			isCurrent: () => true,
			prepareAutomaticBackup: async () => ({
				state: { ...workspace, automaticBackupCreated: true },
				revision: 'revision-1',
				established: true
			}),
			persistWorkspace
		});

		expect(applied).toMatchObject({ status: 'error', message: 'The preview is stale.' });
		expect(persistWorkspace).not.toHaveBeenCalled();
		expect(workspace.bytes).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('cancels before the final commit and leaves the Workspace unchanged', async () => {
		const preview = fixBatchPreview();
		const controller = new AbortController();
		const applyPokemonAction = vi.fn(async () => {
			controller.abort();
			return {
				ok: true as const,
				value: {
					bytes: new Uint8Array([4, 2, 3]),
					mutated: true,
					workspace: workspace.workspace,
					changes: preview.entries[0].changes
				},
				error: null
			};
		});
		const persistWorkspace = vi.fn();

		const applied = await applySaveFileLegalityFixBatch({
			engine: createMockEngine({ applyPokemonAction }),
			workspace,
			preview,
			activeBox: 0,
			signal: controller.signal,
			isCurrent: () => true,
			prepareAutomaticBackup: async () => ({
				state: { ...workspace, automaticBackupCreated: true },
				revision: 'revision-1',
				established: true
			}),
			persistWorkspace
		});

		expect(applied.status).toBe('cancelled');
		expect(applyPokemonAction).toHaveBeenCalledOnce();
		expect(persistWorkspace).not.toHaveBeenCalled();
		expect(workspace.bytes).toEqual(new Uint8Array([1, 2, 3]));
	});
});

function result(
	classification: SaveFileLegalityResult['classification'],
	pokemonLabel: string,
	slot = 0
): SaveFileLegalityResult {
	return {
		id: pokemonLabel,
		source: { zone: 'party', slot },
		location: `Party, Slot ${slot + 1}`,
		pokemonLabel,
		speciesName: pokemonLabel,
		classification,
		firstIssue: classification === 'legal' ? 'No issues found.' : 'Example issue.',
		report: legalReport
	};
}

function fixBatchPreview(): {
	status: 'complete';
	entries: [SaveFileLegalityFixableEntry, SaveFileLegalityFixableEntry];
} {
	return {
		status: 'complete',
		entries: [
			{
				result: result('illegal', 'Pikachu', 0),
				status: 'fixable',
				operation: { kind: 'legality-fix', choiceId: 'fix-1' },
				changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
			},
			{
				result: result('illegal', 'Mew', 2),
				status: 'fixable',
				operation: { kind: 'legality-fix', choiceId: 'fix-2' },
				changes: [{ field: 'Ball', before: 'None', after: 'Poke Ball' }]
			}
		]
	};
}
