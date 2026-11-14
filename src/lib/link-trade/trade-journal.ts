import type { EngineApi, LinkTradeIdentity } from '$lib/engine/types';
import { z } from 'zod/v4';
import { legalityReportSchema, saveSlotRefSchema } from '$lib/engine/worker-protocol';
import type { PokemonStorageService } from '$lib/pksx/pokemon-storage-catalog/service';
import {
	tradeWorkerEventSchema,
	tradeSessionIdSchema,
	linkTradeGameSchema,
	tradeOutcomeSchema,
	tradeErrorSchema,
	tradeReceiptSchema,
	type TradeWorkerEvent
} from './contract';
import type { ReviewedLinkTrade } from './trade-setup';

const identitySchema = z.object({
	pid: z.number().int(),
	ec: z.number().int(),
	tid: z.number().int(),
	sid: z.number().int()
});
const uint8Schema = z.instanceof(Uint8Array);
const sessionEventSchema = z.union(
	tradeWorkerEventSchema.options.filter((schema) => 'sessionId' in schema.shape)
);
export const tradeEntrySchema = z.object({
	version: z.literal(1),
	id: tradeSessionIdSchema,
	review: z.object({
		game: linkTradeGameSchema,
		source: z.object({
			owner: z.enum(['save-file', 'pokemon-storage']),
			collectionId: z.string().nullable(),
			recordId: z.string().optional(),
			slot: saveSlotRefSchema
		}),
		sourceSha256: z.string(),
		outgoingSha256: z.string(),
		outgoingBytes: uint8Schema
	}),
	createdAt: z.string(),
	dispatched: z.boolean(),
	events: z.array(sessionEventSchema),
	outcome: tradeOutcomeSchema.nullable(),
	error: tradeErrorSchema.nullable(),
	receipt: tradeReceiptSchema.nullable(),
	outgoingIdentity: identitySchema.nullable(),
	sourcePayload: uint8Schema.nullable(),
	partnerDigest: z.string().nullable(),
	legality: legalityReportSchema.nullable(),
	returningSession: z.string().nullable(),
	choice: z.enum(['separate', 'link']).nullable(),
	payload: uint8Schema.nullable(),
	recordId: z.string().nullable(),
	imported: z.boolean(),
	importProblem: z.enum(['unparseable', 'storage']).nullable()
});
export type TradeEntry = z.infer<typeof tradeEntrySchema>;
export interface TradeJournalStore {
	list(): Promise<TradeEntry[]>;
	put(entry: TradeEntry): Promise<void>;
}

/** This database is deliberately outside Saves, export and synchronization. */
export function browserTradeJournal(database = 'pksx-trade-journal'): TradeJournalStore {
	async function run<T>(
		mode: IDBTransactionMode,
		action: (store: IDBObjectStore) => IDBRequest<T>
	) {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(database, 1);
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
		list: async () =>
			z.array(tradeEntrySchema).parse(await run('readonly', (store) => store.getAll())),
		put: async (entry) => {
			await run('readwrite', (store) => store.put(entry));
		}
	};
}

