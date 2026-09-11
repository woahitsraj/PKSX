<script lang="ts">
	import type { ItemSpriteIdentity } from '$lib/engine';
	import { resolveItemSpriteCatalogEntry } from '$lib/pksx/item-sprite-catalog';

	interface Props {
		identity?: ItemSpriteIdentity | null;
		resolvedPath?: string | null;
		size?: number;
		fallback?: boolean;
	}

	let { identity = null, resolvedPath = undefined, size = 30, fallback = true }: Props = $props();
	let failedPath = $state<string | null>(null);
	const entry = $derived(resolveItemSpriteCatalogEntry(identity));
	const path = $derived(resolvedPath === undefined ? (entry?.path ?? null) : resolvedPath);

	function handleImageError(event: Event, path: string) {
		if ((event.currentTarget as HTMLImageElement).getAttribute('src') === path) failedPath = path;
	}
</script>

<span
	class="item-sprite"
	class:missing={fallback && (!path || failedPath === path)}
	style:--item-sprite-size={`${size}px`}
	aria-hidden="true"
	data-item-sprite={entry?.slug ?? path ?? 'missing'}
>
	{#if path && failedPath !== path}
		<img
			src={path}
			alt=""
			width={size}
			height={size}
			onerror={(event) => handleImageError(event, path)}
		/>
	{:else if fallback}
		<span class="missing-mark"></span>
	{/if}
</span>

<style>
	.item-sprite {
		display: inline-grid;
		flex: 0 0 var(--item-sprite-size);
		width: var(--item-sprite-size);
		height: var(--item-sprite-size);
		place-items: center;
	}

	.item-sprite img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.missing-mark {
		width: 62%;
		height: 62%;
		border: 1px solid currentColor;
		border-radius: 50%;
		opacity: 0.22;
	}
</style>
