<script lang="ts">
	import { gameLocations, pksxStorageSlots } from '../box-first/prototype-data';
	import Slot from '../density/Slot.svelte';

	const leftLocation =
		gameLocations.find((location) => location.key === 'box-14') ?? gameLocations[1];
	const rightLocation = { ...leftLocation, number: 3, name: 'Favorites', slots: pksxStorageSlots };
	let activePane = $state<'left' | 'right'>('left');
	let leftIndex = $state(14);
	let rightIndex = $state(8);
	const selected = $derived(
		activePane === 'left'
			? (leftLocation.slots[leftIndex] ?? null)
			: (rightLocation.slots[rightIndex] ?? null)
	);
	const selectedLocation = $derived(
		activePane === 'left'
			? `Box ${leftLocation.number} · Slot ${leftIndex + 1}`
			: `Box ${rightLocation.number} · Slot ${rightIndex + 1}`
	);
</script>

<section class="workbench" aria-label="Boxes, two Box Panes">
	<section class="pane" class:active={activePane === 'left'} aria-label="Emerald.sav, Box 14">
		<header class="pane-header">
			<button type="button" class="chip source"><span class="caption">Save</span>Emerald.sav</button
			>
			<div class="location">
				<button type="button" class="step" tabindex="-1" aria-label="Previous Location">‹</button>
				<strong>{leftLocation.number} · {leftLocation.name}</strong>
				<button type="button" class="step" tabindex="-1" aria-label="Next Location">›</button>
			</div>
		</header>
		<div class="grid" role="grid" aria-label="Box 14">
			{#each leftLocation.slots as entry, index (index)}
				<Slot
					{entry}
					{index}
					active={activePane === 'left' && leftIndex === index}
					onSelect={(selectedIndex) => {
						activePane = 'left';
						leftIndex = selectedIndex;
					}}
				/>
			{/each}
		</div>
	</section>

	<aside class="summary" aria-label="Active Slot Detail Rail">
		<div class="transfer" aria-label="Pointer transfer controls">
			<button type="button" tabindex="-1" aria-label="Move to left pane">←</button>
			<button type="button" tabindex="-1" aria-label="Move to right pane">→</button>
		</div>
		{#if selected}
			<img src={selected.sprite} alt="" width="128" height="128" />
			<div class="identity">
				<span class="caption">{selectedLocation}</span>
				<strong class="title">{selected.name}</strong>
				<span class="meta">Lv {selected.level} · {selected.types}</span>
			</div>
			<div class="stats">
				<span>HP <b>157</b></span><span>Atk <b>148</b></span><span>Def <b>132</b></span>
			</div>
			<div class="moves">
				{#each selected.moves as move (move)}<span>{move}</span>{/each}
			</div>
		{:else}
			<div class="identity">
				<span class="caption">{selectedLocation}</span><strong class="title">Empty Slot</strong>
			</div>
		{/if}
	</aside>

	<section class="pane" class:active={activePane === 'right'} aria-label="Pokemon Storage, Box 3">
		<header class="pane-header">
			<button type="button" class="chip source"
				><span class="caption">Storage</span>Pokemon Storage</button
			>
			<div class="location">
				<button type="button" class="step" tabindex="-1" aria-label="Previous Location">‹</button>
				<strong>{rightLocation.number} · {rightLocation.name}</strong>
				<button type="button" class="step" tabindex="-1" aria-label="Next Location">›</button>
			</div>
		</header>
		<div class="grid" role="grid" aria-label="Pokemon Storage Box 3">
			{#each rightLocation.slots as entry, index (index)}
				<Slot
					{entry}
					{index}
					active={activePane === 'right' && rightIndex === index}
					onSelect={(selectedIndex) => {
						activePane = 'right';
						rightIndex = selectedIndex;
					}}
				/>
			{/each}
		</div>
	</section>
</section>

<style>
	.workbench {
		width: min(1560px, calc(100% - var(--desktop-gutter) * 2));
		height: min(760px, calc(100% - var(--desktop-gutter) * 2));
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 260px) minmax(0, 1fr);
		gap: var(--t-space-2);
		margin: auto;
		padding: var(--t-space-1);
		box-sizing: border-box;
	}

	.pane,
	.grid,
	.summary {
		min-width: 0;
		min-height: 0;
	}

	.pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--t-space-1);
		padding: var(--t-space-1);
		border: var(--t-border) solid transparent;
		border-radius: var(--t-radius-lg);
	}

	.pane.active {
		border-color: color-mix(in srgb, var(--rust), transparent 58%);
		background: color-mix(in srgb, var(--paper-hi), transparent 45%);
	}

	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--t-space-2);
	}

	.source {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}

	.location {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--t-space-1);
		font-size: var(--t-label);
		white-space: nowrap;
	}

	.step,
	.transfer button {
		border: var(--t-border) solid var(--rule);
		background: var(--paper-hi);
		color: var(--ink-soft);
		cursor: pointer;
	}

	.step {
		width: var(--t-control-sm);
		height: var(--t-control-sm);
		border-radius: 50%;
		font: 800 var(--t-title) / 1 var(--t-mono);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(var(--t-slot-min), 1fr));
		gap: calc(var(--t-unit) / 2);
		overflow: auto;
	}

	.summary {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto auto;
		gap: var(--t-space-2);
		padding: var(--t-space-2);
		overflow: hidden;
		border: var(--t-border) solid var(--rule);
		border-radius: var(--t-radius-lg);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	.transfer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--t-space-1);
	}

	.transfer button {
		height: var(--t-control-sm);
		border-radius: var(--t-radius-sm);
		font: 800 var(--t-body) var(--t-mono);
	}

	.summary img {
		width: 100%;
		height: 100%;
		min-height: 0;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.identity {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.identity .caption {
		color: var(--rust);
	}

	.title,
	.meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		font-size: var(--t-title);
		line-height: var(--t-lh-tight);
	}

	.meta {
		color: var(--ink-soft);
		font-size: var(--t-label);
	}

	.stats,
	.moves {
		display: grid;
		gap: 2px;
	}

	.stats {
		grid-template-columns: repeat(3, 1fr);
	}

	.moves {
		grid-template-columns: 1fr 1fr;
	}

	.stats span,
	.moves span {
		min-width: 0;
		padding: 2px var(--t-space-1);
		overflow: hidden;
		border-radius: var(--t-radius-sm);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font: 650 var(--t-caption) / 1.2 var(--t-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stats b {
		color: var(--ink);
	}
</style>
