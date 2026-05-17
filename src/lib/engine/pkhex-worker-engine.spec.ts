import { describe, expect, test } from 'vitest';
import { createPkhexWorkerEngine, type EngineWorkerPort } from './pkhex-worker-engine';
import type { EngineWorkerMessage } from './worker-protocol';

type PostedWorkerMessage = {
	message: EngineWorkerMessage;
	transfer?: Transferable[];
};

class FakeWorker implements EngineWorkerPort {
	readonly posted: PostedWorkerMessage[] = [];
	private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

	postMessage(message: EngineWorkerMessage, transfer?: Transferable[]) {
		this.posted.push({ message, transfer });
	}

	addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void) {
		this.listeners.add(listener);
	}

	removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void) {
		this.listeners.delete(listener);
	}

	emit(data: unknown) {
		for (const listener of this.listeners) {
			listener({ data } as MessageEvent<unknown>);
		}
	}
}

describe('createPkhexWorkerEngine', () => {
	test('starts the worker with an explicit engine base path without blocking creation', () => {
		expect.assertions(1);

		const worker = new FakeWorker();

		createPkhexWorkerEngine('/custom-engine', { createWorker: () => worker });

		expect(worker.posted).toEqual([{ message: { type: 'init', basePath: '/custom-engine' } }]);
	});

	test('waits for readiness, routes concurrent requests by id, and normalizes responses', async () => {
		expect.assertions(5);

		const worker = new FakeWorker();
		const engine = createPkhexWorkerEngine('/pkhex-engine', { createWorker: () => worker });

		const version = engine.getVersion();
		expect(worker.posted).toHaveLength(1);

		worker.emit({ type: 'status', status: 'ready' });

		const summary = engine.summarizeSave(new Uint8Array([1, 2, 3]), 'main.sav');

		await Promise.resolve();

		const versionRequest = worker.posted[1]?.message;
		const summaryRequest = worker.posted[2]?.message;

		expect(versionRequest).toMatchObject({ type: 'request', method: 'getVersion' });
		expect(summaryRequest).toMatchObject({ type: 'request', method: 'summarizeSave' });

		if (
			versionRequest?.type !== 'request' ||
			summaryRequest?.type !== 'request' ||
			summaryRequest.method !== 'summarizeSave'
		) {
			throw new Error('Expected worker requests to be posted.');
		}

		worker.emit({
			type: 'response',
			id: summaryRequest.id,
			method: 'summarizeSave',
			result: {
				ok: true,
				value: {
					fileName: 'main.sav',
					saveType: 'SAV9SV',
					gameVersion: 'SV',
					gameVersionId: 45,
					generation: 9,
					trainerName: 'PKSX',
					partyCount: 1,
					boxCount: 32,
					boxSlotCount: 30
				},
				error: null
			}
		});
		worker.emit({
			type: 'response',
			id: versionRequest.id,
			method: 'getVersion',
			result: {
				ok: true,
				value: { pkhexCoreVersion: '26.5.5.0', facadeVersion: '1.0.0.0' },
				error: null
			}
		});

		await expect(summary).resolves.toMatchObject({
			ok: true,
			value: { fileName: 'main.sav', gameVersion: 'SV' }
		});
		await expect(version).resolves.toMatchObject({
			ok: true,
			value: { pkhexCoreVersion: '26.5.5.0' }
		});
	});

	test('copies save bytes before transferring worker-owned buffers', async () => {
		expect.assertions(5);

		const worker = new FakeWorker();
		const engine = createPkhexWorkerEngine('/pkhex-engine', { createWorker: () => worker });
		const bytes = new Uint8Array([1, 2, 3]);

		worker.emit({ type: 'status', status: 'ready' });

		const summary = engine.summarizeSave(bytes, 'main.sav');

		await Promise.resolve();

		const request = worker.posted[1]?.message;

		if (request?.type !== 'request' || request.method !== 'summarizeSave') {
			throw new Error('Expected a summarizeSave request.');
		}

		expect(request.payload.bytes).not.toBe(bytes.buffer);
		expect([...new Uint8Array(request.payload.bytes)]).toEqual([1, 2, 3]);
		expect(worker.posted[1]?.transfer).toEqual([request.payload.bytes]);
		expect([...bytes]).toEqual([1, 2, 3]);

		worker.emit({
			type: 'response',
			id: request.id,
			method: 'summarizeSave',
			result: {
				ok: false,
				value: null,
				error: { code: 'unsupported-save', message: 'Unsupported save.' }
			}
		});

		await expect(summary).resolves.toMatchObject({
			ok: false,
			error: { code: 'unsupported-save' }
		});
	});

	test('drains pending requests and permanently fails later calls when startup fails', async () => {
		expect.assertions(3);

		const worker = new FakeWorker();
		const engine = createPkhexWorkerEngine('/pkhex-engine', { createWorker: () => worker });
		const version = engine.getVersion();

		worker.emit({
			type: 'status',
			status: 'failed',
			error: { code: 'engine-unavailable', message: 'Runtime failed to load.' }
		});

		await expect(version).resolves.toMatchObject({
			ok: false,
			error: { code: 'engine-unavailable', message: 'Runtime failed to load.' }
		});

		await expect(engine.listBoxSlots(new Uint8Array([1]), undefined, 0)).resolves.toMatchObject({
			ok: false,
			error: { code: 'engine-unavailable', message: 'Runtime failed to load.' }
		});
		expect(worker.posted).toHaveLength(1);
	});
});
