import { expect, test, vi } from 'vitest';
import fixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav?url';
import { base64ToBytes } from '$lib/engine';
import { createPkhexEngine } from '$lib/engine/pkhex-engine';
import {
	BrowserCatalogPersistence,
	deleteBrowserCatalog,
	PokemonStorageService
} from '$lib/pksx/pokemon-storage-catalog';
import { reviewedLinkTrade } from './trade-setup';
import {
	browserTradeJournal,
	TradeJournal,
	type TradeEntry,
	type TradeJournalStore
} from './trade-journal';

async function harness() {
	const engine = await createPkhexEngine('/pkhex-engine');
	const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
	const slots = await engine.listBoxSlots(bytes, 'sword.sav', 0);
	if (!slots.ok) throw slots.error;
	let source: Uint8Array | null = null;
	let review = null;
	for (const slot of slots.value) {
		if (!slot.entityBytesBase64) continue;
		source = base64ToBytes(slot.entityBytesBase64);
		const prepared = await engine.prepareOutgoingLinkTrade(source, {
			destinationGame: 'sword',
			sourceKind: 'entity'
		});
		if (prepared.ok)
			review = reviewedLinkTrade(
				{
					owner: 'save-file',
					collectionId: 'save',
					slot: { zone: 'box', box: 0, slot: slot.slot }
				},
				prepared.value
			);
		if (review) break;
	}
	if (!review || !source) throw new Error('Expected a tradable fixture.');
	const name = `trade-${crypto.randomUUID()}`;
	const storage = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
	await storage.initialize();
	const entries = new Map<string, TradeEntry>();
	const store: TradeJournalStore = {
		list: async () => structuredClone([...entries.values()]),
		put: async (entry) => {
			entries.set(entry.id, structuredClone(entry));
		}
	};
	const journal = new TradeJournal(store, engine, storage);
	const entry = await journal.prepare(review, async () => review);
	const end = (received = review.outgoingBytes) =>
		journal.event({
			type: 'session-ended',
			sessionId: entry.id,
			sequence: 1,
			outcome: 'completed',
			error: null,
			unknown: null,
			receipt: {
				sessionId: entry.id,
				game: 'sword',
				receivedPokemon: new Uint8Array(received).buffer,
				sentDigest: review.outgoingSha256,
				receivedDigest: 'receipt',
				completion: { consoleConfirmed: true, ladderPhase: 4, endedBy: 'console-left' }
			}
		});
	return {
		engine,
		review,
		source,
		storage,
		store,
		journal,
		entry,
		end,
		cleanup: () => {
			journal.close();
			return deleteBrowserCatalog(name);
		}
	};
}

test('rechecks review, preserves evidence and recovers without exchanging again', async () => {
	const h = await harness();
	try {
		await expect(
			h.journal.prepare(h.review, async () => ({ ...h.review, sourceSha256: 'changed' }))
		).rejects.toThrow('Review it again');
		const start = vi.fn(async () => {});
		await h.journal.dispatch(h.entry.id, start);
		expect(start.mock.calls[0]).toBeDefined();
		await expect(h.journal.dispatch(h.entry.id, start)).rejects.toThrow('already started');
		await h.journal.event({
			type: 'trade-offer',
			sessionId: h.entry.id,
			sequence: 0,
			pokemon: new Uint8Array(h.review.outgoingBytes).buffer
		});
		const active = await new TradeJournal(h.store, h.engine, h.storage).recover();
		expect(active[0].outcome).toBeNull();
		h.journal.close();
		const recovered = await h.journal.recover();
		expect(recovered[0].outcome).toBe('outcome-unknown');
		expect(recovered[0].events[0].type).toBe('trade-offer');
		expect(h.storage.listRecords()).toHaveLength(0);
		expect(start).toHaveBeenCalledOnce();
	} finally {
		await h.cleanup();
	}
});

