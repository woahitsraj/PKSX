import type {
	BoxSlotSummary,
	EngineApi,
	EngineError,
	EngineResult,
	EngineVersion,
	SaveSummary
} from './types';
import {
	parseEngineWorkerProtocolError,
	parseEngineWorkerResponse,
	parseEngineWorkerStatusMessage,
	type EngineWorkerMessage,
	type EngineWorkerMethod,
	type EngineWorkerRequest,
	type EngineWorkerRequestId,
	type EngineWorkerResponse,
	type EngineWorkerResultForMethod
} from './worker-protocol';

export type EngineWorkerPort = {
	postMessage(message: EngineWorkerMessage, transfer?: Transferable[]): void;
	addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
	addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
	addEventListener(type: 'messageerror', listener: (event: MessageEvent<unknown>) => void): void;
	removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
	removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
	removeEventListener(type: 'messageerror', listener: (event: MessageEvent<unknown>) => void): void;
};

export type EngineWorkerFactory = () => EngineWorkerPort;

type PendingRequest = {
	method: EngineWorkerMethod;
	resolve(result: EngineResult<unknown>): void;
};

type WorkerEngineOptions = {
	createWorker?: EngineWorkerFactory;
};

let nextRequestId = 1;

export function createPkhexWorkerEngine(
	basePath = '/pkhex-engine',
	options: WorkerEngineOptions = {}
): EngineApi {
	const worker = (options.createWorker ?? createDefaultWorker)();
	const pending = new Map<EngineWorkerRequestId, PendingRequest>();
	let resolveStartup!: (result: EngineResult<null>) => void;
	let failedError: EngineError | undefined;

	const startupResult = new Promise<EngineResult<null>>((resolve) => {
		resolveStartup = resolve;
	});

	const onMessage = (event: MessageEvent<unknown>) => {
		const response = parseEngineWorkerResponse(event.data);
		if (response.ok) {
			resolvePendingResponse(response.value);
			return;
		}

		const protocolError = parseEngineWorkerProtocolError(event.data);
		if (protocolError.ok) {
			resolveProtocolError(protocolError.value.id, protocolError.value.error);
			return;
		}

		const status = parseEngineWorkerStatusMessage(event.data);
		if (status.ok) {
			if (status.value.status === 'ready') {
				resolveStartup({ ok: true, value: null, error: null });
			}

			if (status.value.status === 'failed') {
				failWorker(status.value.error);
			}
		}
	};

	const onError = (event: ErrorEvent) => {
		failWorker({
			code: 'engine-unavailable',
			message: event.message || 'The PKHeX Engine worker failed to start.'
		});
	};

	const onMessageError = () => {
		failWorker({
			code: 'engine-unavailable',
			message: 'The PKHeX Engine worker received an unreadable message.'
		});
	};

	function failWorker(error: EngineError) {
		failedError = error;
		resolveStartup(engineFailure(error));

		for (const [id, request] of pending) {
			request.resolve(engineFailure(error));
			pending.delete(id);
		}
	}

	worker.addEventListener('message', onMessage);
	worker.addEventListener('error', onError);
	worker.addEventListener('messageerror', onMessageError);
	worker.postMessage({ type: 'init', basePath });

	return {
		getVersion: () => sendRequest('getVersion'),
		summarizeSave: (bytes, fileName) => {
			const buffer = copyBytesToArrayBuffer(bytes);

			return sendRequest(
				'summarizeSave',
				{
					type: 'request',
					id: createRequestId(),
					method: 'summarizeSave',
					payload: { bytes: buffer, fileName }
				},
				[buffer]
			);
		},
		listBoxSlots: (bytes, fileName, box) => {
			const buffer = copyBytesToArrayBuffer(bytes);

			return sendRequest(
				'listBoxSlots',
				{
					type: 'request',
					id: createRequestId(),
					method: 'listBoxSlots',
					payload: { bytes: buffer, fileName, box }
				},
				[buffer]
			);
		}
	};

	async function sendRequest(method: 'getVersion'): Promise<EngineResult<EngineVersion>>;
	async function sendRequest(
		method: 'summarizeSave',
		request: Extract<EngineWorkerRequest, { method: 'summarizeSave' }>,
		transfer: Transferable[]
	): Promise<EngineResult<SaveSummary>>;
	async function sendRequest(
		method: 'listBoxSlots',
		request: Extract<EngineWorkerRequest, { method: 'listBoxSlots' }>,
		transfer: Transferable[]
	): Promise<EngineResult<BoxSlotSummary[]>>;
	async function sendRequest(
		method: EngineWorkerMethod,
		request: EngineWorkerRequest = { type: 'request', id: createRequestId(), method: 'getVersion' },
		transfer: Transferable[] = []
	): Promise<EngineResult<unknown>> {
		if (failedError !== undefined) {
			return engineFailure(failedError);
		}

		const ready = await startupResult;
		if (!ready.ok) {
			return engineFailure(ready.error);
		}

		return new Promise((resolve) => {
			pending.set(request.id, { method, resolve });
			worker.postMessage(request, transfer);
		});
	}

	function resolvePendingResponse(response: EngineWorkerResponse) {
		const request = pending.get(response.id);
		if (request === undefined) {
			return;
		}

		pending.delete(response.id);

		if (request.method !== response.method) {
			request.resolve(
				engineFailure({
					code: 'invalid-worker-message',
					message: 'The PKHeX Engine worker returned a response for the wrong method.'
				})
			);
			return;
		}

		request.resolve(response.result as EngineWorkerResultForMethod<typeof response.method>);
	}

	function resolveProtocolError(id: EngineWorkerRequestId | undefined, error: EngineError) {
		if (id === undefined) {
			failWorker(error);
			return;
		}

		const request = pending.get(id);
		if (request === undefined) {
			return;
		}

		pending.delete(id);
		request.resolve(engineFailure(error));
	}
}

function createDefaultWorker(): EngineWorkerPort {
	return new Worker(new URL('./pkhex-engine.worker.ts', import.meta.url), { type: 'module' });
}

function createRequestId(): EngineWorkerRequestId {
	const id = `engine-${nextRequestId}`;
	nextRequestId += 1;

	return id;
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);

	return copy.buffer;
}

function engineFailure<T>(error: EngineError): EngineResult<T> {
	return { ok: false, value: null, error };
}
