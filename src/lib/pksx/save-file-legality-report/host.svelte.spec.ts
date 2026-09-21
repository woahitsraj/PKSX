import { describe, expect, it, vi } from 'vitest';
import type { SummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import {
	createSaveFileLegalityReportHost,
	type SaveFileLegalityReportProvider
} from './host.svelte';
import type { SaveFileLegalityScanResult } from '.';

describe('Save File Legality Report host', () => {
	it('marks results stale and reruns against a refreshed Workspace capture', async () => {
		let version = 1;
		let current = true;
		const runs: number[] = [];
		const workflow = {
			active: null,
			open: vi.fn(() => true),
			openRelated: vi.fn(),
			dismiss: vi.fn(() => null),
			closeAll: vi.fn(),
			subscribe: vi.fn(() => () => {})
		} satisfies SummonedWorkflowHost;
		const host = createSaveFileLegalityReportHost(workflow);
		host.register(() => provider(version, () => current, runs));

		expect(host.open({ type: 'control', id: 'launcher' })).toBe(true);
		await vi.waitFor(() => expect(host.state.status).toBe('ready'));
		expect(runs).toEqual([1]);

		current = false;
		host.validate();
		expect(host.state).toMatchObject({ status: 'ready', stale: true });

		version = 2;
		current = true;
		host.run();
		await vi.waitFor(() => expect(runs).toEqual([1, 2]));
		expect(host.state).toMatchObject({ status: 'ready', stale: false });
	});

	it('keeps the Workspace-changed error when an invalidated scan finishes', async () => {
		let current = true;
		let finish: ((result: SaveFileLegalityScanResult) => void) | undefined;
		const workflow = {
			active: null,
			open: vi.fn(() => true),
			openRelated: vi.fn(),
			dismiss: vi.fn(() => null),
			closeAll: vi.fn(),
			subscribe: vi.fn(() => () => {})
		} satisfies SummonedWorkflowHost;
		const host = createSaveFileLegalityReportHost(workflow);
		host.register(() => ({
			...provider(1, () => current, []),
			run: () => new Promise((resolve) => (finish = resolve))
		}));

		expect(host.open({ type: 'control', id: 'launcher' })).toBe(true);
		current = false;
		host.validate();
		expect(host.state).toMatchObject({
			status: 'error',
			message: 'The Workspace changed. Run the report again.'
		});

		finish?.({ status: 'cancelled', checked: 0, total: 0, results: [] });
		await Promise.resolve();
		expect(host.state).toMatchObject({
			status: 'error',
			message: 'The Workspace changed. Run the report again.'
		});
	});
});

function provider(
	version: number,
	isCurrent: () => boolean,
	runs: number[]
): SaveFileLegalityReportProvider {
	return {
		saveFileId: 'save-1',
		fileName: 'main.sav',
		isCurrent,
		run: async (_signal, onProgress) => {
			runs.push(version);
			onProgress({ checked: 0, total: 0, location: null });
			return { status: 'complete', checked: 0, total: 0, results: [] };
		},
		jumpToSlot: async () => null,
		openPokemonReport: async () => false
	};
}
