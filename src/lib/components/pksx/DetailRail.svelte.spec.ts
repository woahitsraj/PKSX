import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import DetailRail from './DetailRail.svelte';
import type { SlotView } from './types';

let mounted: ReturnType<typeof mount> | null = null;

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = null;
	document.body.replaceChildren();
});

function render(identity: SlotView['heldItemSpriteIdentity']) {
	const host = document.createElement('div');
	document.body.append(host);
	const focusedSlot: SlotView = {
		slot: 0,
		label: 'Aron',
		detail: 'Lv. 12',
		level: 12,
		experience: 100,
		experienceProjection: null,
		speciesId: 304,
		form: 0,
		isEgg: false,
		spriteIdentity: null,
		kind: 'pokemon',
		heldItem: 'Potion',
		heldItemSpriteIdentity: identity
	};
	mounted = mount(DetailRail, {
		target: host,
		props: {
			focusedSlot,
			focusZone: 'box',
			focusSlot: 0,
			slotHueStyle: '',
			spriteUrl: null,
			saveSummary: null,
			activeBoxName: 'Box 01',
			positionLabel: 'Box 01, Slot 1'
		}
	});
	return host;
}

describe('DetailRail held item artwork', () => {
	test('shows resolved local artwork beside the authoritative item name', () => {
		const host = render({
			nativeId: 13,
			canonicalId: 17,
			generation: 3,
			context: 'Gen3',
			gameVersionId: 3
		});

		const item = host.querySelector('.item-value');
		const value = item?.querySelector('span');
		expect(item?.textContent).toContain('Potion');
		expect(item?.querySelector('img')?.getAttribute('src')).toBe('/sprites/items/0017-potion.png');
		expect(item?.querySelector('img')?.getAttribute('alt')).toBe('');
		expect(getComputedStyle(value!).color).toBe(getComputedStyle(item!).color);
	});

	test('keeps the item name and fixed fallback stage when artwork is unresolved', () => {
		const host = render({
			nativeId: 1785,
			canonicalId: 1785,
			generation: 8,
			context: 'Gen8',
			gameVersionId: 44
		});

		const item = host.querySelector('.item-value');
		expect(item?.textContent).toContain('Potion');
		expect(item?.querySelector('img')).toBeNull();
		expect(item?.querySelector('[data-item-sprite="missing"]')).not.toBeNull();
	});
});
