import type {
	BoxSlotSummary,
	EngineApi,
	LegalityReport,
	PartySlotSummary,
	SaveSlotRef
} from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';

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
