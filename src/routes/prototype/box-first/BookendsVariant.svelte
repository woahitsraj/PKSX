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

<section class="variant bookends" aria-label="Variant B, Party and details bookend the Box">
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
	<div class="box-area">
		<SourceHeader boxName="Ancient Ruins" />
		<div class="box-grid" role="grid" aria-label="Box 14, Ancient Ruins">
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
	<PrototypeDetail
		pokemon={selected}
		location={selectedPartyIndex === null
			? `Box 14 · Slot ${selectedIndex + 1}`
			: `Party ${selectedPartyIndex + 1}`}
	/>
</section>

<style>
	.variant {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(54px, 0.38fr) minmax(0, 2.35fr) minmax(154px, 1fr);
		gap: 4px;
	}

	.party-zone,
	.party-grid,
	.box-area,
	.box-grid {
		min-width: 0;
		min-height: 0;
	}

	.party-zone {
		display: grid;
		grid-template-rows: 20px minmax(0, 1fr);
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--rule);
		border-radius: 9px;
		background: var(--paper-hi);
	}

	.party-zone > strong {
		color: var(--ink-soft);
		font-size: 8px;
		line-height: 20px;
		text-align: center;
	}

	.party-grid {
		display: grid;
		grid-template-rows: repeat(6, minmax(0, 1fr));
		gap: 2px;
	}

	.box-area {
		display: grid;
		grid-template-rows: 24px minmax(0, 1fr);
		gap: 2px;
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(0, 1fr));
		gap: 2px;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-columns: 52px minmax(0, 1fr);
			grid-template-rows: minmax(0, 1.65fr) minmax(0, 1fr);
		}

		.party-zone {
			grid-column: 1;
			grid-row: 1;
		}

		.box-area {
			grid-column: 2;
			grid-row: 1;
		}

		.variant > :global(.detail) {
			grid-column: 1 / 3;
			grid-row: 2;
		}
	}
</style>
