<script lang="ts">
	import type { SaveSummary } from '$lib/engine';
	import { getSpriteIdentityLabels } from '$lib/pksx/sprite-catalog';
	import ItemSprite from './ItemSprite.svelte';
	import type { SlotView } from './types';

	interface Props {
		focusedSlot: SlotView;
		focusZone: 'party' | 'box' | null;
		focusSlot: number | null;
		slotHueStyle: string;
		spriteUrl: string | null;
		saveSummary: SaveSummary | null;
		activeBoxName: string;
		positionLabel: string;
	}
	type FooterRow = { label: string; value: string; kind?: 'item' };

	let {
		focusedSlot,
		focusZone,
		focusSlot,
		slotHueStyle,
		spriteUrl,
		saveSummary,
		activeBoxName,
		positionLabel
	}: Props = $props();

	const isPokemon = $derived(focusedSlot.kind === 'pokemon');
	const speciesLabel = $derived(
		isPokemon && focusedSlot.speciesId
			? `Species #${String(focusedSlot.speciesId).padStart(4, '0')}`
			: null
	);
	const identityLabels = $derived(getSpriteIdentityLabels(focusedSlot.spriteIdentity));
	const details = $derived(
		[
			focusedSlot.nature,
			focusedSlot.ability,
			focusedSlot.heldItem ? `holding ${focusedSlot.heldItem}` : null
		].filter((value): value is string => typeof value === 'string' && value.length > 0)
	);
	const footerRows = $derived(
		isPokemon
			? [
					focusedSlot.originalTrainer
						? { label: 'OT', value: focusedSlot.originalTrainer }
						: saveSummary?.trainerName
							? { label: 'OT', value: saveSummary.trainerName }
							: null,
					focusedSlot.heldItem
						? { label: 'Item', value: focusedSlot.heldItem, kind: 'item' as const }
						: null,
					focusedSlot.metLabel ? { label: 'Met', value: focusedSlot.metLabel } : null,
					saveSummary?.fileName ? { label: 'Save', value: saveSummary.fileName } : null,
					{ label: 'Pos', value: positionLabel }
				].filter((row): row is FooterRow => row !== null)
			: []
	);
	const hasStats = $derived(isPokemon && focusedSlot.stats && focusedSlot.stats.length > 0);
	const hasMoves = $derived(isPokemon && focusedSlot.moves && focusedSlot.moves.length > 0);
	const hasSlotFocus = $derived(focusZone !== null && focusSlot !== null);
	const locationLabel = $derived(
		focusZone === 'box' ? activeBoxName : focusZone === 'party' ? 'Party' : 'No selection'
	);
</script>

<aside
	class={['detail-rail', !isPokemon && 'empty-state']}
	aria-label="Active Slot details"
	aria-live="polite"
	data-testid="active-slot-detail-rail"
	style={slotHueStyle}
