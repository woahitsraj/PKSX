import type {
	EngineApi,
	EngineError,
	LegalityReport,
	LegalityReportLine,
	PokemonActionAvailability,
	PokemonActionChange,
	PokemonLegalityFixChoice,
	SaveSlotRef
} from '$lib/engine';
import type { SlotView } from '$lib/components/pksx/types';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';

export type LegalityReportState =
	| { status: 'idle' }
	| { status: 'loading'; location: string; pokemonLabel: string }
	| { status: 'ready'; location: string; pokemonLabel: string; report: LegalityReport }
	| { status: 'unavailable'; location: string; pokemonLabel: string; message: string }
	| { status: 'error'; location: string; pokemonLabel: string; message: string };

export type LegalityReportRequest = {
	workspace: WorkspaceState | null;
	engine: EngineApi | null;
	slot: SlotView;
	source: SaveSlotRef;
	location: string;
};

export type LegalityReportRequestResult = {
	state: LegalityReportState;
	dirtyChanged: boolean;
	bytesChanged: boolean;
};

export type LegalityReportFinding = {
	line: LegalityReportLine;
	proposals: PokemonActionChange[];
	fix: PokemonLegalityFixChoice | null;
};

export type LegalityReportFindings = {
	warnings: LegalityReportFinding[];
	messages: LegalityReportFinding[];
	unmatchedFixes: PokemonLegalityFixChoice[];
	combinedProposals: PokemonActionChange[];
};

export function createLegalityReportFindings(
	report: LegalityReport,
	fix: PokemonActionAvailability | null
): LegalityReportFindings {
	const fixes = new Map(fix?.fixes.map((choice) => [choice.id, choice]) ?? []);
	const shownFixes = new Set<string>();
	const decorate = (lines: LegalityReportLine[]) =>
		lines.map((line) => {
			const findingFix =
				line.fixId && !shownFixes.has(line.fixId) ? (fixes.get(line.fixId) ?? null) : null;
			if (findingFix) shownFixes.add(findingFix.id);
			return { line, proposals: findingFix?.changes ?? [], fix: findingFix };
		});

	const warnings = decorate(report.warnings);
	const messages = decorate(report.messages);
	const unmatchedFixes = (fix?.fixes ?? []).filter((choice) => !shownFixes.has(choice.id));
	return { warnings, messages, unmatchedFixes, combinedProposals: fix?.changes ?? [] };
}

export function createLegalityReportLoadingState(
	slot: SlotView,
	location: string
): LegalityReportState {
	return {
		status: 'loading',
		location,
		pokemonLabel: slot.kind === 'pokemon' ? slot.label : 'Empty Slot'
	};
}

export function createLegalityReportUnavailableState(
	slot: SlotView,
	location: string
): LegalityReportState {
	return {
		status: 'unavailable',
		location,
		pokemonLabel: slot.kind === 'pokemon' ? slot.label : 'Empty Slot',
		message:
			slot.kind === 'pokemon'
				? 'Legality Check is not available for this Pokemon.'
				: 'Legality Check needs an occupied Slot.'
	};
}

export async function requestLegalityReport({
	workspace,
	engine,
	slot,
	source,
	location
}: LegalityReportRequest): Promise<LegalityReportRequestResult> {
	const beforeDirty = workspace?.dirty ?? false;
	const beforeBytes = workspace?.bytes ?? null;
	const pokemonLabel = slot.kind === 'pokemon' ? slot.label : 'Empty Slot';

	if (slot.kind !== 'pokemon') {
		return {
			state: createLegalityReportUnavailableState(slot, location),
			dirtyChanged: false,
			bytesChanged: false
		};
	}

	if (!workspace) {
		return {
			state: {
				status: 'error',
				location,
				pokemonLabel,
				message: 'Load a Save File before checking legality.'
			},
			dirtyChanged: false,
			bytesChanged: false
		};
	}

	if (!engine) {
		return {
			state: {
				status: 'error',
				location,
				pokemonLabel,
				message: 'Legality Check is still loading. Try again.'
			},
			dirtyChanged: false,
			bytesChanged: false
		};
	}

	const result = await engine.checkSlotLegality(
		workspace.bytes,
		workspace.file.originalFileName ?? undefined,
		source
	);

	if (!result.ok) {
		return {
			state: {
				status: isUnavailableError(result.error) ? 'unavailable' : 'error',
				location,
				pokemonLabel,
				message: result.error.message
			},
			dirtyChanged: workspace.dirty !== beforeDirty,
			bytesChanged: workspace.bytes !== beforeBytes
		};
	}

	return {
		state: {
			status: 'ready',
			location,
			pokemonLabel,
			report: result.value
		},
		dirtyChanged: workspace.dirty !== beforeDirty,
		bytesChanged: workspace.bytes !== beforeBytes
	};
}

function isUnavailableError(error: EngineError): boolean {
	return error.code === 'unsupported-save' || error.code === 'empty-source-slot';
}
