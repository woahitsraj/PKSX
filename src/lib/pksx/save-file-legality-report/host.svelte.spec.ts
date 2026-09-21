import { describe, expect, it, vi } from 'vitest';
import type { SummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import {
	createSaveFileLegalityReportHost,
	type SaveFileLegalityReportProvider
} from './host.svelte';
import type {
	SaveFileLegalityFixBatchApplyResult,
	SaveFileLegalityFixBatchPreview,
	SaveFileLegalityScanResult
} from '.';

describe('Save File Legality Report host', () => {
	it('reports whether the registered provider can capture the requested Save File', () => {
		let captured: SaveFileLegalityReportProvider | null = null;
		const host = createSaveFileLegalityReportHost(workflowHost());
		host.register(() => captured);

		expect(host.canOpen()).toBe(false);
		captured = provider(1, () => true, []);
		expect(host.canOpen()).toBe(true);
	});

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

	it('previews and applies a batch while preserving per-Pokemon outcomes', async () => {
		const workflow = workflowHost();
		const toast = { success: vi.fn(), error: vi.fn() };
		const previewFixes = vi.fn(async () => ({
			status: 'complete' as const,
			entries: [
				{
					result: reportResult('Pikachu'),
					status: 'fixable' as const,
					operation: { kind: 'legality-fix' as const, choiceId: 'fix:1' },
					changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
				},
				{
					result: reportResult('Mew'),
					status: 'unfixable' as const,
					reason: 'No supported Legality Fix is available.'
				}
			]
		}));
		const applyFixes = vi.fn(async (preview: Awaited<ReturnType<typeof previewFixes>>) => ({
			status: 'complete' as const,
			workspace: {} as never,
			applied: preview.entries.filter(
				(entry): entry is Extract<(typeof preview.entries)[number], { status: 'fixable' }> =>
					entry.status === 'fixable'
			)
		}));
		const host = createSaveFileLegalityReportHost(workflow, toast);
		host.register(() => ({
			...provider(1, () => true, []),
			previewFixes,
			applyFixes
		}));

		host.open({ type: 'control', id: 'launcher' });
		await vi.waitFor(() => expect(host.state.status).toBe('ready'));
		host.previewFixes();
		await vi.waitFor(() =>
			expect(host.state).toMatchObject({
				status: 'ready',
				batch: {
					status: 'preview-ready',
					entries: [{ status: 'fixable' }, { status: 'unfixable' }]
				}
			})
		);
		host.applyFixes();
		await vi.waitFor(() =>
			expect(host.state).toMatchObject({
				status: 'ready',
				stale: true,
				batch: { status: 'applied', entries: [{ status: 'applied' }, { status: 'unfixable' }] }
			})
		);
		expect(previewFixes).toHaveBeenCalledOnce();
		expect(applyFixes).toHaveBeenCalledOnce();
		expect(toast.success).toHaveBeenCalledWith('All supported Legality Fixes succeeded.');
	});

	it('guards result navigation and hands Controller Focus to Cancel during batch work', async () => {
		const preview = deferred<SaveFileLegalityFixBatchPreview>();
		const apply = deferred<SaveFileLegalityFixBatchApplyResult>();
		const jumpToSlot = vi.fn(async () => 'slot-1');
		const openPokemonReport = vi.fn(async () => true);
		const toast = { success: vi.fn(), error: vi.fn() };
		document.body.innerHTML =
			'<button id="other-control">Other</button><button id="save-legality-close">Cancel</button>';
		const other = document.getElementById('other-control');
		const cancel = document.getElementById('save-legality-close');
		const host = createSaveFileLegalityReportHost(workflowHost(), toast);
		host.register(() => ({
			...provider(1, () => true, []),
			previewFixes: () => preview.promise,
			applyFixes: () => apply.promise,
			jumpToSlot,
			openPokemonReport
		}));
		host.open({ type: 'control', id: 'launcher' });
		await vi.waitFor(() => expect(host.state.status).toBe('ready'));

		other?.focus();
		host.previewFixes();
		await vi.waitFor(() => expect(document.activeElement).toBe(cancel));
		await expect(host.jumpToSlot(reportResult('Pikachu'))).resolves.toBe(false);
		await expect(host.openPokemonReport(reportResult('Pikachu'))).resolves.toBe(false);
		expect(jumpToSlot).not.toHaveBeenCalled();
		expect(openPokemonReport).not.toHaveBeenCalled();

		preview.resolve({
			status: 'complete',
			entries: [
				{
					result: reportResult('Pikachu'),
					status: 'fixable',
					operation: { kind: 'legality-fix', choiceId: 'fix:1' },
					changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
				}
			]
		});
		await vi.waitFor(() =>
			expect(host.state).toMatchObject({ batch: { status: 'preview-ready' } })
		);
		other?.focus();
		host.applyFixes();
		await vi.waitFor(() => expect(document.activeElement).toBe(cancel));
		await expect(host.jumpToSlot(reportResult('Pikachu'))).resolves.toBe(false);
		await expect(host.openPokemonReport(reportResult('Pikachu'))).resolves.toBe(false);
		expect(jumpToSlot).not.toHaveBeenCalled();
		expect(openPokemonReport).not.toHaveBeenCalled();

		host.cancel();
		expect(host.state).toMatchObject({ batch: { status: 'cancelled' } });
		expect(toast.success).toHaveBeenCalledWith(
			'Legality Fix batch cancelled. No Pokemon changes were committed.'
		);
		document.body.replaceChildren();
	});

	it('does not report cancellation after the final Workspace commit starts', async () => {
		const finishCommit = deferred<void>();
		const workflow = workflowHost();
		const host = createSaveFileLegalityReportHost(workflow);
		host.register(() => ({
			...provider(1, () => true, []),
			previewFixes: async () => ({
				status: 'complete',
				entries: [
					{
						result: reportResult('Pikachu'),
						status: 'fixable',
						operation: { kind: 'legality-fix', choiceId: 'fix:1' },
						changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
					}
				]
			}),
			applyFixes: async (preview, _signal, onCommitting) => {
				onCommitting();
				await finishCommit.promise;
				return {
					status: 'complete',
					workspace: {} as never,
					applied: preview.entries.filter((entry) => entry.status === 'fixable')
				};
			}
		}));

		host.open({ type: 'control', id: 'launcher' });
		await vi.waitFor(() => expect(host.state.status).toBe('ready'));
		host.previewFixes();
		await vi.waitFor(() =>
			expect(host.state).toMatchObject({ batch: { status: 'preview-ready' } })
		);
		host.applyFixes();
		await vi.waitFor(() => expect(host.state).toMatchObject({ batch: { status: 'committing' } }));

		host.cancel();
		expect(host.state).toMatchObject({ batch: { status: 'committing' } });
		finishCommit.resolve();
		await vi.waitFor(() => expect(host.state).toMatchObject({ batch: { status: 'applied' } }));
	});
});

function workflowHost() {
	return {
		active: null,
		open: vi.fn(() => true),
		openRelated: vi.fn(),
		dismiss: vi.fn(() => null),
		closeAll: vi.fn(),
		subscribe: vi.fn(() => () => {})
	} satisfies SummonedWorkflowHost;
}

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
		previewFixes: async () => ({ status: 'complete', entries: [] }),
		applyFixes: async () => ({ status: 'error', message: 'No fixes.' }),
		jumpToSlot: async () => null,
		openPokemonReport: async () => false
	};
}

function reportResult(pokemonLabel: string) {
	return {
		id: pokemonLabel,
		source: { zone: 'party' as const, slot: 0 },
		location: 'Party, Slot 1',
		pokemonLabel,
		speciesName: pokemonLabel,
		classification: 'illegal' as const,
		firstIssue: 'Example issue.',
		report: {
			legal: false,
			judgement: 'Illegal',
			summary: 'This Pokemon has legality issues.',
			fixableProblems: [],
			warnings: [],
			messages: []
		}
	};
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((next) => (resolve = next));
	return { promise, resolve };
}
