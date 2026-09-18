import { createPkhexWorkerEngine } from '$lib/engine/pkhex-worker-engine';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import { createSaveFileLegalityReportHost } from './host.svelte';
import { createSummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import { scanSaveFileLegality } from '.';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import emeraldUrl from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';

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
			jumpToSlot: async () => null,
			openPokemonReport: async () => false
		}));

		expect(host.open({ type: 'control', id: 'launcher' })).toBe(true);
		await vi.waitFor(() => expect(host.state.status).toBe('ready'), { timeout: 120_000 });
		current = false;
		host.validate();
		expect(host.state).toMatchObject({ status: 'ready', stale: true });
	}, 120_000);
});
