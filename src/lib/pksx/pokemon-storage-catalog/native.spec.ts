import { expect, it } from 'vitest';
import type { NativeFileStore } from '$lib/pksx/saves';
import { catalogContract } from './contract-tests';
import { NativeCatalogPersistence } from './native';
import { referenceFor, type BlobReference } from './types';

const recordFor = (payload: BlobReference) => ({
	recordId: 'engine-record-id',
	payload,
	identityFingerprint: 'fingerprint',
	projection: {} as never,
	origin: {
		entryMode: 'imported' as const,
		originSaveFileId: null,
		originSaveFileName: null,
		originGame: null,
		originalTrainer: null,
		trainerId: null,
		enteredAt: 'now'
	},
	placement: null,
	revision: 0,
	createdAt: 'now',
	updatedAt: 'now'
});

function fixture() {
	const files = new Map<string, string | Uint8Array>();
	const store: NativeFileStore = {
		async readText(path) {
			const value = files.get(path);
			return typeof value === 'string' ? value : null;
		},
		async writeText(path, value) {
			files.set(path, value);
		},
		async readBytes(path) {
			const value = files.get(path);
			return value instanceof Uint8Array ? new Uint8Array(value) : null;
		},
		async writeBytes(path, value) {
			files.set(path, new Uint8Array(value));
		},
		async delete(path) {
			files.delete(path);
		},
		async list(path) {
			return [...files.keys()]
				.filter((key) => key.startsWith(`${path}/`))
				.map((key) => key.slice(path.length + 1))
				.filter((key) => !key.includes('/'));
		}
	};
	return { files, store, persistence: new NativeCatalogPersistence(store) };
}
const fixtures = new WeakMap<NativeCatalogPersistence, ReturnType<typeof fixture>>();
function create() {
	const value = fixture();
	fixtures.set(value.persistence, value);
	return value.persistence;
}
catalogContract('native', create, async (persistence, id) => {
	fixtures
		.get(persistence as NativeCatalogPersistence)!
		.files.set(`pokemon-storage-catalog/blobs/${id}.bin`, new Uint8Array([0]));
});
it('native sweep removes staged orphans but retains committed blobs', async () => {
	const { files, persistence } = fixture();
	const reference = await referenceFor(new Uint8Array([1]), 1);
	files.set(`pokemon-storage-catalog/blobs/${reference.id}.bin`, new Uint8Array([1]));
	expect(await persistence.sweep()).toBe(1);
	expect(files.size).toBe(0);
});

it('retains legacy catalog authority until the joint journal commits', async () => {
	const { files, store, persistence } = fixture();
	const payload = new Uint8Array([7]);
	const reference = await referenceFor(payload, 1);
	const original = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [recordFor(reference)],
		tombstones: []
	};
	const hash = async (text: string) =>
		[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	const text = JSON.stringify(original);
	const manifestSha256 = await hash(text);
	files.set('pokemon-storage-catalog/blobs/' + reference.id + '.bin', payload);
	files.set('pokemon-storage-catalog/manifests/0.json', text);
	files.set(
		'pokemon-storage-catalog/manifests/0.complete',
		JSON.stringify({
			revision: 0,
			manifestSha256,
			checksum: await hash(`0:${manifestSha256}`)
		})
	);
	expect(await persistence.read()).toEqual(original);
	await persistence.commit(0, { ...original, revision: 1 }, []);
	files.delete('pokemon-storage-catalog/manifests/0.complete');
	expect((await new NativeCatalogPersistence(store).read())?.records[0]?.recordId).toBe(
		'engine-record-id'
	);
	expect(await persistence.readBlob(reference)).toEqual(payload);
});

