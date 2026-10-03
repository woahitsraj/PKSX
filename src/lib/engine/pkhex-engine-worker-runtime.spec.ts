import { describe, expect, test } from 'vitest';
import {
	createPkhexEngineWorkerRuntime,
	type DotnetPkhexEngineExports
} from './pkhex-engine-worker-runtime';
import type { EngineWorkerMessage, EngineWorkerStatusMessage } from './worker-protocol';

type PostedWorkerMessage = EngineWorkerMessage | EngineWorkerStatusMessage;

type Deferred<T> = {
	promise: Promise<T>;
	resolve(value: T): void;
	reject(error: unknown): void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});

	return { promise, resolve, reject };
}

function createEngineExports(): DotnetPkhexEngineExports {
	return {
		GetVersionJson: () =>
			JSON.stringify({
				ok: true,
				value: { pkhexCoreVersion: '26.5.5.0', facadeVersion: '1.0.0.0' },
				error: null
			}),
		ParseSaveSmoke: () =>
			JSON.stringify({
				ok: true,
				value: {
					fileName: 'main.sav',
					saveType: 'SAV9SV',
					gameVersion: 'SV',
					gameVersionId: 45,
					generation: 9,
					trainerName: 'PKSX',
					trainerId: 41203,
					playTime: '47:12',
					playedHours: 47,
					playedMinutes: 12,
					partyCount: 1,
					boxCount: 32,
					boxSlotCount: 30
				},
				error: null
			}),
		SummarizeSaveCardJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					summary: {
						saveType: 'SAV9SV',
						gameVersion: 'SV',
						gameVersionId: 45,
						generation: 9,
						partyCount: 1,
						boxCount: 32,
						boxSlotCount: 30
					},
					pokemonCount: 3
				},
				error: null
			}),
		LoadSlotEditDataJson: () => JSON.stringify({ ok: true, value: null, error: null }),
		ListBoxSmoke: () =>
			JSON.stringify({
				ok: true,
				value: [],
				error: null
			}),
		LoadSaveWorkspaceJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					summary: {
						fileName: 'main.sav',
						saveType: 'SAV9SV',
						gameVersion: 'SV',
						gameVersionId: 45,
						generation: 9,
						trainerName: 'PKSX',
						trainerId: 41203,
						playTime: '47:12',
						playedHours: 47,
						playedMinutes: 12,
						partyCount: 1,
						boxCount: 32,
						boxSlotCount: 30
					},
					partySlots: [],
					boxSlots: []
				},
				error: null
			}),
		SerializeSaveJson: () =>
			JSON.stringify({
				ok: true,
				value: { bytesBase64: 'AQID', byteLength: 3 },
				error: null
			}),
		ApplySlotOperationJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					bytesBase64: 'AQID',
					byteLength: 3,
					mutated: true,
					workspace: {
						summary: {
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
						partySlots: [],
						boxSlots: []
					}
				},
				error: null
			}),
		ApplyPokemonEditOperationJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					bytesBase64: 'AQID',
					byteLength: 3,
					mutated: true,
					workspace: {
						summary: {
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
						partySlots: [],
						boxSlots: []
					}
				},
				error: null
			}),
		PreviewPokemonEditOperationJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					bytesBase64: 'AQID',
					byteLength: 3,
					mutated: true,
					workspace: { summary: {}, partySlots: [], boxSlots: [] }
				},
				error: null
			}),
		ValidatePokemonEditPreviewJson: () => JSON.stringify({ ok: true, value: true, error: null }),
		CreatePokemonJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					bytesBase64: 'AQID',
					byteLength: 3,
					mutated: true,
					workspace: {
						summary: {
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
						partySlots: [],
						boxSlots: []
					}
				},
				error: null
			}),
		PreviewPokemonSpeciesFormEditJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					availableSpecies: [{ id: 25, name: 'Pikachu' }],
					availableForms: [{ id: 0, name: 'Default' }],
					preview: {
						speciesId: 25,
						speciesName: 'Pikachu',
						form: 0,
						formName: 'Default',
						types: ['Electric'],
						moves: [],
						spriteIdentity: {
							speciesId: 25,
							form: 0,
							isEgg: false,
							isShiny: false,
							displaySex: 'default'
						},
						legal: true,
						legalitySummary: 'PKHeX judged this Pokemon legal.',
						consequences: []
					}
				},
				error: null
			}),
		ImportStoredPokemonJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					bytesBase64: 'AQID',
					byteLength: 3,
					mutated: true,
					workspace: {
						summary: {
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
						partySlots: [],
						boxSlots: []
					}
				},
				error: null
			}),
		CheckSlotLegalityJson: () =>
			JSON.stringify({
				ok: true,
				value: {
					legal: true,
					judgement: 'Legal',
					summary: 'PKHeX judged this Pokemon legal.',
					fixableProblems: [],
					warnings: [],
					messages: [
						{
							severity: 'Valid',
							identifier: 'Encounter',
							message: 'Encounter is valid.'
						}
					]
				},
				error: null
			}),
		PreviewPokemonActionsJson: () =>
			JSON.stringify({
				ok: false,
				value: null,
				error: { code: 'unsupported-pokemon-action', message: 'Unavailable in this fixture.' }
			}),
		ApplyPokemonActionJson: () =>
			JSON.stringify({
				ok: false,
				value: null,
				error: { code: 'unsupported-pokemon-action', message: 'Unavailable in this fixture.' }
			}),
		PreviewStoredPokemonActionsJson: () =>
			JSON.stringify({
				ok: false,
				value: null,
				error: { code: 'unsupported-pokemon-action', message: 'Unavailable in this fixture.' }
			}),
		ApplyStoredPokemonActionJson: () =>
			JSON.stringify({
				ok: false,
				value: null,
				error: { code: 'unsupported-pokemon-action', message: 'Unavailable in this fixture.' }
			}),
		CreatePreservationPayloadJson: () => unavailableInTestEngine(),
		ForkPreservationPayloadJson: () => unavailableInTestEngine(),
		ReplacePreservationPayloadCurrentJson: () => unavailableInTestEngine(),
		ReadPreservationPayloadJson: () => unavailableInTestEngine(),
		ProjectPreservationPayloadJson: () => unavailableInTestEngine(),
		PrepareOutgoingLinkTradeJson: () => unavailableInTestEngine(),
		ReadLinkTradePartnerPokemonJson: () => unavailableInTestEngine()
	};
}

