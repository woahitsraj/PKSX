import { parseEngineResult } from './pkhex-engine';
import type {
	BoxSlotSummary,
	EngineResult,
	EngineVersion,
	SaveSummary,
	SaveWorkspace,
	SerializedSave
} from './types';
import {
	createEngineWorkerProtocolError,
	createEngineWorkerResponse,
	parseEngineWorkerInitMessage,
	parseEngineWorkerRequest,
	type EngineWorkerLoadSaveWorkspaceRequest,
	type EngineWorkerListBoxSlotsRequest,
	type EngineWorkerMessage,
	type EngineWorkerRequest,
	type EngineWorkerSerializeSaveRequest,
	type EngineWorkerStatusMessage,
	type EngineWorkerSummarizeSaveRequest
} from './worker-protocol';

export type DotnetPkhexEngineExports = {
	GetVersionJson(): string;
	ParseSaveSmoke(bytes: Uint8Array, fileName?: string): string;
	ListBoxSmoke(bytes: Uint8Array, fileName: string | undefined, box: number): string;
	LoadSaveWorkspaceJson(bytes: Uint8Array, fileName: string | undefined, box: number): string;
	SerializeSaveJson(bytes: Uint8Array, fileName?: string): string;
};

export type PkhexEngineWorkerRuntimeOptions = {
	loadEngine(basePath: string): Promise<DotnetPkhexEngineExports>;
	postMessage(message: EngineWorkerMessage | EngineWorkerStatusMessage): void;
};

export type PkhexEngineWorkerRuntime = {
	handleMessage(message: unknown): void;
};

export function createPkhexEngineWorkerRuntime({
	loadEngine,
	postMessage
}: PkhexEngineWorkerRuntimeOptions): PkhexEngineWorkerRuntime {
	let startup: Promise<DotnetPkhexEngineExports> | undefined;
	let ready = false;
	let failed = false;
	let callQueue = Promise.resolve();

	function handleMessage(message: unknown) {
		const init = parseEngineWorkerInitMessage(message);
		if (init.ok) {
			startEngine(init.value.basePath);
			return;
		}

		const request = parseEngineWorkerRequest(message);
		if (!request.ok) {
			postMessage(createEngineWorkerProtocolError(request.error, request.id));
			return;
		}

		callQueue = callQueue
			.then(() => handleRequest(request.value))
			.catch((error: unknown) => {
				postFailedStatus(error);
			});
	}

	function startEngine(basePath: string) {
		if (startup !== undefined) {
			return;
		}

		postMessage({ type: 'status', status: 'loading' });
		startup = loadEngine(basePath)
			.then((engine) => {
				ready = true;
				postMessage({ type: 'status', status: 'ready' });

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

	async function handleRequest(request: EngineWorkerRequest) {
		if (startup === undefined || failed) {
			postMessage(createEngineWorkerResponse(request, unavailableResult(request)));
			return;
		}

		if (!ready) {
			await startup;
		}

		const engine = await startup;

		switch (request.method) {
			case 'getVersion':
				postMessage(
					createEngineWorkerResponse(
						request,
						parseEngineResult<EngineVersion>(engine.GetVersionJson())
					)
				);
				return;
			case 'summarizeSave':
				postMessage(createEngineWorkerResponse(request, summarizeSave(engine, request)));
				return;
			case 'listBoxSlots':
				postMessage(createEngineWorkerResponse(request, listBoxSlots(engine, request)));
				return;
			case 'loadSaveWorkspace':
				postMessage(createEngineWorkerResponse(request, loadSaveWorkspace(engine, request)));
				return;
			case 'serializeSave':
				postMessage(createEngineWorkerResponse(request, serializeSave(engine, request)));
				return;
		}
	}

	function postFailedStatus(error: unknown) {
		if (failed) {
			return;
		}

		failed = true;
		postMessage({
			type: 'status',
			status: 'failed',
			error: {
				code: 'engine-unavailable',
				message: getErrorMessage(error)
			}
		});
	}

	return { handleMessage };
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

function loadSaveWorkspace(
	engine: DotnetPkhexEngineExports,
	request: EngineWorkerLoadSaveWorkspaceRequest
): EngineResult<SaveWorkspace> {
	return parseEngineResult<SaveWorkspace>(
		engine.LoadSaveWorkspaceJson(
			new Uint8Array(request.payload.bytes),
			request.payload.fileName,
			request.payload.box
		)
	);
}

function serializeSave(
	engine: DotnetPkhexEngineExports,
	request: EngineWorkerSerializeSaveRequest
): EngineResult<SerializedSave> {
	return parseEngineResult<SerializedSave>(
		engine.SerializeSaveJson(new Uint8Array(request.payload.bytes), request.payload.fileName)
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
		case 'loadSaveWorkspace':
			return result satisfies EngineResult<SaveWorkspace>;
		case 'serializeSave':
			return result satisfies EngineResult<SerializedSave>;
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return 'The PKHeX Engine failed to load.';
}
