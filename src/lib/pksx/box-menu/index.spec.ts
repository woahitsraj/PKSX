import { describe, expect, it } from 'vitest';

import { createBoxMenuCommands } from './index';

describe('Box Menu commands', () => {
	it('keeps the five commands in their fixed order', () => {
		expect(
			createBoxMenuCommands({
				source: { type: 'save-file', label: 'emerald.sav' },
				workspaceReady: true,
				paneCount: 1
			}).map((command) => command.label)
		).toEqual(['Export', 'Save a backup', 'Switch', 'Open another collection', 'Close']);
	});

	it('explains every unavailable Pokemon Storage command', () => {
		const commands = createBoxMenuCommands({
			source: { type: 'pokemon-storage', label: 'Pokemon Storage' },
			workspaceReady: false,
			paneCount: 1
		});

		expect(
			commands.map(({ key, availability, reason }) => ({ key, availability, reason }))
		).toEqual([
			{
				key: 'export',
				availability: 'unavailable',
				reason: 'Pokemon Storage cannot be exported.'
			},
			{
				key: 'save-backup',
				availability: 'unavailable',
				reason: 'Pokemon Storage does not use Backups.'
			},
			{ key: 'switch', availability: 'available', reason: null },
			{ key: 'open-another', availability: 'available', reason: null },
			{
				key: 'close',
				availability: 'unavailable',
				reason: 'Keep at least one collection open.'
			}
		]);
	});

	it('allows switching and closing the active Save File pane when another pane remains', () => {
		const commands = createBoxMenuCommands({
			source: { type: 'save-file', label: 'emerald.sav' },
			workspaceReady: true,
			paneCount: 2
		});

		expect(commands[2]).toMatchObject({ availability: 'available', reason: null });
		expect(commands[3]).toMatchObject({
			availability: 'unavailable',
			reason: 'Two collections are already open.'
		});
		expect(commands[4]).toMatchObject({ availability: 'available', reason: null });
	});

	it('waits for a Save File Workspace before exporting or backing up', () => {
		const commands = createBoxMenuCommands({
			source: { type: 'save-file', label: 'secondary.sav' },
			workspaceReady: false,
			paneCount: 2
		});

		expect(commands[0]).toMatchObject({
			availability: 'unavailable',
			reason: 'secondary.sav is still loading.'
		});
		expect(commands[1]).toMatchObject({
			availability: 'unavailable',
			reason: 'secondary.sav is still loading.'
		});
	});
});
