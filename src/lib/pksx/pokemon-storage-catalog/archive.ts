import { base64ToBytes } from '$lib/engine';
import {
	assertManifest,
	referencedPayloads,
	verifyBlob,
	type PokemonStorageManifest,
	type StagedBlob
} from './types';

export const STORAGE_ARCHIVE_VERSION = 1;
type Archive = {
	archiveVersion: number;
	exportedAt: string;
	manifestSha256: string;
	manifest: PokemonStorageManifest;
	payloads: Record<string, string>;
};

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let index = 0; index < bytes.length; index += 8192)
		binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
	return btoa(binary);
}

export async function encodeStorageArchive(
	manifest: PokemonStorageManifest,
	blobs: StagedBlob[],
	exportedAt: string
): Promise<Uint8Array> {
	assertManifest(manifest);
	const payloads: Record<string, string> = {};
	for (const blob of blobs) {
		await verifyBlob(blob.reference, blob.bytes);
		payloads[blob.reference.id] = toBase64(blob.bytes);
	}
	const required = new Set(referencedPayloads(manifest).map((item) => item.id));
	if (required.size !== Object.keys(payloads).length || [...required].some((id) => !payloads[id]))
		throw new Error('Pokemon Storage archive is missing a required payload.');
	return new TextEncoder().encode(
		JSON.stringify({
			archiveVersion: STORAGE_ARCHIVE_VERSION,
			exportedAt,
			manifestSha256: await sha256(JSON.stringify(manifest)),
			manifest,
			payloads
		} satisfies Archive)
	);
}

export async function decodeStorageArchive(bytes: Uint8Array): Promise<{
	manifest: PokemonStorageManifest;
	blobs: StagedBlob[];
	exportedAt: string;
}> {
	let archive: Archive;
	try {
		archive = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Archive;
	} catch {
		throw new Error('Pokemon Storage archive is malformed.');
	}
	if (archive?.archiveVersion !== STORAGE_ARCHIVE_VERSION)
		throw new Error('Unsupported Pokemon Storage archive version.');
	if (!Number.isFinite(Date.parse(archive.exportedAt)))
		throw new Error('Pokemon Storage archive export time is invalid.');
	assertManifest(archive.manifest);
	if (archive.manifestSha256 !== (await sha256(JSON.stringify(archive.manifest))))
		throw new Error('Pokemon Storage archive manifest checksum mismatch.');
	if (!archive.payloads || typeof archive.payloads !== 'object' || Array.isArray(archive.payloads))
		throw new Error('Pokemon Storage archive payloads are missing.');
	const references = new Map(referencedPayloads(archive.manifest).map((item) => [item.id, item]));
	if (Object.keys(archive.payloads).length !== references.size)
		throw new Error('Pokemon Storage archive payload set is incomplete.');
	const blobs: StagedBlob[] = [];
	for (const [id, reference] of references) {
		const encoded = archive.payloads[id];
		if (typeof encoded !== 'string') throw new Error('Pokemon Storage archive payload is missing.');
		let payload: Uint8Array;
		try {
			payload = base64ToBytes(encoded, reference.byteLength);
		} catch {
			throw new Error('Pokemon Storage archive payload is malformed.');
		}
		await verifyBlob(reference, payload);
		blobs.push({ reference, bytes: payload });
	}
	return { manifest: archive.manifest, blobs, exportedAt: archive.exportedAt };
}
