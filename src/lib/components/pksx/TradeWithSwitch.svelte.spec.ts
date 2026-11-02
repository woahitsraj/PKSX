import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { EngineResult, OutgoingLinkTrade } from '$lib/engine';
import type { TradeWorkerCapabilities, TradeWorkerEvent } from '$lib/link-trade/contract';
import type { TradeWorkerClient } from '$lib/link-trade/trade-worker-client';
import TradeWithSwitch from './TradeWithSwitch.svelte';

const capabilities: TradeWorkerCapabilities = {
	contractVersion: 1,
	webSerial: false,
	fakePort: true,
	keysPresent: true,
	firmware: { protocolVersion: 1, version: '1.0.0', targets: ['esp32'] },
	games: [
		{
			game: 'sword',
			role: 'joiner',
			hardwareVerified: true,
			hostConfirmation: false,
			outgoingByteLength: 344
		},
		{
			game: 'shield',
			role: 'joiner',
			hardwareVerified: false,
			hostConfirmation: false,
			outgoingByteLength: 344
		}
	]
};
const board = {
	protocolVersion: 1,
	firmwareVersion: '1.0.0',
	target: 'esp32',
	chipRevision: 1,
	baudRate: 921600,
	simulated: true
};
const offer: OutgoingLinkTrade = {
	destinationGame: 'sword',
	ready: true,
	entityFormat: 'PK8',
	outgoingBytes: new Uint8Array(344),
	sourceSha256: 'source',
	outgoingSha256: 'outgoing',
	converted: true,
	changes: [
		{ field: 'Format', before: 'PB8', after: 'PK8' },
		{ field: 'Encryption Constant', before: '00000001', after: '00000002' },
		{ field: 'Ball', before: 'Strange', after: 'Poke' }
	],
	legality: null,
	blockingReasons: [],
	projection: null
};

let component: Record<string, unknown> | null = null;

afterEach(async () => {
	if (component) await unmount(component);
	component = null;
	document.body.replaceChildren();
});

function stubClient(overrides: Partial<TradeWorkerClient> = {}) {
	const listeners = new Set<(event: TradeWorkerEvent) => void>();
	const client: TradeWorkerClient = {
		capabilities: async () => ({ ok: true, value: capabilities }),
		importKeys: async () => ({ ok: true, value: {} }),
		forgetKeys: async () => ({ ok: true, value: {} }),
		connectRadio: async () => ({ ok: true, value: board }),
		installFirmware: async () => ({ ok: true, board }),
		onEvent: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		terminate: vi.fn(),
		...overrides
	};
	return { client, emit: (event: TradeWorkerEvent) => listeners.forEach((l) => l(event)) };
}

async function settle() {
	for (let turn = 0; turn < 5; turn += 1) {
		await tick();
		await Promise.resolve();
	}
	flushSync();
}

async function render(
	client: TradeWorkerClient,
	result: EngineResult<OutgoingLinkTrade> = { ok: true, value: offer, error: null },
	onClose = vi.fn()
) {
	const prepare = vi.fn(async () => result);
	component = mount(TradeWithSwitch, {
		target: document.body,
		props: {
			pokemonLabel: 'Pikachu',
			location: 'Box 1, Slot 1',
			source: {
				owner: 'pokemon-storage',
				collectionId: 'pokemon-storage',
				slot: { zone: 'box', box: 0, slot: 0 }
			},
			prepare,
			createClient: () => client,
			onClose
		}
	}) as Record<string, unknown>;
	await settle();
	return { prepare, onClose };
}

function button(name: string) {
	const found = Array.from(document.querySelectorAll('button')).find(
		(candidate) => candidate.textContent?.trim() === name
	);
	if (!found) throw new Error(`No button named ${name}: ${document.body.textContent}`);
	return found;
}

async function click(name: string) {
	button(name).click();
	await settle();
}

