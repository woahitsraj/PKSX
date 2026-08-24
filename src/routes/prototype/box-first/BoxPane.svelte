<script lang="ts">
	import PrototypeSlot from './PrototypeSlot.svelte';
	import SourceHeader from './SourceHeader.svelte';
	import type { PrototypeLocation, PrototypePokemon } from './prototype-data';

	interface Source {
		tag: string;
		name: string;
	}

	interface Props {
		source: Source;
		location: PrototypeLocation;
		selectedIndex: number | null;
		onSelect: (entry: PrototypePokemon | null, index: number) => void;
		onPrevious?: () => void;
		onNext?: () => void;
	}

	let {
		source,
		location,
		selectedIndex,
		onSelect,
		onPrevious = () => {},
		onNext = () => {}
	}: Props = $props();
	const isParty = $derived(location.number === null);
</script>

<section class="box-pane" aria-label={`${source.name}, ${location.name}`}>
	<SourceHeader
		sourceTag={source.tag}
		sourceName={source.name}
		boxNumber={location.number}
		boxName={location.name}
		{onPrevious}
		{onNext}
	/>
	<div
		class={['box-grid', isParty && 'party-view']}
		role="grid"
		aria-label={isParty
			? `${source.name}, Party`
			: `${source.name}, Box ${location.number}, ${location.name}`}
	>
		{#each location.slots as entry, index (index)}
			<PrototypeSlot {entry} {index} party={isParty} active={selectedIndex === index} {onSelect} />
		{/each}
	</div>
</section>

<style>
	.box-pane,
	.box-grid {
		min-width: 0;
		min-height: 0;
	}

	.box-pane {
		width: 100%;
		height: 100%;
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

	.box-grid.party-view {
		width: min(100%, 360px);
		height: min(100%, 240px);
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		align-self: center;
		justify-self: center;
	}
</style>
