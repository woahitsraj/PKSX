import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import LinkedSaveFolders from './LinkedSaveFolders.svelte';
import { deleteIndexedDbSaves, IndexedDbSavesStorage } from '$lib/pksx/saves';
import { saveFolders, type FolderLink } from '$lib/pksx/linked-save-folders';

const state = vi.hoisted(() => ({
	database: `linked-ui-${crypto.randomUUID()}`,
	folders: [] as FolderLink[]
}));
vi.mock('$lib/pksx/linked-save-folders', async (original) => ({
	...(await original<typeof import('$lib/pksx/linked-save-folders')>()),
	supportsSaveFolders: () => true,
	saveFolders: {
		status: vi.fn(async () => ({ folders: state.folders })),
		pick: vi.fn(async () => {
			const folder = { tree: 'content://dolphin/tree/root', name: 'Saves folder' };
			state.folders = [folder];
			return { cancelled: false, folder };
		}),
		unlink: vi.fn(async () => {
			state.folders = [];
		}),
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
		invalidateSavesCache: () => {}
	};
});
let component: ReturnType<typeof mount>;
let target: HTMLDivElement;
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	await deleteIndexedDbSaves(state.database);
});

it('automatically discovers/imports a chosen folder without changing the active Save File, and retains Saves after unlink', async () => {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(LinkedSaveFolders, { target });
	const button = (label: string) =>
		Array.from(target.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === label
		)!;
	await expect.poll(() => !!button('Choose save folder')).toBe(true);
	button('Choose save folder').click();
	await expect.poll(() => target.textContent).toContain('xd.gci: In Saves');
	const storage = new IndexedDbSavesStorage({ databaseName: state.database });
	expect(await storage.listSaves()).toHaveLength(1);
	expect(await storage.getActiveSaveFileId()).toBeNull();
	await expect.poll(() => button('Unlink Saves folder')?.disabled).toBe(false);
	button('Unlink Saves folder').click();
	await expect.poll(() => !!button('Unlink Saves folder')).toBe(false);
	expect(await storage.listSaves()).toHaveLength(1);
	expect(saveFolders.unlink).toHaveBeenCalledOnce();
	expect(target.textContent).toContain('RAW/GCP memory cards are unsupported');
});
