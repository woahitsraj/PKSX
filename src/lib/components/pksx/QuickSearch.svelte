<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { QuickSearchSaveFile } from '$lib/pksx/quick-search/host.svelte';
	import { filterQuickSearchResults, type QuickSearchResult } from '$lib/pksx/quick-search';
	import { isControllerKeyboardEvent } from '$lib/pksx/controller-input';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		saveFile: QuickSearchSaveFile;
		onSelect: (result: QuickSearchResult) => Promise<boolean>;
		onClose: () => void;
	}

	let { saveFile, onSelect, onClose }: Props = $props();
	let query = $state('');
	let results = $state<QuickSearchResult[]>([]);
	let loading = $state(true);
	let unavailable = $state(false);
	let error = $state(false);
	let selectedResultId = $state<string | null>(null);
	let input: HTMLInputElement | undefined;
	let availabilityRequest = 0;
	const matches = $derived(filterQuickSearchResults(results, query));
	const activeResultId = $derived(selectedResultId ?? matches[0]?.id ?? null);
	const selectedIndex = $derived(matches.findIndex(({ id }) => id === selectedResultId));

	onMount(() => {
		void load();
	});

	async function load() {
		loading = true;
		try {
			if (!(await saveFile.isAvailable())) {
				unavailable = true;
				return;
			}
			results = await saveFile.loadResults();
		} catch {
			error = true;
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
		if (!(await saveFile.isAvailable()) && request === availabilityRequest) unavailable = true;
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

		const navigationKeys = isControllerKeyboardEvent(event)
			? ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']
			: ['ArrowUp', 'ArrowDown', 'Enter'];
		if (!navigationKeys.includes(event.key)) return;
		event.preventDefault();

		if (event.key === 'Enter') {
			const result = matches.find(({ id }) => id === activeResultId);
			if (result) void selectResult(result);
			return;
		}

		if (matches.length === 0) {
			input?.focus();
			return;
		}
		const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
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
	variant="command"
	commandRows={matches.length}
	onBack={onClose}
>
	<div class="quick-search">
		<h2 id="quick-search-title" class="visually-hidden">Search Active Save File</h2>
		<p id="quick-search-description" class="visually-hidden">
			Find a Pokemon by species, nickname, or location.
		</p>

		<div class="search-row">
			<input
				{@attach searchInput}
				type="search"
				aria-label="Search Active Save File"
				aria-activedescendant={activeResultId ? `quick-search-result-${activeResultId}` : undefined}
				placeholder="Species, nickname, or location"
				value={query}
				onfocus={() => (selectedResultId = null)}
				oninput={handleInput}
			/>
			<button
				type="button"
				class="close-search"
				data-pksx-control-category="small"
				data-controller-back
				aria-label="Close Search"
				onclick={onClose}>Esc</button
			>
		</div>

		<div class="results" aria-live="polite">
			{#if loading}
				<p class="state">Reading Active Save File...</p>
			{:else if unavailable}
				<p class="state">The Active Save File is no longer available.</p>
			{:else if error}
				<p class="state">Search could not read the Active Save File.</p>
			{:else if results.length === 0}
				<p class="state">The Active Save File has no Pokemon to search.</p>
			{:else if query.trim().length === 0}
				<p class="state">Search by species, nickname, or location.</p>
			{:else if matches.length === 0}
				<p class="state">No Pokemon match "{query.trim()}".</p>
			{:else}
				<div class="result-list" role="list" aria-label="Search results">
					{#each matches as result (result.id)}
						<button
							id={`quick-search-result-${result.id}`}
							type="button"
							class:active={activeResultId === result.id}
							aria-label={`${result.nickname}, ${result.speciesName}, ${result.locationLabel}, ${result.saveFileName}`}
							onfocus={() => (selectedResultId = result.id)}
							onclick={() => void selectResult(result)}
						>
							<span class="identity">
								<strong>{result.nickname}</strong>
								{#if result.speciesName !== result.nickname}<small>{result.speciesName}</small>{/if}
							</span>
							<span class="location">{result.locationLabel}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<footer>
			<span><strong>Active Save File</strong> · {saveFile.fileName}</span>
			<span class="hints"><kbd>↑↓</kbd> Navigate <kbd>↵</kbd> Open</span>
		</footer>
	</div>
</TakeoverFrame>

<style>
	.quick-search {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2);
		border-bottom: var(--pksx-border-width) solid var(--pksx-color-border-strong);
	}

	input {
		min-width: 0;
		min-height: var(--pksx-control-height);
		flex: 1;
		padding: 0 var(--pksx-space-2);
		border: 0;
		background: transparent;
		color: var(--pksx-color-text-primary);
		font-family: var(--pksx-font-sans);
		font-size: var(--pksx-type-editable);
		outline: none;
	}

	input::placeholder {
		color: var(--pksx-color-text-secondary);
	}

	.close-search {
		min-width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		padding: 0 var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-secondary);
		font: 700 var(--pksx-type-caption) / 1 var(--pksx-font-mono);
		cursor: pointer;
	}

	.close-search:hover,
	.close-search:focus-visible {
		border-color: var(--pksx-color-accent-primary);
		color: var(--pksx-color-text-primary);
		outline: none;
	}

	.results,
	.result-list {
		min-height: 0;
	}

	.results {
		max-height: min(420px, 55dvh);
		overflow: hidden;
	}

	.result-list {
		height: auto;
		max-height: inherit;
		overflow-y: auto;
	}

	.result-list button {
		width: 100%;
		min-height: var(--pksx-control-height);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border: 0;
		border-bottom: var(--pksx-border-width) solid var(--pksx-color-border-subtle);
		background: transparent;
		color: var(--pksx-color-text-primary);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.result-list button:hover,
	.result-list button:focus-visible,
	.result-list button.active {
		background: var(--pksx-color-accent-wash);
		outline: none;
	}

	.identity {
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--pksx-space-2);
	}

	.identity strong,
	.identity small,
	.location,
	footer span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.identity strong {
		font-size: var(--pksx-type-label);
	}

	.identity small,
	.location,
	.state,
	footer {
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-caption);
		line-height: 1.25;
	}

	.location {
		text-align: right;
	}

	.state {
		margin: 0;
		padding: var(--pksx-space-4) var(--pksx-space-3);
		text-align: center;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border-top: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		background: var(--pksx-color-surface-subtle);
	}

	footer strong {
		color: var(--pksx-color-text-primary);
	}

	.hints {
		flex: none;
	}

	kbd {
		font: inherit;
		color: var(--pksx-color-text-primary);
	}

	@container pksx-takeover (max-width: 480px) {
		.hints {
			display: none;
		}
	}
</style>
