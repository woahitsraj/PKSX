import { describe, expect, it } from 'vitest';
import {
	tradeWorkerMessageSchema,
	type RadioPort,
	type TradeWorkerEvent,
	type TradeWorkerMessage
} from '../contract';
import { memoryKeyStore, type SwitchKeys } from '../switch-keys';
import { fromHex, toHex } from './bytes';
import { sha256 } from './crypto';
import { FakeTradeRadio, fakePk8, type FakeRadioOptions } from './fake-radio';
import { PortError, TradeWorkerRuntime } from './runtime';
import type { Clock } from './serial-port';
import vectors from './test-vectors.json';

/** Real timers, `factor` times faster: the protocol's own timings, compressed. */
function scaledClock(factor: number): Clock {
	const start = performance.now();
	return {
		now: () => (performance.now() - start) * factor,
		sleep: (ms, signal) =>
			new Promise((resolve) => {
				if (signal?.aborted) return resolve();
				const timer = setTimeout(done, ms / factor);
				signal?.addEventListener('abort', done, { once: true });
				function done() {
					clearTimeout(timer);
					resolve();
				}
			})
	};
}

const keys = Object.fromEntries(
	Object.entries(vectors.keys).map(([name, hex]) => [name, fromHex(hex)])
) as unknown as SwitchKeys;
const offer = fakePk8(1);

