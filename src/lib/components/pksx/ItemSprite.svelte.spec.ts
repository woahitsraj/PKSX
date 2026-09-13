import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import type { ItemSpriteIdentity } from '$lib/engine';
import ItemSprite from './ItemSprite.svelte';

let mounted: ReturnType<typeof mount> | null = null;
const props = $state<{ identity: ItemSpriteIdentity | null; size: number }>({
	identity: null,
	size: 32
});

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = null;
	props.identity = null;
	document.body.replaceChildren();
});

function render(identity: ItemSpriteIdentity | null) {
	const host = document.createElement('div');
	document.body.append(host);
	props.identity = identity;
	mounted = mount(ItemSprite, { target: host, props });
	flushSync();
	return host;
}

describe('ItemSprite', () => {
	test('renders deterministic local artwork with empty alt text', () => {
		const host = render({
			nativeId: 13,
			canonicalId: 17,
			generation: 3,
			context: 'Gen3',
			gameVersionId: 3
		});

		const image = host.querySelector('img');
		expect(image?.getAttribute('src')).toBe('/sprites/items/0017-potion.png');
		expect(image?.getAttribute('alt')).toBe('');
		expect(image?.getAttribute('width')).toBe('32');
		expect(host.querySelector('[data-item-sprite]')?.getAttribute('aria-hidden')).toBe('true');
	});

	test('preserves the same fixed stage for missing artwork', () => {
		const host = render({
			nativeId: 1785,
			canonicalId: 1785,
			generation: 8,
			context: 'Gen8',
			gameVersionId: 44
		});

		expect(host.querySelector('img')).toBeNull();
		expect(host.querySelector('[data-item-sprite="missing"] .missing-mark')).not.toBeNull();
		expect((host.querySelector('[data-item-sprite]') as HTMLElement).style.cssText).toContain(
			'32px'
		);
	});

	test('replaces a failed image without retaining failure across identities', () => {
		const host = render({
			nativeId: 13,
			canonicalId: 17,
			generation: 3,
			context: 'Gen3',
			gameVersionId: 3
		});
		const failedImage = host.querySelector('img')!;

		failedImage.dispatchEvent(new Event('error'));
		flushSync();
		expect(host.querySelector('img')).toBeNull();
		expect(host.querySelector('[data-item-sprite="potion"] .missing-mark')).not.toBeNull();

		props.identity = {
			nativeId: 1880,
			canonicalId: 1880,
			generation: 9,
			context: 'Gen9',
			gameVersionId: 9
		};
		flushSync();
		expect(host.querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/items/1696-booster-energy.png'
		);

		failedImage.dispatchEvent(new Event('error'));
		flushSync();
		expect(host.querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/items/1696-booster-energy.png'
		);
	});
});
