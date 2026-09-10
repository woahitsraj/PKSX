import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import SavesGrid from './SavesGrid.svelte';
import { createSummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
import { createEmptyPokemonStorage, deleteIndexedDbSaves } from '$lib/pksx/saves';
import { getSavesSnapshot, getSavesStorage, invalidateSavesCache } from '$lib/pksx/saves-cache';

const fakes = vi.hoisted(() => ({
	databaseName: 'pksx-grid-test-' + crypto.randomUUID(),
	host: null as ReturnType<typeof createSummonedWorkflowHost> | null
}));

vi.mock('$lib/pksx/saves', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/pksx/saves')>();
	return {
		...original,
		createSavesStorage: () =>
			new original.IndexedDbSavesStorage({ databaseName: fakes.databaseName })
	};
});
vi.mock('$lib/pksx/summoned-workflow/host.svelte', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/pksx/summoned-workflow/host.svelte')>()),
	getSummonedWorkflowHost: () => fakes.host
}));
vi.mock('$lib/engine', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/engine')>()),
	createPkhexWorkerEngine: () => ({ loadSaveWorkspace: async () => ({ ok: false }) })
}));

let component: ReturnType<typeof mount> | null = null;
let container: HTMLElement;

afterEach(async () => {
	if (component) await unmount(component);
	component = null;
	container?.remove();
	await deleteIndexedDbSaves(fakes.databaseName);
	invalidateSavesCache();
});

it.each(['save-file-menu', 'save-file-delete', 'main-menu'] as const)(
	'reconciles a missing menu target while %s owns the workflow',
	async (kind) => {
		const storage = getSavesStorage();
		const removed = await storage.importSave({
			bytes: new Uint8Array([1]),
			originalFileName: 'removed.sav'
		});
		const survivor = await storage.importSave({
			bytes: new Uint8Array([2]),
			originalFileName: 'survivor.sav'
		});
		const host = createSummonedWorkflowHost();
		fakes.host = host;
		container = document.createElement('div');
		document.body.append(container);
		component = mount(SavesGrid, { target: container });
		await expect.poll(() => container.querySelectorAll('.save-card').length).toBe(2);
		const grid = container.querySelector<HTMLElement>('#saves-grid')!;
		await expect.poll(() => document.activeElement).toBe(grid);
		container
			.querySelector<HTMLButtonElement>('[aria-label="Open Save File Menu for removed.sav"]')!
			.click();
		await tick();
		if (kind === 'save-file-delete') {
			host.openRelated(kind, { type: 'control', id: 'save-file-menu-command-2' });
		} else if (kind === 'main-menu') {
			host.closeAll();
			host.open(kind, { type: 'control', id: 'saves-grid' });
		}
		await storage.deleteSave(removed.id);
		invalidateSavesCache();
		await getSavesSnapshot({ force: true });
		await tick();

		expect(host.active?.kind ?? null).toBe(kind === 'main-menu' ? 'main-menu' : null);
		expect(grid.getAttribute('aria-activedescendant')).toBe('saves-target-' + survivor.id);
		if (kind !== 'main-menu') {
			await expect.poll(() => document.activeElement).toBe(grid);
			expect(container.querySelector('[inert]')).toBeNull();
		}
	}
);

it('includes Pokemon Storage in grid navigation', async () => {
	fakes.host = createSummonedWorkflowHost();
	await getSavesStorage().putPokemonStorage(createEmptyPokemonStorage(4));
	container = document.createElement('div');
	document.body.append(container);
	component = mount(SavesGrid, { target: container });

	const grid = container.querySelector<HTMLElement>('#saves-grid')!;
	const storageCard = container.querySelector<HTMLElement>('#saves-target-pokemon-storage')!;
	await expect
		.poll(() => storageCard.textContent?.replace(/\s+/g, ' '))
		.toContain('4 Storage Boxes');
	expect(grid.getAttribute('aria-activedescendant')).toBe('saves-target-import');
	const storageText = storageCard.textContent?.replace(/\s+/g, ' ');
	expect(storageCard.getAttribute('role')).toBe('gridcell');
	expect(storageText).toContain('0 Pokemon');
	expect(storageText).toContain('4 Storage Boxes');
	expect(storageText).toContain('Automatically saved by PKSX');

	grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
	await tick();
	expect(grid.getAttribute('aria-activedescendant')).toBe('saves-target-pokemon-storage');
	grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	await tick();
	expect(grid.getAttribute('aria-activedescendant')).toBe('saves-target-import');
});
