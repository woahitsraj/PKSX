import { describe, expect, it, vi } from 'vitest';
import { createBoxPane, type BoxSourceRef } from '$lib/pksx/storage-workbench';
import { BoxesSessionService, type BoxesSessionPersistence } from './index';

const storage: BoxSourceRef = {
	type: 'pokemon-storage',
	id: 'pokemon-storage',
	label: 'Pokemon Storage'
};
const emerald: BoxSourceRef = {
	type: 'save-file',
	id: 'save-1',
	label: 'emerald.sav',
	dirty: true
};
const scarlet: BoxSourceRef = {
	type: 'save-file',
	id: 'save-2',
	label: 'scarlet.sav',
	dirty: false
};

describe('BoxesSessionService', () => {
	it('restores the current two-pane composition during the session', () => {
		const service = new BoxesSessionService();
		const state = {
			panes: [
				createBoxPane('pane-primary', emerald, {
					activeBox: 2,
					boxCount: 14,
					focus: { zone: 'box', slot: 8 }
				}),
				createBoxPane('pane-secondary', storage, { activeBox: 1, boxCount: 3 })
			],
			activePaneId: 'pane-secondary',
			virtualPaneIds: ['pane-secondary'],
			virtualPaneViews: {
				'pane-secondary': {
					preferences: {
						location: 'unfiled' as const,
						sort: 'species' as const,
						filters: { query: 'Aron', originGame: '', entryMode: '', shinyOnly: false }
					},
					focusedId: 'record-1',
					columns: 4
				}
			}
		};
		service.set(state);

		expect(
			service.restore({ saveFiles: [emerald, scarlet], activeSaveFileId: emerald.id })
		).toEqual(state);
	});

	it('persists only the primary collection and its last meaningful view', () => {
		const persistence = createPersistence();
		const service = new BoxesSessionService(persistence);
		service.set({
			panes: [
				createBoxPane('pane-primary', emerald, {
					activeBox: 4,
					boxCount: 14,
					focus: { zone: 'party', slot: 3 }
				}),
				createBoxPane('pane-secondary', scarlet, { boxCount: 32 })
			],
			activePaneId: 'pane-secondary',
			virtualPaneIds: [],
			virtualPaneViews: {}
		});

		const restored = new BoxesSessionService(persistence).restore({
			saveFiles: [emerald, scarlet],
			activeSaveFileId: scarlet.id
		});

		expect(restored).toEqual({
			panes: [
				createBoxPane('pane-primary', emerald, {
					activeBox: 4,
					boxCount: 14,
					focus: { zone: 'party', slot: 3 }
				})
			],
			activePaneId: 'pane-primary',
			virtualPaneIds: [],
			virtualPaneViews: {}
		});
		expect(persistence.save).toHaveBeenCalledTimes(2);
	});

	it('falls back to the active Save File when a remembered source is missing', () => {
		const persistence = createPersistence({
			primary: createBoxPane('pane-primary', emerald, { activeBox: 9, boxCount: 14 })
		});
		const service = new BoxesSessionService(persistence);

		const restored = service.restore({
			saveFiles: [scarlet],
			activeSaveFileId: scarlet.id,
			pokemonStorageBoxCount: 5
		});

		expect(restored.panes).toEqual([createBoxPane('pane-primary', scarlet, { boxCount: 1 })]);
	});

	it('restores a primary virtual Storage view after reload', () => {
		const persistence = createPersistence();
		const view = {
			preferences: {
				location: 'unfiled' as const,
				sort: 'recent' as const,
				filters: { query: 'Aron', originGame: '', entryMode: '', shinyOnly: false }
			},
			focusedId: 'record-1',
			columns: 3
		};
		new BoxesSessionService(persistence).set({
			panes: [createBoxPane('pane-primary', storage)],
			activePaneId: 'pane-primary',
			virtualPaneIds: ['pane-primary'],
			virtualPaneViews: { 'pane-primary': view }
		});
		const restored = new BoxesSessionService(persistence).restore({
			saveFiles: [],
			activeSaveFileId: null
		});
		expect(restored.virtualPaneIds).toEqual(['pane-primary']);
		expect(restored.virtualPaneViews['pane-primary']).toEqual(view);
	});

	it('opens a selected collection as the focused one-pane composition', () => {
		const service = new BoxesSessionService();
		service.set({
			panes: [createBoxPane('pane-primary', emerald), createBoxPane('pane-secondary', storage)],
			activePaneId: 'pane-secondary',
			virtualPaneIds: ['pane-secondary'],
			virtualPaneViews: {}
		});

		expect(service.selectPrimary(storage, 3)).toEqual({
			panes: [createBoxPane('pane-primary', storage, { boxCount: 3 })],
			activePaneId: 'pane-primary',
			virtualPaneIds: [],
			virtualPaneViews: {}
		});
	});
});

function createPersistence(initial: unknown = null) {
	const persistence: BoxesSessionPersistence & { value: unknown } = {
		value: initial,
		load: vi.fn((): unknown => persistence.value),
		save: vi.fn((value) => {
			persistence.value = value;
		})
	};
	return persistence;
}
