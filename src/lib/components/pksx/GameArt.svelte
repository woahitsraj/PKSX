<script lang="ts">
	import { resolveGameArt } from '$lib/pksx/game-art-catalog';

	interface Props {
		/** Engine `gameVersion`. Absent or unknown games draw the fallback. */
		gameVersion?: string | null;
	}

	let { gameVersion = null }: Props = $props();
	let failedPaths = $state<string[]>([]);
	const art = $derived(resolveGameArt(gameVersion));
	const covers = $derived(art.covers.filter((cover) => !failedPaths.includes(cover.path)));
</script>

<!-- Decorative: the owner states the game name in text. Size it with --game-art-size. -->
<span
	class="game-art"
	class:pair={covers.length > 1}
	aria-hidden="true"
	data-game-art={covers.length ? 'cover' : 'fallback'}
	data-game-platform={art.platform ?? 'unknown'}
>
	{#each covers as cover (cover.path)}
		<img
			src={cover.path}
			alt=""
			width={cover.width}
			height={cover.height}
			decoding="async"
			draggable="false"
			onerror={() => (failedPaths = [...failedPaths, cover.path])}
		/>
	{:else}
		<span class="missing-mark"></span>
	{/each}
</span>

<style>
	.game-art {
		position: relative;
		display: grid;
		flex: 0 0 var(--game-art-size, 56px);
		width: var(--game-art-size, 56px);
		height: var(--game-art-size, 56px);
		place-items: center;
	}

	.game-art img {
		position: absolute;
		inset: 0;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		margin: auto;
		border-radius: var(--pksx-radius-small);
		box-shadow: var(--shadow-sm);
	}

	.game-art.pair img {
		inset: 0 auto auto 0;
		z-index: 1;
		max-width: 74%;
		max-height: 74%;
	}

	.game-art.pair img:last-child {
		inset: auto 0 0 auto;
		z-index: 0;
	}

	.game-art[data-game-art='fallback'] {
		border: var(--pksx-border-width) dashed var(--rule);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink-mute);
	}

	.missing-mark {
		width: 42%;
		height: 42%;
		border: var(--pksx-border-width) solid currentColor;
		border-radius: 50%;
		opacity: 0.5;
	}
</style>
