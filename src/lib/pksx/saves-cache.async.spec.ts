import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveWorkspace } from '$lib/engine';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import type { StoredSaveFile } from '$lib/pksx/saves';

const fakes = vi.hoisted(() => ({
	storage: {
		getActiveSaveFileId: vi.fn(),
		listSaves: vi.fn(),
		getSave: vi.fn(),
		getSaveBytes: vi.fn(),
		getWorkspace: vi.fn()
	},
	engine: {
		summarizeSaveCard: vi.fn(),
		loadSaveWorkspace: vi.fn()
	}
}));

vi.mock('$lib/pksx/saves', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/pksx/saves')>()),
	createSavesStorage: () => fakes.storage
}));

vi.mock('$lib/engine', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/engine')>()),
	createPkhexWorkerEngine: () => fakes.engine
}));

import {
	forgetSaveCardDetails,
	getCachedSavesSnapshot,
	getSavesSnapshot,
	invalidateActiveWorkspaceCache,
	invalidateSavesCache,
	loadWorkspaceForOpening,
	setCachedActiveWorkspace,
	subscribeSavesSnapshot
} from './saves-cache';

const saveFile = (id: string): StoredSaveFile => ({
	id,
	originalFileName: id + '.sav',
	byteLength: 4,
	importedAt: '2026-06-01T10:00:00.000Z',
	updatedAt: '2026-06-02T10:00:00.000Z'
});

