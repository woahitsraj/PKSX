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

<section class="variant sidecar" aria-label="Variant A, single location with quick switching">
	<div class="box-area">
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
	</div>
	<aside class="sidecar-rail">
		<SourceHeader
			boxNumber={currentLocation.number}
			boxName={currentLocation.name}
			{quickLocations}
			{activeLocation}
			stacked
			onPrevious={() => cycleLocation(-1)}
			onNext={() => cycleLocation(1)}
			onLocationChange={changeLocation}
		/>
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

	.box-area,
	.sidecar-rail,
	.box-grid {
		min-width: 0;
		min-height: 0;
	}

	.box-area {
		display: grid;
	}

	.box-grid {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(5, minmax(0, 1fr));
		gap: 2px;
	}

	.box-grid.party-view {
		width: min(100%, 360px);
		height: min(100%, 240px);
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		align-self: center;
		justify-self: center;
	}

	.sidecar-rail {
		display: grid;
		grid-template-rows: 72px 18px minmax(0, 1fr);
		gap: 3px;
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
	}
</style>
