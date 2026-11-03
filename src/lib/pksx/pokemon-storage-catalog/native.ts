import type { NativeFileStore } from '$lib/pksx/saves';
import {
	assertManifest,
	CatalogConflictError,
	cloneManifest,
	referencedPayloads,
	verifyBlob,
	type BlobReference,
	type CatalogPersistence,
	type PokemonStorageManifest,
	type StagedBlob
} from './types';

const directory = 'pokemon-storage-catalog';
let catalogQueue = Promise.resolve();
const manifestPath = (revision: number) => `${directory}/manifests/${revision}.json`;
const completionPath = (revision: number) => `${directory}/manifests/${revision}.complete`;
const blobPath = (id: string) => `${directory}/blobs/${id}.bin`;
const digest = async (value: string) =>
	[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
type Completion = { revision: number; manifestSha256: string; checksum: string };

async function completionFor(revision: number, manifestSha256: string): Promise<Completion> {
	return {
		revision,
		manifestSha256,
		checksum: await digest(`${revision}:${manifestSha256}`)
	};
}

export class NativeCatalogPersistence implements CatalogPersistence {
	constructor(private readonly files: NativeFileStore) {}
	async read(): Promise<PokemonStorageManifest | null> {
		const completions = await this.#completions();
		return completions[0] ? this.#readCompleted(completions[0]) : null;
	}
	async #completions(): Promise<Completion[]> {
		const names = await this.files.list(`${directory}/manifests`);
		const completions: Completion[] = [];
		for (const name of names.filter((item) => /^\d+\.complete$/.test(item))) {
			const revision = Number(name.slice(0, -9));
			if (!Number.isSafeInteger(revision)) continue;
			const text = await this.files.readText(completionPath(revision));
			if (!text) continue;
			let completion: Completion;
			try {
				completion = JSON.parse(text) as Completion;
			} catch {
				continue;
			}
			if (
				!completion ||
				typeof completion !== 'object' ||
				completion.revision !== revision ||
				typeof completion.manifestSha256 !== 'string' ||
				!/^[a-f0-9]{64}$/.test(completion.manifestSha256) ||
				completion.checksum !==
					(await digest(`${completion.revision}:${completion.manifestSha256}`))
			)
				continue;
			completions.push(completion);
		}
		return completions.sort((a, b) => b.revision - a.revision);
	}
	async #readCompleted(completion: Completion): Promise<PokemonStorageManifest> {
		const text = await this.files.readText(manifestPath(completion.revision));
		if (!text) throw new Error('Published Pokemon Storage manifest is missing.');
		if ((await digest(text)) !== completion.manifestSha256)
			throw new Error('Published Pokemon Storage manifest checksum mismatch.');
		const manifest = JSON.parse(text) as PokemonStorageManifest;
		assertManifest(manifest);
		if (manifest.revision !== completion.revision)
			throw new Error('Pokemon Storage manifest revision mismatch.');
		for (const reference of referencedPayloads(manifest)) {
			const bytes = await this.files.readBytes(blobPath(reference.id));
			if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
			await verifyBlob(reference, bytes);
		}
		return cloneManifest(manifest);
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
		for (const reference of referencedPayloads(manifest)) {
			const bytes = await this.files.readBytes(blobPath(reference.id));
			if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
			await verifyBlob(reference, bytes);
		}
		if ((await this.read())?.revision !== expectedRevision && expectedRevision !== null)
			throw new CatalogConflictError();
		const text = JSON.stringify(manifest);
		await this.files.writeText(manifestPath(manifest.revision), text);
		if ((await this.files.readText(manifestPath(manifest.revision))) !== text)
			throw new Error('Staged Pokemon Storage manifest did not verify.');
		const completion = await completionFor(manifest.revision, await digest(text));
		try {
			await this.files.writeText(completionPath(manifest.revision), JSON.stringify(completion));
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
		const manifest = await this.read();
		const keep = new Set(
			manifest ? referencedPayloads(manifest).map((item) => `${item.id}.bin`) : []
		);
		const names = await this.files.list(`${directory}/blobs`);
		const orphans = names.filter((name) => /^[a-f0-9]{64}\.bin$/.test(name) && !keep.has(name));
		for (const name of orphans) await this.files.delete(`${directory}/blobs/${name}`);
		return orphans.length;
	}
}
