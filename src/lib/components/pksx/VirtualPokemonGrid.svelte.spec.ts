import { mount, unmount } from 'svelte';
import { expect, test, vi } from 'vitest';
import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
import { defaultVirtualViewPreferences } from '$lib/pksx/pokemon-storage-catalog/virtual-views';
import VirtualPokemonGrid from './VirtualPokemonGrid.svelte';
import { virtualRecordControlId } from './virtual-pokemon-grid-layout';

test('overlapping records have independent focus targets in two panes', async () => {
	const record = {
		recordId: 'shared-record',
		projection: { nickname: 'ARON', speciesName: 'Aron', level: 11, spriteIdentity: null },
		origin: { originGame: 'Emerald', entryMode: 'copied-in' },
		placement: null
	} as PokemonRecord;
	const hosts = ['left', 'right'].map(() =>
		document.body.appendChild(document.createElement('div'))
	);
	const focus = [vi.fn(), vi.fn()];
	const grids = ['left', 'right'].map((paneId, index) =>
		mount(VirtualPokemonGrid, {
			target: hosts[index],
			props: {
				paneId,
				records: [record],
				allRecords: [record],
				preferences: defaultVirtualViewPreferences,
				focusedId: record.recordId,
				busy: false,
				onFocus: focus[index],
				onPreferences: () => {},
				onMoveToUnfiled: () => {},
				onCarry: () => {},
				onColumns: () => {}
			}
		})
	);
	try {
		const buttons = hosts.map((host) => host.querySelector<HTMLButtonElement>('.record')!);
		expect(buttons[0].id).not.toBe(buttons[1].id);
		const target = document.getElementById(virtualRecordControlId('right', record.recordId));
		expect(target).toBe(buttons[1]);
		target!.focus();
		expect(document.activeElement).toBe(buttons[1]);
		expect(focus[1]).toHaveBeenCalledWith(record.recordId);
		expect(focus[0]).not.toHaveBeenCalled();
	} finally {
		await Promise.all(grids.map((grid) => unmount(grid)));
		hosts.forEach((host) => host.remove());
	}
});
