import { expect, test } from 'vitest';
import fixtureUrl from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';
import { base64ToBytes } from '$lib/engine';
import { createPkhexEngine } from '$lib/engine/pkhex-engine';
import { BrowserCatalogPersistence, deleteBrowserCatalog, PokemonStorageService } from './index';

test('real engine payloads survive archive replacement and pre-restore recovery', async () => {
	const name = `storage-archive-engine-${crypto.randomUUID()}`;
	try {
		const engine = await createPkhexEngine('/pkhex-engine');
		const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
		const slots = await engine.listBoxSlots(bytes, '011020251345.sav', 0);
		if (!slots.ok) throw slots.error;
		const entity = slots.value.find((slot) => slot.entityBytesBase64);
		if (!entity?.entityBytesBase64) throw new Error('Expected a populated Emerald slot.');
		const entityBytes = base64ToBytes(entity.entityBytesBase64);
		const service = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
		await service.initialize();
		const boxId = service.listBoxes()[0].id;
		const origin = {
			entryMode: 'imported' as const,
			originSaveFileId: null,
			originSaveFileName: '011020251345.sav',
			originGame: 'Emerald',
			originalTrainer: 'Trainer',
			trainerId: '42',
			enteredAt: '2026-10-03T00:00:00Z'
		};
		const active = await service.add(entityBytes, origin, {
			storageBoxId: boxId,
			slot: 0
		});
		const unfiled = await service.add(entityBytes, origin);
		const deleted = await service.add(entityBytes, origin);
		await service.retire(deleted.recordId, 'cleared');
		const activePayload = await service.readPayload(active.recordId);
		const archive = await service.exportArchive();
		const later = await service.add(entityBytes, origin);
		await service.restoreArchive(archive);
		const reopened = new PokemonStorageService(new BrowserCatalogPersistence(name), engine);
		await reopened.load();
		expect(reopened.listRecords().map((item) => item.recordId)).toEqual([
			active.recordId,
			unfiled.recordId
		]);
		expect(reopened.listRecords()[0].origin).toEqual(origin);
		expect(await reopened.readPayload(active.recordId)).toEqual(activePayload);
		expect(reopened.listRecentlyDeleted().map((item) => item.recordId)).toEqual([deleted.recordId]);
		await reopened.sweep();
		await reopened.recoverPreRestore();
		expect(reopened.listRecords().some((item) => item.recordId === later.recordId)).toBe(true);
		expect(await reopened.readPayload(later.recordId)).toBeDefined();
	} finally {
		await deleteBrowserCatalog(name);
	}
});
