import type {
	BoxSlotSummary,
	EngineApi,
	EngineError,
	EngineErrorCode,
	EngineResult,
	EngineVersion,
	LegalityReport,
	PokemonEditOperation,
	PokemonEditOperationResult,
	SaveWorkspace,
	SlotOperation,
	SlotOperationResult,
	SerializedSave,
	SaveSummary
} from './types';

type RawDotnetModule = {
	dotnet: {
		create(): Promise<{
			getAssemblyExports(assemblyName: string): Promise<{
				Pksx: {
					Pkhex: {
						Engine: {
							PkhexEngineExports: DotnetPkhexEngineExports;
						};
					};
				};
			}>;
			getConfig(): { mainAssemblyName: string };
			runMain(): Promise<void>;
		}>;
	};
};

type DotnetPkhexEngineExports = {
	GetVersionJson(): string;
	ParseSaveSmoke(bytes: Uint8Array, fileName?: string): string;
	ListBoxSmoke(bytes: Uint8Array, fileName: string | undefined, box: number): string;
	LoadSaveWorkspaceJson(bytes: Uint8Array, fileName: string | undefined, box: number): string;
	SerializeSaveJson(bytes: Uint8Array, fileName?: string): string;
	ApplySlotOperationJson(
		bytes: Uint8Array,
		fileName: string | undefined,
		operationJson: string
	): string;
	ApplyPokemonEditOperationJson(
		bytes: Uint8Array,
		fileName: string | undefined,
		operationJson: string
	): string;
	CheckSlotLegalityJson(
		bytes: Uint8Array,
		fileName: string | undefined,
		sourceJson: string
	): string;
};

const knownEngineErrorCodes = new Set<EngineErrorCode>([
	'unsupported-save',
	'invalid-box',
	'invalid-slot',
	'empty-source-slot',
	'occupied-destination-slot',
	'unsupported-slot-operation',
	'invalid-pokemon-edit',
	'unsupported-pokemon-edit',
	'engine-unavailable',
	'invalid-engine-response',
	'invalid-worker-message',
	'unknown-engine-error'
]);

export async function createPkhexEngine(basePath = '/pkhex-engine'): Promise<EngineApi> {
	const module = (await import(
		/* @vite-ignore */ `${basePath}/_framework/dotnet.js`
	)) as RawDotnetModule;
	const runtime = await module.dotnet.create();
	const config = runtime.getConfig();
	const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
	await runtime.runMain();

	const engine = exports.Pksx.Pkhex.Engine.PkhexEngineExports;

	return {
		getVersion: async () => parseEngineResult<EngineVersion>(engine.GetVersionJson()),
		summarizeSave: async (bytes, fileName) =>
			normalizeSaveSummaryResult(
				parseEngineResult<RawSaveSummary>(engine.ParseSaveSmoke(bytes, fileName))
			),
		listBoxSlots: async (bytes, fileName, box) =>
			parseEngineResult<BoxSlotSummary[]>(engine.ListBoxSmoke(bytes, fileName, box)),
		loadSaveWorkspace: async (bytes, fileName, box) =>
			normalizeSaveWorkspaceResult(
				parseEngineResult<RawSaveWorkspace>(engine.LoadSaveWorkspaceJson(bytes, fileName, box))
			),
		serializeSave: async (bytes, fileName) =>
			parseEngineResult<SerializedSave>(engine.SerializeSaveJson(bytes, fileName)),
		applySlotOperation: async (bytes, fileName, operation, activeBox) =>
			decodeMutationResult(
				parseEngineResult<RawSlotOperationResult>(
					engine.ApplySlotOperationJson(
						bytes,
						fileName,
						JSON.stringify({ ...operation, activeBox } satisfies RawSlotOperationRequest)
					)
				)
			),
		applyPokemonEditOperation: async (bytes, fileName, operation, activeBox) =>
			decodeMutationResult(
				parseEngineResult<RawPokemonEditOperationResult>(
					engine.ApplyPokemonEditOperationJson(
						bytes,
						fileName,
						JSON.stringify({
							...operation,
							activeBox
						} satisfies RawPokemonEditOperationRequest)
					)
				)
			),
		checkSlotLegality: async (bytes, fileName, source) =>
			parseEngineResult<LegalityReport>(
				engine.CheckSlotLegalityJson(bytes, fileName, JSON.stringify(source))
			)
	};
}

