import { getContext, setContext, tick } from 'svelte';
import type { SummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import type { SummonedWorkflowLauncher } from '$lib/pksx/summoned-workflow';
import type { ToastHost } from '$lib/pksx/toast/host.svelte';
import type {
	SaveFileLegalityFixBatchApplyResult,
	SaveFileLegalityFixBatchEntry,
	SaveFileLegalityFixBatchPreview,
	SaveFileLegalityFixableEntry,
	SaveFileLegalityProgress,
	SaveFileLegalityResult,
	SaveFileLegalityScanResult
} from '.';

const hostKey = Symbol('pksx-save-file-legality-report-host');

export type SaveFileLegalityReportProvider = {
	saveFileId: string;
	fileName: string;
	isCurrent(): boolean;
	run(
		signal: AbortSignal,
		onProgress: (progress: SaveFileLegalityProgress) => void
	): Promise<SaveFileLegalityScanResult>;
	previewFixes(
		results: SaveFileLegalityResult[],
		signal: AbortSignal
	): Promise<SaveFileLegalityFixBatchPreview>;
	applyFixes(
		preview: Extract<SaveFileLegalityFixBatchPreview, { status: 'complete' }>,
		signal: AbortSignal,
		onCommitting: () => void
	): Promise<SaveFileLegalityFixBatchApplyResult>;
	jumpToSlot(result: SaveFileLegalityResult): Promise<string | null>;
	openPokemonReport(result: SaveFileLegalityResult): Promise<boolean>;
};

export type SaveFileLegalityReportTarget = 'active-save' | 'active-collection';

export type SaveFileLegalityFixBatchViewState =
	| { status: 'idle' }
	| { status: 'previewing' }
	| { status: 'preview-ready'; entries: SaveFileLegalityFixBatchEntry[] }
	| { status: 'applying'; entries: SaveFileLegalityFixBatchEntry[] }
	| { status: 'committing'; entries: SaveFileLegalityFixBatchEntry[] }
	| {
			status: 'applied';
			entries: Array<
				| Exclude<SaveFileLegalityFixBatchEntry, SaveFileLegalityFixableEntry>
				| (Omit<SaveFileLegalityFixableEntry, 'status'> & { status: 'applied' })
			>;
	  }
	| { status: 'cancelled'; entries: SaveFileLegalityFixBatchEntry[] }
	| { status: 'error'; message: string; entries: SaveFileLegalityFixBatchEntry[] };

export type SaveFileLegalityReportViewState =
	| { status: 'idle' }
	| { status: 'loading'; progress: SaveFileLegalityProgress }
	| {
			status: 'ready';
			results: SaveFileLegalityResult[];
			stale: boolean;
			batch: SaveFileLegalityFixBatchViewState;
	  }
	| { status: 'cancelled'; results: SaveFileLegalityResult[] }
	| { status: 'error'; message: string; results: SaveFileLegalityResult[] };

export type SaveFileLegalityReportHost = {
	readonly state: SaveFileLegalityReportViewState;
	readonly fileName: string | null;
	register(
		provider: (target: SaveFileLegalityReportTarget) => SaveFileLegalityReportProvider | null
	): () => void;
	canOpen(target?: SaveFileLegalityReportTarget): boolean;
	open(launcher: SummonedWorkflowLauncher, target?: SaveFileLegalityReportTarget): boolean;
	run(): void;
	previewFixes(): void;
	applyFixes(): void;
	cancel(): void;
	close(): void;
	validate(): void;
	jumpToSlot(result: SaveFileLegalityResult): Promise<boolean>;
	openPokemonReport(result: SaveFileLegalityResult): Promise<boolean>;
};

export function createSaveFileLegalityReportHost(
	workflow: SummonedWorkflowHost,
	toast: Pick<ToastHost, 'success' | 'error'> = { success() {}, error() {} }
): SaveFileLegalityReportHost {
	let provider = $state<
		((target: SaveFileLegalityReportTarget) => SaveFileLegalityReportProvider | null) | null
	>(null);
	let captured = $state<SaveFileLegalityReportProvider | null>(null);
	let target = $state<SaveFileLegalityReportTarget>('active-save');
	let state = $state<SaveFileLegalityReportViewState>({ status: 'idle' });
	let controller: AbortController | null = null;
	let request = 0;

	function run() {
		const refreshed = provider?.(target) ?? null;
		if (refreshed && (!captured || refreshed.saveFileId === captured.saveFileId)) {
			captured = refreshed;
		}
		const source = captured;
		if (!source) return;
		controller?.abort();
		controller = new AbortController();
		const currentRequest = ++request;
		state = { status: 'loading', progress: { checked: 0, total: 0, location: null } };
		void source
			.run(controller.signal, (progress) => {
				if (currentRequest === request) state = { status: 'loading', progress };
			})
			.then((result) => {
				if (currentRequest !== request) return;
				state = viewStateFor(result, !source.isCurrent());
			});
	}

	return {
		get state() {
			return state;
		},
		get fileName() {
			return captured?.fileName ?? null;
		},
		register(next) {
			provider = next;
			return () => {
				if (provider === next) provider = null;
			};
		},
		canOpen(nextTarget = 'active-save') {
			return provider?.(nextTarget) != null;
		},
		open(launcher, nextTarget = 'active-save') {
			if (!provider) return false;
			target = nextTarget;
			captured = provider(target);
			if (!captured) return false;
			const opened = workflow.active
				? (workflow.openRelated('save-file-legality-report', launcher), true)
				: workflow.open('save-file-legality-report', launcher);
			if (!opened) {
				captured = null;
				return false;
			}
			run();
			return true;
		},
		run,
		previewFixes() {
			const source = captured;
			if (!source || state.status !== 'ready' || state.stale) return;
			const results = state.results;
			controller?.abort();
			controller = new AbortController();
			const currentRequest = ++request;
			state = { ...state, batch: { status: 'previewing' } };
			focusBatchCancel();
			void source.previewFixes(results, controller.signal).then((preview) => {
				if (currentRequest !== request || state.status !== 'ready') return;
				state = {
					...state,
					batch:
						preview.status === 'cancelled'
							? { status: 'cancelled', entries: preview.entries }
							: { status: 'preview-ready', entries: preview.entries }
				};
				if (preview.status === 'cancelled') toast.success('Legality Fix preview cancelled.');
			});
		},
		applyFixes() {
			const source = captured;
			if (
				!source ||
				state.status !== 'ready' ||
				state.stale ||
				state.batch.status !== 'preview-ready'
			)
				return;
			const entries = state.batch.entries;
			const preview = { status: 'complete' as const, entries };
			controller?.abort();
			controller = new AbortController();
			const currentRequest = ++request;
			state = { ...state, batch: { status: 'applying', entries } };
			focusBatchCancel();
			void source
				.applyFixes(preview, controller.signal, () => {
					if (
						currentRequest === request &&
						state.status === 'ready' &&
						state.batch.status === 'applying'
					) {
						state = { ...state, batch: { status: 'committing', entries } };
					}
				})
				.then((result) => {
					if (currentRequest !== request || state.status !== 'ready') return;
					if (result.status === 'cancelled') {
						state = { ...state, batch: { status: 'cancelled', entries } };
						toast.success('Legality Fix batch cancelled. No Pokemon changes were committed.');
						return;
					}
					if (result.status === 'error') {
						state = { ...state, batch: { status: 'error', message: result.message, entries } };
						toast.error(result.message);
						return;
					}
					const appliedById = Object.fromEntries(
						result.applied.map((entry) => [entry.result.id, entry])
					);
					state = {
						...state,
						stale: true,
						batch: {
							status: 'applied',
							entries: entries.map((entry) => {
								if (entry.status === 'unfixable') return entry;
								const applied = appliedById[entry.result.id] ?? entry;
								return { ...applied, status: 'applied' as const };
							})
						}
					};
					toast.success('All supported Legality Fixes succeeded.');
				});
		},
		cancel() {
			controller?.abort();
			if (state.status === 'loading') {
				request += 1;
				state = { status: 'cancelled', results: [] };
			} else if (
				state.status === 'ready' &&
				(state.batch.status === 'previewing' || state.batch.status === 'applying')
			) {
				const entries = state.batch.status === 'applying' ? state.batch.entries : [];
				request += 1;
				state = { ...state, batch: { status: 'cancelled', entries } };
				toast.success('Legality Fix batch cancelled. No Pokemon changes were committed.');
			}
		},
		close() {
			controller?.abort();
			controller = null;
			request += 1;
			state = { status: 'idle' };
			captured = null;
			const launcher = workflow.dismiss();
			if (launcher) {
				void tick().then(() => document.getElementById(launcher.id)?.focus());
			}
		},
		validate() {
			if (!captured || captured.isCurrent()) return;
			if (state.status === 'loading') request += 1;
			controller?.abort();
			if (state.status === 'ready') state = { ...state, stale: true };
			else if (state.status === 'loading') {
				state = {
					status: 'error',
					message: 'The Workspace changed. Run the report again.',
					results: []
				};
			}
		},
		async jumpToSlot(result) {
			if (batchIsBusy(state)) return false;
			if (!captured || !captured.isCurrent()) {
				if (state.status === 'ready') state = { ...state, stale: true };
				return false;
			}
			const focusId = await captured.jumpToSlot(result);
			if (!focusId) return false;
			controller?.abort();
			request += 1;
			state = { status: 'idle' };
			captured = null;
			workflow.closeAll();
			await tick();
			const target = document.getElementById(focusId);
			target?.focus();
			target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			return true;
		},
		async openPokemonReport(result) {
			if (batchIsBusy(state)) return false;
			if (!captured || !captured.isCurrent()) {
				if (state.status === 'ready') state = { ...state, stale: true };
				return false;
			}
			const opened = await captured.openPokemonReport(result);
			if (opened) {
				controller?.abort();
				request += 1;
			}
			return opened;
		}
	};
}

function batchIsBusy(state: SaveFileLegalityReportViewState) {
	return (
		state.status === 'ready' &&
		(state.batch.status === 'previewing' ||
			state.batch.status === 'applying' ||
			state.batch.status === 'committing')
	);
}

function focusBatchCancel() {
	void tick().then(() => document.getElementById('save-legality-close')?.focus());
}

function viewStateFor(
	result: SaveFileLegalityScanResult,
	stale: boolean
): SaveFileLegalityReportViewState {
	if (result.status === 'complete') {
		return { status: 'ready', results: result.results, stale, batch: { status: 'idle' } };
	}
	if (result.status === 'cancelled') return { status: 'cancelled', results: result.results };
	return { status: 'error', message: result.message, results: result.results };
}

export function setSaveFileLegalityReportHost(host: SaveFileLegalityReportHost) {
	return setContext(hostKey, host);
}

export function getSaveFileLegalityReportHost() {
	return getContext<SaveFileLegalityReportHost>(hostKey);
}