const workspace = (trainerName: string): SaveWorkspace =>
	({
		summary: {
			fileName: 'test.sav',
			saveType: 'SAV3',
			gameVersion: 'E',
			gameVersionId: 3,
			generation: 3,
			trainerName,
			trainerId: 1,
			playTime: '1:00',
			playedHours: 1,
			playedMinutes: 0,
			partyCount: 0,
			boxCount: 1,
			boxSlotCount: 30
		},
		partySlots: [],
		boxSlots: [],
		boxNames: { supported: true, names: ['BOX 1'], unsupportedReason: null }
	}) as SaveWorkspace;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe('Saves cache async settlement', () => {
	afterEach(() => {
		invalidateSavesCache();
		invalidateActiveWorkspaceCache();
		vi.clearAllMocks();
	});

	it('settles an immediately invalidated Workspace publication without rescanning the catalog', async () => {
		const file = saveFile('workspace-refresh');
		const older = deferred<ReturnType<typeof success>>();
		const newer = deferred<ReturnType<typeof success>>();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(file.id);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard
			.mockReturnValueOnce(older.promise)
			.mockReturnValueOnce(newer.promise);

		await getSavesSnapshot({ force: true });
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(1));
		const updates: Array<ReturnType<typeof getCachedSavesSnapshot>> = [];
		const unsubscribe = subscribeSavesSnapshot((snapshot) => updates.push(snapshot));
		setCachedActiveWorkspace(
			createCleanWorkspaceState({
				file,
				bytes: new Uint8Array([5, 6, 7, 8]),
				workspace: workspace('NEW')
			})
		);
		invalidateSavesCache();
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(2));
		expect(fakes.storage.listSaves).toHaveBeenCalledTimes(1);

		older.resolve(success('OLD'));
		await Promise.resolve();
		expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]).toEqual({
			status: 'loading'
		});
		newer.resolve(success('NEW'));
		await vi.waitFor(() =>
			expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]).toMatchObject({
				status: 'ready',
				details: { summary: { trainerName: 'NEW' } }
			})
		);
		expect(updates.at(-1)).toBe(getCachedSavesSnapshot());
		unsubscribe();
		expect(getCachedSavesSnapshot()).toBeNull();
	});

	it('discards an old detail result after an unmounted Workspace publication', async () => {
		const file = saveFile('unmounted-workspace');
		const older = deferred<ReturnType<typeof success>>();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(file.id);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockImplementation((bytes: Uint8Array) =>
			bytes[0] === 1 ? older.promise : Promise.resolve(success('NEW'))
		);

		const unsubscribe = subscribeSavesSnapshot(() => undefined);
		await getSavesSnapshot({ force: true });
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(1));
		unsubscribe();
		setCachedActiveWorkspace(
			createCleanWorkspaceState({
				file,
				bytes: new Uint8Array([5, 6, 7, 8]),
				workspace: workspace('NEW')
			})
		);
		older.resolve(success('OLD'));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(getCachedSavesSnapshot()).toBeNull();
		const replay = vi.fn();
		const resubscribe = subscribeSavesSnapshot(replay);
		expect(replay).not.toHaveBeenCalled();
		await getSavesSnapshot();
		await vi.waitFor(() =>
			expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]).toMatchObject({
				status: 'ready',
				details: { summary: { trainerName: 'NEW' } }
			})
		);
		resubscribe();
	});

	it('does not republish a removed file while its replacement catalog is pending', async () => {
		const file = saveFile('removed-during-detail');
		const details = deferred<ReturnType<typeof success>>();
		const nextCatalog = deferred<StoredSaveFile[]>();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(file.id);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockReturnValue(details.promise);
		await getSavesSnapshot({ force: true });
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(1));
		const updates = vi.fn();
		const unsubscribe = subscribeSavesSnapshot(updates);
		updates.mockClear();

		invalidateSavesCache();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(null);
		fakes.storage.listSaves.mockReturnValue(nextCatalog.promise);
		const refresh = getSavesSnapshot({ force: true });
		details.resolve(success('REMOVED'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(updates).not.toHaveBeenCalled();
		nextCatalog.resolve([]);
		await refresh;
		expect(updates).toHaveBeenLastCalledWith({
			activeSaveFileId: null,
			saveFiles: [],
			detailsBySaveFileId: {}
		});
		unsubscribe();
	});

	it('settles current details if a replacement catalog fails', async () => {
		const file = saveFile('failed-catalog');
		const details = deferred<ReturnType<typeof success>>();
		const nextCatalog = deferred<StoredSaveFile[]>();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(file.id);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockReturnValue(details.promise);
		await getSavesSnapshot({ force: true });
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(1));
		const updates = vi.fn();
		const unsubscribe = subscribeSavesSnapshot(updates);
		fakes.storage.listSaves.mockReturnValue(nextCatalog.promise);
		const refresh = getSavesSnapshot({ force: true });
		details.resolve(success('CURRENT'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		nextCatalog.reject(new Error('Catalog unavailable'));
		await expect(refresh).rejects.toThrow('Catalog unavailable');
		await vi.waitFor(() =>
			expect(updates).toHaveBeenLastCalledWith(
				expect.objectContaining({
					detailsBySaveFileId: {
						[file.id]: expect.objectContaining({ status: 'ready' })
					}
				})
			)
		);
		unsubscribe();
	});

	it('returns the newest snapshot to an overlapping stale catalog request', async () => {
		const firstList = deferred<StoredSaveFile[]>();
		const secondList = deferred<StoredSaveFile[]>();
		const newest = saveFile('newest');
		fakes.storage.getActiveSaveFileId.mockResolvedValue(newest.id);
		fakes.storage.listSaves
			.mockReturnValueOnce(firstList.promise)
			.mockReturnValueOnce(secondList.promise);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockResolvedValue(success('NEW'));

		const firstRequest = getSavesSnapshot({ force: true });
		const secondRequest = getSavesSnapshot({ force: true });
		firstList.resolve([saveFile('stale')]);
		secondList.resolve([newest]);

		const [firstSnapshot, secondSnapshot] = await Promise.all([firstRequest, secondRequest]);
		expect(firstSnapshot).toBe(secondSnapshot);
		expect(firstSnapshot.saveFiles).toEqual([newest]);
	});

	it('loads a Workspace for opening once and then reuses the published one', async () => {
		const file = saveFile('opening');
		fakes.storage.getSave.mockResolvedValue(file);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.loadSaveWorkspace.mockResolvedValue({
			ok: true,
			value: workspace('OPEN'),
			error: null
		});

		const first = await loadWorkspaceForOpening(file.id);
		expect(first).toMatchObject({ published: false, state: { file } });
		setCachedActiveWorkspace(first!.state, 0);
		const second = await loadWorkspaceForOpening(file.id);

		expect(second).toMatchObject({ published: true, state: { file } });
		expect(fakes.engine.loadSaveWorkspace).toHaveBeenCalledTimes(1);
	});

	it('reuses stored card details for unchanged bytes without the engine', async () => {
		const file = saveFile('stored-details');
		fakes.storage.getActiveSaveFileId.mockResolvedValue(null);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([9, 9, 9, 9]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockResolvedValue(success('STORED'));
		const ready = () =>
			vi.waitFor(() =>
				expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]).toMatchObject({
					status: 'ready',
					details: { summary: { trainerName: 'STORED' } }
				})
			);
		const unsubscribe = subscribeSavesSnapshot(() => undefined);
		await getSavesSnapshot({ force: true });
		await ready();

		// A new app session has no in-memory details.
		forgetSaveCardDetails();
		await getSavesSnapshot({ force: true });
		await ready();

		// Earlier tests can still settle their own cards, so count only this Save File.
		expect(
			fakes.engine.summarizeSaveCard.mock.calls.filter(
				([, fileName]) => fileName === file.originalFileName
			)
		).toHaveLength(1);
		unsubscribe();
	});

	it('keeps card details when the active Workspace is republished with the same bytes', async () => {
		const file = saveFile('box-switch');
		fakes.storage.getActiveSaveFileId.mockResolvedValue(file.id);
		fakes.storage.listSaves.mockResolvedValue([file]);
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockResolvedValue(success('ACTIVE'));
		const unsubscribe = subscribeSavesSnapshot(() => undefined);
		const state = createCleanWorkspaceState({
			file,
			bytes: new Uint8Array([5, 6, 7, 8]),
			workspace: workspace('ACTIVE')
		});
		await getSavesSnapshot({ force: true });
		setCachedActiveWorkspace(state, 0);
		await vi.waitFor(() =>
			expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]?.status).toBe('ready')
		);
		fakes.engine.summarizeSaveCard.mockClear();

		setCachedActiveWorkspace({ ...state, bytes: new Uint8Array([5, 6, 7, 8]) }, 1);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(getCachedSavesSnapshot()?.detailsBySaveFileId[file.id]?.status).toBe('ready');
		expect(fakes.engine.summarizeSaveCard).not.toHaveBeenCalled();
		unsubscribe();
	});

	it('keeps another card settling when the active Workspace is republished', async () => {
		const active = saveFile('active');
		const other = saveFile('other');
		const olderActive = deferred<ReturnType<typeof success>>();
		const otherDetails = deferred<ReturnType<typeof success>>();
		const newerActive = deferred<ReturnType<typeof success>>();
		fakes.storage.getActiveSaveFileId.mockResolvedValue(active.id);
		fakes.storage.listSaves.mockResolvedValue([active, other]);
		fakes.storage.getSaveBytes.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
		fakes.storage.getWorkspace.mockResolvedValue(null);
		fakes.engine.summarizeSaveCard.mockImplementation((bytes: Uint8Array, fileName: string) =>
			fileName === other.originalFileName
				? otherDetails.promise
				: bytes[0] === 1
					? olderActive.promise
					: newerActive.promise
		);

		await getSavesSnapshot({ force: true });
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(2));
		const unsubscribe = subscribeSavesSnapshot(() => undefined);
		setCachedActiveWorkspace(
			createCleanWorkspaceState({
				file: active,
				bytes: new Uint8Array([5, 6, 7, 8]),
				workspace: workspace('ACTIVE NEW')
			})
		);
		await vi.waitFor(() => expect(fakes.engine.summarizeSaveCard).toHaveBeenCalledTimes(3));

		otherDetails.resolve(success('OTHER'));
		await vi.waitFor(() =>
			expect(getCachedSavesSnapshot()?.detailsBySaveFileId[other.id]).toMatchObject({
				status: 'ready',
				details: { summary: { trainerName: 'OTHER' } }
			})
		);
		expect(getCachedSavesSnapshot()?.detailsBySaveFileId[active.id]).toEqual({
			status: 'loading'
		});

		olderActive.resolve(success('ACTIVE OLD'));
		await Promise.resolve();
		expect(getCachedSavesSnapshot()?.detailsBySaveFileId[active.id]).toEqual({
			status: 'loading'
		});
		newerActive.resolve(success('ACTIVE NEW'));
		await vi.waitFor(() =>
			expect(getCachedSavesSnapshot()?.detailsBySaveFileId[active.id]).toMatchObject({
				status: 'ready',
				details: { summary: { trainerName: 'ACTIVE NEW' } }
			})
		);
		unsubscribe();
	});
});

function success(trainerName: string) {
	return {
		ok: true as const,
		value: { summary: workspace(trainerName).summary, pokemonCount: 0 },
		error: null
	};
}
