<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { QuickSearchCollection } from '$lib/pksx/quick-search/host.svelte';
	import { filterQuickSearchResults, type QuickSearchResult } from '$lib/pksx/quick-search';
	import { isControllerKeyboardEvent } from '$lib/pksx/controller-input';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		collection: QuickSearchCollection;
		onSelect: (result: QuickSearchResult) => Promise<boolean>;
		onClose: () => void;
	}

	let { collection, onSelect, onClose }: Props = $props();
	let query = $state('');
	let results = $state<QuickSearchResult[]>([]);
	let loading = $state(true);
	let unavailable = $state(false);
	let error = $state<string | null>(null);
	let selectedResultId = $state<string | null>(null);
	let input: HTMLInputElement | undefined;
	let availabilityRequest = 0;
	const matches = $derived(filterQuickSearchResults(results, query));
	const selectedIndex = $derived(matches.findIndex(({ id }) => id === selectedResultId));

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		try {
			if (!(await collection.isAvailable())) {
				unavailable = true;
				return;
			}
			results = await collection.loadResults();
		} catch (cause) {
			error =
				cause instanceof Error ? cause.message : 'Quick Search could not read this collection.';
		} finally {
			loading = false;
			await tick();
			input?.focus();
		}
	}

	async function handleInput(event: Event) {
		query = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
		selectedResultId = null;
		const request = ++availabilityRequest;
		if (!(await collection.isAvailable()) && request === availabilityRequest) unavailable = true;
	}

	async function selectResult(result: QuickSearchResult) {
		if (!(await onSelect(result))) unavailable = true;
	}

	function searchInput(node: HTMLInputElement) {
		input = node;
		return () => {
			if (input === node) input = undefined;
		};
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}

		if (!isControllerKeyboardEvent(event)) return;
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
		event.preventDefault();

		if (event.key === 'Enter') {
			const result = matches.find(({ id }) => id === selectedResultId);
			if (result) void selectResult(result);
			return;
		}

		const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
		if (matches.length === 0) {
			input?.focus();
			return;
		}
		const nextIndex = Math.max(-1, Math.min(matches.length - 1, selectedIndex + offset));
		if (nextIndex < 0) input?.focus();
		else document.getElementById(`quick-search-result-${matches[nextIndex]?.id}`)?.focus();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<TakeoverFrame
	labelledby="quick-search-title"
	describedby="quick-search-description"
	busy={loading}
	onBack={onClose}
>
	<div class="quick-search">
		<header>
			<div>
				<p>Focused collection</p>
				<h2 id="quick-search-title">Quick Search</h2>
			</div>
			<button
				type="button"
				class="close-search"
				data-pksx-control-category="small"
				data-controller-back
				aria-label="Close Quick Search"
				onclick={onClose}>×</button
			>
		</header>

		<p id="quick-search-description" class="collection-label">{collection.label}</p>
		<input
			{@attach searchInput}
			type="search"
			aria-label={`Search ${collection.label}`}
			placeholder="Species, nickname, or Location"
			value={query}
			oninput={handleInput}
		/>

		<div class="results" aria-live="polite">
			{#if loading}
				<p class="state">Reading {collection.label}...</p>
			{:else if unavailable}
				<p class="state">{collection.label} is no longer available.</p>
			{:else if error}
				<p class="state">{error}</p>
			{:else if results.length === 0}
				<p class="state">{collection.label} has no Pokemon to search.</p>
			{:else if query.trim().length === 0}
				<p class="state">Type a species, nickname, or Location.</p>
			{:else if matches.length === 0}
				<p class="state">No Pokemon match "{query.trim()}".</p>
			{:else}
				<div class="result-list" role="list" aria-label="Quick Search results">
					{#each matches as result (result.id)}
						<button
							id={`quick-search-result-${result.id}`}
							type="button"
							class:controller-focused={selectedResultId === result.id}
							aria-label={`${result.nickname} ${result.speciesName} ${result.collectionLabel} ${result.locationLabel}`}
							onfocus={() => (selectedResultId = result.id)}
							onclick={() => void selectResult(result)}
						>
							<span class="identity">
								<strong>{result.nickname}</strong>
								{#if result.speciesName !== result.nickname}<small>{result.speciesName}</small>{/if}
							</span>
							<span class="location">
								<strong>{result.collectionLabel}</strong>
								<small>{result.locationLabel}</small>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</TakeoverFrame>

<style>
	.quick-search {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-3);
	}

	header div {
		display: grid;
		gap: var(--pksx-space-1);
	}

	header p,
	header h2,
	.collection-label,
	.state {
		margin: 0;
	}

	header p {
		color: var(--pksx-color-accent-primary);
		font: 750 var(--pksx-type-caption) / 1 var(--pksx-font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	header h2 {
		font-size: var(--pksx-type-display);
		line-height: 1;
	}

	.close-search {
		width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		padding: 0;
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: 50%;
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font: inherit;
		cursor: pointer;
	}

	.collection-label {
		color: var(--pksx-color-text-secondary);
		font: 700 var(--pksx-type-label) / 1 var(--pksx-font-mono);
	}

	input {
		width: 100%;
		min-height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-3);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-medium);
		background: var(--pksx-color-surface-panel);
		color: var(--pksx-color-text-primary);
		font-family: var(--pksx-font-sans);
		font-size: max(16px, var(--pksx-type-editable, 16px));
	}

	.results,
	.result-list {
		min-height: 0;
	}

	.results {
		overflow: hidden;
	}

	.result-list {
		height: 100%;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-1);
		overflow-y: auto;
	}

	.result-list button {
		width: 100%;
		min-height: var(--pksx-control-height);
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.result-list button:hover,
	.result-list button:focus-visible,
	.result-list button.controller-focused {
		border-color: var(--pksx-color-accent-primary);
		background: var(--pksx-color-accent-wash);
		outline: none;
	}

	.identity,
	.location {
		min-width: 0;
		display: grid;
		gap: var(--pksx-space-1);
	}

	.location {
		text-align: right;
	}

	.identity strong,
	.location strong {
		overflow: hidden;
		font-size: var(--pksx-type-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small,
	.state {
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-caption);
		line-height: 1.25;
	}

	.state {
		padding: var(--pksx-space-3);
		border: var(--pksx-border-width) dashed var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-medium);
		text-align: center;
	}
</style>
