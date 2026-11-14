import { TradeWorkerRuntime } from './trade-worker/runtime';
import { FakeTradeRadio, type FakeScript } from './trade-worker/fake-radio';
import { memoryKeyStore, parseProdKeys } from './switch-keys';
import type { Clock } from './trade-worker/serial-port';
import {
	capabilitiesSchema,
	boardSchema,
	sessionStatusSchema,
	type TradeWorkerEvent
} from './contract';
import type { TradeWorkerClient, TradeWorkerResult } from './trade-worker-client';

export function fakeTradeClient(
	script: FakeScript,
	receivedPokemon: Uint8Array,
	fault?: 'join' | 'storage' | 'radio'
): TradeWorkerClient {
	const keyStore = memoryKeyStore(
		parseProdKeys(
			['aes_kek_generation_source', 'aes_key_generation_source', 'master_key_00', 'master_key_12']
				.map((name) => `${name} = ${'00'.repeat(16)}`)
				.join('\n')
		)
	);
	const listeners = new Set<(event: TradeWorkerEvent) => void>();
	const pending = new Map<string, (result: TradeWorkerResult<unknown>) => void>();
	const clock: Clock = {
		now: () => performance.now() * 5,
		sleep: (ms, signal) =>
			new Promise((resolve) => {
				if (signal?.aborted) return resolve();
				const timer = setTimeout(done, ms / 5);
				function done() {
					clearTimeout(timer);
					signal?.removeEventListener('abort', done);
					resolve();
				}
				signal?.addEventListener('abort', done, { once: true });
			})
	};
	let connections = 0;
	const runtime = new TradeWorkerRuntime({
		post: (message) => {
			if (message.type === 'event') listeners.forEach((listener) => listener(message.event));
			else {
				pending.get(message.requestId)?.(
					message.ok ? { ok: true, value: message.result } : message
				);
				pending.delete(message.requestId);
			}
		},
		keyStore,
		clock,
		webSerial: false,
		fakePort: true,
		openPort: async () =>
			new FakeTradeRadio({
				script,
				receivedPokemon: new Uint8Array(receivedPokemon),
				joinFailures: fault === 'join' ? 1 : 0,
				dropBeforeConfirmation: fault === 'radio' && connections++ === 0,
				keys: () => keyStore.load(),
				clock
			}),
		openBootloader: async () => {
			throw new Error('Firmware is outside this test.');
		},
		loadFirmware: async () => {
			throw new Error('Firmware is outside this test.');
		}
	});
	function request(command: object): Promise<TradeWorkerResult<unknown>> {
		const requestId = crypto.randomUUID();
		return new Promise((resolve) => {
			pending.set(requestId, resolve);
			void runtime.handle({ ...command, requestId });
		});
	}
	return {
		capabilities: async () => {
			const result = await request({ type: 'get-capabilities' });
			return result.ok ? { ok: true, value: capabilitiesSchema.parse(result.value) } : result;
		},
		connectRadio: async () => {
			const result = await request({ type: 'connect-radio', port: { kind: 'fake', script } });
			return result.ok
				? { ok: true, value: boardSchema.parse((result.value as { board: unknown }).board) }
				: result;
		},
		startSession: async (sessionId, game, bytes) => {
			const result = await request({
				type: 'start-session',
				sessionId,
				game,
				outgoingPokemon: new Uint8Array(bytes).buffer
			});
			return result.ok ? { ok: true, value: sessionStatusSchema.parse(result.value) } : result;
		},
		cancelSession: (sessionId) => request({ type: 'cancel-session', sessionId }),
		importKeys: async () => ({ ok: true, value: {} }),
		forgetKeys: async () => ({ ok: true, value: {} }),
		installFirmware: async () => {
			throw new Error('Firmware is outside this test.');
		},
		onEvent: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		terminate: () => {
			listeners.clear();
			void request({ type: 'disconnect-radio' });
		}
	};
}
