<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		raw: string;
		width: number;
		height: number;
		band: 'short' | 'tall';
		scale?: number;
		children: Snippet;
	}

	let { label, raw, width, height, band, scale = 1, children }: Props = $props();
</script>

<figure class="canvas" style:width="{width * scale}px">
	<figcaption>
		<strong>{label}</strong>
		{raw} raw · {width}×{height} safe · {band}{scale !== 1 ? ` · ${scale}×` : ''}
	</figcaption>
	<div class="scaler" style:width="{width * scale}px" style:height="{height * scale}px">
		<div
			class="frame"
			data-canvas={label}
			style:width="{width}px"
			style:height="{height}px"
			style:--band={band}
			style:transform={scale !== 1 ? `scale(${scale})` : undefined}
		>
			{@render children()}
		</div>
	</div>
</figure>

<style>
	.canvas {
		flex: none;
		margin: 0;
	}

	figcaption {
		margin-bottom: 4px;
		color: #6b5d4a;
		font: 500 11px/1.3 var(--pksx-font-sans);
	}

	.scaler {
		position: relative;
		overflow: hidden;
	}

	/* The frame is the safe canvas: the size container tokens and refinements measure against. */
	.frame {
		container-type: size;
		position: absolute;
		top: 0;
		left: 0;
		overflow: hidden;
		outline: 1px solid rgba(42, 36, 28, 0.3);
		background: var(--paper);
		transform-origin: top left;
	}
</style>
