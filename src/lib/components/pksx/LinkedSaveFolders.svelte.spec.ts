import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import LinkedSaveFolders from './LinkedSaveFolders.svelte';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import { saveFolders } from '$lib/pksx/linked-save-folders';

const state = vi.hoisted(() => ({ database: `linked-ui-${crypto.randomUUID()}` }));
vi.mock('$lib/pksx/linked-save-folders', async (original) => ({
	...(await original<typeof import('$lib/pksx/linked-save-folders')>()),
	supportsSaveFolders: () => true,
	saveFolders: {
		status: vi.fn(async () => ({ tree: null, mode: 'dolphin' })),
		pick: vi.fn(async () => ({ tree: 'content://dolphin/tree/root', mode: 'dolphin' })),
		unlink: vi.fn(async () => {}),
		cancel: vi.fn(async () => {}),
		list: vi.fn(async () => ({
			entries: [{ id: 'xd', name: 'xd.gci', directory: false, size: 4 }],
			truncated: false
		})),
		read: vi.fn(async () => ({ identity: 'dolphin:xd', base64: 'AQIDBA==' }))
	}
}));
vi.mock('$lib/pksx/saves-cache', async () => {
	const { IndexedDbSavesStorage } = await import('$lib/pksx/saves');
	const { createMockEngine } = await import('$lib/engine/mock-engine');
	const storage = new IndexedDbSavesStorage({ databaseName: state.database });
	return {
		getSavesStorage: () => storage,
		getPkhexEngine: createMockEngine,
		invalidateSavesCache: () => {},
		invalidateActiveWorkspaceCache: () => {}
	};
});
vi.mock('$lib/pksx/boxes-session', () => ({ getBoxesSession: () => ({ selectPrimary: vi.fn() }) }));
let component: ReturnType<typeof mount>;
let target: HTMLDivElement;
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	await deleteIndexedDbSaves(state.database);
});

it('links, scans without importing, imports explicitly, and retains Saves after unlink', async () => {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(LinkedSaveFolders, { target });
	const button = (label: string) =>
		Array.from(target.querySelectorAll('button')).find((button) => button.textContent === label)!;
	await expect.poll(() => button('Link Dolphin folder')?.disabled).toBe(false);
	button('Link Dolphin folder').click();
	await expect.poll(() => !!button('Scan folder')).toBe(true);
	button('Scan folder').click();
	await expect.poll(() => button('Import xd.gci')?.disabled).toBe(false);
	const storage = new IndexedDbSavesStorage({ databaseName: state.database });
	expect(await storage.listSaves()).toHaveLength(0);
	button('Import xd.gci').click();
	await expect.poll(() => button('Already in Saves')?.disabled).toBe(true);
	expect(await storage.listSaves()).toHaveLength(1);
	button('Unlink').click();
	await expect.poll(() => !!button('Link Dolphin folder')).toBe(true);
	expect(await storage.listSaves()).toHaveLength(1);
	expect(saveFolders.unlink).toHaveBeenCalledOnce();
	expect(target.textContent).toContain('Whole RAW/GCP memory cards are unsupported');
});
