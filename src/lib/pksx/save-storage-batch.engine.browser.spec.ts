import { afterEach, expect, test } from 'vitest';
import { createPkhexEngine } from '$lib/engine';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import {
	BrowserCatalogPersistence,
	PokemonStorageService
} from '$lib/pksx/pokemon-storage-catalog';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import fixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import { applySaveStorageBatch, previewSaveStorageBatch } from './save-storage-batch';

const names: string[] = [];
afterEach(async () => {
	for (const name of names.splice(0)) await deleteIndexedDbSaves(name);
});
async function setup() {
	const name = `batch-${crypto.randomUUID()}`;
	names.push(name);
	const engine = await createPkhexEngine('/pkhex-engine');
	const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
	const loaded = await engine.loadSaveWorkspace(bytes, 'emerald.sav', 0);
	if (!loaded.ok) throw loaded.error;
	const source = loaded.value.boxSlots.find((slot) => !slot.isEmpty);
	if (!source) throw new Error('Fixture needs an occupied Box Slot.');
	const second = await engine.loadSaveWorkspace(bytes, 'emerald.sav', 1);
	if (!second.ok) throw second.error;
	const empty = second.value.boxSlots.find((slot) => slot.isEmpty);
	if (!empty) throw new Error('Fixture needs an empty Slot in Box 2.');
	const copied = await engine.applySlotOperation(
		bytes,
		'emerald.sav',
		{
			kind: 'copy',
			source: { zone: 'box', box: 0, slot: source.slot },
			destination: { zone: 'box', box: 1, slot: empty.slot }
		},
		1
	);
	if (!copied.ok) throw copied.error;
	const storage = new IndexedDbSavesStorage({ databaseName: name });
	const file = await storage.importSave({
		bytes: copied.value.bytes,
		originalFileName: 'emerald.sav'
	});
	const catalog = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
	await catalog.initialize();
	return {
		engine,
		storage,
		catalog,
		state: createCleanWorkspaceState({
			file,
			bytes: copied.value.bytes,
			workspace: copied.value.workspace
		}),
		sources: [
			{ box: 0, slot: source.slot },
			{ box: 1, slot: empty.slot }
		],
		startingBoxId: catalog.listBoxes()[0].id
	};
}

test.each(['copy', 'move'] as const)(
	'commits a cross-box %s atomically and preserves payloads',
	async (mode) => {
		const input = await setup();
		const batch = await previewSaveStorageBatch({ ...input, mode });
		expect(input.catalog.listRecords()).toHaveLength(0);
		expect(await input.storage.getWorkspace(input.state.file.id)).toBeNull();
		const next = await applySaveStorageBatch(batch, input.storage, input.catalog);
		expect(input.catalog.listRecords()).toHaveLength(2);
		expect(new Set(input.catalog.listRecords().map((record) => record.recordId)).size).toBe(2);
		for (const source of input.sources) {
			const loaded = await input.engine.loadSaveWorkspace(next.bytes, 'emerald.sav', source.box);
			if (!loaded.ok) throw loaded.error;
			expect(loaded.value.boxSlots.find((slot) => slot.slot === source.slot)?.isEmpty).toBe(
				mode === 'move'
			);
		}
		for (const record of input.catalog.listRecords()) {
			const payload = await input.engine.readPreservationPayload(
				await input.catalog.readPayload(record.recordId)
			);
			expect(payload.ok).toBe(true);
			expect(record.origin.entryMode).toBe(mode === 'move' ? 'moved-in' : 'copied-in');
		}
		expect(await input.storage.listBackups(input.state.file.id)).toHaveLength(
			mode === 'move' ? 1 : 0
		);
		if (mode === 'copy') expect(await input.storage.getWorkspace(input.state.file.id)).toBeNull();
	}
);

test('rejects changed sources and destinations without partial writes', async () => {
	const input = await setup();
	const batch = await previewSaveStorageBatch({ ...input, mode: 'move' });
	await input.catalog.addBox();
	await expect(applySaveStorageBatch(batch, input.storage, input.catalog)).rejects.toThrow();
	expect(input.catalog.listRecords()).toHaveLength(0);
	expect(await input.storage.getWorkspace(input.state.file.id)).toBeNull();
	expect(await input.storage.listBackups(input.state.file.id)).toHaveLength(0);
	expect(() => input.catalog.planBatchPlacement(100, input.startingBoxId)).toThrow(/Not enough/);
});

test('rejects an invalid staged payload before persisting any member', async () => {
	const input = await setup();
	const batch = await previewSaveStorageBatch({ ...input, mode: 'move' });
	batch.prepared.payloads[1].bytes[0] ^= 255;
	await expect(applySaveStorageBatch(batch, input.storage, input.catalog)).rejects.toThrow();
	expect(input.catalog.listRecords()).toHaveLength(0);
	expect(await input.storage.getWorkspace(input.state.file.id)).toBeNull();
	expect(await input.storage.listBackups(input.state.file.id)).toHaveLength(0);
});

test('rejects a source edit during preview and leaves the edit intact', async () => {
	const input = await setup();
	const batch = await previewSaveStorageBatch({ ...input, mode: 'move' });
	await input.storage.putWorkspace({
		saveFileId: input.state.file.id,
		bytes: new Uint8Array([1, 2]),
		dirty: true,
		automaticBackupCreated: false
	});
	await expect(applySaveStorageBatch(batch, input.storage, input.catalog)).rejects.toThrow(
		/source Save File changed/
	);
	expect(input.catalog.listRecords()).toHaveLength(0);
	expect((await input.storage.getWorkspace(input.state.file.id))?.bytes).toEqual(
		new Uint8Array([1, 2])
	);
});