function unavailableInTestEngine() {
	return JSON.stringify({
		ok: false,
		value: null,
		error: {
			code: 'unsupported-preservation-payload',
			message: 'This call is unavailable in this test engine.'
		}
	});
}

async function flushPromises() {
	for (let index = 0; index < 10; index += 1) {
		await Promise.resolve();
	}
}

describe('createPkhexEngineWorkerRuntime', () => {
	test('passes both snapshots to the preservation update facade', async () => {
		const posted: PostedWorkerMessage[] = [];
		let received: [number[], number[]] | null = null;
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: async () => ({
				...createEngineExports(),
				ReplacePreservationPayloadCurrentJson: (payload, entity) => {
					received = [[...payload], [...entity]];
					return unavailableInTestEngine();
				}
			}),
			postMessage: (message) => posted.push(message)
		});
		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		await flushPromises();
		runtime.handleMessage({
			type: 'request',
			id: 'replace-1',
			method: 'replacePreservationPayloadCurrent',
			payload: { bytes: new Uint8Array([1, 2]).buffer, entityBytes: new Uint8Array([3]).buffer }
		});
		await flushPromises();
		expect(received).toEqual([[1, 2], [3]]);
		expect(posted.at(-1)).toMatchObject({
			type: 'response',
			method: 'replacePreservationPayloadCurrent',
			result: { ok: false, error: { code: 'unsupported-preservation-payload' } }
		});
	});
	test('returns engine-unavailable responses for requests received while idle', async () => {
		expect.assertions(1);

		const posted: PostedWorkerMessage[] = [];
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: async () => createEngineExports(),
			postMessage: (message) => posted.push(message)
		});

		runtime.handleMessage({ type: 'request', id: 'req-1', method: 'getVersion' });
		await flushPromises();

		expect(posted).toEqual([
			{
				type: 'response',
				id: 'req-1',
				method: 'getVersion',
				result: {
					ok: false,
					value: null,
					error: {
						code: 'engine-unavailable',
						message: 'Pokemon data is still loading. Try again.'
					}
				}
			}
		]);
	});

	test('posts loading once, shares the startup attempt, and services queued requests after ready', async () => {
		expect.assertions(3);

		const startup = createDeferred<DotnetPkhexEngineExports>();
		const posted: PostedWorkerMessage[] = [];
		const basePaths: string[] = [];
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: (basePath) => {
				basePaths.push(basePath);
				return startup.promise;
			},
			postMessage: (message) => posted.push(message)
		});

		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		runtime.handleMessage({ type: 'init', basePath: '/other-engine' });
		runtime.handleMessage({ type: 'request', id: 'req-2', method: 'getVersion' });
		await flushPromises();

		expect(basePaths).toEqual(['/pkhex-engine']);
		expect(posted).toEqual([{ type: 'status', status: 'loading' }]);

		startup.resolve(createEngineExports());
		await flushPromises();

		expect(posted).toEqual([
			{ type: 'status', status: 'loading' },
			{ type: 'status', status: 'ready' },
			{
				type: 'response',
				id: 'req-2',
				method: 'getVersion',
				result: {
					ok: true,
					value: { pkhexCoreVersion: '26.5.5.0', facadeVersion: '1.0.0.0' },
					error: null
				}
			}
		]);
	});

	test('answers queued user requests before queued background requests', async () => {
		const startup = createDeferred<DotnetPkhexEngineExports>();
		const posted: PostedWorkerMessage[] = [];
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: () => startup.promise,
			postMessage: (message) => posted.push(message)
		});
		const payload = { bytes: new ArrayBuffer(1) };

		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		runtime.handleMessage({ type: 'request', id: 'card', method: 'summarizeSaveCard', payload });
		runtime.handleMessage({
			type: 'request',
			id: 'warm-up',
			method: 'loadSaveWorkspace',
			payload: { ...payload, box: 0, background: true }
		});
		runtime.handleMessage({ type: 'request', id: 'open', method: 'summarizeSave', payload });
		startup.resolve(createEngineExports());
		await flushPromises();

		expect(posted.flatMap((message) => ('id' in message ? [message.id] : []))).toEqual([
			'open',
			'card',
			'warm-up'
		]);
	});

	test('counts Save card Pokemon with an engine that lacks the card export', async () => {
		const posted: PostedWorkerMessage[] = [];
		const engine = createEngineExports();
		delete (engine as Partial<DotnetPkhexEngineExports>).SummarizeSaveCardJson;
		engine.ListBoxSmoke = (_bytes, _fileName, box) =>
			JSON.stringify({ ok: true, value: box === 0 ? [{ isEmpty: false }, { isEmpty: true }] : [] });
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: async () => engine,
			postMessage: (message) => posted.push(message)
		});

		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		runtime.handleMessage({
			type: 'request',
			id: 'card',
			method: 'summarizeSaveCard',
			payload: { bytes: new ArrayBuffer(1) }
		});
		await flushPromises();

		expect(posted.at(-1)).toMatchObject({
			id: 'card',
			result: { ok: true, value: { summary: { boxCount: 32 }, pokemonCount: 2 } }
		});
	});

	test('posts failed startup status and makes later calls engine-unavailable when runtime import fails', async () => {
		expect.assertions(2);

		const posted: PostedWorkerMessage[] = [];
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: async () => {
				throw new Error('Runtime import failed.');
			},
			postMessage: (message) => posted.push(message)
		});

		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		await flushPromises();

		expect(posted).toEqual([
			{ type: 'status', status: 'loading' },
			{
				type: 'status',
				status: 'failed',
				error: { code: 'engine-unavailable', message: 'Runtime import failed.' }
			}
		]);

		runtime.handleMessage({ type: 'request', id: 'req-3', method: 'getVersion' });
		await flushPromises();

		expect(posted.at(-1)).toEqual({
			type: 'response',
			id: 'req-3',
			method: 'getVersion',
			result: {
				ok: false,
				value: null,
				error: {
					code: 'engine-unavailable',
					message: 'Pokemon data is still loading. Try again.'
				}
			}
		});
	});

	test('fails deterministically when a request is waiting on a failed facade lookup', async () => {
		expect.assertions(1);

		const startup = createDeferred<DotnetPkhexEngineExports>();
		const posted: PostedWorkerMessage[] = [];
		const runtime = createPkhexEngineWorkerRuntime({
			loadEngine: () => startup.promise,
			postMessage: (message) => posted.push(message)
		});

		runtime.handleMessage({ type: 'init', basePath: '/pkhex-engine' });
		runtime.handleMessage({ type: 'request', id: 'req-4', method: 'getVersion' });
		startup.reject(new Error('Facade exports were not found.'));
		await flushPromises();

		expect(posted).toEqual([
			{ type: 'status', status: 'loading' },
			{
				type: 'status',
				status: 'failed',
				error: { code: 'engine-unavailable', message: 'Facade exports were not found.' }
			}
		]);
	});
});
