import { expect, it } from 'vitest';
import { decodeStorageArchive, encodeStorageArchive } from './archive';
import { emptyManifest, referenceFor, type PokemonRecord } from './types';

it('rejects an archive whose record has no projection or origin', async () => {
	const bytes = new Uint8Array([1, 2, 3]);
	const payload = await referenceFor(bytes, 1);
	const now = '2026-11-01T00:00:00Z';
	const record = {
		recordId: 'record-1',
		payload,
		identityFingerprint: 'fingerprint',
		projection: { speciesId: 304, level: 5, nickname: 'ARON' },
		origin: {
			entryMode: 'imported',
			originSaveFileId: null,
			originSaveFileName: null,
			originGame: null,
			originalTrainer: null,
			trainerId: null,
			enteredAt: now
		},
		placement: null,
		revision: 0,
		createdAt: now,
		updatedAt: now
	} as unknown as PokemonRecord;
	const manifest = { ...emptyManifest('storage', now, 'box'), records: [record] };
	const blobs = [{ reference: payload, bytes }];

	await expect(
		decodeStorageArchive(await encodeStorageArchive(manifest, blobs, now))
	).resolves.toBeTruthy();
	for (const field of ['projection', 'origin'] as const) {
		const broken = { ...manifest, records: [{ ...record, [field]: null }] };
		await expect(
			decodeStorageArchive(await encodeStorageArchive(broken, blobs, now))
		).rejects.toThrow('Pokemon Storage archive record is malformed.');
	}
});