describe('Trade with Switch setup', () => {
	test('explains an unsupported browser first, even when a simulated radio exists', async () => {
		const { client } = stubClient();
		await render(client);
		expect(document.body.textContent).toContain('desktop Chrome or Edge');
		await click('Continue with simulated radio');
		expect(document.body.textContent).toContain('Switch keys');
	});

	test('moves focus with controller actions, clamps at the edges and confirms', async () => {
		const { client } = stubClient();
		await render(client);
		await click('Continue with simulated radio');
		const api = component as unknown as { dispatch(action: string): void };
		expect(document.activeElement).toBe(button('Continue'));
		api.dispatch('right');
		expect(document.activeElement).toBe(button('Continue'));
		for (const name of ['Forget keys', 'Close', 'Close']) {
			api.dispatch('left');
			expect(document.activeElement).toBe(button(name));
		}
		api.dispatch('right');
		api.dispatch('right');
		api.dispatch('confirm');
		await settle();
		expect(document.body.textContent).toContain('Trade Radio');
	});

	test('a second press while the radio connects cannot leave the step', async () => {
		let finish = () => {};
		const { client } = stubClient({
			connectRadio: () =>
				new Promise((resolve) => (finish = () => resolve({ ok: true, value: board })))
		});
		const { onClose } = await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Use simulated radio');
		const api = component as unknown as { dispatch(action: string): void };
		api.dispatch('confirm');
		api.dispatch('back');
		await settle();
		expect(onClose).not.toHaveBeenCalled();
		expect(document.body.textContent).toContain('Trade Radio');
		finish();
		await vi.waitFor(() => expect(document.body.textContent).toContain('Destination game'));
	});

	test('explains an unsupported browser and offers no connection', async () => {
		const { client } = stubClient({
			capabilities: async () => ({
				ok: true,
				value: { ...capabilities, fakePort: false }
			})
		});
		await render(client);
		expect(document.body.textContent).toContain('desktop Chrome or Edge');
		expect(document.body.textContent).not.toContain('Connect');
		expect(button('Close')).toBe(document.activeElement);
	});

	test('names missing keys and never a value', async () => {
		const importKeys = vi.fn(async () => ({
			ok: false as const,
			error: {
				code: 'keys-incomplete' as const,
				message: 'prod.keys is missing master_key_12'
			}
		}));
		const { client } = stubClient({
			capabilities: async () => ({
				ok: true,
				value: { ...capabilities, webSerial: true, keysPresent: false }
			}),
			importKeys
		});
		await render(client);
		const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
		const files = new DataTransfer();
		files.items.add(new File(['header_key = 00'], 'prod.keys'));
		input.files = files.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
		await vi.waitFor(() => expect(importKeys).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(document.body.textContent).toContain('missing master_key_12'));
		expect(document.body.textContent).not.toContain('header_key');
	});

	test('reaches a review bound to the prepared game without an exchange command', async () => {
		const { client } = stubClient();
		const { prepare, onClose } = await render(client);
		await click('Continue with simulated radio');
		expect(button('Continue')).toBe(document.activeElement);
		await click('Continue');
		await click('Use simulated radio');

		expect(button('Sword')).toBe(document.activeElement);
		expect(button('Shield').disabled).toBe(true);
		expect(document.body.textContent).toContain('Shield is not verified');
		await click('Sword');

		expect(prepare).toHaveBeenCalledExactlyOnceWith('sword');
		const text = document.body.textContent;
		expect(text).toContain('keeps the original');
		expect(text).toContain('confirm the trade on the Switch');
		expect(text).toContain('no HOME tracker');
		expect(text).toContain('Ball: Strange to Poke');
		expect(text).not.toContain('PK8');
		expect(text).not.toContain('Encryption');
		expect(Object.keys(client)).not.toContain('startSession');

		await click('Change game');
		expect(document.body.textContent).toContain('Destination game');
		await click('Sword');
		expect(prepare).toHaveBeenCalledTimes(2);
		await click('Done');
		expect(onClose).toHaveBeenCalledOnce();
	});

	test('shows blocking reasons and has no ready review', async () => {
		const { client } = stubClient();
		await render(client, {
			ok: true,
			value: {
				...offer,
				ready: false,
				outgoingBytes: null,
				outgoingSha256: null,
				blockingReasons: [{ kind: 'unavailable-in-game', message: 'Not in Sword.' }]
			},
			error: null
		});
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Use simulated radio');
		await click('Sword');
		expect(document.body.textContent).toContain('Not in Sword.');
		expect(document.body.textContent).not.toContain('keeps the original');
	});

	test('offers Install firmware after a firmware mismatch, then continues', async () => {
		const { client } = stubClient({
			connectRadio: async () => ({
				ok: false,
				error: { code: 'firmware-mismatch', message: 'v2' }
			})
		});
		await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Use simulated radio');
		expect(document.body.textContent).toContain('another version of the firmware');
		expect(document.body.textContent).not.toContain('v2');
		await click('Install firmware');
		expect(document.body.textContent).toContain('PKSX installs the Trade Radio firmware');
		expect(button('Install firmware')).toBe(document.activeElement);
		await click('Install firmware');
		await click('Replace firmware');
		await vi.waitFor(() => expect(document.body.textContent).toContain('Firmware installed'));
		await click('Done');
		expect(document.body.textContent).toContain('Destination game');
	});

	test('returns to the radio step when the board drops after the firmware installs', async () => {
		const { client, emit } = stubClient();
		await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Install on simulated radio');
		await click('Install firmware');
		await click('Replace firmware');
		await vi.waitFor(() => expect(document.body.textContent).toContain('Firmware installed'));
		emit({ type: 'radio-disconnected', error: { code: 'radio-lost', message: 'gone' } });
		await settle();
		await click('Done');
		expect(document.body.textContent).toContain('connection to the Trade Radio was lost');
		expect(button('Use simulated radio').disabled).toBe(false);
	});

	test('returns to the radio step when the connection drops during review', async () => {
		const { client, emit } = stubClient();
		await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Use simulated radio');
		await click('Sword');
		emit({
			type: 'radio-disconnected',
			error: { code: 'radio-lost', message: 'gone' }
		});
		await settle();
		expect(document.body.textContent).toContain('connection to the Trade Radio was lost');
		expect(document.body.textContent).not.toContain('keeps the original');
	});

	test('moves back one step and closes from the first step', async () => {
		const { client } = stubClient();
		const { onClose } = await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		const api = component as unknown as { dispatch(action: string): void };
		api.dispatch('back');
		await settle();
		expect(document.body.textContent).toContain('Switch keys');
		api.dispatch('back');
		expect(onClose).toHaveBeenCalledOnce();
	});

	test('does not dismiss while firmware installs', async () => {
		let finish = () => {};
		const { client } = stubClient({
			connectRadio: async () => ({
				ok: false,
				error: { code: 'firmware-mismatch', message: '' }
			}),
			installFirmware: () => new Promise((resolve) => (finish = () => resolve({ ok: true, board })))
		});
		await render(client);
		await click('Continue with simulated radio');
		await click('Continue');
		await click('Use simulated radio');
		await click('Install firmware');
		await click('Install firmware');
		await click('Replace firmware');
		(component as unknown as { dispatch(action: string): void }).dispatch('back');
		await settle();
		expect(document.body.textContent).toContain('Do not disconnect the board.');
		finish();
		await vi.waitFor(() => expect(document.body.textContent).toContain('Firmware installed'));
	});
});
