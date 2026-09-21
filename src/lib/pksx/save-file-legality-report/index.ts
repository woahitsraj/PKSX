import type {
	BoxSlotSummary,
	EngineApi,
	PokemonActionChange,
	LegalityReport,
	PartySlotSummary,
	SaveSlotRef,
	StoredPokemonActionOperation
} from '$lib/engine';
import type { PreparedAutomaticBackup, WorkspaceState } from '$lib/pksx/backup-workflow';

export type SaveFileLegalityClassification = 'legal' | 'warning' | 'illegal';
export type SaveFileLegalityFilter = 'all' | SaveFileLegalityClassification;

export type SaveFileLegalityResult = {
	id: string;
	source: SaveSlotRef;
	location: string;
	pokemonLabel: string;
	speciesName: string;
	classification: SaveFileLegalityClassification;
	firstIssue: string;
	report: LegalityReport;
};

export type SaveFileLegalityProgress = {
	checked: number;
	total: number;
	location: string | null;
};

export type SaveFileLegalityScanResult =
	| { status: 'complete'; results: SaveFileLegalityResult[]; checked: number; total: number }
	| { status: 'cancelled'; results: SaveFileLegalityResult[]; checked: number; total: number }
	| {
			status: 'error';
			message: string;
			results: SaveFileLegalityResult[];
			checked: number;
			total: number;
	  };

export type SaveFileLegalityFixableEntry = {
	result: SaveFileLegalityResult;
	status: 'fixable';
	operation: StoredPokemonActionOperation;
	changes: PokemonActionChange[];
};

export type SaveFileLegalityUnfixableEntry = {
	result: SaveFileLegalityResult;
	status: 'unfixable';
	reason: string;
};

export type SaveFileLegalityFixBatchEntry =
	| SaveFileLegalityFixableEntry
	| SaveFileLegalityUnfixableEntry;

export type SaveFileLegalityFixBatchPreview =
	| { status: 'complete'; entries: SaveFileLegalityFixBatchEntry[] }
	| { status: 'cancelled'; entries: SaveFileLegalityFixBatchEntry[] };

export type SaveFileLegalityFixBatchApplyResult =
	| {
			status: 'complete';
			workspace: WorkspaceState;
			applied: SaveFileLegalityFixableEntry[];
	  }
	| { status: 'cancelled' }
	| { status: 'error'; message: string };

export function saveFileLegalityOpenControlId(result: Pick<SaveFileLegalityResult, 'id'>) {
	return `save-legality-open-${result.id.replaceAll(':', '-')}`;
}

export async function scanSaveFileLegality(input: {
	engine: EngineApi;
	workspace: WorkspaceState;
	signal?: AbortSignal;
	onProgress?: (progress: SaveFileLegalityProgress) => void;
}): Promise<SaveFileLegalityScanResult> {
	const { engine, workspace, signal, onProgress } = input;
	const fileName = workspace.file.originalFileName ?? undefined;
	const firstBoxWorkspaceResult = await engine.loadSaveWorkspace(workspace.bytes, fileName, 0);
	if (!firstBoxWorkspaceResult.ok) return scanError(firstBoxWorkspaceResult.error.message);

	const targets: ScanTarget[] = [
		...firstBoxWorkspaceResult.value.partySlots
			.filter((slot) => !slot.isEmpty)
			.map((slot) => partyTarget(slot)),
		...firstBoxWorkspaceResult.value.boxSlots
			.filter((slot) => !slot.isEmpty)
			.map((slot) => boxTarget(slot))
	];

	for (let box = 1; box < firstBoxWorkspaceResult.value.summary.boxCount; box += 1) {
		if (signal?.aborted) return cancelled([], 0, targets.length);
		const listed = await engine.listBoxSlots(workspace.bytes, fileName, box);
		if (!listed.ok) return scanError(listed.error.message, [], 0, targets.length);
		targets.push(...listed.value.filter((slot) => !slot.isEmpty).map((slot) => boxTarget(slot)));
	}

	const results: SaveFileLegalityResult[] = [];
	onProgress?.({ checked: 0, total: targets.length, location: null });
	for (const target of targets) {
		if (signal?.aborted) return cancelled(results, results.length, targets.length);
		const checked = await engine.checkSlotLegality(workspace.bytes, fileName, target.source);
		if (!checked.ok) {
			return scanError(checked.error.message, results, results.length, targets.length);
		}
		results.push(createResult(target, checked.value));
		onProgress?.({ checked: results.length, total: targets.length, location: target.location });
	}

	return { status: 'complete', results, checked: results.length, total: targets.length };
}

export async function previewSaveFileLegalityFixBatch(input: {
	engine: EngineApi;
	workspace: WorkspaceState;
	results: SaveFileLegalityResult[];
	signal?: AbortSignal;
}): Promise<SaveFileLegalityFixBatchPreview> {
	const entries: SaveFileLegalityFixBatchEntry[] = [];
	const fileName = input.workspace.file.originalFileName ?? undefined;

	for (const result of input.results) {
		if (result.classification !== 'illegal') continue;
		if (input.signal?.aborted) return { status: 'cancelled', entries };

		const preview = await input.engine.previewPokemonActions(
			input.workspace.bytes,
			fileName,
			result.source
		);
		if (!preview.ok) {
			entries.push({ result, status: 'unfixable', reason: preview.error.message });
			continue;
		}

		const action = preview.value.actions.find(({ kind }) => kind === 'legality-fix');
		if (action?.available && action.applyAllToken && action.changes.length > 0) {
			entries.push({
				result,
				status: 'fixable',
				operation: { kind: 'legality-fix', choiceId: action.applyAllToken },
				changes: action.changes
			});
			continue;
		}

		entries.push({
			result,
			status: 'unfixable',
			reason: action?.unavailableReason ?? 'No supported Legality Fix is available.'
		});
	}

	return input.signal?.aborted ? { status: 'cancelled', entries } : { status: 'complete', entries };
}

