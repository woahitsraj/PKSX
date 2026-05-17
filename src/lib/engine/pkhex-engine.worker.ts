import { parseEngineResult } from './pkhex-engine';
import type { BoxSlotSummary, EngineResult, EngineVersion, SaveSummary } from './types';
import {
	createEngineWorkerProtocolError,
	createEngineWorkerResponse,
	parseEngineWorkerInitMessage,
	parseEngineWorkerRequest,
	type EngineWorkerListBoxSlotsRequest,
	type EngineWorkerMessage,
	type EngineWorkerRequest,
	type EngineWorkerStatusMessage,
	type EngineWorkerSummarizeSaveRequest
} from './worker-protocol';

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

let startup: Promise<DotnetPkhexEngineExports> | undefined;
let ready = false;
let failed = false;
let callQueue = Promise.resolve();

self.addEventListener('message', (event: MessageEvent<unknown>) => {
	const init = parseEngineWorkerInitMessage(event.data);
	if (init.ok) {
		startEngine(init.value.basePath);
		return;
	}

	const request = parseEngineWorkerRequest(event.data);
	if (!request.ok) {
		postWorkerMessage(createEngineWorkerProtocolError(request.error, request.id));
		return;
	}

	callQueue = callQueue
		.then(() => handleRequest(request.value))
		.catch((error: unknown) => {
			postFailedStatus(error);
		});
});

function startEngine(basePath: string) {
	if (startup !== undefined) {
		return;
	}

	postWorkerMessage({ type: 'status', status: 'loading' });
	startup = loadEngine(basePath)
		.then((engine) => {
			ready = true;
			postWorkerMessage({ type: 'status', status: 'ready' });

			return engine;
		})
		.catch((error: unknown) => {
			postFailedStatus(error);
			throw error;
		});

	startup.catch(() => {
		// The failed status is the worker protocol surface; keep the rejected startup promise observed.
	});
}

async function loadEngine(basePath: string): Promise<DotnetPkhexEngineExports> {
	const module = (await import(
		/* @vite-ignore */ `${basePath}/_framework/dotnet.js`
	)) as RawDotnetModule;
	const runtime = await module.dotnet.create();
	const config = runtime.getConfig();
	const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
	await runtime.runMain();

	return exports.Pksx.Pkhex.Engine.PkhexEngineExports;
}

async function handleRequest(request: EngineWorkerRequest) {
	if (startup === undefined || failed) {
		postWorkerMessage(createEngineWorkerResponse(request, unavailableResult(request)));
		return;
	}

	if (!ready) {
		await startup;
	}

	const engine = await startup;

	switch (request.method) {
		case 'getVersion':
			postWorkerMessage(
				createEngineWorkerResponse(
					request,
					parseEngineResult<EngineVersion>(engine.GetVersionJson())
				)
			);
			return;
		case 'summarizeSave':
			postWorkerMessage(createEngineWorkerResponse(request, summarizeSave(engine, request)));
			return;
		case 'listBoxSlots':
			postWorkerMessage(createEngineWorkerResponse(request, listBoxSlots(engine, request)));
			return;
	}
}

function summarizeSave(
	engine: DotnetPkhexEngineExports,
	request: EngineWorkerSummarizeSaveRequest
): EngineResult<SaveSummary> {
	return parseEngineResult<SaveSummary>(
		engine.ParseSaveSmoke(new Uint8Array(request.payload.bytes), request.payload.fileName)
	);
}

function listBoxSlots(
	engine: DotnetPkhexEngineExports,
	request: EngineWorkerListBoxSlotsRequest
): EngineResult<BoxSlotSummary[]> {
	return parseEngineResult<BoxSlotSummary[]>(
		engine.ListBoxSmoke(
			new Uint8Array(request.payload.bytes),
			request.payload.fileName,
			request.payload.box
		)
	);
}

function unavailableResult(request: EngineWorkerRequest) {
	const result = {
		ok: false,
		value: null,
		error: {
			code: 'engine-unavailable',
			message: 'The PKHeX Engine worker is not ready.'
		}
	} as const;

	switch (request.method) {
		case 'getVersion':
			return result satisfies EngineResult<EngineVersion>;
		case 'summarizeSave':
			return result satisfies EngineResult<SaveSummary>;
		case 'listBoxSlots':
			return result satisfies EngineResult<BoxSlotSummary[]>;
	}
}

function postFailedStatus(error: unknown) {
	failed = true;
	postWorkerMessage({
		type: 'status',
		status: 'failed',
		error: {
			code: 'engine-unavailable',
			message: getErrorMessage(error)
		}
	});
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return 'The PKHeX Engine failed to load.';
}

function postWorkerMessage(message: EngineWorkerMessage | EngineWorkerStatusMessage) {
	self.postMessage(message);
}

export {};
