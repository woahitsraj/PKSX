<script lang="ts">
	import type { SaveSummary } from '$lib/engine';
	import type { SlotView } from './types';

	interface Props {
		focusedSlot: SlotView;
		focusZone: 'party' | 'box';
		focusSlot: number;
		slotHueStyle: string;
		spriteUrl: string | null;
		saveSummary: SaveSummary | null;
		activeBoxName: string;
		slotPalette: number[];
	}

	let {
		focusedSlot,
		focusZone,
		focusSlot,
		slotHueStyle,
		spriteUrl,
		saveSummary,
		activeBoxName,
		slotPalette
	}: Props = $props();

	const stats = [
		{ key: 'HP', iv: 31, ev: 252 },
		{ key: 'ATK', iv: 29, ev: 4 },
		{ key: 'DEF', iv: 25, ev: null },
		{ key: 'SPA', iv: 31, ev: 252 },
		{ key: 'SPD', iv: 18, ev: null },
		{ key: 'SPE', iv: 31, ev: null }
	];
	const moves = ['Ember', 'Gust', 'Flora', 'Roost'];
</script>

<aside class="detail-rail" aria-live="polite" style={slotHueStyle}>
	<div class="portrait-card">
		<small
			>PORTRAIT · {focusZone === 'party'
				? `PARTY ${focusSlot + 1}`
				: `SLOT ${focusSlot + 1}`}</small
		>
		{#if focusedSlot.kind === 'pokemon' && spriteUrl}
			<img src={spriteUrl} alt="" width="180" height="180" />
		{:else if focusedSlot.kind === 'pokemon'}
			<span class="portrait-missing" aria-hidden="true"></span>
		{:else}
			<span class="portrait-empty" aria-hidden="true"></span>
		{/if}
	</div>
	<div class="detail-heading">
		<div>
			<h2>{focusedSlot.kind === 'pokemon' ? focusedSlot.label : '—'}</h2>
			<span>
				{#if focusedSlot.kind === 'pokemon' && focusedSlot.speciesId}
					#{String(focusedSlot.speciesId).padStart(4, '0')} · Modest · Updraft
				{:else}
					No creature in this slot
				{/if}
			</span>
		</div>
		<div class="detail-level">
			<span>LEVEL</span>
			<strong>{focusedSlot.level ?? '—'}</strong>
		</div>
	</div>
	<div class="stat-grid" aria-label="Stats">
		{#each stats as stat (stat.key)}
			<div class="stat-row">
				<span class="stat-key">{stat.key}</span>
				<span class="stat-bar" aria-hidden="true">
					<i style={`width: ${focusedSlot.kind === 'pokemon' ? (stat.iv / 31) * 100 : 0}%`}></i>
				</span>
				<span class="stat-iv">{focusedSlot.kind === 'pokemon' ? stat.iv : '—'}</span>
				<span class="stat-ev"
					>{focusedSlot.kind === 'pokemon' && stat.ev ? `+${stat.ev}` : '—'}</span
				>
			</div>
		{/each}
	</div>
	<div class="moveset" aria-label="Moves">
		<span class="moveset-label">MOVE SET</span>
		<div class="moveset-grid">
			{#each moves as move, index (move)}
				<div
					class="move-chip"
					style={`--slot-hue: ${slotPalette[(index * 4) % slotPalette.length]}`}
				>
					<strong>{focusedSlot.kind === 'pokemon' ? move.toUpperCase() : '—'}</strong>
					<small>{focusedSlot.kind === 'pokemon' ? 'PP 25/25' : ''}</small>
				</div>
			{/each}
		</div>
	</div>
	<div class="detail-footer">
		<div>
			<span>OT</span>
			<strong>{saveSummary?.trainerName ?? 'CASS · 41203'}</strong>
		</div>
		<div>
			<span>ITEM</span>
			<strong>{focusedSlot.kind === 'pokemon' ? 'Charcoal Ember' : '—'}</strong>
		</div>
		<div>
			<span>MET</span>
			<strong
				>{focusedSlot.kind === 'pokemon'
					? `${activeBoxName} · Lv. ${focusedSlot.level}`
					: '—'}</strong
			>
		</div>
	</div>
</aside>

<style>
	.detail-rail {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		overflow-y: auto;
		border: 0;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.portrait-card {
		position: relative;
		height: 174px;
		display: grid;
		place-items: center;
		border-radius: var(--pksx-radius-lg);
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(0, 0, 0, 0.025) 24px 25px
			),
			radial-gradient(
				circle at 30% 35%,
				oklch(0.94 0.07 var(--slot-hue, 48)),
				oklch(0.78 0.13 var(--slot-hue, 48))
			);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
	}

	:global(.app-shell.dark) .portrait-card {
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(255, 255, 255, 0.04) 24px 25px
			),
			radial-gradient(
				circle at 30% 35%,
				oklch(0.5 0.08 var(--slot-hue, 48)),
				oklch(0.28 0.08 var(--slot-hue, 48))
			);
	}

	.portrait-card img {
		width: 138px;
		height: 138px;
		object-fit: contain;
	}

	.portrait-empty {
		width: 64px;
		height: 64px;
		border: 1px dashed var(--rule-hi);
		border-radius: var(--pksx-radius-lg);
	}

	.portrait-missing {
		width: 86px;
		height: 86px;
		border: 1px solid color-mix(in srgb, var(--ink), transparent 45%);
		border-radius: var(--pksx-radius-lg);
		background: color-mix(in srgb, var(--paper), transparent 35%);
	}

	.portrait-missing::before {
		content: '?';
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		color: color-mix(in srgb, var(--ink), transparent 35%);
		font:
			800 2rem var(--pksx-font-mono),
			monospace;
	}

	.portrait-card small {
		position: absolute;
		top: 10px;
		left: 12px;
		color: color-mix(in srgb, var(--ink), transparent 45%);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	.detail-heading h2 {
		margin: 0;
		color: var(--ink);
		font-size: 1.45rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
	}

	.detail-heading span {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.detail-level {
		display: grid;
		justify-items: end;
		gap: 0;
	}

	.detail-level span {
		color: var(--ink-mute);
		font:
			700 0.58rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.06em;
	}

	.detail-level strong {
		color: var(--ink);
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
	}

	.stat-grid {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border-radius: var(--pksx-radius-lg);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
	}

	.stat-row {
		display: grid;
		grid-template-columns: 32px 1fr 28px 36px;
		align-items: center;
		gap: 8px;
		font:
			700 0.62rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.05em;
	}

	.stat-row .stat-key {
		color: var(--ink-soft);
	}

	.stat-row .stat-bar {
		position: relative;
		display: block;
		height: 7px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--paper-deep), transparent 25%);
		overflow: hidden;
	}

	.stat-row .stat-bar i {
		position: absolute;
		inset: 0 auto 0 0;
		display: block;
		border-radius: 5px;
		background: linear-gradient(90deg, var(--rust), oklch(0.7 0.18 32));
	}

	.stat-row .stat-iv {
		color: var(--ink);
		text-align: right;
	}

	.stat-row .stat-ev {
		color: var(--ink-mute);
		text-align: right;
	}

	.moveset {
		display: grid;
		gap: 6px;
	}

	.moveset-label {
		color: var(--ink-mute);
		font:
			700 0.58rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.08em;
	}

	.moveset-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.move-chip {
		--slot-hue: 48;
		display: grid;
		gap: 2px;
		padding: 8px 10px;
		border-radius: var(--pksx-radius-md);
		background: linear-gradient(
			135deg,
			oklch(0.92 0.07 var(--slot-hue)),
			oklch(0.86 0.1 var(--slot-hue))
		);
		color: var(--ink);
	}

	:global(.app-shell.dark) .move-chip {
		background: linear-gradient(
			135deg,
			oklch(0.42 0.08 var(--slot-hue)),
			oklch(0.34 0.09 var(--slot-hue))
		);
	}

	.move-chip strong {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.move-chip small {
		color: color-mix(in srgb, var(--ink), transparent 35%);
		font:
			700 0.58rem var(--pksx-font-mono),
			monospace;
	}

	.detail-footer {
		display: grid;
		gap: 4px;
		padding: 8px 10px;
		border-top: 1px solid var(--rule);
	}

	.detail-footer div {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.7rem;
	}

	.detail-footer span {
		color: var(--ink-mute);
		font:
			700 0.58rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.06em;
	}

	.detail-footer strong {
		color: var(--ink);
		font-weight: 700;
	}

	@media (max-width: 820px) {
		.detail-rail {
			order: 2;
			position: static;
			max-height: none;
			overflow: visible;
			min-height: 0;
			border-radius: var(--pksx-radius-lg);
			padding: 10px;
			gap: 10px;
		}

		.portrait-card {
			height: 168px;
		}

		.detail-heading {
			align-items: flex-start;
			justify-content: space-between;
			gap: 8px;
		}
	}
</style>
