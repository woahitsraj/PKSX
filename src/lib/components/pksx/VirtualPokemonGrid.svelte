<script lang="ts">
	import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
	import type { VirtualViewPreferences } from '$lib/pksx/pokemon-storage-catalog/virtual-views';
	import { resolveSpriteCatalogEntry } from '$lib/pksx/sprite-catalog';
	import { asset } from '$app/paths';

	type Props = {
		records: PokemonRecord[];
		allRecords: PokemonRecord[];
		preferences: VirtualViewPreferences;
		focusedId: string | null;
		busy: boolean;
		onPreferences: (preferences: VirtualViewPreferences) => void;
		onFocus: (id: string) => void;
		onMoveToUnfiled: (id: string) => void;
		onCarry: (id: string, mode: 'move' | 'copy') => void;
		onColumns: (columns: number) => void;
	};
	let {
		records,
		allRecords,
		preferences,
		focusedId,
		busy,
		onPreferences,
		onFocus,
		onMoveToUnfiled,
		onCarry,
		onColumns
	}: Props = $props();
	let viewport: HTMLDivElement | undefined;
	let scrollTop = $state(0);
	let height = $state(360);
	let width = $state(600);
	const minWidth = 116;
	const gap = 8;
	const rowHeight = 128;
	const columns = $derived(Math.max(1, Math.floor((width + gap) / (minWidth + gap))));
	const rows = $derived(Math.ceil(records.length / columns));
	const startRow = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - 2));
	const endRow = $derived(Math.min(rows, Math.ceil((scrollTop + height) / rowHeight) + 2));
	const visible = $derived(records.slice(startRow * columns, endRow * columns));
	const games = $derived(
		[
			...new Set(
				allRecords
					.map((record) => record.origin.originGame)
					.filter((game): game is string => Boolean(game))
			)
		].sort()
	);
	const modes = ['moved-in', 'copied-in', 'imported', 'transferred-in'];
	function measure(node: HTMLDivElement) {
		viewport = node;
		const observer = new ResizeObserver(() => {
			width = node.clientWidth;
			height = node.clientHeight;
			onColumns(Math.max(1, Math.floor((width + gap) / (minWidth + gap))));
		});
		observer.observe(node);
		width = node.clientWidth;
		height = node.clientHeight;
		return () => {
			observer.disconnect();
			if (viewport === node) viewport = undefined;
		};
	}

	function updateFilters(changes: Partial<VirtualViewPreferences['filters']>) {
		onPreferences({ ...preferences, filters: { ...preferences.filters, ...changes } });
		viewport?.scrollTo({ top: 0 });
	}

	function spriteUrl(record: PokemonRecord) {
		const entry = resolveSpriteCatalogEntry(record.projection.spriteIdentity);
		return entry ? asset(entry.path) : null;
	}
</script>

