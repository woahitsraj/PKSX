import { afterEach, expect, test } from 'vitest';
import { createPkhexEngine, type EngineApi } from '$lib/engine';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import {
	BrowserCatalogPersistence,
	PokemonStorageService
} from '$lib/pksx/pokemon-storage-catalog';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import type { SavesStorage } from '$lib/pksx/saves';
import fixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import { preserveAndClearSaveSlot, SaveDeletionPendingError } from './save-deletion';

const names: string[] = [];
afterEach(async () => {
	for (const name of names.splice(0)) await deleteIndexedDbSaves(name);
});

async function setup() {
	const name = `save-deletion-${crypto.randomUUID()}`;
	names.push(name);
	const engine = await createPkhexEngine('/pkhex-engine');
	const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
	const parsed = await engine.loadSaveWorkspace(bytes, 'emerald.sav', 0);
	if (!parsed.ok) throw parsed.error;
	const source = parsed.value.partySlots.find((slot) => !slot.isEmpty && slot.entityBytesBase64);
	if (!source) throw new Error('Fixture has no occupied Party Slot.');
	const storage = new IndexedDbSavesStorage({ databaseName: name });
	const file = await storage.importSave({ bytes, originalFileName: 'emerald.sav' });
	const catalog = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
	await catalog.initialize();
	return {
		name,
		engine,
		storage,
		catalog,
		source: { zone: 'party' as const, slot: source.slot },
		state: createCleanWorkspaceState({ file, bytes, workspace: parsed.value })
	};
}

async function reopen(input: Awaited<ReturnType<typeof setup>>) {
	const storage = new IndexedDbSavesStorage({ databaseName: input.name });
	const catalog = new PokemonStorageService(
		new BrowserCatalogPersistence(input.name),
		input.engine
	);
	await catalog.load();
	return { storage, catalog };
}

test('preserves a Save Slot deletion and restores it to Unfiled', async () => {
	const input = await setup();
	const next = await preserveAndClearSaveSlot({ ...input, activeBox: 0 });
	expect(next.workspace.summary.partyCount).toBe(input.state.workspace.summary.partyCount - 1);
	const { storage, catalog } = await reopen(input);
	const tombstone = catalog.listRecentlyDeleted()[0];
	expect(tombstone?.recovery?.origin).toMatchObject({
		entryMode: 'deleted-from-save',
		originSaveFileId: input.state.file.id,
		originSaveSlot: input.source,
		originGame: input.state.workspace.summary.gameVersion,
		trainerId: String(input.state.workspace.summary.trainerId)
	});
	expect(await storage.getWorkspace(input.state.file.id)).toMatchObject({
		dirty: true,
		automaticBackupCreated: true
	});
	expect(await storage.listBackups(input.state.file.id)).toHaveLength(1);
	const restored = await catalog.restore(tombstone.recordId);
	expect(restored.placement).toBeNull();
	expect((await reopen(input)).catalog.getRecord(restored.recordId)?.placement).toBeNull();
});

test.each([false, true])(
	'reconciles an ambiguous native-style commit, unreadable=%s',
	async (unreadable) => {
		const input = await setup();
		let committed = false;
		const storage = new Proxy(input.storage, {
			get(target, property) {
				if (property === 'commitPreservedSaveDeletion')
					return async (
						value: Parameters<NonNullable<SavesStorage['commitPreservedSaveDeletion']>>[0]
					) => {
						await target.commitPreservedSaveDeletion(value);
						committed = true;
						throw new Error('journal acknowledgement unavailable');
					};
				if (property === 'getWorkspace' && committed && unreadable)
					return async () => {
						throw new Error('journal read unavailable');
					};
				const member = Reflect.get(target, property);
				return typeof member === 'function' ? member.bind(target) : member;
			}
		}) as SavesStorage;
		const operation = preserveAndClearSaveSlot({ ...input, storage, activeBox: 0 });
		if (unreadable) await expect(operation).rejects.toBeInstanceOf(SaveDeletionPendingError);
		else await expect(operation).resolves.toMatchObject({ dirty: true });
		const reopened = await reopen(input);
		expect(reopened.catalog.listRecentlyDeleted()).toHaveLength(1);
		expect(await reopened.storage.listBackups(input.state.file.id)).toHaveLength(1);
		expect(await reopened.storage.getWorkspace(input.state.file.id)).toMatchObject({ dirty: true });
	}
);

test.each(['payload', 'engine', 'backupBytes', 'workspaces', 'blobs', 'manifest', 'finalCommit'])(
	'failed %s stage leaves the occupied Save Slot and no visible partial state',
	async (stage) => {
		const input = await setup();
		const originalPut = IDBObjectStore.prototype.put;
		const failingEngine = new Proxy(input.engine, {
			get(target, property) {
				if (stage === 'payload' && property === 'createPreservationPayload')
					return async () => {
						throw new Error('injected payload failure');
					};
				if (stage === 'engine' && property === 'applySlotOperation')
					return async () => {
						throw new Error('injected engine failure');
					};
				const value = Reflect.get(target, property);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		}) as EngineApi;
		if (!['payload', 'engine'].includes(stage)) {
			IDBObjectStore.prototype.put = function (...args) {
				if (this.name === stage) throw new Error(`injected ${stage} failure`);
				const request = originalPut.apply(this, args);
				if (stage === 'finalCommit' && this.name === 'manifest') this.transaction.abort();
				return request;
			};
		}
		try {
			const catalog = new PokemonStorageService(
				new BrowserCatalogPersistence(input.name),
				failingEngine
			);
			await catalog.load();
			await expect(
				preserveAndClearSaveSlot({ ...input, engine: failingEngine, catalog, activeBox: 0 })
			).rejects.toThrow();
		} finally {
			IDBObjectStore.prototype.put = originalPut;
		}
		const { storage, catalog } = await reopen(input);
		expect(await storage.getWorkspace(input.state.file.id)).toBeNull();
		expect(await storage.listBackups(input.state.file.id)).toHaveLength(0);
		expect(catalog.listRecentlyDeleted()).toHaveLength(0);
		const bytes = await storage.getSaveBytes(input.state.file.id);
		const parsed = await input.engine.loadSaveWorkspace(bytes!, 'emerald.sav', 0);
		if (!parsed.ok) throw parsed.error;
		expect(parsed.value.partySlots.find((slot) => slot.slot === input.source.slot)?.isEmpty).toBe(
			false
		);
	}
);
