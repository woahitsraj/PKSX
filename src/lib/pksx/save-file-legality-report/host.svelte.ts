import { getContext, setContext, tick } from 'svelte';
import type { SummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import type { SummonedWorkflowLauncher } from '$lib/pksx/summoned-workflow';
import type {
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
	jumpToSlot(result: SaveFileLegalityResult): Promise<string | null>;
	openPokemonReport(result: SaveFileLegalityResult): Promise<boolean>;
};

export type SaveFileLegalityReportTarget = 'active-save' | 'active-collection';

export type SaveFileLegalityReportViewState =
	| { status: 'idle' }
	| { status: 'loading'; progress: SaveFileLegalityProgress }
	| { status: 'ready'; results: SaveFileLegalityResult[]; stale: boolean }
	| { status: 'cancelled'; results: SaveFileLegalityResult[] }
	| { status: 'error'; message: string; results: SaveFileLegalityResult[] };

export type SaveFileLegalityReportHost = {
	readonly state: SaveFileLegalityReportViewState;
	readonly fileName: string | null;
	register(
		provider: (target: SaveFileLegalityReportTarget) => SaveFileLegalityReportProvider | null
	): () => void;
	open(launcher: SummonedWorkflowLauncher, target?: SaveFileLegalityReportTarget): boolean;
	run(): void;
	cancel(): void;
	close(): void;
	validate(): void;
	jumpToSlot(result: SaveFileLegalityResult): Promise<boolean>;
	openPokemonReport(result: SaveFileLegalityResult): Promise<boolean>;
};

export function createSaveFileLegalityReportHost(
	workflow: SummonedWorkflowHost
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
		cancel() {
			controller?.abort();
			if (state.status === 'loading') {
				request += 1;
				state = { status: 'cancelled', results: [] };
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

function viewStateFor(
	result: SaveFileLegalityScanResult,
	stale: boolean
): SaveFileLegalityReportViewState {
	if (result.status === 'complete') return { status: 'ready', results: result.results, stale };
	if (result.status === 'cancelled') return { status: 'cancelled', results: result.results };
	return { status: 'error', message: result.message, results: result.results };
}

export function setSaveFileLegalityReportHost(host: SaveFileLegalityReportHost) {
	return setContext(hostKey, host);
}

export function getSaveFileLegalityReportHost() {
	return getContext<SaveFileLegalityReportHost>(hostKey);
}
