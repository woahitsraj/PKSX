import { describe, expect, it, vi } from 'vitest';
import type { EngineApi } from '$lib/engine';
import { createMockEngine } from '$lib/engine/mock-engine';
import { scanFolder, importLinkedSave, type SaveFoldersPlugin, type DiscoveredSave } from './index';
import { CapacitorSavesStorage, type NativeFileStore } from '$lib/pksx/saves';

function storageFixture() {
	const files = new Map<string, string | Uint8Array>();
	const fileStore: NativeFileStore = {
		readText: async (path) => {
			const value = files.get(path);
			return typeof value === 'string' ? value : null;
		},
		readBytes: async (path) => {
			const value = files.get(path);
			return value instanceof Uint8Array ? value : null;
		},
		writeText: async (path, value) => {
			files.set(path, value);
		},
		writeBytes: async (path, value) => {
			files.set(path, value);
		},
		delete: async (path) => {
			files.delete(path);
		},
		list: async () => []
	};
	return { fileStore, storage: new CapacitorSavesStorage({ fileStore }) };
}

function pluginFixture(): SaveFoldersPlugin {
	return {
		status: async () => ({ tree: 'test', mode: 'dolphin' }),
		pick: async () => ({ tree: 'test', mode: 'dolphin' }),
		unlink: async () => {},
		cancel: async () => {},
		list: vi.fn(async ({ documentId }) => ({
			entries: documentId
				? [
						{ id: 'xd', name: 'same.gci', directory: false, size: 4 },
						{ id: 'invalid', name: 'bad.gci', directory: false, size: 4 },
						{ id: 'raw', name: 'card.raw', directory: false, size: 4 }
					]
				: [
						{ id: 'GC', name: 'GC', directory: true, size: 0 },
						{ id: 'Cache', name: 'Cache', directory: true, size: 0 }
					],
			truncated: false
		})),
		read: vi.fn(async ({ documentId }) => ({ base64: 'AQIDBA==', identity: documentId }))
	};
}

describe('linked save folders', () => {
	it('prunes Dolphin caches, validates GCI files, and retains usable partial results on cancellation', async () => {
		const plugin = pluginFixture();
		const engine = createMockEngine();
		const { storage } = storageFixture();
		const controller = new AbortController();
		const saves: DiscoveredSave[] = [];
		await expect(
			scanFolder({
				plugin,
				engine,
				storage,
				mode: 'dolphin',
				signal: controller.signal,
				onSave: (save) => {
					saves.push(save);
					controller.abort();
				},
				onProgress: () => {}
			})
		).rejects.toThrow();
		expect(saves.map((save) => save.path)).toEqual(['GC/same.gci']);
		expect(plugin.list).toHaveBeenCalledTimes(2);
		expect(plugin.read).toHaveBeenCalledTimes(1);
		expect(await storage.listSaves()).toEqual([]);
	});

	it('cancels without waiting for an engine validation already in flight', async () => {
		const plugin = pluginFixture();
		const engine = createMockEngine();
		const { storage } = storageFixture();
		const controller = new AbortController();
		engine.loadSaveWorkspace = () => {
			queueMicrotask(() => controller.abort());
			return new Promise(() => {});
		};
		const onSave = vi.fn();
		await expect(
			scanFolder({
				plugin,
				engine,
				storage,
				mode: 'dolphin',
				signal: controller.signal,
				onSave,
				onProgress: () => {}
			})
		).rejects.toThrow();
		expect(onSave).not.toHaveBeenCalled();
	});

	it('retains source identity across restart, serializes repeated imports, and preserves same-named distinct documents', async () => {
		const plugin = pluginFixture();
		const engine = createMockEngine();
		const { storage, fileStore } = storageFixture();
		const save = { id: 'xd', name: 'same.gci', path: 'GC/same.gci', imported: false };
		const [first, repeated] = await Promise.all([
			importLinkedSave(plugin, engine, storage, save),
			importLinkedSave(plugin, engine, storage, save)
		]);
		expect(repeated.id).toBe(first.id);
		const restarted = new CapacitorSavesStorage({ fileStore });
		const distinct = await importLinkedSave(plugin, engine, restarted, { ...save, id: 'other-xd' });
		expect(distinct.id).not.toBe(first.id);
		expect(await restarted.listSaves()).toHaveLength(2);
		expect((await restarted.getSave(first.id))?.linkedDocumentId).toBe('xd');
		await expect(restarted.getSaveBytes(first.id)).resolves.toEqual(new Uint8Array([1, 2, 3, 4]));
	});

	it('rejects invalid candidates and imports, accepts generic save names, and reports scan bounds', async () => {
		const plugin = pluginFixture();
		plugin.list = async () => ({
			entries: [{ id: 'main', name: 'main', directory: false, size: 4 }],
			truncated: true
		});
		const engine = createMockEngine();
		engine.loadSaveWorkspace = vi.fn<EngineApi['loadSaveWorkspace']>(async () => ({
			ok: false,
			value: null,
			error: { code: 'unsupported-save', message: 'Invalid save' }
		}));
		const { storage } = storageFixture();
		const onSave = vi.fn();
		const onProgress = vi.fn();
		await scanFolder({
			plugin,
			engine,
			storage,
			mode: 'generic',
			signal: new AbortController().signal,
			onSave,
			onProgress
		});
		expect(engine.loadSaveWorkspace).toHaveBeenCalledOnce();
		expect(onSave).not.toHaveBeenCalled();
		expect(onProgress).toHaveBeenLastCalledWith(expect.stringContaining('Scan limit reached'));
		await expect(
			importLinkedSave(plugin, engine, storage, {
				id: 'main',
				name: 'main',
				path: 'main',
				imported: false
			})
		).rejects.toThrow('Invalid save');
		expect(await storage.listSaves()).toEqual([]);
	});
});
