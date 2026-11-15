import { describe, expect, it, vi } from 'vitest';
import { createMockEngine } from '$lib/engine/mock-engine';
import { CapacitorSavesStorage, type NativeFileStore } from '$lib/pksx/saves';
import { SaveFileEditCoordinator } from '$lib/pksx/save-file-edit-coordinator';
import {
	LinkedSaveSources,
	sourceHash,
	type LinkedSavesPlugin,
	type SourceInspection
} from './index';

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
async function fixture() {
	const files = new Map<string, string | Uint8Array>();
	const fileStore: NativeFileStore = {
		readText: async (path) => {
			const value = files.get(path);
			return typeof value === 'string' ? value : null;
		},
		readBytes: async (path) => {
			const value = files.get(path);
			return value instanceof Uint8Array ? value.slice() : null;
		},
		writeText: async (path, value) => {
			files.set(path, value);
		},
		writeBytes: async (path, value) => {
			files.set(path, value.slice());
		},
		delete: async (path) => {
			files.delete(path);
		},
		list: async () => []
	};
	const storage = new CapacitorSavesStorage({ fileStore });
	const engine = createMockEngine();
	const file = await storage.importSave({
		bytes: new Uint8Array([1]),
		originalFileName: 'main',
		linkedDocumentId: '["provider","main"]'
	});
	const native: {
		bytes: Uint8Array;
		state: SourceInspection['source'] | undefined;
		denied: boolean;
		fail: string;
	} = { bytes: new Uint8Array([1]), state: undefined, denied: false, fail: '' };
	const plugin: LinkedSavesPlugin = {
		inspect: async ({ saveFileId, baselineHash }) => {
			if (native.denied) throw new Error('Permission removed');
			native.state ??= { saveFileId, baselineHash };
			const hash = await sourceHash(native.bytes);
			let outcome: SourceInspection['outcome'] = 'none';
			if (native.state.pending) {
				if (hash === native.state.pending.afterHash) {
					native.state.baselineHash = hash;
					delete native.state.pending;
					outcome = 'completed';
				} else if (hash === native.state.baselineHash) {
					delete native.state.pending;
					outcome = 'not-written';
				} else outcome = 'recovery-required';
			}
			return {
				source: structuredClone(native.state),
				hash,
				name: 'main',
				base64: encode(native.bytes),
				outcome
			};
		},
		accept: async ({ hash }) => {
			if (!native.state || (await sourceHash(native.bytes)) !== hash)
				throw new Error('Source changed');
			native.state.baselineHash = hash;
		},
		write: vi.fn(async ({ expectedHash, base64, backupId, recover }) => {
			if (!native.state || (await sourceHash(native.bytes)) !== expectedHash)
				throw new Error('Source changed');
			const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
			const previous = native.state.pending;
			if (recover && !previous) throw new Error('No recovery pending');
			native.state.pending = {
				beforeHash: expectedHash,
				afterHash: await sourceHash(bytes),
				backupId,
				recoveryBackupId: previous?.recoveryBackupId ?? backupId,
				recoveryHash: previous?.recoveryHash ?? expectedHash
			};
			if (native.fail === 'partial') {
				native.bytes = new Uint8Array([255]);
				throw new Error('Provider interrupted');
			}
			native.bytes = bytes;
			if (native.fail === 'after') throw new Error('App stopped before acknowledgement');
			native.state.baselineHash = await sourceHash(bytes);
			delete native.state.pending;
		})
	};
	const edits = new SaveFileEditCoordinator({ storage, engine });
	const createService = () => new LinkedSaveSources({ storage, engine, edits, plugin });
	const sources = createService();
	await sources.observe(file);
	return { storage, engine, file, native, plugin, sources, createService };
}

