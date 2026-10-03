<script lang="ts">
	import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
	import { asset } from '$app/paths';
	import { resolveSpriteCatalogEntry } from '$lib/pksx/sprite-catalog';

	type Props = {
		paneId: string;
		active: boolean;
		records: PokemonRecord[];
		focusedId: string | null;
		busy: boolean;
		onFocus: (id: string) => void;
		onOpen: (id: string) => void;
		onEmpty: () => void;
		onColumns: (columns: number) => void;
	};
	let { paneId, active, records, focusedId, busy, onFocus, onOpen, onEmpty, onColumns }: Props =
		$props();
	let width = $state(600);
	const columns = $derived(Math.max(1, Math.floor((width + 8) / 124)));
	function measure(node: HTMLDivElement) {
		const observer = new ResizeObserver(() => {
			width = node.clientWidth;
			onColumns(columns);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}
	function spriteUrl(record: PokemonRecord) {
		const entry = resolveSpriteCatalogEntry(record.projection.spriteIdentity);
		return entry ? asset(entry.path) : null;
	}
</script>

<div class="recently-deleted">
	<div class="toolbar">
		<span>{records.length} Pokemon recoverable for 30 days</span>
		<button
			id={active ? 'recently-deleted-empty' : `${paneId}-recently-deleted-empty`}
			type="button"
			data-pksx-control-category="small"
			disabled={busy || records.length === 0}
			onclick={onEmpty}>Empty Recently Deleted</button
		>
	</div>
	<div class="grid-viewport" {@attach measure} role="grid" aria-label="Recently Deleted Pokemon">
		{#if records.length === 0}<p>No Pokemon in Recently Deleted.</p>{/if}
		<div class="cards" style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}>
			{#each records as record, index (record.recordId)}
				<div class="card" role="row">
					<button
						id={active
							? `virtual-record-${record.recordId}`
							: `${paneId}-virtual-record-${record.recordId}`}
						type="button"
						role="gridcell"
						data-pksx-control-category="card"
						aria-selected={focusedId === record.recordId}
						aria-rowindex={Math.floor(index / columns) + 1}
						aria-colindex={(index % columns) + 1}
						aria-label={record.projection.nickname || record.projection.speciesName}
						onfocus={() => onFocus(record.recordId)}
						onclick={() => onOpen(record.recordId)}
					>
						{#if spriteUrl(record)}<img
								src={spriteUrl(record)!}
								alt=""
								width="64"
								height="64"
							/>{/if}
						<strong>{record.projection.nickname || record.projection.speciesName}</strong>
					</button>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.recently-deleted {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 8px;
		padding: 8px;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.toolbar span,
	.grid-viewport p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-caption);
	}
	.grid-viewport {
		min-height: 0;
		overflow: auto;
	}
	.cards {
		display: grid;
		gap: 8px;
	}
	.card {
		min-width: 0;
	}
	.card > button[data-pksx-control-category='card'] {
		min-height: 98px;
		width: 100%;
		display: grid;
		justify-items: center;
		align-content: center;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
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
	.toolbar button {
		min-height: var(--pksx-small-control-height);
		border: 1px solid var(--rule);
		border-radius: 5px;
		background: var(--paper-hi);
		color: var(--ink);
		font: inherit;
		font-size: var(--pksx-type-caption);
		cursor: pointer;
	}
</style>
