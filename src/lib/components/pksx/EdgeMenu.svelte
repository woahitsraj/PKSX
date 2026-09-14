<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		easeDrawer,
		layerReplacement,
		reducedMotion,
		type TransitionOptions
	} from '$lib/pksx/motion';

	interface Props {
		label: string;
		onDismiss: () => void;
		children: Snippet;
	}

	let { label, onDismiss, children }: Props = $props();

	const replaced = () => layerReplacement('.edge-menu-layer');
	const duration = (direction: TransitionOptions['direction']) =>
		reducedMotion() ? 120 : direction === 'out' ? 150 : 200;

	function backdropFade(node: Element, _params: undefined, { direction }: TransitionOptions) {
		void node;
		return () =>
			replaced()
				? { duration: 0 }
				: {
						duration: duration(direction),
						easing: easeDrawer,
						css: (t: number) => `opacity: ${t}`
					};
	}

	function sheet(node: Element, _params: undefined, { direction }: TransitionOptions) {
		const axis =
			getComputedStyle(node).getPropertyValue('--edge-menu-axis').trim() === 'x' ? 'X' : 'Y';
		return () => {
			if (replaced()) return { duration: 0 };
			const fade = reducedMotion();
			return {
				duration: duration(direction),
				easing: easeDrawer,
				css: (t: number, u: number) =>
					fade ? `opacity: ${t}` : `transform: translate${axis}(${(u * 100).toFixed(2)}%)`
			};
		};
	}
</script>

<div class="edge-menu-layer">
	<button
		class="edge-menu-backdrop"
		data-pksx-control-category="composition"
		type="button"
		tabindex="-1"
		aria-label={`Dismiss ${label}`}
		onclick={onDismiss}
		in:backdropFade|global
		out:backdropFade|global
	></button>
	<div
		class="edge-menu-panel pksx-density"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		in:sheet|global
		out:sheet|global
	>
		{@render children()}
	</div>
</div>

<style>
	.edge-menu-layer {
		position: fixed;
		z-index: 500;
		inset: var(--pksx-safe-area-top) var(--pksx-safe-area-right) var(--pksx-safe-area-bottom)
			var(--pksx-safe-area-left);
		container-name: pksx-edge-menu pksx-density;
		container-type: size;
		display: grid;
		align-items: end;
		pointer-events: none;
	}

	.edge-menu-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		border-radius: 0;
		background: color-mix(in srgb, var(--ink), transparent 55%);
		box-shadow: none;
		pointer-events: auto;
	}

	.edge-menu-panel {
		--edge-menu-axis: y;
		position: relative;
		z-index: 1;
		width: 100%;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--pksx-radius-large) var(--pksx-radius-large) 0 0;
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
		pointer-events: auto;
	}

	@container pksx-edge-menu (aspect-ratio > 1 / 1) {
		.edge-menu-panel {
			--edge-menu-axis: x;
			width: min(320px, 100%);
			height: 100%;
			justify-self: end;
			border-radius: var(--pksx-radius-large) 0 0 var(--pksx-radius-large);
		}
	}
</style>