test('receipt retries survive Storage failure and a crash after creation, without duplicate records', async () => {
	const h = await harness();
	try {
		await h.end();
		await h.end();
		expect((await h.journal.required(h.entry.id)).events).toHaveLength(1);
		const original = h.storage.importPayload.bind(h.storage);
		const fail = vi.spyOn(h.storage, 'importPayload').mockRejectedValueOnce(new Error('disk full'));
		expect((await h.journal.retryImport(h.entry.id)).importProblem).toBe('storage');
		fail.mockImplementationOnce(async (...args) => {
			await original(...args);
			throw new Error('crash before acknowledgement');
		});
		await h.journal.retryImport(h.entry.id);
		expect(h.storage.listRecords()).toHaveLength(1);
		const reopened = new TradeJournal(h.store, h.engine, h.storage);
		await reopened.recover();
		const done = await reopened.retryImport(h.entry.id);
		expect(done.imported).toBe(true);
		expect(done.legality).not.toBeNull();
		expect(h.storage.listRecords()).toHaveLength(1);
		expect(h.storage.getRecord(done.recordId!)?.placement).toBeNull();
		await reopened.retryImport(h.entry.id);
		expect(h.storage.listRecords()).toHaveLength(1);
	} finally {
		await h.cleanup();
	}
});

test('malformed receipt bytes remain recoverable and never become a record', async () => {
	const h = await harness();
	try {
		const malformed = new Uint8Array([1, 2, 3]);
		await h.end(malformed);
		const entry = await h.journal.retryImport(h.entry.id);
		expect(entry.importProblem).toBe('unparseable');
		expect(entry.partnerDigest).toHaveLength(64);
		expect(new Uint8Array(entry.receipt!.receivedPokemon)).toEqual(malformed);
		expect(h.storage.listRecords()).toHaveLength(0);
	} finally {
		await h.cleanup();
	}
});

test('a returning copy waits for a choice and links to the original payload only explicitly', async () => {
	const h = await harness();
	try {
		const record = await h.storage.add(h.source, {
			entryMode: 'imported',
			originGame: 'Sword',
			originSaveFileId: null,
			originSaveFileName: null,
			originalTrainer: null,
			trainerId: null,
			enteredAt: new Date().toISOString()
		});
		const original = await h.storage.readPayload(record.recordId);
		const outgoingReview = {
			...h.review,
			source: { ...h.review.source, owner: 'pokemon-storage' as const, recordId: record.recordId }
		};
		const sent = await h.journal.prepare(outgoingReview, async () => outgoingReview);
		await h.journal.dispatch(sent.id, async () => {});
		const projected = await h.engine.projectPreservationPayload(original, 9);
		if (!projected.ok) throw projected.error;
		await h.storage.replace(record.recordId, projected.value.bytes, record.payload.id);
		const recent = await h.journal.prepare(outgoingReview, async () => outgoingReview);
		await h.journal.dispatch(recent.id, async () => {});
		await h.end();
		const waiting = await h.journal.retryImport(h.entry.id);
		expect(waiting.returningSession).toBe(recent.id);
		expect(waiting.imported).toBe(false);
		expect(h.storage.listRecords()).toHaveLength(1);
		await h.store.put({
			...waiting,
			choice: 'link',
			returningSession: sent.id,
			recordId: record.recordId,
			payload: new Uint8Array(original),
			importProblem: 'storage'
		});
		const linked = await h.journal.retryImport(h.entry.id, 'link');
		expect(linked.returningSession).toBe(recent.id);
		expect(linked.recordId).toBe(record.recordId);
		expect(linked.imported).toBe(true);
		expect(await h.storage.readPayload(record.recordId)).toEqual(original);
	} finally {
		await h.cleanup();
	}
});

test('IndexedDB acknowledgement survives reopening with exact encrypted receipt bytes', async () => {
	const h = await harness();
	const database = `trade-journal-${crypto.randomUUID()}`;
	try {
		const store = browserTradeJournal(database);
		await h.end();
		await store.put(await h.journal.required(h.entry.id));
		const reopened = new TradeJournal(browserTradeJournal(database), h.engine, h.storage);
		await reopened.recover();
		const entry = await reopened.retryImport(h.entry.id);
		expect(entry.imported).toBe(true);
		const persisted = (await browserTradeJournal(database).list())[0];
		expect(persisted.recordId).toBe(entry.recordId);
		expect(new Uint8Array(persisted.receipt!.receivedPokemon)).toEqual(h.review.outgoingBytes);
	} finally {
		await h.cleanup();
		indexedDB.deleteDatabase(database);
	}
});
