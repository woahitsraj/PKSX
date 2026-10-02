import type { NativeFileStore } from '$lib/pksx/saves';
import {
	assertManifest,
	CatalogConflictError,
	cloneManifest,
	verifyBlob,
	type BlobReference,
	type CatalogPersistence,
	type PokemonStorageManifest,
	type StagedBlob
} from './types';

const directory = 'pokemon-storage-catalog';
let catalogQueue = Promise.resolve();
const manifestPath = (revision: number) => `${directory}/manifests/${revision}.json`;
const blobPath = (id: string) => `${directory}/blobs/${id}.bin`;

export class NativeCatalogPersistence implements CatalogPersistence {
	constructor(private readonly files: NativeFileStore) {}
	async read(): Promise<PokemonStorageManifest | null> {
		const names = await this.files.list(`${directory}/manifests`);
		const revisions = names
			.filter((name) => /^\d+\.json$/.test(name))
			.map((name) => Number(name.slice(0, -5)))
			.sort((a, b) => b - a);
		for (const revision of revisions) {
			const text = await this.files.readText(manifestPath(revision));
			if (!text) continue;
			let manifest: PokemonStorageManifest;
			try {
				manifest = JSON.parse(text) as PokemonStorageManifest;
			} catch {
				continue;
			}
			assertManifest(manifest);
			if (manifest.revision !== revision)
				throw new Error('Pokemon Storage manifest revision mismatch.');
			for (const record of manifest.records) {
				const bytes = await this.files.readBytes(blobPath(record.payload.id));
				if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
				await verifyBlob(record.payload, bytes);
			}
			return cloneManifest(manifest);
		}
		if (revisions.length && !(revisions.length === 1 && revisions[0] === 0))
			throw new Error('No complete Pokemon Storage manifest is available.');
		return null;
	}
	async readBlob(reference: BlobReference): Promise<Uint8Array | null> {
		const bytes = await this.files.readBytes(blobPath(reference.id));
		return bytes ? new Uint8Array(bytes) : null;
	}
	commit(
		expectedRevision: number | null,
		manifest: PokemonStorageManifest,
		blobs: StagedBlob[]
	): Promise<void> {
		const operation = catalogQueue.then(() => this.#commit(expectedRevision, manifest, blobs));
		catalogQueue = operation.then(
			() => undefined,
			() => undefined
		);
		return operation;
	}
	async #commit(
		expectedRevision: number | null,
		manifest: PokemonStorageManifest,
		blobs: StagedBlob[]
	): Promise<void> {
		assertManifest(manifest);
		const current = await this.read();
		if (
			(current?.revision ?? null) !== expectedRevision ||
			(current && current.storageId !== manifest.storageId) ||
			manifest.revision !== (expectedRevision ?? -1) + 1
		)
			throw new CatalogConflictError();
		for (const blob of blobs) {
			await verifyBlob(blob.reference, blob.bytes);
			const path = blobPath(blob.reference.id);
			const previous = await this.files.readBytes(path);
			if (previous) await verifyBlob(blob.reference, previous);
			else await this.files.writeBytes(path, blob.bytes);
			const staged = await this.files.readBytes(path);
			if (!staged) throw new Error('Staged Pokemon preservation payload is missing.');
			await verifyBlob(blob.reference, staged);
		}
		for (const record of manifest.records) {
			const bytes = await this.files.readBytes(blobPath(record.payload.id));
			if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
			await verifyBlob(record.payload, bytes);
		}
		if ((await this.read())?.revision !== expectedRevision && expectedRevision !== null)
			throw new CatalogConflictError();
		try {
			await this.files.writeText(manifestPath(manifest.revision), JSON.stringify(manifest));
		} catch (error) {
			const saved = await this.read();
			if (saved?.revision !== manifest.revision) throw error;
		}
		const saved = await this.read();
		if (saved?.revision !== manifest.revision)
			throw new Error('Pokemon Storage manifest commit did not complete.');
	}
	sweep(): Promise<number> {
		const operation = catalogQueue.then(() => this.#sweep());
		catalogQueue = operation.then(
			() => undefined,
			() => undefined
		);
		return operation;
	}
	async #sweep(): Promise<number> {
		const manifests = await this.files.list(`${directory}/manifests`);
		const keep = new Set<string>();
		for (const name of manifests.filter((name) => /^\d+\.json$/.test(name))) {
			const text = await this.files.readText(`${directory}/manifests/${name}`);
			if (!text) continue;
			try {
				const manifest = JSON.parse(text) as PokemonStorageManifest;
				assertManifest(manifest);
				for (const record of manifest.records) keep.add(`${record.payload.id}.bin`);
			} catch {
				/* An incomplete manifest does not own blobs. */
			}
		}
		const names = await this.files.list(`${directory}/blobs`);
		const orphans = names.filter((name) => /^[a-f0-9]{64}\.bin$/.test(name) && !keep.has(name));
		for (const name of orphans) await this.files.delete(`${directory}/blobs/${name}`);
		return orphans.length;
	}
}
