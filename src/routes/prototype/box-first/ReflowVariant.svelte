<script lang="ts">
	import PrototypeDetail from './PrototypeDetail.svelte';
	import PrototypeSlot from './PrototypeSlot.svelte';
	import SourceHeader from './SourceHeader.svelte';
	import { boxSlots, initialPokemon, party, type PrototypePokemon } from './prototype-data';

	let selected = $state<PrototypePokemon | null>(initialPokemon);
	let selectedIndex = $state(14);
	let selectedPartyIndex = $state<number | null>(null);

	function selectBox(entry: PrototypePokemon | null, index: number) {
		selected = entry;
		selectedIndex = index;
		selectedPartyIndex = null;
	}

	function selectParty(entry: PrototypePokemon | null, index: number) {
		selected = entry;
		selectedPartyIndex = index;
	}
</script>

<section class="variant reflow" aria-label="Variant C, Box grid reflows around a shared deck">
	<div class="top-deck">
		<section class="party-zone" aria-label="Party">
			<strong>Party</strong>
			<div class="party-grid" role="grid">
				{#each party as entry, index (entry.name)}
					<PrototypeSlot
						{entry}
						{index}
						party
						active={selectedPartyIndex === index}
						onSelect={selectParty}
					/>
				{/each}
			</div>
		</section>
		<PrototypeDetail
			pokemon={selected}
			location={selectedPartyIndex === null
				? `Box 14 · Slot ${selectedIndex + 1}`
				: `Party ${selectedPartyIndex + 1}`}
			compact
		/>
	</div>
	<div class="box-area">
		<SourceHeader boxName="Route 119" />
		<div class="box-grid" role="grid" aria-label="Box 14, Route 119">
			{#each boxSlots as entry, index (index)}
				<PrototypeSlot
					{entry}
					{index}
					active={selectedPartyIndex === null && selectedIndex === index}
					onSelect={selectBox}
				/>
			{/each}
		</div>
	</div>
</section>

<style>
	.variant {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: minmax(70px, 0.56fr) minmax(0, 1.44fr);
		gap: 4px;
	}

	.top-deck,
	.party-zone,
	.party-grid,
	.box-area,
	.box-grid {
		min-width: 0;
		min-height: 0;
	}

	.top-deck {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(170px, 1fr);
		gap: 4px;
	}

	.party-zone {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--rule);
		border-radius: 9px;
		background: var(--paper-hi);
	}

	.party-zone > strong {
		display: grid;
		place-items: center;
		color: var(--ink-soft);
		font-size: 8px;
	}

	.party-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 2px;
	}

	.box-area {
		display: grid;
		grid-template-rows: 24px minmax(0, 1fr);
		gap: 2px;
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 2px;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-rows: minmax(146px, 30%) minmax(0, 1fr);
		}

		.top-deck {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(54px, 0.65fr) minmax(76px, 1fr);
		}

		.box-grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			grid-template-rows: repeat(6, minmax(0, 1fr));
		}
	}
</style>
