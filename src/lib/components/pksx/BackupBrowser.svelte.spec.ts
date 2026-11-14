import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import type { SaveCardSummary } from '$lib/engine';
import BackupBrowser from './BackupBrowser.svelte';

const fakes = vi.hoisted(() => ({
	active: { kind: 'backup-browser' },
	ownerAvailable: true,
	bytes: new Map<string, Uint8Array>(),
	pending: new Map<number, (value: unknown) => void>(),
	summarize: vi.fn(),
	putWorkspace: vi.fn(),
	owner: { id: 'owner', importedAt: 'now', originalFileName: 'owner.sav' },
	backups: ['one', 'two', 'missing', 'corrupt'].map((id) => ({
		id,
		saveFileId: 'owner',
		createdAt: '2026-01-01',
		reason: 'manual'
	}))
}));

vi.mock('$lib/pksx/summoned-workflow/host.svelte', () => ({
	getSummonedWorkflowHost: () => ({
		active: fakes.active,
		dismiss: () => null
	})
}));
vi.mock('$lib/pksx/saves-cache', () => ({
	getCachedActiveWorkspaceBox: () => 0,
	getCachedActiveWorkspace: () => null,
	getSaveFileEditCoordinator: () => ({}),
	invalidateSavesCache: () => undefined,
	setCachedActiveWorkspace: () => undefined,
	getSavesStorage: () => ({
		getActiveSaveFileId: async () => 'owner',
		getSave: async () => (fakes.ownerAvailable ? fakes.owner : null),
		getWorkspace: async () => ({ bytes: new Uint8Array([99]), dirty: true }),
		listBackups: async () => fakes.backups,
		getBackupBytes: async (id: string) => fakes.bytes.get(id) ?? null,
		putWorkspace: fakes.putWorkspace
	}),
	getPkhexEngine: () => ({ summarizeSaveCard: fakes.summarize }),
	getActiveWorkspaceService: () => ({ subscribe: () => () => undefined })
}));

let component: ReturnType<typeof mount> | undefined;
let container: HTMLElement;

afterEach(async () => {
	if (component) await unmount(component);
	container?.remove();
	vi.clearAllMocks();
	fakes.pending.clear();
	fakes.ownerAvailable = true;
});

function details(game: string, trainer: string, playTime: string): SaveCardSummary {
	return {
		summary: {
			saveType: 'SAV3',
			gameVersionId: 3,
			generation: 3,
			trainerId: 1,
			playedHours: 0,
			playedMinutes: 0,
			partyCount: 1,
			boxCount: 14,
			boxSlotCount: 30,
			gameVersion: game,
			trainerName: trainer,
			playTime
		},
		pokemonCount: 7
	};
}

it('ignores late selected previews, distinguishes missing and parse failure, and stays read-only', async () => {
	fakes.bytes = new Map([
		['one', new Uint8Array([1])],
		['two', new Uint8Array([2])],
		['corrupt', new Uint8Array([3])]
	]);
	fakes.summarize.mockImplementation(
		(bytes: Uint8Array) => new Promise((resolve) => fakes.pending.set(bytes[0], resolve))
	);
	container = document.createElement('div');
	document.body.append(container);
	component = mount(BackupBrowser, { target: container });
	await expect.poll(() => fakes.pending.has(1)).toBe(true);
	const select = (id: string) =>
		container.querySelector<HTMLButtonElement>('#backup-browser-preview-' + id)!.click();
	select('two');
	await expect.poll(() => fakes.pending.has(2)).toBe(true);
	fakes.pending.get(2)!({ ok: true, value: details('Pt', 'SECOND', '') });
	await expect.poll(() => container.textContent).toContain('SECOND');
	expect(container.textContent).toContain('Unavailable');
	fakes.pending.get(1)!({ ok: true, value: details('E', 'FIRST', '10:00') });
	await expect.poll(() => container.textContent).not.toContain('FIRST');
	select('missing');
	await expect.poll(() => container.textContent).toContain('Backup bytes are missing');
	select('corrupt');
	await expect.poll(() => fakes.pending.has(3)).toBe(true);
	fakes.pending.get(3)!({ ok: false, error: { message: 'Cannot parse Backup' } });
	await expect.poll(() => container.textContent).toContain('Cannot parse Backup');
	expect(fakes.putWorkspace).not.toHaveBeenCalled();
	expect(fakes.summarize.mock.calls.map(([bytes]) => [...bytes])).toEqual([[1], [2], [3]]);
	fakes.ownerAvailable = false;
	select('two');
	await expect.poll(() => container.textContent).toContain('Save File is no longer available');
	fakes.ownerAvailable = true;
	select('one');
	await expect.poll(() => container.textContent).toContain('Loading Backup preview');
	await unmount(component);
	component = undefined;
	fakes.pending.get(1)!({ ok: true, value: details('E', 'CLOSED', '10:00') });
	expect(container.textContent).toBe('');
	expect(fakes.putWorkspace).not.toHaveBeenCalled();
});