describe('linked source workflow', () => {
	it('skips identical Export and backs up external bytes before local-only Export', async () => {
		const { sources, storage, file, native, plugin } = await fixture();
		expect(await sources.export(file, async () => new Uint8Array([1]))).toEqual({
			name: 'main',
			written: false
		});
		expect(await storage.listBackups(file.id)).toHaveLength(0);
		await sources.export(file, async () => new Uint8Array([2]));
		const backups = await storage.listBackups(file.id);
		expect(backups.map((item) => item.reason)).toEqual(['linked-source-before-export']);
		expect(await storage.getBackupBytes(backups[0].id)).toEqual(new Uint8Array([1]));
		expect(native.bytes).toEqual(new Uint8Array([2]));
		await sources.export(file, async () => new Uint8Array([2]));
		expect(plugin.write).toHaveBeenCalledOnce();
	});

	it('blocks conflicting Export and preserves both local revisions before confirmed external refresh', async () => {
		const { sources, storage, file, native, plugin } = await fixture();
		await storage.putWorkspace({
			saveFileId: file.id,
			bytes: new Uint8Array([2]),
			dirty: true,
			automaticBackupCreated: false
		});
		native.bytes = new Uint8Array([3]);
		expect(await sources.observe(file)).toMatchObject({
			kind: 'changed',
			localChanges: true,
			valid: true
		});
		await expect(sources.export(file, async () => new Uint8Array([2]))).rejects.toThrow(
			'emulator changed'
		);
		expect(plugin.write).not.toHaveBeenCalled();
		const hash = await sourceHash(native.bytes);
		await expect(sources.loadExternal(file, hash, false)).rejects.toThrow('Confirm');
		expect(await storage.listBackups(file.id)).toHaveLength(0);
		await sources.loadExternal(file, hash, true);
		expect((await storage.getWorkspace(file.id))?.bytes).toEqual(new Uint8Array([3]));
		expect(await storage.getSaveBytes(file.id)).toEqual(new Uint8Array([1]));
		const backups = await storage.listBackups(file.id);
		expect(backups.map((item) => item.reason).sort()).toEqual([
			'linked-import-before-refresh',
			'linked-workspace-before-refresh'
		]);
		expect(await sources.observe(file)).toMatchObject({ kind: 'current' });
		await sources.observe(file);
		expect(await storage.listBackups(file.id)).toHaveLength(2);
	});

	it('refuses stale external choices and missing permissions without writing', async () => {
		const { sources, storage, file, native, plugin } = await fixture();
		native.bytes = new Uint8Array([3]);
		await expect(
			sources.loadExternal(file, await sourceHash(new Uint8Array([2])), true)
		).rejects.toThrow('changed again');
		native.denied = true;
		expect(await sources.observe(file)).toMatchObject({
			kind: 'unavailable',
			message: 'Permission removed'
		});
		await expect(sources.export(file, async () => new Uint8Array([2]))).rejects.toThrow(
			'Permission removed'
		);
		expect(plugin.write).not.toHaveBeenCalled();
		expect(await storage.listBackups(file.id)).toHaveLength(0);
	});

	it('requires a durable pre-write Backup', async () => {
		const { sources, storage, file, native, plugin } = await fixture();
		vi.spyOn(storage, 'createBackup').mockRejectedValueOnce(new Error('Disk full'));
		await expect(sources.export(file, async () => new Uint8Array([2]))).rejects.toThrow(
			'Disk full'
		);
		expect(native.bytes).toEqual(new Uint8Array([1]));
		expect(plugin.write).not.toHaveBeenCalled();
	});

	it('keeps partial external bytes and restores the original Backup after interrupted Export', async () => {
		const { sources, storage, file, native, createService } = await fixture();
		native.fail = 'partial';
		await expect(sources.export(file, async () => new Uint8Array([2]))).rejects.toThrow(
			'interrupted'
		);
		const restarted = createService();
		expect(await restarted.observe(file)).toMatchObject({ kind: 'recovery' });
		native.fail = '';
		await restarted.recover(file, await sourceHash(native.bytes));
		expect(native.bytes).toEqual(new Uint8Array([1]));
		const backups = await storage.listBackups(file.id);
		const partial = backups.find((backup) => backup.reason === 'linked-source-before-recovery');
		expect(partial && (await storage.getBackupBytes(partial.id))).toEqual(new Uint8Array([255]));
		expect(await restarted.observe(file)).toMatchObject({ kind: 'current' });
	});

	it('reconciles a completed native write on restart without another destructive write', async () => {
		const { sources, file, native, plugin, createService } = await fixture();
		native.fail = 'after';
		await expect(sources.export(file, async () => new Uint8Array([2]))).rejects.toThrow(
			'acknowledgement'
		);
		expect(await createService().observe(file)).toMatchObject({
			kind: 'current',
			outcome: 'completed'
		});
		expect(plugin.write).toHaveBeenCalledOnce();
	});
});