function harness(fake: Partial<FakeRadioOptions> = {}, storedKeys: SwitchKeys | null = keys) {
	const clock = scaledClock(10);
	const keyStore = memoryKeyStore(storedKeys);
	const messages: TradeWorkerMessage[] = [];
	let radio: FakeTradeRadio | null = null;
	const runtime = new TradeWorkerRuntime({
		post: (message) => messages.push(tradeWorkerMessageSchema.parse(message)),
		keyStore,
		webSerial: false,
		fakePort: true,
		clock,
		openPort: async (port: RadioPort) => {
			if (port.kind !== 'fake') throw new PortError('port-not-found', 'no Web Serial in tests');
			radio = new FakeTradeRadio({
				script: port.script,
				keys: () => keyStore.load(),
				clock,
				...fake
			});
			return radio;
		}
	});
	let next = 0;
	const send = async (command: Record<string, unknown>) => {
		const requestId = `r${next++}`;
		await runtime.handle({ ...command, requestId });
		return messages.find((m) => m.type === 'response' && m.requestId === requestId)!;
	};
	const events = () => messages.flatMap((m) => (m.type === 'event' ? [m.event] : []));
	const ended = async () => {
		for (;;) {
			const end = events().find((e) => e.type === 'session-ended');
			if (end) return end as Extract<TradeWorkerEvent, { type: 'session-ended' }>;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	};
	return { send, events, ended, radio: () => radio!, keyStore };
}

const start = (sessionId = 'trade-1', bytes: Uint8Array = offer) => ({
	type: 'start-session',
	sessionId,
	game: 'sword',
	outgoingPokemon: new Uint8Array(bytes).buffer
});

describe('the trade worker', { timeout: 60_000 }, () => {
	it('completes a Link Trade only after confirmation, phase 4 and a graceful end', async () => {
		const h = harness();
		expect(
			await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'trade' } })
		).toMatchObject({
			ok: true,
			result: { board: { firmwareVersion: '1.0.0', target: 'esp32', simulated: true } }
		});
		expect(await h.send(start())).toMatchObject({ ok: true });
		const end = await h.ended();

		expect([end.outcome, end.error]).toEqual(['completed', null]);
		expect(toHex(new Uint8Array(end.receipt!.receivedPokemon))).toBe(toHex(fakePk8(2)));
		expect(end.receipt!.sentDigest).toBe(toHex(await sha256(offer)));
		expect(end.receipt!.completion).toEqual({
			consoleConfirmed: true,
			ladderPhase: 4,
			endedBy: 'console-left'
		});
		const phases = h.events().flatMap((e) => (e.type === 'session-phase' ? [e.phase] : []));
		expect(phases).toEqual([
			'scanning',
			'joining',
			'waiting-for-console',
			'in-trade-room',
			'offer-received',
			'confirming',
			'finishing'
		]);
		const ladder = h.events().flatMap((e) => (e.type === 'confirmation-progress' ? [e.phase] : []));
		expect(ladder).toEqual([0, 1, 2, 3, 4]);
		const sequences = h.events().flatMap((e) => ('sequence' in e ? [e.sequence] : []));
		expect(sequences).toEqual(sequences.map((_, i) => i));

		const seen = h.radio().observed;
		expect(toHex(seen.offer!)).toBe(toHex(offer));
		expect(toHex(seen.snapshot!.subarray(0, 0x158))).toBe(toHex(offer));
		expect(toHex(seen.staJoinKey!)).toBe(toHex(seen.expectedDataKey!));
		expect(await h.send({ type: 'recover-session', sessionId: 'trade-1' })).toMatchObject({
			ok: true,
			result: { status: { outcome: 'completed' }, unknown: null }
		});
	});

	it('never starts a second trade for a repeated start', async () => {
		const h = harness();
		await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'trade' } });
		const racing = await Promise.all([h.send(start()), h.send(start('trade-2'))]);
		expect(racing).toMatchObject([{ ok: true }, { ok: false, error: { code: 'session-active' } }]);
		expect(await h.send(start())).toMatchObject({ ok: true, result: { sessionId: 'trade-1' } });
		expect(await h.send(start('trade-2'))).toMatchObject({
			ok: false,
			error: { code: 'session-active' }
		});
		await h.send({ type: 'cancel-session', sessionId: 'trade-1' });
		expect((await h.ended()).outcome).toBe('cancelled');
		expect(
			h.events().filter((e) => e.type === 'session-phase' && e.phase === 'scanning')
		).toHaveLength(1);
	});

	it('reports a console that backs out of its confirmation as cancelled', async () => {
		const h = harness();
		await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'cancel' } });
		await h.send(start());
		const end = await h.ended();
		expect(end).toMatchObject({ outcome: 'cancelled', receipt: null });
		const actions = h.events().flatMap((e) => (e.type === 'console-action' ? [e.action] : []));
		expect(actions).toEqual(['offer-shown', 'confirmed', 'withdrew', 'offer-shown', 'left']);
		const offers = h.events().flatMap((e) => (e.type === 'trade-offer' ? [e.pokemon] : []));
		expect(offers.map((o) => toHex(new Uint8Array(o)))).toEqual(
			[fakePk8(2), fakePk8(3)].map(toHex)
		);
	});

	it('keeps a USB loss after phase 4 as an Unknown Trade Outcome with the offer as evidence', async () => {
		const h = harness();
		await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'drop-after-ladder' } });
		await h.send(start());
		const end = await h.ended();
		expect(end).toMatchObject({
			outcome: 'outcome-unknown',
			receipt: null,
			unknown: { reason: 'radio-lost', consoleConfirmed: true, ladderPhase: 4 }
		});
		expect(toHex(new Uint8Array(end.unknown!.offeredPokemon!))).toBe(toHex(fakePk8(2)));
		expect(
			h.events().some((e) => e.type === 'radio-disconnected' && e.error?.code === 'radio-lost')
		).toBe(true);
	});

	it('reports a console that never accepts the session as not ready', async () => {
		const h = harness();
		await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'not-ready' } });
		await h.send(start());
		expect(await h.ended()).toMatchObject({
			outcome: 'failed',
			error: { code: 'console-not-ready' }
		});
	});

	it('checks keys, the offer and the board before any radio work', async () => {
		const h = harness({}, null);
		expect(await h.send(start('bad', new Uint8Array(10)))).toMatchObject({
			ok: false,
			error: { code: 'invalid-outgoing-pokemon' }
		});
		expect(await h.send(start('a', offer))).toMatchObject({
			ok: false,
			error: { code: 'keys-missing' }
		});
		const imported = await h.send({ type: 'import-keys', prodKeys: 'master_key_00 = 00' });
		expect(imported).toMatchObject({ ok: false, error: { code: 'keys-incomplete' } });
		expect(JSON.stringify(imported)).not.toMatch(/[0-9a-f]{32}/);
		const text = Object.entries(vectors.keys)
			.map(([name, hex]) => `${name} = ${hex}`)
			.concat('header_key = ' + '11'.repeat(32))
			.join('\n');
		expect(await h.send({ type: 'import-keys', prodKeys: text })).toMatchObject({ ok: true });
		expect(Object.keys((await h.keyStore.load())!).sort()).toEqual(
			Object.keys(vectors.keys).sort()
		);
		expect(await h.send(start('b', offer))).toMatchObject({
			ok: false,
			error: { code: 'radio-not-connected' }
		});
		await h.send({ type: 'forget-keys' });
		expect(await h.keyStore.load()).toBe(null);
	});

	for (const [fake, code] of [
		[{ info: 'pokeldn-radio esp32 version=0.9.0 idf=v6.1' }, 'firmware-mismatch'],
		[{ info: 'pokeldn-radio esp32s2 version=1.0.0 idf=v6.1' }, 'unsupported-board'],
		[{ info: 'ESP-ROM:esp32 boot' }, 'unsupported-board'],
		[{ protocolVersion: 2 }, 'protocol-mismatch'],
		[{ busy: true }, 'port-busy']
	] as const) {
		it(`refuses a radio before a trade: ${code}`, async () => {
			const h = harness(fake);
			expect(
				await h.send({ type: 'connect-radio', port: { kind: 'fake', script: 'trade' } })
			).toMatchObject({ ok: false, error: { code } });
		});
	}

	it('rejects malformed commands and reports what it supports', async () => {
		const h = harness();
		expect(await h.send({ type: 'start-session', sessionId: '../x' })).toMatchObject({
			ok: false,
			error: { code: 'invalid-message' }
		});
		expect(await h.send({ type: 'get-capabilities' })).toMatchObject({
			ok: true,
			result: {
				contractVersion: 1,
				fakePort: true,
				games: [
					{ game: 'sword', hardwareVerified: true, hostConfirmation: false },
					{ game: 'shield', hardwareVerified: false, outgoingByteLength: 0x158 }
				]
			}
		});
		expect(await h.send({ type: 'confirm-offer', sessionId: 'none' })).toMatchObject({
			ok: false,
			error: { code: 'session-not-found' }
		});
	});
});
