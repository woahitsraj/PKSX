<script lang="ts">
	import BoxPane from './BoxPane.svelte';
	import PrototypeDetail from './PrototypeDetail.svelte';
	import { gameLocations, type PrototypePokemon } from './prototype-data';

	const source = { tag: 'SAVE', name: 'Emerald.sav' };
	let activeLocation = $state('box-14');
	let selectedIndex = $state(14);
	const currentLocation = $derived(
		gameLocations.find((location) => location.key === activeLocation) ?? gameLocations[0]
	);
	const selected = $derived(currentLocation.slots[selectedIndex] ?? null);

	function select(_entry: PrototypePokemon | null, index: number) {
		selectedIndex = index;
	}

	function changeLocation(key: string) {
		activeLocation = key;
		const location = gameLocations.find((entry) => entry.key === key) ?? gameLocations[0];
		selectedIndex = Math.max(
			0,
			location.slots.findIndex((entry) => entry !== null)
		);
	}

	function cycleLocation(offset: number) {
		const index = gameLocations.findIndex((location) => location.key === activeLocation);
		changeLocation(
			gameLocations[(index + offset + gameLocations.length) % gameLocations.length].key
		);
	}
</script>

<section class="variant single-pane" aria-label="Variant A, single Box pane">
	<BoxPane
		{source}
		location={currentLocation}
		locations={gameLocations}
		{selectedIndex}
		onSelect={select}
		onLocationChange={changeLocation}
		onPrevious={() => cycleLocation(-1)}
		onNext={() => cycleLocation(1)}
	/>
	<aside class="sidecar-rail">
		<span class="rail-label">Selected Pokémon</span>
		<PrototypeDetail
			pokemon={selected}
			location={currentLocation.number === null
				? `Party · Slot ${selectedIndex + 1}`
				: `Box ${currentLocation.number} · Slot ${selectedIndex + 1}`}
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
		grid-template-columns: minmax(0, 2.85fr) minmax(168px, 1fr);
		gap: 4px;
	}

	.sidecar-rail {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: 18px minmax(0, 1fr);
		gap: 3px;
		padding-top: 48px;
	}

	.rail-label {
		padding-left: 3px;
		color: var(--ink-soft);
		font: 700 8px/18px var(--pksx-font-sans);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1.55fr) minmax(0, 1fr);
		}

		.sidecar-rail {
			padding-top: 0;
		}
	}
</style>
