<script lang="ts">
	interface LocationOption {
		key: string;
		shortLabel: string;
	}

	interface Props {
		sourceTag: string;
		sourceName: string;
		locationKey: string;
		boxNumber: number | null;
		boxName: string;
		locations: LocationOption[];
		onPrevious: () => void;
		onNext: () => void;
		onLocationChange: (key: string) => void;
	}

	let {
		sourceTag,
		sourceName,
		locationKey,
		boxNumber,
		boxName,
		locations,
		onPrevious,
		onNext,
		onLocationChange
	}: Props = $props();
	const activeIndex = $derived(
		Math.max(
			0,
			locations.findIndex((item) => item.key === locationKey)
		)
	);
	const previousLocations = $derived(
		[-2, -1].map(
			(offset) => locations[(activeIndex + offset + locations.length) % locations.length]
		)
	);
	const nextLocations = $derived(
		[1, 2].map((offset) => locations[(activeIndex + offset) % locations.length])
	);
</script>

<header class="source-header">
	<button type="button" class="source-chip" aria-label={`Open location menu for ${sourceName}`}>
		<span>{sourceTag}</span><strong>{sourceName}</strong><i aria-hidden="true">▾</i>
	</button>
	<nav class="location-strip" aria-label={`Nearby locations in ${sourceName}`}>
		{#each previousLocations as location (location.key)}
			<button
				type="button"
				class="location-chip"
				aria-label={`Open ${location.shortLabel}`}
				onclick={() => onLocationChange(location.key)}>{location.shortLabel}</button
			>
		{/each}
		<button type="button" class="box-arrow" aria-label="Previous location" onclick={onPrevious}
			>‹</button
		>
		<strong class="box-name" aria-current="page"
			>{boxNumber === null ? boxName : `${boxNumber} · ${boxName}`}</strong
		>
		<button type="button" class="box-arrow" aria-label="Next location" onclick={onNext}>›</button>
		{#each nextLocations as location (location.key)}
			<button
				type="button"
				class="location-chip"
				aria-label={`Open ${location.shortLabel}`}
				onclick={() => onLocationChange(location.key)}>{location.shortLabel}</button
			>
		{/each}
	</nav>
</header>

<style>
	.source-header {
		min-width: 0;
		height: 24px;
		display: flex;
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
		min-width: 64px;
		max-width: 88px;
		height: 100%;
		flex: 0 1 88px;
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
		width: 18px;
		height: 20px;
		flex: 0 0 18px;
		border-radius: 5px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font-size: 14px;
		line-height: 1;
	}

	.box-name {
		min-width: 28px;
		flex: 1 1 auto;
		overflow: hidden;
		color: var(--ink-soft);
		font-size: clamp(8px, 1.8cqh, 11px);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.location-strip {
		min-width: 0;
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.location-chip {
		box-sizing: border-box;
		min-width: 18px;
		height: 20px;
		display: grid;
		place-items: center;
		padding: 0 2px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: var(--paper-hi);
		color: var(--ink-soft);
		font: 700 7px var(--pksx-font-sans);
	}

	button.location-chip {
		cursor: pointer;
	}

	.source-header button:focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: -1px;
	}

	@container (max-width: 300px) {
		.location-strip {
			gap: 1px;
		}

		.source-chip {
			min-width: 68px;
			max-width: 70px;
			flex-basis: 70px;
			gap: 2px;
			padding-inline: 3px;
		}

		.source-chip span {
			display: none;
		}

		.source-chip strong,
		.box-name {
			font-size: 8px;
		}

		.source-chip i {
			font-size: 6px;
		}
	}
</style>