>
	<div class="portrait-card">
		{#if isPokemon && spriteUrl}
			<img src={spriteUrl} alt="" width="180" height="180" />
		{:else if isPokemon}
			<span class="portrait-missing" aria-hidden="true"></span>
		{:else}
			<span class="portrait-empty" aria-hidden="true"></span>
		{/if}
		{#if isPokemon && focusedSlot.types && focusedSlot.types.length > 0}
			<div class="type-row" aria-label="Types">
				{#each focusedSlot.types as type (type.name)}
					<span
						class="type-chip"
						style={`--type-hue: ${type.hue}; --type-chroma: ${type.chroma ?? 0.09}`}
						>{type.name}</span
					>
				{/each}
			</div>
		{/if}
	</div>
	<div class="detail-heading" class:empty-heading={!isPokemon}>
		<div>
			<h2>{isPokemon ? focusedSlot.label : 'Empty slot'}</h2>
			{#if isPokemon && details.length > 0}
				<span>{details.join(' · ')}</span>
			{:else if !hasSlotFocus}
				<span>No slot selected</span>
			{:else if !isPokemon}
				<span>No Pokemon stored here</span>
			{/if}
		</div>
		{#if isPokemon && focusedSlot.level !== null}
			<div class="detail-level">
				<span>Level</span>
				<strong>{focusedSlot.level}</strong>
			</div>
		{/if}
	</div>

	{#if isPokemon}
		<div class="identity-strip" aria-label="Pokemon identity">
			{#if speciesLabel}<span>{speciesLabel}</span>{/if}
			{#if identityLabels.form}<span>{identityLabels.form}</span>{/if}
			{#if identityLabels.shiny}<span>{identityLabels.shiny}</span>{/if}
			{#if identityLabels.displaySex}<span>{identityLabels.displaySex}</span>{/if}
			{#if focusedSlot.gender}<span>{focusedSlot.gender}</span>{/if}
			{#if focusedSlot.isEgg}<span>Egg</span>{/if}
			<span>{locationLabel}</span>
		</div>
	{/if}

	{#if hasStats}
		<div class="stat-panel" aria-label="Stats">
			<div class="panel-title">
				<h3>Stats</h3>
				<strong>BST {focusedSlot.stats?.reduce((total, stat) => total + stat.value, 0)}</strong>
			</div>
			{#each focusedSlot.stats ?? [] as stat (stat.key)}
				<div class="stat-row">
					<span class="stat-key">{stat.label}</span>
					<span class="stat-bar" aria-hidden="true">
						<i style={`width: ${Math.min(100, Math.round((stat.value / stat.max) * 100))}%`}></i>
					</span>
					<strong>{stat.value}</strong>
					<em>+{stat.ev ?? 0}</em>
				</div>
			{/each}
		</div>
	{/if}

	{#if hasMoves}
		<div class="move-panel" aria-label="Move set">
			<div class="panel-title">
				<h3>Move Set</h3>
			</div>
			<div class="move-grid">
				{#each focusedSlot.moves ?? [] as move, index (`${index}-${move.id}-${move.name}`)}
					<div
						class="move-chip"
						style={`--type-hue: ${move.hue}; --type-chroma: ${move.chroma ?? 0.09}`}
					>
						<strong>{move.name}</strong>
						<span>{move.type}</span>
						{#if move.pp !== null && move.pp !== undefined}
							<em>{move.pp}</em>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if footerRows.length > 0}
		<div class="detail-footer" aria-label="Storage metadata">
			{#each footerRows as row (row.label)}
				<span>{row.label}</span>
				<strong class:item-value={row.kind === 'item'}>
					{#if row.kind === 'item'}
						<ItemSprite identity={focusedSlot.heldItemSpriteIdentity} size={30} />
					{/if}
					<span>{row.value}</span>
				</strong>
			{/each}
		</div>
	{/if}

	{#if !isPokemon}
		<div class="empty-copy">
			<span>{focusZone === null ? 'Selection' : 'Position'}</span>
			<strong>{positionLabel}</strong>
		</div>
	{/if}
</aside>

<style>
	.detail-rail {
		min-width: 0;
		min-height: 0;
		contain: layout paint style;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 14px;
		overflow-y: auto;
		border: 0;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.detail-rail.empty-state {
		color: var(--ink-soft);
	}

	.portrait-card {
		position: relative;
		flex: none;
		height: 200px;
		display: grid;
		place-items: center;
		border-radius: var(--pksx-radius-lg);
		background: linear-gradient(
			160deg,
			oklch(0.93 calc(var(--slot-chroma, 0.08) * 0.6) var(--slot-hue, 48)),
			oklch(0.82 var(--slot-chroma, 0.12) var(--slot-hue, 48))
		);
		overflow: hidden;
	}

	.empty-state .portrait-card {
		height: 140px;
		background: var(--paper-deep);
	}

	:global(.app-shell.dark) .portrait-card,
	:global(:root[data-pksx-theme='dark']) .portrait-card {
		background: linear-gradient(
			160deg,
			oklch(0.42 var(--slot-chroma, 0.08) var(--slot-hue, 48)),
			oklch(0.26 var(--slot-chroma, 0.08) var(--slot-hue, 48))
		);
	}

	:global(.app-shell.dark) .empty-state .portrait-card,
	:global(:root[data-pksx-theme='dark']) .empty-state .portrait-card {
		background: var(--paper-deep);
	}

	.portrait-card img {
		width: min(62%, 160px);
		height: min(62%, 160px);
		object-fit: contain;
		image-rendering: pixelated;
	}

	.portrait-empty {
		width: 56px;
		height: 56px;
		border: 1.5px dashed var(--rule-hi);
		border-radius: var(--pksx-radius-md);
	}

	.portrait-missing {
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ink), transparent 60%);
		border-radius: var(--pksx-radius-md);
	}

	.portrait-missing::before {
		content: '?';
		color: var(--ink-soft);
		font:
			800 var(--pksx-type-display) var(--pksx-font-mono),
			monospace;
	}

	.type-row {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.type-chip {
		padding: 3px 10px;
		border-radius: var(--pksx-radius-sm);
		background: oklch(0.95 calc(var(--type-chroma, 0.09) * 0.6) var(--type-hue, 52));
		color: oklch(0.3 var(--type-chroma, 0.09) var(--type-hue, 52));
		font-size: var(--pksx-type-label);
		font-weight: 750;
	}

	.detail-heading {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.detail-heading h2 {
		margin: 0;
		color: var(--ink);
		font-size: var(--pksx-type-display);
		font-weight: 800;
		line-height: 1.05;
		overflow-wrap: break-word;
	}

	.detail-heading span {
		display: block;
		margin-top: 6px;
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		font-weight: 600;
		line-height: 1.25;
	}

	.detail-heading.empty-heading h2 {
		font-size: var(--pksx-type-title);
	}

	.detail-level {
		flex: none;
		display: grid;
		justify-items: end;
		gap: 2px;
	}

	.detail-level span {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 650;
	}

	.detail-level strong {
		color: var(--ink);
		font:
			800 var(--pksx-type-display) var(--pksx-font-mono),
			monospace;
		line-height: 1;
	}

	.identity-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 600;
		line-height: 1.25;
	}

	.identity-strip span:not(:last-child)::after {
		content: '·';
		margin-left: 8px;
		color: var(--ink-mute);
	}

	.stat-panel,
	.move-panel {
		display: grid;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--rule);
	}

	.panel-title {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.panel-title h3 {
		margin: 0;
		color: var(--ink);
		font-size: var(--pksx-type-label);
		font-weight: 750;
	}

	.panel-title strong {
		color: var(--ink-soft);
		font:
			700 var(--pksx-type-label) var(--pksx-font-mono),
			monospace;
	}

	.stat-row {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) 28px 34px;
		align-items: center;
		gap: 8px;
	}

	.stat-key {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 700;
	}

	.stat-bar {
		position: relative;
		height: 6px;
		border-radius: var(--pksx-radius-xs);
		background: var(--paper-deep);
		overflow: hidden;
	}

	.stat-bar i {
		position: absolute;
		inset: 0 auto 0 0;
		display: block;
		border-radius: inherit;
		background: var(--rust);
	}

	.stat-row strong,
	.stat-row em {
		margin: 0;
		font:
			700 var(--pksx-type-label) var(--pksx-font-mono),
			monospace;
		text-align: right;
	}

	.stat-row strong {
		color: var(--ink);
	}

	.stat-row em {
		color: var(--ink-soft);
		font-style: normal;
	}

	.move-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 12px;
	}

	.move-chip {
		min-width: 0;
		display: grid;
		grid-template-columns: 8px minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: 6px;
		row-gap: 1px;
	}

	.move-chip::before {
		content: '';
		grid-row: 1;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: oklch(0.6 var(--type-chroma, 0.16) var(--type-hue, 48));
	}

	.move-chip strong {
		min-width: 0;
		color: var(--ink);
		font-size: var(--pksx-type-label);
		font-weight: 750;
		line-height: 1.2;
		overflow-wrap: break-word;
	}

	.move-chip span {
		grid-column: 2 / -1;
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 550;
	}

	.move-chip em {
		grid-row: 1;
		grid-column: 3;
		color: var(--ink-soft);
		font:
			700 var(--pksx-type-label) var(--pksx-font-mono),
			monospace;
		font-style: normal;
	}

	.detail-footer,
	.empty-copy {
		margin-top: auto;
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: 6px 12px;
		padding-top: 12px;
		border-top: 1px solid var(--rule);
	}

	.detail-footer > span,
	.empty-copy span {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 650;
	}

	.detail-footer strong,
	.empty-copy strong {
		min-width: 0;
		color: var(--ink);
		font-size: var(--pksx-type-label);
		font-weight: 700;
		text-align: right;
		overflow-wrap: anywhere;
	}

	.detail-footer .item-value {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 7px;
	}

	@container detail-rail (width < 260px) or (height <= 260px) {
		.detail-rail {
			order: 2;
			position: static;
			max-height: none;
			min-height: 0;
			border-radius: var(--pksx-radius-lg);
			padding: 10px;
			gap: 12px;
		}

		.portrait-card {
			height: 180px;
		}

		.detail-heading {
			gap: 8px;
		}
	}

	@container detail-rail (height <= 260px) {
		.move-grid {
			grid-template-columns: 1fr;
		}

		.stat-row {
			grid-template-columns: 34px minmax(0, 1fr) 28px;
		}

		.stat-row em {
			display: none;
		}
	}
</style>
