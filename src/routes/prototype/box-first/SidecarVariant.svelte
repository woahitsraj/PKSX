<script lang="ts">
	import BoxPane from './BoxPane.svelte';
	import PrototypeDetail from './PrototypeDetail.svelte';
	import { gameLocations, type PrototypePokemon } from './prototype-data';

	const source = { tag: 'SAVE', name: 'Emerald.sav' };
	const quickLocations = gameLocations.map((location) => ({
		key: location.key,
		label: location.shortLabel
	}));
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
		{selectedIndex}
		onSelect={select}
		onPrevious={() => cycleLocation(-1)}
		onNext={() => cycleLocation(1)}
	/>
	<aside class="sidecar-rail">
		<nav class="quick-locations" aria-label="Quick location switcher">
			{#each quickLocations as location (location.key)}
				<button
					type="button"
					class:active={activeLocation === location.key}
					aria-pressed={activeLocation === location.key}
					onclick={() => changeLocation(location.key)}>{location.label}</button
				>
			{/each}
		</nav>
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
		grid-template-rows: 22px 18px minmax(0, 1fr);
		gap: 3px;
		padding-top: 30px;
	}

	.quick-locations {
		min-width: 0;
		display: flex;
		gap: 2px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.quick-locations button {
		min-width: 22px;
		height: 20px;
		padding: 0 3px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: var(--paper-hi);
		color: var(--ink-soft);
		font: 700 8px var(--pksx-font-sans);
		cursor: pointer;
	}

	.quick-locations button:first-child {
		min-width: 38px;
	}

	.quick-locations button.active {
		border-color: var(--rust);
		background: var(--rust);
		color: white;
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
