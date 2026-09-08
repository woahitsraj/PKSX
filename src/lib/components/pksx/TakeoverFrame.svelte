<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		labelledby: string;
		describedby?: string;
		busy?: boolean;
		onBack: () => void;
		children: Snippet;
	}

	let { labelledby, describedby, busy = false, onBack, children }: Props = $props();

	function handleBackdrop(event: MouseEvent) {
		if (!(event.target instanceof Element) || !event.target.closest('.takeover-frame')) onBack();
	}
</script>

<div class="takeover-backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="takeover-safe-canvas pksx-density-container">
		<div
			class="takeover-frame pksx-density"
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledby}
			aria-describedby={describedby}
			aria-busy={busy}
		>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.takeover-backdrop {
		position: fixed;
		z-index: 700;
		inset: 0;
		padding: var(--pksx-safe-area-top) var(--pksx-safe-area-right)
			var(--pksx-safe-area-bottom) var(--pksx-safe-area-left);
		background: color-mix(in oklch, var(--pksx-color-text-primary) 48%, transparent);
	}

	.takeover-safe-canvas {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
	}

	.takeover-frame {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 1px solid var(--pksx-color-border-strong);
		background: var(--pksx-color-surface-panel);
		color: var(--pksx-color-text-primary);
		box-shadow: var(--pksx-shadow-panel);
	}

	@container style(--pksx-height-band: tall) {
		.takeover-safe-canvas {
			place-items: center;
		}

		.takeover-frame {
			width: min(760px, 100%);
			height: min(560px, 100%);
			border-radius: var(--pksx-radius-large);
		}
	}
</style>
