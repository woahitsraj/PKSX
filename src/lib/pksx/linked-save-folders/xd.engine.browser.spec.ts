import { expect, it } from 'vitest';
import { createPkhexWorkerEngine } from '$lib/engine';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import { importLinkedSave, scanFolder, type DiscoveredSave, type SaveFoldersPlugin } from './index';
import xdUrl from '../../../../test-fixtures/save-files/libpkmn-test-files/pokemon-xd.gci?url';

it('discovers and explicitly imports real XD bytes without duplicating linked documents', async () => {
	const bytes = new Uint8Array(await (await fetch(xdUrl)).arrayBuffer());
	let base64 = '';
	for (const byte of bytes) base64 += String.fromCharCode(byte);
	const databaseName = `linked-xd-${crypto.randomUUID()}`;
	const storage = new IndexedDbSavesStorage({ databaseName });
	const engine = createPkhexWorkerEngine();
	const folder = { tree: 'dolphin', name: 'Dolphin' };
	const plugin: SaveFoldersPlugin = {
		status: async () => ({ folders: [folder] }),
		pick: async () => ({ cancelled: false, folder }),
		unlink: async () => {},
		cancel: async () => {},
		list: async () => ({
			entries: [{ id: 'GC/USA/xd.gci', name: 'xd.gci', directory: false, size: bytes.length }],
			truncated: false
		}),
		read: async ({ documentId }) => ({
			base64: btoa(base64),
			identity: JSON.stringify(['dolphin.user', documentId])
		})
	};
	try {
		const saves: DiscoveredSave[] = [];
		await scanFolder({
			plugin,
			engine,
			storage,
			folder,
			signal: new AbortController().signal,
			onSave: (save) => {
				saves.push(save);
			},
			onProgress: () => {}
		});
		expect(saves).toHaveLength(1);
		expect(await storage.listSaves()).toHaveLength(0);
		const [first, second] = await Promise.all([
			importLinkedSave(plugin, engine, storage, saves[0]),
			importLinkedSave(plugin, engine, storage, saves[0])
		]);
		expect(first.id).toBe(second.id);
		expect(await storage.listSaves()).toHaveLength(1);
		expect(await storage.getSaveBytes(first.id)).toEqual(bytes);
		const rescanned: DiscoveredSave[] = [];
		await scanFolder({
			plugin,
			engine,
			storage,
			folder,
			signal: new AbortController().signal,
			onSave: (save) => {
				rescanned.push(save);
			},
			onProgress: () => {}
		});
		expect(rescanned[0].imported).toBe(true);
	} finally {
		await deleteIndexedDbSaves(databaseName);
	}
}, 60000);