it('keeps a complete native manifest authoritative after a partial manifest write', async () => {
	const { files, store, persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	const failing = new NativeCatalogPersistence({
		...store,
		async writeText(path, value) {
			files.set(path, value.slice(0, 12));
			throw new Error('disk full');
		}
	});
	await expect(failing.commit(0, { ...first, revision: 1 }, [])).rejects.toThrow('disk full');
	expect((await persistence.read())?.revision).toBe(0);
});
it('ignores valid JSON candidates without a verified completion', async () => {
	const { files, persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	const candidatePath = 'pokemon-storage-catalog/manifests/1.json';
	files.set(candidatePath, JSON.stringify({ ...first, revision: 2 }));
	expect((await persistence.read())?.revision).toBe(0);
	const missing = await referenceFor(new Uint8Array([7]), 1);
	files.set(
		candidatePath,
		JSON.stringify({ ...first, revision: 1, records: [recordFor(missing)] })
	);
	expect((await persistence.read())?.revision).toBe(0);
	expect(await persistence.sweep()).toBe(0);
});
it('keeps the previous manifest when joint journal publication fails', async () => {
	const { files, store, persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	const payload = new Uint8Array([7]);
	const reference = await referenceFor(payload, 1);
	const failing = new NativeCatalogPersistence({
		...store,
		async writeText(path, value) {
			if (path === 'catalog.0.json') {
				files.set(path, '{');
				throw new Error('publication interrupted');
			}
			await store.writeText(path, value);
		}
	});
	await expect(
		failing.commit(0, { ...first, revision: 1, records: [recordFor(reference)] }, [
			{ reference, bytes: payload }
		])
	).rejects.toThrow('publication interrupted');
	expect((await persistence.read())?.revision).toBe(0);
	expect(await persistence.sweep()).toBe(1);
	expect(await persistence.readBlob(reference)).toBeNull();
});
it('serializes simultaneous native conditional commits', async () => {
	const { persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	const results = await Promise.allSettled([
		persistence.commit(0, { ...first, revision: 1 }, []),
		persistence.commit(0, { ...first, revision: 1 }, [])
	]);
	expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
});
it('does not mistake a native read failure for an older authoritative generation', async () => {
	const { store, persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	await persistence.commit(0, { ...first, revision: 1 }, []);
	const failing = new NativeCatalogPersistence({
		...store,
		async readText(path) {
			if (path === 'catalog.0.json') throw new Error('media unavailable');
			return store.readText(path);
		}
	});
	await expect(failing.read()).rejects.toThrow('media unavailable');
});
it('does not sweep a staged blob while its native manifest commit is in flight', async () => {
	const { files, store, persistence } = fixture();
	const first = {
		schemaVersion: 1 as const,
		storageId: 'storage-id',
		revision: 0,
		createdAt: 'now',
		updatedAt: 'now',
		boxOrder: ['box-id'],
		boxes: [{ id: 'box-id', name: null, revision: 0, createdAt: 'now', updatedAt: 'now' }],
		records: [],
		tombstones: []
	};
	await persistence.commit(null, first, []);
	const payload = new Uint8Array([7, 8]);
	const reference = await referenceFor(payload, 1);
	const manifest = {
		...first,
		revision: 1,
		records: [recordFor(reference)]
	};
	let announce!: () => void;
	let release!: () => void;
	const atManifestWrite = new Promise<void>((resolve) => {
		announce = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const writer = new NativeCatalogPersistence({
		...store,
		async writeText(path, value) {
			if (path === 'catalog.0.json') {
				announce();
				await gate;
			}
			await store.writeText(path, value);
		}
	});
	const committing = writer.commit(0, manifest, [{ reference, bytes: payload }]);
	await atManifestWrite;
	const sweeping = persistence.sweep();
	release();
	await expect(committing).resolves.toBeUndefined();
	await expect(sweeping).resolves.toBe(0);
	expect(await persistence.readBlob(reference)).toEqual(payload);
	expect((await persistence.read())?.records[0]?.recordId).toBe('engine-record-id');
	files.set(`pokemon-storage-catalog/blobs/${reference.id}.bin`, new Uint8Array([0]));
	await expect(persistence.read()).rejects.toThrow(/checksum/);
	files.set(`pokemon-storage-catalog/blobs/${reference.id}.bin`, payload);
	await persistence.commit(1, { ...manifest, revision: 2, records: [] }, []);
	expect(await persistence.sweep()).toBe(1);
	expect(await persistence.readBlob(reference)).toBeNull();
});
