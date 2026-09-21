import { createPkhexWorkerEngine } from '$lib/engine/pkhex-worker-engine';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import { createSaveFileLegalityReportHost } from './host.svelte';
import { createSummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import {
	applySaveFileLegalityFixBatch,
	previewSaveFileLegalityFixBatch,
	scanSaveFileLegality
} from '.';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import emeraldUrl from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import platinumUrl from '../../../../test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav?url';

let fixtureBytes: Uint8Array;

beforeAll(async () => {
	fixtureBytes = new Uint8Array(await (await fetch(emeraldUrl)).arrayBuffer());
});

async function workspace() {
	const engine = createPkhexWorkerEngine('/pkhex-engine');
	const loaded = await engine.loadSaveWorkspace(fixtureBytes, '011020251345.sav', 0);
	if (!loaded.ok) throw loaded.error;
	return {
		engine,
		workspace: createCleanWorkspaceState({
			file: {
				id: 'emerald',
				originalFileName: '011020251345.sav',
				byteLength: fixtureBytes.byteLength,
				importedAt: '2026-09-18T00:00:00.000Z',
				updatedAt: '2026-09-18T00:00:00.000Z'
			},
			bytes: fixtureBytes,
			workspace: loaded.value
		})
	};
}

describe('Save File-wide Legality Report with real Save File bytes', () => {
	test('reports progress for Party and occupied Box Slots without changing the Workspace', async () => {
		const setup = await workspace();
		const before = setup.workspace.bytes.slice();
		const progress: number[] = [];
		const result = await scanSaveFileLegality({
			...setup,
			onProgress: ({ checked }) => progress.push(checked)
		});

		expect(result.status).toBe('complete');
		if (result.status !== 'complete') throw new Error('The report did not complete.');
		expect(result.results.some(({ source }) => source.zone === 'party')).toBe(true);
		expect(result.results.some(({ source }) => source.zone === 'box')).toBe(true);
		expect(progress.at(0)).toBe(0);
		expect(progress.at(-1)).toBe(result.total);
		expect(setup.workspace.bytes).toEqual(before);
		expect(setup.workspace.dirty).toBe(false);
	}, 120_000);

	test('cancels after a reported worker result', async () => {
		const setup = await workspace();
		const controller = new AbortController();
		const result = await scanSaveFileLegality({
			...setup,
			signal: controller.signal,
			onProgress: ({ checked }) => {
				if (checked === 1) controller.abort();
			}
		});

		expect(result).toMatchObject({ status: 'cancelled', checked: 1 });
		expect(setup.workspace.dirty).toBe(false);
	}, 60_000);

	test('marks completed results stale when the real-byte Workspace changes', async () => {
		const setup = await workspace();
		let current = true;
		const host = createSaveFileLegalityReportHost(createSummonedWorkflowHost());
		host.register(() => ({
			saveFileId: setup.workspace.file.id,
			fileName: setup.workspace.file.originalFileName ?? 'save.sav',
			isCurrent: () => current,
			run: (signal, onProgress) => scanSaveFileLegality({ ...setup, signal, onProgress }),
			previewFixes: async () => ({ status: 'complete', entries: [] }),
			applyFixes: async () => ({ status: 'error', message: 'No fixes.' }),
			jumpToSlot: async () => null,
			openPokemonReport: async () => false
		}));

		expect(host.open({ type: 'control', id: 'launcher' })).toBe(true);
		await vi.waitFor(() => expect(host.state.status).toBe('ready'), { timeout: 120_000 });
		current = false;
		host.validate();
		expect(host.state).toMatchObject({ status: 'ready', stale: true });
	}, 120_000);

	test('retains exact candidates across 140 previews and commits one copied-byte worker batch', async () => {
		const bytes = new Uint8Array(await (await fetch(platinumUrl)).arrayBuffer());
		const original = bytes.slice();
		const engine = createPkhexWorkerEngine('/pkhex-engine');
		const loaded = await engine.loadSaveWorkspace(bytes, 'pokemon-platinum-eu.sav', 2);
		if (!loaded.ok) throw loaded.error;
		const state = createCleanWorkspaceState({
			file: {
				id: 'platinum',
				originalFileName: 'pokemon-platinum-eu.sav',
				byteLength: bytes.byteLength,
				importedAt: '2026-09-18T00:00:00.000Z',
				updatedAt: '2026-09-18T00:00:00.000Z'
			},
			bytes,
			workspace: loaded.value
		});
		const scan = await scanSaveFileLegality({ engine, workspace: state });
		if (scan.status !== 'complete') throw new Error('Expected the Platinum report to complete.');
		const preview = await previewSaveFileLegalityFixBatch({
			engine,
			workspace: state,
			results: scan.results
		});
		if (preview.status !== 'complete') throw new Error('Expected the batch preview to complete.');
		expect(preview.entries.some(({ status }) => status === 'fixable')).toBe(true);
		expect(preview.entries.some(({ status }) => status === 'unfixable')).toBe(true);
		expect(preview.entries).toHaveLength(
			scan.results.filter(({ classification }) => classification === 'illegal').length
		);
		const firstFixable = preview.entries.find(({ status }) => status === 'fixable');
		if (!firstFixable || firstFixable.status !== 'fixable') {
			throw new Error('Expected a supported Legality Fix.');
		}
		for (let index = 0; index < 140; index += 1) {
			const extraPreview = await engine.previewPokemonActions(
				state.bytes,
				state.file.originalFileName ?? undefined,
				firstFixable.result.source
			);
			if (!extraPreview.ok) throw extraPreview.error;
		}

		const persistWorkspace = vi.fn(async () => undefined);
		const applied = await applySaveFileLegalityFixBatch({
			engine,
			workspace: state,
			preview,
			activeBox: 2,
			isCurrent: () => true,
			prepareAutomaticBackup: async (workspace) => ({
				state: { ...workspace, automaticBackupCreated: true },
				revision: 'revision-1',
				established: true
			}),
			persistWorkspace
		});

		expect(applied.status).toBe('complete');
		expect(persistWorkspace).toHaveBeenCalledOnce();
		expect(bytes).toEqual(original);
		if (applied.status !== 'complete') throw new Error('Expected the batch to apply.');
		expect(applied.workspace.dirty).toBe(true);
		expect(applied.workspace.bytes).not.toEqual(original);
	}, 120_000);
});
