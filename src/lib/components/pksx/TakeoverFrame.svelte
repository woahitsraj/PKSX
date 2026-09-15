<script lang="ts">
	import type { Snippet } from 'svelte';
	import { layerFade, panelSettle } from '$lib/pksx/motion';

	interface Props {
		labelledby: string;
		describedby?: string;
		busy?: boolean;
		variant?: 'takeover' | 'command';
		commandRows?: number;
		onBack: () => void;
		children: Snippet;
	}

	let {
		labelledby,
		describedby,
		busy = false,
		variant = 'takeover',
		commandRows = 1,
		onBack,
		children
	}: Props = $props();

	const fade = layerFade('.takeover-backdrop');
	const settle = panelSettle(
		'.takeover-backdrop',
		(node) => getComputedStyle(node).getPropertyValue('--pksx-height-band').trim() === 'tall'
	);

	function handleBackdrop(event: MouseEvent) {
		if (!(event.target instanceof Element) || !event.target.closest('.takeover-frame')) onBack();
	}
</script>

<div
	class="takeover-backdrop"
	role="presentation"
	onclick={handleBackdrop}
	in:fade|global
	out:fade|global
>
	<div class="takeover-safe-canvas" class:command={variant === 'command'}>
		<div
			class="takeover-frame pksx-density-container"
			class:command={variant === 'command'}
			style:--pksx-command-rows={Math.max(1, commandRows)}
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledby}
			aria-describedby={describedby}
			aria-busy={busy}
			in:settle|global
			out:settle|global
		>
			<div class="takeover-content pksx-density" class:command={variant === 'command'}>
				{@render children()}
			</div>
		</div>
	</div>
</div>

<style>
	.takeover-backdrop {
		position: fixed;
		z-index: 700;
		inset: 0;
		contain: strict;
		overflow: hidden;
		padding: var(--pksx-safe-area-top) var(--pksx-safe-area-right) var(--pksx-safe-area-bottom)
			var(--pksx-safe-area-left);
		background: color-mix(in oklch, var(--pksx-color-text-primary) 48%, transparent);
	}

	.takeover-safe-canvas {
		container: pksx-takeover / size;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		overflow: hidden;
	}

	.takeover-frame {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: visible;
		contain: layout paint;
	}

	.takeover-safe-canvas.command {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: clamp(var(--pksx-space-2), 8vh, 72px) var(--pksx-space-2) var(--pksx-space-2);
	}

	.takeover-frame.command {
		width: min(680px, 100%);
		height: calc(62px + min(calc(var(--pksx-command-rows) * 32px), 55dvh));
		contain: none;
	}

	.takeover-content {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--pksx-color-surface-panel);
		color: var(--pksx-color-text-primary);
		box-shadow:
			inset 0 0 0 1px var(--pksx-color-border-strong),
			var(--pksx-shadow-panel);
	}

	.takeover-content.command {
		height: 100%;
		border-radius: var(--pksx-radius-large);
	}

	@container pksx-takeover style(--pksx-height-band: tall) {
		.takeover-frame:not(.command) {
			width: min(760px, 100%);
			height: min(560px, 100%);
		}

		.takeover-content {
			border-radius: var(--pksx-radius-large);
		}
	}
</style>
