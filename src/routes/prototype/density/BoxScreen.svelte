<script lang="ts">
	import Slot from './Slot.svelte';
	import { gameLocations } from '../box-first/prototype-data';

	const location = gameLocations.find((item) => item.key === 'box-14') ?? gameLocations[1];
	let selectedIndex = $state(14);
	const selected = $derived(location.slots[selectedIndex] ?? null);
</script>

<section class="box-screen" aria-label="Boxes">
	<div class="pane">
		<header class="pane-header">
			<button type="button" class="chip source" aria-label="Open Box Menu for Emerald.sav">
				<span class="caption">Save</span><strong>Emerald.sav</strong>
			</button>
			<nav class="locations" aria-label="Nearby locations">
				<button type="button" class="chip">Party</button>
				<button type="button" class="chip">13</button>
				<strong class="current">{location.number} · {location.name}</strong>
				<button type="button" class="chip">15</button>
				<button type="button" class="chip">16</button>
			</nav>
		</header>
		<div class="grid" role="grid" aria-label="Box 14" data-scroll>
			{#each location.slots as entry, index (index)}
				<Slot
					{entry}
					{index}
					active={selectedIndex === index}
					onSelect={(i) => (selectedIndex = i)}
				/>
			{/each}
		</div>
	</div>
	<aside class="rail" aria-label="Active Slot Detail Rail">
		{#if selected}
			<img src={selected.sprite} alt="" width="128" height="128" />
			<div class="identity">
				<span class="caption">Box 14 · Slot {selectedIndex + 1}</span>
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
				<span class="caption">Box 14 · Slot {selectedIndex + 1}</span>
				<strong class="title">Empty Slot</strong>
			</div>
		{/if}
	</aside>
</section>

<style>
	.box-screen {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 2.85fr) minmax(150px, 1fr);
		gap: var(--t-space-1);
		padding: var(--t-space-1);
		box-sizing: border-box;
	}

	.pane,
	.grid,
	.rail {
		min-width: 0;
		min-height: 0;
	}

	.pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--t-space-1);
	}

	.pane-header {
		display: flex;
		align-items: center;
		gap: var(--t-space-1);
		overflow: hidden;
	}

	.source {
		flex: 0 1 auto;
		cursor: pointer;
	}

	.source strong {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.locations {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--t-space-1);
		min-width: 0;
	}

	.locations .chip {
		cursor: pointer;
		color: var(--ink-soft);
	}

	.current {
		font-size: var(--t-label);
		white-space: nowrap;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(var(--t-slot-min), 1fr));
		gap: calc(var(--t-unit) / 2);
		overflow: auto;
	}

	/* The rail refines against its own allocated box: a column when taller than wide, a row when wider. */
	.rail {
		container: rail / size;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto auto;
		gap: var(--t-space-1);
		padding: var(--t-space-2);
		overflow: hidden;
		border: var(--t-border) solid var(--rule);
		border-radius: var(--t-radius-lg);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	.rail img {
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

	.title {
		overflow: hidden;
		font-size: var(--t-title);
		line-height: var(--t-lh-tight);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: var(--t-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stats,
	.moves {
		display: grid;
		gap: 2px;
		align-content: start;
	}

	.stats {
		grid-template-columns: repeat(3, 1fr);
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

	@container (max-aspect-ratio: 1 / 1) {
		.box-screen {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1.55fr) minmax(0, 1fr);
		}
	}

	/* Narrow pane: drop the outer location chips before anything collides. */
	@container (max-width: 440px) {
		.locations .chip:first-child,
		.locations .chip:last-child {
			display: none;
		}
	}

	@container rail (min-aspect-ratio: 1 / 1) {
		.rail {
			grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
			grid-template-rows: auto auto minmax(0, 1fr);
			align-content: center;
		}

		.rail img {
			grid-row: 1 / 4;
		}

		.moves {
			grid-template-columns: 1fr 1fr;
		}
	}

	@container rail (min-aspect-ratio: 1 / 1) and (max-height: 120px) {
		.stats,
		.moves {
			display: none;
		}

		.rail {
			grid-template-rows: 1fr;
		}
	}
</style>