type RawSlotOperationRequest = SlotOperation & { activeBox: number };
type RawPokemonEditOperationRequest = PokemonEditOperation & { activeBox: number };

type SaveSummaryDefaultedFields = 'trainerId' | 'playTime' | 'playedHours' | 'playedMinutes';
type RawSaveSummary = Omit<SaveSummary, SaveSummaryDefaultedFields> &
	Partial<Pick<SaveSummary, SaveSummaryDefaultedFields>>;
type RawSaveWorkspace = Omit<SaveWorkspace, 'summary'> & { summary: RawSaveSummary };
type RawSlotOperationResult = Omit<SlotOperationResult, 'bytes' | 'workspace'> & {
	bytesBase64: string;
	byteLength: number;
	workspace: RawSaveWorkspace;
};
type RawPokemonEditOperationResult = Omit<PokemonEditOperationResult, 'bytes' | 'workspace'> & {
	bytesBase64: string;
	byteLength: number;
	workspace: RawSaveWorkspace;
};

export function parseEngineResult<T>(json: string): EngineResult<T> {
	try {
		return normalizeEngineResult(JSON.parse(json));
	} catch {
		return engineFailure('invalid-engine-response', 'The PKHeX Engine returned invalid JSON.');
	}
}

function normalizeEngineResult<T>(value: unknown): EngineResult<T> {
	if (!isRecord(value) || typeof value.ok !== 'boolean') {
		return engineFailure('invalid-engine-response', 'The PKHeX Engine returned an invalid result.');
	}

	if (value.ok) {
		if (!('value' in value)) {
			return engineFailure(
				'invalid-engine-response',
				'The PKHeX Engine returned a success without a value.'
			);
		}

		return { ok: true, value: value.value as T, error: null };
	}

	const error = normalizeEngineError(value.error);

	return { ok: false, value: null, error };
}

function normalizeEngineError(error: unknown): EngineError {
	if (!isRecord(error)) {
		return {
			code: 'invalid-engine-response',
			message: 'The PKHeX Engine returned a failure without an error.'
		};
	}

	const message =
		typeof error.message === 'string' && error.message.length > 0
			? error.message
			: 'The PKHeX Engine failed without an error message.';

	if (typeof error.code !== 'string') {
		return { code: 'invalid-engine-response', message };
	}

	return {
		code: knownEngineErrorCodes.has(error.code as EngineErrorCode)
			? (error.code as EngineErrorCode)
			: 'unknown-engine-error',
		message
	};
}

function engineFailure<T>(code: EngineErrorCode, message: string): EngineResult<T> {
	return { ok: false, value: null, error: { code, message } };
}

function decodeMutationResult<
	T extends { bytes: Uint8Array; mutated: boolean; workspace: SaveWorkspace }
>(
	result: EngineResult<{
		bytesBase64: string;
		byteLength: number;
		mutated: boolean;
		workspace: RawSaveWorkspace;
	}>
): EngineResult<T> {
	if (!result.ok) {
		return result;
	}

	return {
		ok: true,
		value: {
			bytes: base64ToBytes(result.value.bytesBase64, result.value.byteLength),
			mutated: result.value.mutated,
			workspace: normalizeSaveWorkspace(result.value.workspace)
		} as T,
		error: null
	};
}

function normalizeSaveSummaryResult(
	result: EngineResult<RawSaveSummary>
): EngineResult<SaveSummary> {
	if (!result.ok) {
		return result;
	}

	return {
		ok: true,
		value: normalizeSaveSummary(result.value),
		error: null
	};
}

function normalizeSaveWorkspaceResult(
	result: EngineResult<RawSaveWorkspace>
): EngineResult<SaveWorkspace> {
	if (!result.ok) {
		return result;
	}

	return {
		ok: true,
		value: normalizeSaveWorkspace(result.value),
		error: null
	};
}

function normalizeSaveWorkspace(workspace: RawSaveWorkspace): SaveWorkspace {
	return {
		...workspace,
		summary: normalizeSaveSummary(workspace.summary)
	};
}

function normalizeSaveSummary(summary: RawSaveSummary): SaveSummary {
	return {
		...summary,
		trainerId: summary.trainerId ?? 0,
		playTime: summary.playTime ?? '',
		playedHours: summary.playedHours ?? 0,
		playedMinutes: summary.playedMinutes ?? 0
	};
}

function base64ToBytes(base64: string, byteLength: number): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(byteLength);

	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
