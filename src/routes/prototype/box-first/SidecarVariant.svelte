<script lang="ts">
	import PrototypeDetail from './PrototypeDetail.svelte';
	import PrototypeSlot from './PrototypeSlot.svelte';
	import SourceHeader from './SourceHeader.svelte';
	import { boxSlots, initialPokemon, party, type PrototypePokemon } from './prototype-data';

	let selected = $state<PrototypePokemon | null>(initialPokemon);
	let selectedIndex = $state(14);

	function select(entry: PrototypePokemon | null, index: number) {
		selected = entry;
		selectedIndex = index;
	}
</script>

<section class="variant sidecar" aria-label="Variant A, Party inside the detail sidecar">
	<div class="box-area">
		<div class="box-grid" role="grid" aria-label="Box 14, Sky Pillar">
			{#each boxSlots as entry, index (index)}
				<PrototypeSlot {entry} {index} active={selectedIndex === index} onSelect={select} />
			{/each}
		</div>
	</div>
	<aside class="sidecar-rail">
		<SourceHeader />
		<section class="party-zone" aria-label="Party">
			<strong>Party</strong>
			<div class="party-grid" role="grid">
				{#each party as entry, index (entry.name)}
					<PrototypeSlot {entry} {index} party active={selected === entry} onSelect={select} />
				{/each}
			</div>
		</section>
		<PrototypeDetail
			pokemon={selected}
			location={selectedIndex < 6 && party[selectedIndex] === selected
				? `Party ${selectedIndex + 1}`
				: `Box 14 · Slot ${selectedIndex + 1}`}
		/>
	</aside>
</section>

<style>
	.variant {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 2.85fr) minmax(154px, 1fr);
		gap: 4px;
	}

	.box-area,
	.sidecar-rail,
	.party-zone,
	.box-grid,
	.party-grid {
		min-width: 0;
		min-height: 0;
	}

	.box-area {
		display: block;
	}

	.box-grid {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(0, 1fr));
		gap: 2px;
	}

	.sidecar-rail {
		display: grid;
		grid-template-rows: 24px minmax(76px, 0.72fr) minmax(0, 1.28fr);
		gap: 4px;
	}

	.party-zone {
		display: grid;
		grid-template-rows: 14px minmax(0, 1fr);
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--rule);
		border-radius: 9px;
		background: var(--paper-hi);
	}

	.party-zone > strong {
		padding-left: 2px;
		color: var(--ink-soft);
		font-size: 8px;
		line-height: 14px;
	}

	.party-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: 2px;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1.55fr) minmax(0, 1fr);
		}

		.sidecar-rail {
			grid-template-rows: 24px minmax(54px, 0.42fr) minmax(0, 1fr);
		}

		.party-zone {
			grid-template-columns: 38px minmax(0, 1fr);
			grid-template-rows: 1fr;
			align-items: stretch;
		}

		.party-zone > strong {
			display: grid;
			place-items: center;
		}

		.party-grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
			grid-template-rows: 1fr;
		}
	}
</style>
