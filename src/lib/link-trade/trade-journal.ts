import type { EngineApi, LegalityReport, LinkTradeIdentity } from '$lib/engine/types';
import type { PokemonStorageService } from '$lib/pksx/pokemon-storage-catalog/service';
import type { TradeWorkerEvent, TradeReceipt, TradeOutcome, TradeError } from './contract';
import type { ReviewedLinkTrade } from './trade-setup';

type SessionEvent = Extract<TradeWorkerEvent, { sessionId: string }>;
export type TradeEntry = {
	version: 1;
	id: string;
	review: ReviewedLinkTrade;
	createdAt: string;
	dispatched: boolean;
	events: SessionEvent[];
	outcome: TradeOutcome | null;
	error: TradeError | null;
	receipt: TradeReceipt | null;
	outgoingIdentity: LinkTradeIdentity | null;
	sourcePayload: Uint8Array | null;
	partnerDigest: string | null;
	legality: LegalityReport | null;
	returningSession: string | null;
	choice: 'separate' | 'link' | null;
	payload: Uint8Array | null;
	recordId: string | null;
	imported: boolean;
	importProblem: 'unparseable' | 'storage' | null;
};
export interface TradeJournalStore {
	list(): Promise<TradeEntry[]>;
	put(entry: TradeEntry): Promise<void>;
}

