<script lang="ts">
	import PrototypeSlot from './PrototypeSlot.svelte';
	import SourceHeader from './SourceHeader.svelte';
	import { boxSlots, pksxStorageSlots, type PrototypePokemon } from './prototype-data';

	type Side = 'pksx' | 'game';

	let pksxSlots = $state<Array<PrototypePokemon | null>>([...pksxStorageSlots]);
	let gameSlots = $state<Array<PrototypePokemon | null>>([...boxSlots]);
	let selectedSide = $state<Side>('game');
	let selectedIndex = $state(14);
	const selected = $derived(
		(selectedSide === 'pksx' ? pksxSlots : gameSlots)[selectedIndex] ?? null
	);

	function select(side: Side, _entry: PrototypePokemon | null, index: number) {
		selectedSide = side;
		selectedIndex = index;
	}

	function moveTo(targetSide: Side) {
		if (!selected || selectedSide === targetSide) return;
		const source = selectedSide === 'pksx' ? pksxSlots : gameSlots;
		const target = targetSide === 'pksx' ? pksxSlots : gameSlots;
		const targetIndex = target.findIndex((entry) => entry === null);
		if (targetIndex === -1) return;

		target[targetIndex] = source[selectedIndex];
		source[selectedIndex] = null;
		selectedSide = targetSide;
		selectedIndex = targetIndex;
	}
</script>

<section class="variant transfer" aria-label="Variant B, side-by-side storage transfer">
	<section class="storage-pane" aria-label="PKSX storage">
		<SourceHeader sourceTag="PKSX" sourceName="My Storage" boxNumber={3} boxName="Favorites" />
		<div class="box-grid" role="grid" aria-label="PKSX storage, Favorites">
			{#each pksxSlots as entry, index (index)}
				<PrototypeSlot
					{entry}
					{index}
					active={selectedSide === 'pksx' && selectedIndex === index}
					onSelect={(item, slot) => select('pksx', item, slot)}
				/>
			{/each}
		</div>
	</section>

	<aside class="transfer-rail" aria-label="Transfer controls">
		<div class="selection">
			{#if selected}
				<img src={selected.sprite} alt="" width="64" height="64" />
				<strong>{selected.name}</strong>
				<span>{selectedSide === 'pksx' ? 'PKSX storage' : 'Emerald.sav'}</span>
			{:else}
				<strong>Empty slot</strong>
				<span>Select a Pokémon</span>
			{/if}
		</div>
		<button
			type="button"
			class="move-left"
			disabled={!selected || selectedSide === 'pksx'}
			onclick={() => moveTo('pksx')}
		>
			<span aria-hidden="true">←</span> To PKSX
		</button>
		<button
			type="button"
			class="move-right"
			disabled={!selected || selectedSide === 'game'}
			onclick={() => moveTo('game')}
		>
			To game <span aria-hidden="true">→</span>
		</button>
	</aside>

	<section class="storage-pane" aria-label="Emerald save storage">
		<SourceHeader sourceTag="SAVE" sourceName="Emerald.sav" boxNumber={14} boxName="Sky Pillar" />
		<div class="box-grid" role="grid" aria-label="Emerald save, Box 14, Sky Pillar">
			{#each gameSlots as entry, index (index)}
				<PrototypeSlot
					{entry}
					{index}
					active={selectedSide === 'game' && selectedIndex === index}
					onSelect={(item, slot) => select('game', item, slot)}
				/>
			{/each}
		</div>
	</section>
</section>

<style>
	.variant {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 82px minmax(0, 1fr);
		gap: 5px;
	}

	.storage-pane,
	.box-grid,
	.transfer-rail {
		min-width: 0;
		min-height: 0;
	}

	.storage-pane {
		display: grid;
		grid-template-rows: 24px minmax(0, 1fr);
		gap: 3px;
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(0, 1fr));
		gap: 2px;
	}

	.transfer-rail {
		display: grid;
		grid-template-rows: minmax(0, 1fr) 34px 34px;
		align-items: center;
		gap: 4px;
		padding: 4px 4px 38px;
		border: 1px solid var(--rule);
		border-radius: 10px;
		background: var(--paper-deep);
	}

	.selection {
		min-width: 0;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 3px;
		text-align: center;
	}

	.selection img {
		width: min(64px, 90%);
		height: auto;
		image-rendering: pixelated;
	}

	.selection strong {
		max-width: 100%;
		overflow: hidden;
		font-size: 9px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.selection span {
		color: var(--ink-soft);
		font-size: 7px;
	}

	.transfer-rail button {
		min-width: 0;
		height: 34px;
		padding: 3px;
		border: 1px solid var(--rule-hi);
		border-radius: 7px;
		background: var(--paper-hi);
		color: var(--ink);
		font: 700 8px var(--pksx-font-sans);
		cursor: pointer;
	}

	.transfer-rail button:disabled {
		opacity: 0.34;
		cursor: default;
	}

	.transfer-rail button:not(:disabled):focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: 1px;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1fr) 64px minmax(0, 1fr);
		}

		.transfer-rail {
			grid-template-columns: minmax(0, 1fr) 86px 86px;
			grid-template-rows: 1fr;
			padding: 4px;
		}

		.selection {
			grid-template-columns: 42px auto;
			justify-content: start;
			text-align: left;
		}

		.selection img {
			grid-row: 1 / 3;
			width: 42px;
		}
	}
</style>
