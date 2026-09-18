<script lang="ts">
	import type { BoxPickerLocation } from '$lib/pksx/box-picker';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		collection: string;
		locations: BoxPickerLocation[];
		activeLocationId: string;
		activeIndex: number;
		boxNameUnavailableReason?: string | null;
		onFocusLocation: (index: number) => void;
		onSelectLocation: (location: BoxPickerLocation) => void;
		onColumnCountChange: (columnCount: number) => void;
		onClose: () => void;
	}

	let {
		collection,
		locations,
		activeLocationId,
		activeIndex,
		boxNameUnavailableReason = null,
		onFocusLocation,
		onSelectLocation,
		onColumnCountChange,
		onClose
	}: Props = $props();

	function measureColumns(node: HTMLElement) {
		const report = () => {
			const columnCount = getComputedStyle(node)
				.gridTemplateColumns.split(' ')
				.filter(Boolean).length;
			onColumnCountChange(Math.max(1, columnCount));
		};
		const observer = new ResizeObserver(report);
		observer.observe(node);
		report();
		return () => observer.disconnect();
	}
</script>

<TakeoverFrame labelledby="box-picker-title" onBack={onClose}>
	<div class="box-picker">
		<header>
			<div>
				<h2 id="box-picker-title">Choose a Box</h2>
				<p>{collection}</p>
				{#if boxNameUnavailableReason}
					<p class="box-name-unavailable" role="note">{boxNameUnavailableReason}</p>
				{/if}
			</div>
			<button
				type="button"
				data-pksx-control-category="icon-only"
				aria-label="Close Box Picker"
				onclick={onClose}>×</button
			>
		</header>

		<div class="box-picker-grid" aria-label={`${collection} Boxes`} {@attach measureColumns}>
			{#each locations as location, index (location.id)}
				{@const numericLabel =
					location.location.kind === 'physical-box'
						? `Box ${String(location.location.box + 1).padStart(2, '0')}`
						: location.label}
				<button
					id={`box-picker-location-${index}`}
					type="button"
					data-pksx-control-category="card"
					class:controller-focused={activeIndex === index}
					aria-label={`${numericLabel}: ${location.label}, ${location.detail}`}
					aria-current={location.id === activeLocationId ? 'true' : undefined}
					onfocus={() => onFocusLocation(index)}
					onclick={() => onSelectLocation(location)}
				>
					<strong>{location.label}</strong>
					<span>{location.detail}</span>
				</button>
			{/each}
		</div>
	</div>
</TakeoverFrame>

<style>
	.box-picker {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-3);
		overflow: hidden;
		color: var(--ink);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	header div {
		display: grid;
		gap: var(--pksx-border-width);
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--pksx-type-title);
	}

	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
	}

	.box-name-unavailable {
		font-size: var(--pksx-type-caption);
	}

	header button {
		width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}

	.box-picker-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		align-content: start;
		gap: var(--pksx-space-2);
		overflow: auto;
	}

	.box-picker-grid button {
		min-height: 76px;
		display: grid;
		place-content: center;
		gap: var(--pksx-space-1);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink);
		font: inherit;
		text-align: center;
		cursor: pointer;
	}

	.box-picker-grid button:hover,
	.box-picker-grid button:focus-visible,
	.box-picker-grid button.controller-focused {
		border-color: color-mix(in srgb, var(--rust), transparent 55%);
		background: var(--rust-wash);
		color: var(--rust);
		outline: none;
	}

	.box-picker-grid button[aria-current='true'] {
		box-shadow: inset 0 0 0 2px var(--rust);
	}

	.box-picker-grid strong {
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	.box-picker-grid span {
		color: var(--ink-soft);
		font: 650 var(--pksx-type-caption) / 1 var(--pksx-font-mono);
	}
</style>
