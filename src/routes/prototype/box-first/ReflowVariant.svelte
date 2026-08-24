<script lang="ts">
	import PrototypeDetail from './PrototypeDetail.svelte';
	import PrototypeSlot from './PrototypeSlot.svelte';
	import SourceHeader from './SourceHeader.svelte';
	import { gameLocations, type PrototypePokemon } from './prototype-data';

	let activeLocation = $state('box-14');
	let selectedIndex = $state(14);
	const currentLocation = $derived(
		gameLocations.find((location) => location.key === activeLocation) ?? gameLocations[0]
	);
	const selected = $derived(currentLocation.slots[selectedIndex] ?? null);
	const quickLocations = gameLocations.map((location) => ({
		key: location.key,
		label: location.shortLabel
	}));

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

<section class="variant reflow" aria-label="Variant C, wide box with a detail dock">
	<SourceHeader
		boxNumber={currentLocation.number}
		boxName={currentLocation.name}
		{quickLocations}
		{activeLocation}
		onPrevious={() => cycleLocation(-1)}
		onNext={() => cycleLocation(1)}
		onLocationChange={changeLocation}
	/>
	<div
		class="box-grid"
		class:party-view={currentLocation.number === null}
		role="grid"
		aria-label={currentLocation.number === null
			? 'Party'
			: `Box ${currentLocation.number}, ${currentLocation.name}`}
	>
		{#each currentLocation.slots as entry, index (index)}
			<PrototypeSlot
				{entry}
				{index}
				party={currentLocation.number === null}
				active={selectedIndex === index}
				onSelect={select}
			/>
		{/each}
	</div>
	<PrototypeDetail
		pokemon={selected}
		location={currentLocation.number === null
			? `Party · Slot ${selectedIndex + 1}`
			: `Box ${currentLocation.number} · Slot ${selectedIndex + 1}`}
		compact
	/>
</section>

<style>
	.variant {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: 44px minmax(0, 1fr) minmax(66px, 0.3fr);
		gap: 4px;
	}

	.box-grid {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 2px;
	}

	.box-grid.party-view {
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: 1fr;
		padding: 20px 34px;
	}

	@container stage (max-aspect-ratio: 1 / 1) {
		.variant {
			grid-template-rows: 44px minmax(0, 1fr) minmax(82px, 0.24fr);
		}

		.box-grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			grid-template-rows: repeat(6, minmax(0, 1fr));
		}

		.box-grid.party-view {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-rows: repeat(2, minmax(0, 1fr));
			padding: 14px 28px;
		}
	}
</style>
