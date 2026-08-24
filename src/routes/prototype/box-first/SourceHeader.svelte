<script lang="ts">
	interface QuickLocation {
		key: string;
		label: string;
	}

	interface Props {
		sourceTag?: string;
		sourceName?: string;
		boxNumber?: number | null;
		boxName?: string;
		quickLocations?: QuickLocation[];
		activeLocation?: string;
		stacked?: boolean;
		onPrevious?: () => void;
		onNext?: () => void;
		onLocationChange?: (key: string) => void;
	}

	let {
		sourceTag = 'SAVE',
		sourceName = 'Emerald.sav',
		boxNumber = 14,
		boxName = 'Sky Pillar',
		quickLocations = [],
		activeLocation = '',
		stacked = false,
		onPrevious = () => {},
		onNext = () => {},
		onLocationChange = () => {}
	}: Props = $props();
</script>

<div class:stacked class="location-header">
	<header class="source-header">
		<button type="button" class="source-chip" aria-label={`Open location menu for ${sourceName}`}>
			<span>{sourceTag}</span><strong>{sourceName}</strong><i aria-hidden="true">▾</i>
		</button>
		<button type="button" class="box-arrow" aria-label="Previous location" onclick={onPrevious}
			>‹</button
		>
		<strong class="box-name">{boxNumber === null ? boxName : `${boxNumber} · ${boxName}`}</strong>
		<button type="button" class="box-arrow" aria-label="Next location" onclick={onNext}>›</button>
	</header>
	{#if quickLocations.length}
		<nav class="quick-locations" aria-label="Quick location switcher">
			{#each quickLocations as location (location.key)}
				<button
					type="button"
					class:active={activeLocation === location.key}
					aria-pressed={activeLocation === location.key}
					onclick={() => onLocationChange(location.key)}>{location.label}</button
				>
			{/each}
		</nav>
	{/if}
</div>

<style>
	.location-header {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.source-header {
		min-width: 0;
		min-height: 20px;
		display: grid;
		grid-template-columns: minmax(0, auto) 22px minmax(0, 1fr) 22px;
		align-items: center;
		gap: 2px;
		overflow: hidden;
	}

	.source-header button {
		border: 0;
		font: inherit;
		cursor: pointer;
	}

	.source-chip {
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 5px;
		border-radius: 6px;
		background: var(--paper-hi);
		box-shadow: inset 0 0 0 1px var(--rule);
		color: var(--ink);
	}

	.source-chip span {
		color: var(--rust);
		font: 800 6px var(--pksx-font-mono);
	}

	.source-chip strong {
		overflow: hidden;
		font-size: clamp(8px, 1.8cqh, 11px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-chip i {
		color: var(--ink-soft);
		font-size: 8px;
		font-style: normal;
	}

	.box-arrow {
		height: 100%;
		border-radius: 5px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1;
	}

	.box-name {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: clamp(8px, 1.8cqh, 11px);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-header button:focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: -1px;
	}

	.quick-locations {
		min-width: 0;
		display: flex;
		gap: 2px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.quick-locations button {
		min-width: 30px;
		height: 18px;
		padding: 0 7px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: var(--paper-hi);
		color: var(--ink-soft);
		font: 700 8px var(--pksx-font-sans);
		cursor: pointer;
	}

	.quick-locations button:first-child {
		min-width: 44px;
	}

	.quick-locations button.active {
		border-color: var(--rust);
		background: var(--rust);
		color: white;
	}

	.location-header.stacked .source-header {
		grid-template-columns: 22px minmax(0, 1fr) 22px;
		grid-template-rows: 24px 28px;
	}

	.location-header.stacked .source-chip {
		grid-column: 1 / 4;
		grid-row: 1;
	}

	.location-header.stacked .source-header > button:nth-of-type(2) {
		grid-column: 1;
		grid-row: 2;
	}

	.location-header.stacked .box-name {
		grid-column: 2;
		grid-row: 2;
		font-size: 10px;
	}

	.location-header.stacked .source-header > button:nth-of-type(3) {
		grid-column: 3;
		grid-row: 2;
	}

	.location-header.stacked .quick-locations button {
		min-width: 22px;
		padding-inline: 3px;
	}

	.location-header.stacked .quick-locations button:first-child {
		min-width: 38px;
	}
</style>