export async function applySaveFileLegalityFixBatch(input: {
	engine: EngineApi;
	workspace: WorkspaceState;
	preview: Extract<SaveFileLegalityFixBatchPreview, { status: 'complete' }>;
	activeBox: number;
	signal?: AbortSignal;
	isCurrent(): boolean;
	onCommitting?(): void;
	prepareAutomaticBackup(state: WorkspaceState): Promise<PreparedAutomaticBackup>;
	persistWorkspace(state: WorkspaceState, expectedUpdatedAt: string): Promise<void>;
}): Promise<SaveFileLegalityFixBatchApplyResult> {
	const selected = input.preview.entries.filter(
		(entry): entry is SaveFileLegalityFixableEntry => entry.status === 'fixable'
	);
	if (selected.length === 0) {
		return { status: 'error', message: 'No supported Legality Fixes are available.' };
	}
	if (input.signal?.aborted) return { status: 'cancelled' };
	if (!input.isCurrent()) return staleBatchResult();

	let prepared: PreparedAutomaticBackup;
	try {
		prepared = await input.prepareAutomaticBackup(input.workspace);
	} catch (error) {
		return { status: 'error', message: errorMessage(error) };
	}
	if (input.signal?.aborted) return { status: 'cancelled' };
	if (!input.isCurrent()) return staleBatchResult();

	let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(prepared.state.bytes);
	let projectedWorkspace = prepared.state.workspace;
	const applied: SaveFileLegalityFixableEntry[] = [];
	for (const entry of selected) {
		if (input.signal?.aborted) return { status: 'cancelled' };
		if (!input.isCurrent()) return staleBatchResult();
		const result = await input.engine.applyPokemonAction(
			bytes,
			prepared.state.file.originalFileName ?? undefined,
			{ ...entry.operation, source: entry.result.source },
			input.activeBox
		);
		if (!result.ok) return { status: 'error', message: result.error.message };
		bytes = result.value.bytes;
		projectedWorkspace = result.value.workspace;
		applied.push({ ...entry, changes: result.value.changes });
	}

	if (input.signal?.aborted) return { status: 'cancelled' };
	if (!input.isCurrent()) return staleBatchResult();
	const workspace: WorkspaceState = {
		...prepared.state,
		bytes,
		workspace: projectedWorkspace,
		dirty: true,
		restoredFromBackup: null
	};
	input.onCommitting?.();
	try {
		await input.persistWorkspace(workspace, prepared.revision);
	} catch (error) {
		return { status: 'error', message: errorMessage(error) };
	}
	return { status: 'complete', workspace, applied };
}

export function filterSaveFileLegalityResults(
	results: SaveFileLegalityResult[],
	filter: SaveFileLegalityFilter
) {
	return filter === 'all' ? results : results.filter((result) => result.classification === filter);
}

export function countSaveFileLegalityResults(results: SaveFileLegalityResult[]) {
	return {
		legal: results.filter(({ classification }) => classification === 'legal').length,
		warning: results.filter(({ classification }) => classification === 'warning').length,
		illegal: results.filter(({ classification }) => classification === 'illegal').length,
		total: results.length
	};
}

type ScanTarget = {
	source: SaveSlotRef;
	location: string;
	pokemonLabel: string;
	speciesName: string;
};

function partyTarget(slot: PartySlotSummary): ScanTarget {
	return {
		source: { zone: 'party', slot: slot.slot },
		location: `Party, Slot ${slot.slot + 1}`,
		pokemonLabel: slot.nickname || slot.speciesName || `Pokemon ${slot.speciesId}`,
		speciesName: slot.speciesName || slot.nickname || `Pokemon ${slot.speciesId}`
	};
}

function boxTarget(slot: BoxSlotSummary): ScanTarget {
	return {
		source: { zone: 'box', box: slot.box, slot: slot.slot },
		location: `Box ${String(slot.box + 1).padStart(2, '0')}, Slot ${slot.slot + 1}`,
		pokemonLabel: slot.nickname || slot.speciesName || `Pokemon ${slot.speciesId}`,
		speciesName: slot.speciesName || slot.nickname || `Pokemon ${slot.speciesId}`
	};
}

function createResult(target: ScanTarget, report: LegalityReport): SaveFileLegalityResult {
	const classification = report.legal
		? report.warnings.length > 0
			? 'warning'
			: 'legal'
		: 'illegal';
	const firstIssue =
		report.warnings[0]?.message ??
		report.messages.find(({ severity }) => severity !== 'Valid')?.message ??
		'No issues found.';
	return {
		id:
			target.source.zone === 'party'
				? `party:${target.source.slot}`
				: `box:${target.source.box}:${target.source.slot}`,
		...target,
		classification,
		firstIssue,
		report
	};
}

function cancelled(
	results: SaveFileLegalityResult[],
	checked: number,
	total: number
): SaveFileLegalityScanResult {
	return { status: 'cancelled', results, checked, total };
}

function scanError(
	message: string,
	results: SaveFileLegalityResult[] = [],
	checked = 0,
	total = 0
): SaveFileLegalityScanResult {
	return { status: 'error', message, results, checked, total };
}

function staleBatchResult(): SaveFileLegalityFixBatchApplyResult {
	return {
		status: 'error',
		message: 'The Workspace changed. Preview supported fixes again.'
	};
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'The Legality Fix batch could not be applied.';
}