export class TradeJournal {
	readonly #leases = new Map<string, () => void>();
	close() {
		for (const release of this.#leases.values()) release();
		this.#leases.clear();
	}

	constructor(
		readonly store: TradeJournalStore,
		private readonly engine: Pick<
			EngineApi,
			| 'readLinkTradePartnerPokemon'
			| 'createPreservationPayload'
			| 'readPreservationPayload'
			| 'projectPreservationPayload'
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
				review: { ...structuredClone(review), outgoingBytes: new Uint8Array(review.outgoingBytes) },
				createdAt: new Date().toISOString(),
				dispatched: false,
				events: [],
				outcome: null,
				error: null,
				receipt: null,
				outgoingIdentity: parsed.value.identity,
				sourcePayload: review.source.recordId
					? new Uint8Array(await this.storage.readPayload(review.source.recordId))
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
		if (this.#leases.has(id)) throw new Error('This trade was already started.');
		await new Promise<void>((resolve, reject) => {
			void navigator.locks
				.request(`pksx-trade-session-${id}`, { ifAvailable: true }, async (lock) => {
					if (!lock) {
						reject(new Error('This trade is active in another window.'));
						return;
					}
					await new Promise<void>((release) => {
						this.#leases.set(id, release);
						resolve();
					});
				})
				.catch(reject);
		});
		try {
			const entry = await this.lock(async () => {
				const entry = await this.required(id);
				if (entry.dispatched) throw new Error('This trade was already started. Check its outcome.');
				entry.dispatched = true;
				await this.store.put(entry);
				return entry;
			});
			await start(entry);
		} catch (error) {
			this.#leases.get(id)?.();
			this.#leases.delete(id);
			throw error;
		}
	}

	async event(event: TradeWorkerEvent) {
		if (!('sessionId' in event)) return;
		return this.lock(async () => {
			const entry = await this.required(event.sessionId);
			if (
				entry.outcome ||
				event.sequence <= (entry.events.filter((item) => 'sequence' in item).at(-1)?.sequence ?? -1)
			)
				return entry;
			entry.events.push(structuredClone(event));
			if (event.type === 'session-ended') {
				entry.outcome = event.outcome;
				entry.error = event.error;
				entry.receipt = event.receipt;
			}
			await this.store.put(entry);
			if (entry.outcome) {
				this.#leases.get(entry.id)?.();
				this.#leases.delete(entry.id);
			}
			return entry;
		});
	}

	async readOffer(id: string) {
		const entry = await this.required(id);
		const offer = entry.events.findLast((event) => event.type === 'trade-offer');
		if (offer?.type !== 'trade-offer') return null;
		const result = await this.engine.readLinkTradePartnerPokemon(
			new Uint8Array(offer.pokemon),
			entry.review.game
		);
		return result.ok ? result.value : null;
	}

	async recover() {
		return this.lock(async () => {
			const locks = await navigator.locks.query();
			const active = new Set(locks.held?.map((lock) => lock.name));
			for (const entry of await this.list()) {
				if (active.has(`pksx-trade-session-${entry.id}`)) continue;
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
				if (choice === 'separate' && entry.choice === 'link') {
					entry.payload = null;
					entry.recordId = null;
					entry.choice = 'separate';
					await this.store.put(entry);
				}
				const linkedRecordId = entry.choice === 'link' ? entry.recordId : null;
				if (entry.choice === 'link' && entry.payload && entry.recordId) {
					const previous = entry.returningSession
						? await this.required(entry.returningSession)
						: null;
					const current = this.storage.getRecord(entry.recordId)
						? await this.storage.readPayload(entry.recordId)
						: null;
					if (
						!current ||
						(!equalBytes(current, entry.payload) &&
							(!previous?.sourcePayload || !equalBytes(current, previous.sourcePayload)))
					) {
						entry.payload = null;
						await this.store.put(entry);
					}
				}
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
					const matches = (await this.list()).filter(
						(previous) =>
							previous.id !== id &&
							previous.dispatched &&
							previous.review.source.recordId &&
							previous.sourcePayload &&
							sameIdentity(previous.outgoingIdentity, parsed.value.identity)
					);
					const eligible: TradeEntry[] = [];
					for (const candidate of matches) {
						const recordId = candidate.review.source.recordId!;
						if (
							(linkedRecordId && recordId !== linkedRecordId) ||
							!this.storage.getRecord(recordId)
						)
							continue;
						if (equalBytes(await this.storage.readPayload(recordId), candidate.sourcePayload!))
							eligible.push(candidate);
					}
					const recordIds = new Set(eligible.map((candidate) => candidate.review.source.recordId));
					const match = recordIds.size === 1 ? eligible[0] : null;
					entry.returningSession = match?.id ?? matches[0]?.id ?? null;
					entry.choice = entry.choice ?? choice ?? (matches.length ? null : 'separate');
					await this.store.put(entry);
					if (!entry.choice) return entry;
					if (entry.choice === 'link') {
						if (!match)
							throw new Error(
								'The original source is changed, unavailable or ambiguous. Import separately.'
							);
						entry.recordId = match.review.source.recordId!;
						const original = await this.engine.readPreservationPayload(match.sourcePayload!);
						if (!original.ok) throw original.error;
						const restored = await this.engine.projectPreservationPayload(
							match.sourcePayload!,
							original.value.summary.originalFormat
						);
						if (!restored.ok) throw restored.error;
						entry.payload = new Uint8Array(restored.value.bytes);
					} else {
						const payload = await this.engine.createPreservationPayload(parsed.value.entityBytes);
						if (!payload.ok) throw payload.error;
						entry.payload = new Uint8Array(payload.value.bytes);
						entry.recordId = payload.value.summary.recordId;
					}
					await this.store.put(entry);
				}
				if (!entry.payload || !entry.recordId) throw new Error('Trade import is not ready.');
				const record = this.storage.getRecord(entry.recordId);
				if (entry.choice === 'link') {
					if (!record) throw new Error('Source record is unavailable.');
					const current = await this.storage.readPayload(entry.recordId);
					if (!equalBytes(current, entry.payload)) {
						const previous = entry.returningSession
							? await this.required(entry.returningSession)
							: null;
						if (!previous?.sourcePayload || !equalBytes(current, previous.sourcePayload))
							throw new Error('Source record changed. Keep it and import separately.');
						await this.storage.replace(entry.recordId, entry.payload, record.payload.id);
					}
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
