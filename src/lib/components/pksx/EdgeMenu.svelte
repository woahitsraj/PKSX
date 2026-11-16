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

	let dragOffset = $state(0);
	let drag: { startY: number; lastY: number; lastTime: number; velocity: number } | null =
		$state(null);

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
					fade
						? `opacity: ${t}`
						: `transform: translate${axis}(calc(${dragOffset}px + ${(u * 100).toFixed(2)}%))`
			};
		};
	}

	function startDrag(event: PointerEvent) {
		if (event.button !== 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
	}

	function moveDrag(event: PointerEvent) {
		if (!drag) return;
		const elapsed = event.timeStamp - drag.lastTime;
		if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
		drag.lastY = event.clientY;
		drag.lastTime = event.timeStamp;
		dragOffset = Math.max(0, event.clientY - drag.startY);
	}

	function endDrag(event: PointerEvent) {
		if (!drag) return;
		const flung = drag.velocity > 0.5 && event.timeStamp - drag.lastTime < 100;
		drag = null;
		if (
			flung ||
			dragOffset > (event.currentTarget as HTMLElement).parentElement!.offsetHeight * 0.3
		)
			onDismiss();
		else dragOffset = 0;
	}

	function cancelDrag() {
		drag = null;
		dragOffset = 0;
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
		class:dragging={drag !== null}
		style:transform={dragOffset ? `translateY(${dragOffset}px)` : undefined}
		in:sheet|global
		out:sheet|global
	>
		<div
			class="edge-menu-handle"
			aria-hidden="true"
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={endDrag}
			onpointercancel={cancelDrag}
		></div>
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
		inset: calc(0px - var(--pksx-safe-area-top)) calc(0px - var(--pksx-safe-area-right))
			calc(0px - var(--pksx-safe-area-bottom)) calc(0px - var(--pksx-safe-area-left));
		border: 0;
		border-radius: 0;
		background: var(--pksx-color-backdrop);
		box-shadow: none;
		pointer-events: auto;
	}

	.edge-menu-panel {
		--edge-menu-axis: y;
		position: relative;
		z-index: 1;
		max-height: calc(100% + var(--pksx-safe-area-bottom));
		margin: 0 calc(0px - var(--pksx-safe-area-right)) calc(0px - var(--pksx-safe-area-bottom))
			calc(0px - var(--pksx-safe-area-left));
		padding: 0 var(--pksx-safe-area-right) var(--pksx-safe-area-bottom) var(--pksx-safe-area-left);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--pksx-radius-large) var(--pksx-radius-large) 0 0;
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
		pointer-events: auto;
		transition: transform 200ms var(--pksx-ease-drawer);
	}

	.edge-menu-panel.dragging {
		transition: none;
	}

	.edge-menu-handle {
		flex: none;
		display: grid;
		place-items: center;
		height: 20px;
		cursor: grab;
		touch-action: none;
	}

	.edge-menu-handle::before {
		content: '';
		width: 36px;
		height: 5px;
		border-radius: 999px;
		background: var(--rule-hi);
	}

	.dragging .edge-menu-handle {
		cursor: grabbing;
	}

	@container pksx-edge-menu (aspect-ratio > 1 / 1) {
		.edge-menu-panel {
			--edge-menu-axis: x;
			width: calc(min(320px, 100%) + var(--pksx-safe-area-right));
			max-height: none;
			align-self: stretch;
			justify-self: end;
			margin: calc(0px - var(--pksx-safe-area-top)) calc(0px - var(--pksx-safe-area-right))
				calc(0px - var(--pksx-safe-area-bottom)) 0;
			padding: var(--pksx-safe-area-top) var(--pksx-safe-area-right) var(--pksx-safe-area-bottom) 0;
			border-radius: var(--pksx-radius-large) 0 0 var(--pksx-radius-large);
		}

		.edge-menu-handle {
			display: none;
		}
	}
</style>
