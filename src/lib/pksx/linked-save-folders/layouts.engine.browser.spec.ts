import { expect, it } from 'vitest';
import { createPkhexWorkerEngine } from '$lib/engine';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import { scanFolder, type SaveFoldersPlugin } from './index';
import emerald from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import soulsilver from '../../../../test-fixtures/save-files/minna-pokemon-saves/pokemon-soulsilver.sav?url';
import red from '../../../../test-fixtures/save-files/pkmds-blazor/pokemon-red.sav?url';
import x from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav?url';

it('validates battery save bytes through the worker engine in each emulator directory layout', async () => {
	const engine = createPkhexWorkerEngine();
	const databaseName = `emulator-layouts-${crypto.randomUUID()}`;
	const storage = new IndexedDbSavesStorage({ databaseName });
	const cases = [
		['RetroArch', 'saves/mGBA/Pokemon.srm', emerald],
		['melonDS', 'roms/Pokemon.sav', soulsilver],
		['DraStic', 'backup/Pokemon.dsv', soulsilver],
		['Pizza Boy A', 'saves/Pokemon.sav', red],
		['Azahar', 'sdmc/Nintendo 3DS/id0/id1/title/00040000/00055e00/data/00000001/main', x]
	];
	try {
		for (const [name, path, url] of cases) {
			const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
			let binary = '';
			for (const byte of bytes) binary += String.fromCharCode(byte);
			const folder = { tree: 'content://test/tree/' + encodeURIComponent(name), name };
			const segments = path.split('/');
			const plugin: SaveFoldersPlugin = {
				status: async () => ({ folders: [folder] }),
				pick: async () => ({ cancelled: false, folder }),
				unlink: async () => {},
				cancel: async () => {},
				list: async ({ documentId }) => {
					const depth = documentId ? documentId.split('/').length : 0;
					return {
						entries: [
							{
								id: segments.slice(0, depth + 1).join('/'),
								name: segments[depth],
								directory: depth < segments.length - 1,
								size: depth < segments.length - 1 ? 0 : bytes.length
							}
						],
						truncated: false
					};
				},
				read: async ({ documentId }) => ({
					identity: folder.tree + '/' + documentId,
					base64: btoa(binary)
				})
			};
			let found = 0;
			await scanFolder({
				plugin,
				folder,
				engine,
				storage,
				signal: new AbortController().signal,
				onSave: async (save, recognized) => {
					found++;
					await storage.importSave({
						bytes: recognized,
						originalFileName: save.name,
						linkedDocumentId: save.identity,
						activate: false
					});
				},
				onProgress: () => {}
			});
			expect(found, name).toBe(1);
		}
		expect(await storage.listSaves()).toHaveLength(5);
		expect(await storage.getActiveSaveFileId()).toBeNull();
	} finally {
		await deleteIndexedDbSaves(databaseName);
	}
}, 60000);