/** This database is deliberately outside Saves, export and synchronization. */
export function browserTradeJournal(): TradeJournalStore {
	async function run<T>(
		mode: IDBTransactionMode,
		action: (store: IDBObjectStore) => IDBRequest<T>
	) {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('pksx-trade-journal', 1);
			request.onupgradeneeded = () =>
				request.result.createObjectStore('sessions', { keyPath: 'id' });
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<T>((resolve, reject) => {
				const transaction = db.transaction('sessions', mode);
				const request = action(transaction.objectStore('sessions'));
				transaction.oncomplete = () => resolve(request.result);
				transaction.onabort = transaction.onerror = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	}
	return {
		list: () => run<TradeEntry[]>('readonly', (store) => store.getAll()),
		put: async (entry) => {
			await run('readwrite', (store) => store.put(entry));
		}
	};
}

export class TradeJournal {
	constructor(
		readonly store: TradeJournalStore,
		private readonly engine: Pick<
			EngineApi,
			'readLinkTradePartnerPokemon' | 'createPreservationPayload'
		>,
		private readonly storage: PokemonStorageService,
		private readonly lock: <T>(action: () => Promise<T>) => Promise<T> = (action) =>
			navigator.locks.request('pksx-trade-journal', action)
	) {}

	list() {
		return this.store.list();
	}
	async required(id: string) {
		const entry = (await this.list()).find((item) => item.id === id);
		if (!entry) throw new Error('Trade recovery is unavailable.');
		return entry;
	}

	async prepare(review: ReviewedLinkTrade, recheck: () => Promise<ReviewedLinkTrade | null>) {
		return this.lock(async () => {
			const current = await recheck();
			if (
				!current ||
				current.game !== review.game ||
				current.sourceSha256 !== review.sourceSha256 ||
				current.outgoingSha256 !== review.outgoingSha256 ||
				!equalBytes(current.outgoingBytes, review.outgoingBytes)
			)
				throw new Error('This Pokemon changed. Review it again before trading.');
			const parsed = await this.engine.readLinkTradePartnerPokemon(
				review.outgoingBytes,
				review.game
			);
			if (!parsed.ok || !parsed.value.identity)
				throw new Error('PKSX could not check the outgoing Pokemon.');
			const entry: TradeEntry = {
				version: 1,
				id: crypto.randomUUID(),
				review: structuredClone(review),
				createdAt: new Date().toISOString(),
				dispatched: false,
				events: [],
				outcome: null,
				error: null,
				receipt: null,
				outgoingIdentity: parsed.value.identity,
				sourcePayload: review.source.recordId
					? await this.storage.readPayload(review.source.recordId)
					: null,
				partnerDigest: null,
				legality: null,
				returningSession: null,
				choice: null,
				payload: null,
				recordId: null,
				imported: false,
				importProblem: null
			};
			await this.store.put(entry);
			return entry;
		});
	}

	async dispatch(id: string, start: (entry: TradeEntry) => Promise<void>) {
		const entry = await this.lock(async () => {
			const entry = await this.required(id);
			if (entry.dispatched) throw new Error('This trade was already started. Check its outcome.');
			entry.dispatched = true;
			await this.store.put(entry);
			return entry;
		});
		await start(entry);
	}

	async event(event: TradeWorkerEvent) {
		if (!('sessionId' in event)) return;
		return this.lock(async () => {
			const entry = await this.required(event.sessionId);
			if (entry.outcome || event.sequence <= (entry.events.at(-1)?.sequence ?? -1)) return entry;
			entry.events.push(structuredClone(event));
			if (event.type === 'session-ended') {
				entry.outcome = event.outcome;
				entry.error = event.error;
				entry.receipt = event.receipt;
			}
			await this.store.put(entry);
			return entry;
		});
	}

	async recover() {
		return this.lock(async () => {
			for (const entry of await this.list()) {
				if (entry.dispatched && !entry.outcome) {
					entry.outcome = 'outcome-unknown';
					await this.store.put(entry);
				}
			}
			return this.list();
		});
	}

	async retryImport(id: string, choice?: 'separate' | 'link') {
		return this.lock(async () => {
			const entry = await this.required(id);
			if (entry.outcome !== 'completed' || !entry.receipt || entry.imported) return entry;
			try {
				await this.storage.load();
				if (!this.storage.current) await this.storage.initialize();
				if (!entry.payload) {
					const parsed = await this.engine.readLinkTradePartnerPokemon(
						new Uint8Array(entry.receipt.receivedPokemon),
						entry.review.game
					);
					if (!parsed.ok) throw parsed.error;
					entry.partnerDigest = parsed.value.partnerSha256;
					entry.legality = parsed.value.legality;
					if (!parsed.value.parsed || !parsed.value.entityBytes) {
						entry.importProblem = 'unparseable';
						await this.store.put(entry);
						return entry;
					}
					const match = (await this.list()).find(
						(previous) =>
							previous.id !== id &&
							previous.dispatched &&
							previous.review.source.recordId &&
							previous.sourcePayload &&
							sameIdentity(previous.outgoingIdentity, parsed.value.identity)
					);
					entry.returningSession = match?.id ?? null;
					entry.choice = entry.choice ?? choice ?? (match ? null : 'separate');
					await this.store.put(entry);
					if (!entry.choice) return entry;
					if (entry.choice === 'link' && match) {
						entry.recordId = match.review.source.recordId!;
						entry.payload = match.sourcePayload;
					} else {
						const payload = await this.engine.createPreservationPayload(parsed.value.entityBytes);
						if (!payload.ok) throw payload.error;
						entry.payload = payload.value.bytes;
						entry.recordId = payload.value.summary.recordId;
					}
					await this.store.put(entry);
				}
				if (!entry.payload || !entry.recordId) throw new Error('Trade import is not ready.');
				const record = this.storage.getRecord(entry.recordId);
				if (entry.choice === 'link') {
					if (!record) throw new Error('Source record is unavailable.');
					const current = await this.storage.readPayload(entry.recordId);
					if (!equalBytes(current, entry.payload))
						throw new Error('Source record changed. Keep it and import separately.');
				} else if (
					!record &&
					!this.storage.listTombstones().some((item) => item.recordId === entry.recordId)
				) {
					await this.storage.importPayload(entry.payload, {
						entryMode: 'imported',
						originGame: entry.review.game,
						originSaveFileId: null,
						originSaveFileName: null,
						originalTrainer: null,
						trainerId: null,
						enteredAt: entry.createdAt
					});
				}
				entry.imported = true;
				entry.importProblem = null;
				await this.store.put(entry);
			} catch {
				entry.importProblem = 'storage';
				await this.store.put(entry);
			}
			return entry;
		});
	}
}

function equalBytes(a: Uint8Array, b: Uint8Array) {
	return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
function sameIdentity(a: LinkTradeIdentity | null, b: LinkTradeIdentity | null) {
	return !!a && !!b && a.pid === b.pid && a.ec === b.ec && a.tid === b.tid && a.sid === b.sid;
}
