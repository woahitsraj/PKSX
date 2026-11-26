<script lang="ts">
	import type { ControllerGuideHint } from '$lib/pksx/controller-guide';

	let { hints }: { hints: ControllerGuideHint[] } = $props();
	let height = $state(0);

	$effect(() => {
		const root = document.documentElement.style;
		root.setProperty('--pksx-controller-guide-space', `${height}px`);
		return () => root.removeProperty('--pksx-controller-guide-space');
	});
</script>

<aside class="controller-guide" aria-label="Controller guide" bind:offsetHeight={height}>
	<ul>
		{#each hints as hint (hint.button + hint.action)}
			<li><kbd>{hint.button}</kbd><span>{hint.action}</span></li>
		{/each}
	</ul>
</aside>

<style>
	.controller-guide {
		position: fixed;
		z-index: 800;
		right: 0;
		bottom: 0;
		left: 0;
		padding: var(--pksx-space-1, 4px) calc(var(--pksx-safe-area-right) + var(--pksx-space-2, 8px))
			calc(var(--pksx-device-safe-area-bottom) + var(--pksx-space-1, 4px))
			calc(var(--pksx-safe-area-left) + var(--pksx-space-2, 8px));
		border-top: var(--pksx-border-width, 1px) solid var(--pksx-color-border-strong);
		background: var(--pksx-color-surface-panel);
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-label);
		line-height: 1.3;
		pointer-events: none;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--pksx-space-1, 4px) var(--pksx-space-3, 12px);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-1, 4px);
		white-space: nowrap;
	}

	kbd {
		padding: 0 5px;
		border: var(--pksx-border-width, 1px) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-xs);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font-family: inherit;
		font-weight: 650;
	}
</style>
