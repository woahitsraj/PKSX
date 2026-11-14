import { mount, unmount, tick } from 'svelte';
import { page } from 'vitest/browser';
import '../../routes/layout.css';
import { expect, test, vi } from 'vitest';
import fixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav?url';
import { createPkhexEngine } from '$lib/engine/pkhex-engine';
import { base64ToBytes } from '$lib/engine';
import TradeWithSwitch from '$lib/components/pksx/TradeWithSwitch.svelte';
import {
	PokemonStorageService,
	BrowserCatalogPersistence,
	deleteBrowserCatalog
} from '$lib/pksx/pokemon-storage-catalog';
import { TradeJournal, type TradeEntry } from './trade-journal';
import { fakeTradeClient } from './trade-test-client.e2e-helper';
import type { FakeScript } from './trade-worker/fake-radio';

for (const { script, fault } of [
	{ script: 'trade' },
	{ script: 'cancel' },
	{ script: 'not-ready' },
	{ script: 'drop-after-ladder' },
	{ script: 'trade', fault: 'storage' },
	{ script: 'trade', fault: 'join' }
] satisfies { script: FakeScript; fault?: 'storage' | 'join' }[]) {
	test(`exchange Takeover follows the real fake-radio ${script} ${fault ?? ''} outcome`, async () => {
		await page.viewport(
			fault === 'join' ? 616 : fault === 'storage' ? 360 : 1280,
			fault === 'join' ? 336 : fault === 'storage' ? 560 : 800
		);
		const engine = await createPkhexEngine('/pkhex-engine');
		const save = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
		const slots = await engine.listBoxSlots(save, 'Sword.sav', 0);
		if (!slots.ok) throw slots.error;
		let bytes: Uint8Array | null = null;
		let outgoing: Uint8Array | null = null;
		for (const slot of slots.value) {
			if (!slot.entityBytesBase64) continue;
			bytes = base64ToBytes(slot.entityBytesBase64);
			const prepared = await engine.prepareOutgoingLinkTrade(bytes, {
				destinationGame: 'sword',
				sourceKind: 'entity'
			});
			if (prepared.ok && prepared.value.ready) {
				outgoing = prepared.value.outgoingBytes;
				break;
			}
		}
		if (!bytes || !outgoing) throw new Error('Expected tradable fixture.');
		const sourceBytes = bytes;
		const name = `trade-ui-${crypto.randomUUID()}`;
		const storage = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
		await storage.initialize();
		const entries = new Map<string, TradeEntry>();
		const journal = new TradeJournal(
			{
				list: async () => structuredClone([...entries.values()]),
				put: async (entry) => {
					entries.set(entry.id, structuredClone(entry));
				}
			},
			engine,
			storage
		);
		let finishImport = () => {};
		if (script === 'trade' && !fault) {
			const original = storage.importPayload.bind(storage);
			const pending = new Promise<void>((resolve) => {
				finishImport = resolve;
			});
			vi.spyOn(storage, 'importPayload').mockImplementation(async (...args) => {
				await pending;
				return original(...args);
			});
		}
		const client = fakeTradeClient(script, outgoing, fault);
		if (fault === 'storage')
			vi.spyOn(storage, 'importPayload').mockRejectedValueOnce(new Error('disk full'));
		const start = vi.spyOn(client, 'startSession');
		const onClose = vi.fn();
		const host = document.createElement('div');
		document.body.append(host);
		const component = mount(TradeWithSwitch, {
			target: host,
			props: {
				pokemonLabel: 'Fixture Pokemon',
				location: 'Box 1',
				source: {
					owner: 'save-file',
					collectionId: 'fixture',
					slot: { zone: 'box', box: 0, slot: 0 }
				},
				prepare: (destinationGame) =>
					engine.prepareOutgoingLinkTrade(sourceBytes, { destinationGame, sourceKind: 'entity' }),
				createClient: () => client,
				createJournal: async () => journal,
				onClose
			}
		});
		async function click(label: string) {
			await vi.waitFor(() =>
				expect(
					[...host.querySelectorAll('button')].some(
						(button) => button.textContent?.trim() === label && !button.disabled
					)
				).toBe(true)
			);
			[...host.querySelectorAll('button')]
				.find((button) => button.textContent?.trim() === label)!
				.click();
			await tick();
		}
		try {
			await click('Continue with simulated radio');
			await click('Continue');
			await click('Use simulated radio');
			await click('Sword');
			await click('Start trade');
			const expected = {
				trade: 'Trade completed',
				cancel: 'Trade cancelled',
				'not-ready': "Switch isn't ready",
				'drop-after-ladder': 'Unknown Trade Outcome'
			}[script];
			if (fault === 'join') {
				await vi.waitFor(() => expect(host.textContent).toContain('Could not join the Switch'), {
					timeout: 25000
				});
				await click('Retry');
			}
			await vi.waitFor(() => expect(host.textContent).toContain(expected), { timeout: 25000 });
			if (script === 'trade' && !fault) {
				component.dispatch('back');
				expect(onClose).not.toHaveBeenCalled();
				finishImport();
			}
			if (fault === 'storage') {
				await vi.waitFor(() => expect(host.textContent).toContain('has not been saved to Storage'));
				await click('Retry local import');
			}
			if (script === 'trade') {
				await vi.waitFor(() => expect(host.textContent).toContain('Unfiled'));
				expect(storage.listRecords()).toHaveLength(1);
			} else expect(storage.listRecords()).toHaveLength(0);
			expect(start).toHaveBeenCalledTimes(fault === 'join' ? 2 : 1);
			const dialog = host.querySelector('[role=dialog]')!.getBoundingClientRect();
			expect(dialog.left).toBeGreaterThanOrEqual(0);
			expect(dialog.top).toBeGreaterThanOrEqual(0);
			expect(dialog.right).toBeLessThanOrEqual(window.innerWidth);
			expect(dialog.bottom).toBeLessThanOrEqual(window.innerHeight);
			if (import.meta.env.VITE_TRADE_EVIDENCE)
				await page.screenshot({
					path: `/tmp/pksx-trade-evidence/${script}-${fault ?? 'outcome'}.png`
				});
			component.dispatch('back');
			expect(onClose).toHaveBeenCalledOnce();
		} finally {
			finishImport();
			await unmount(component);
			host.remove();
			await deleteBrowserCatalog(name);
		}
	}, 40000);
}