<div class="virtual-browser">
	<div class="filters" aria-label="Pokemon filters and sort">
		<input
			type="search"
			data-pksx-control-category="composition"
			aria-label="Filter Pokemon"
			placeholder="Species, nickname, trainer"
			value={preferences.filters.query}
			oninput={(event) => updateFilters({ query: event.currentTarget.value })}
		/>
		<select
			data-pksx-control-category="composition"
			aria-label="Sort Pokemon"
			value={preferences.sort}
			onchange={(event) =>
				onPreferences({
					...preferences,
					sort: event.currentTarget.value as VirtualViewPreferences['sort']
				})}
		>
			<option value="recent">Recently added</option>
			<option value="oldest">Oldest first</option>
			<option value="species">Species</option>
			<option value="level">Highest level</option>
		</select>
		<select
			data-pksx-control-category="composition"
			aria-label="Origin game"
			value={preferences.filters.originGame}
			onchange={(event) => updateFilters({ originGame: event.currentTarget.value })}
		>
			<option value="">All games</option>
			{#each games as game (game)}<option value={game}>{game}</option>{/each}
		</select>
		<select
			data-pksx-control-category="composition"
			aria-label="Entry mode"
			value={preferences.filters.entryMode}
			onchange={(event) => updateFilters({ entryMode: event.currentTarget.value })}
		>
			<option value="">All origins</option>
			{#each modes as mode (mode)}<option value={mode}
					>{mode.replace('-in', '').replace('-', ' ')}</option
				>{/each}
		</select>
		<label class="shiny"
			><input
				type="checkbox"
				data-pksx-control-category="composition"
				checked={preferences.filters.shinyOnly}
				onchange={(event) => updateFilters({ shinyOnly: event.currentTarget.checked })}
			/> Shiny</label
		>
	</div>
	<div
		class="viewport"
		{@attach measure}
		role="grid"
		aria-label={preferences.location === 'unfiled' ? 'Unfiled Pokemon' : 'All Pokemon'}
		aria-rowcount={rows}
		aria-colcount={columns}
		onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
	>
		{#if records.length === 0}<p class="empty">No Pokemon match this view.</p>{/if}
		<div class="spacer" style={`--virtual-height: ${rows * rowHeight}px`}>
			<div
				class="cards"
				style:top={`${startRow * rowHeight}px`}
				style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}
			>
				{#each visible as record, offset (record.recordId)}
					{@const index = startRow * columns + offset}
					<div class="card" role="row">
						<button
							data-pksx-control-category="card"
							id={`virtual-record-${record.recordId}`}
							class:focused={focusedId === record.recordId}
							type="button"
							role="gridcell"
							aria-selected={focusedId === record.recordId}
							aria-rowindex={Math.floor(index / columns) + 1}
							aria-colindex={(index % columns) + 1}
							aria-label={`${record.projection.nickname || record.projection.speciesName}, level ${record.projection.level}`}
							onfocus={() => onFocus(record.recordId)}
							onclick={() => onFocus(record.recordId)}
						>
							{#if spriteUrl(record)}<img
									src={spriteUrl(record)!}
									alt=""
									width="64"
									height="64"
								/>{/if}
							<strong>{record.projection.nickname || record.projection.speciesName}</strong>
							<small>Lv {record.projection.level}</small>
						</button>
						{#if record.placement && preferences.location === 'all-pokemon'}
							<button
								class="unfile"
								data-pksx-control-category="composition"
								type="button"
								disabled={busy}
								onclick={() => onMoveToUnfiled(record.recordId)}>Move to Unfiled</button
							>
						{/if}
						<div class="carry-actions">
							<button
								type="button"
								data-pksx-control-category="composition"
								disabled={busy}
								onclick={() => onCarry(record.recordId, 'move')}>Move</button
							>
							<button
								type="button"
								data-pksx-control-category="composition"
								disabled={busy}
								onclick={() => onCarry(record.recordId, 'copy')}>Copy</button
							>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
	<p class="count">{records.length} Pokemon</p>
</div>

<style>
	.virtual-browser {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 6px;
		padding: 8px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.filters input[type='search'] {
		min-width: 130px;
		flex: 1;
	}
	.filters select,
	.filters input {
		min-height: var(--pksx-control-height);
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
	}
	.filters select {
		max-width: 130px;
	}
	.shiny {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: var(--pksx-type-caption);
	}
	.viewport {
		min-height: 0;
		overflow: auto;
		outline: none;
	}
	.spacer {
		position: relative;
		height: var(--virtual-height);
	}
	.cards {
		position: absolute;
		left: 0;
		right: 0;
		display: grid;
		gap: 8px;
	}
	.card {
		min-width: 0;
		height: 120px;
		position: relative;
	}
	.card > button:first-child {
		width: 100%;
		height: 100%;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 2px;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}
	.card > button:first-child.focused,
	.card > button:first-child:focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: -2px;
	}
	.card img {
		object-fit: contain;
	}
	.card strong {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--pksx-type-caption);
	}
	.card small {
		color: var(--ink-soft);
	}
	.unfile {
		position: absolute;
		right: 3px;
		top: 3px;
		border: 0;
		border-radius: 4px;
		background: var(--paper-hi);
		color: var(--ink);
		font-size: var(--pksx-type-caption);
		min-height: calc(var(--pksx-small-control-height));
		cursor: pointer;
	}
	.carry-actions {
		position: absolute;
		left: 3px;
		bottom: 3px;
		display: flex;
		gap: 2px;
	}
	.carry-actions button {
		border: 0;
		border-radius: 4px;
		background: var(--paper-hi);
		color: var(--ink);
		font-size: var(--pksx-type-caption);
		min-height: calc(var(--pksx-small-control-height));
		cursor: pointer;
	}
	.count,
	.empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--pksx-type-caption);
	}
</style>
