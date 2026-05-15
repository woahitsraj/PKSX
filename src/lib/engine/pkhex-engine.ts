import type {
	BoxSlotSummary,
	EngineApi,
	EngineError,
	EngineErrorCode,
	EngineResult,
	EngineVersion,
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
};

const knownEngineErrorCodes = new Set<EngineErrorCode>([
	'unsupported-save',
	'invalid-box',
	'engine-unavailable',
	'invalid-engine-response',
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
			parseEngineResult<SaveSummary>(engine.ParseSaveSmoke(bytes, fileName)),
		listBoxSlots: async (bytes, fileName, box) =>
			parseEngineResult<BoxSlotSummary[]>(engine.ListBoxSmoke(bytes, fileName, box))
	};
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
