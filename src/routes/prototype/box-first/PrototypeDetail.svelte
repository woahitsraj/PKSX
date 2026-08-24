<script lang="ts">
	import type { PrototypePokemon } from './prototype-data';

	interface Props {
		pokemon: PrototypePokemon | null;
		location: string;
		compact?: boolean;
	}

	let { pokemon, location, compact = false }: Props = $props();
</script>

<section class:compact class="detail" aria-label="Active Slot Detail Rail" aria-live="polite">
	{#if pokemon}
		<img src={pokemon.sprite} alt="" width="128" height="128" />
		<div class="identity">
			<span>{location}</span>
			<strong>{pokemon.name}</strong>
			<small>Lv {pokemon.level} · {pokemon.types}</small>
		</div>
		<div class="stats" aria-label="Stats">
			<span>HP <strong>157</strong></span>
			<span>ATK <strong>148</strong></span>
			<span>DEF <strong>132</strong></span>
		</div>
		<div class="moves" aria-label="Moves">
			{#each pokemon.moves as move (move)}<span>{move}</span>{/each}
		</div>
	{:else}
		<div class="empty-detail">
			<span>{location}</span>
			<strong>Empty slot</strong>
			<small>No Pokemon stored here</small>
		</div>
	{/if}
</section>

<style>
	.detail {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		grid-template-rows: auto auto 1fr;
		gap: 4px 6px;
		padding: 6px;
		overflow: hidden;
		border: 1px solid var(--rule);
		border-radius: 9px;
		background: color-mix(in srgb, var(--paper-hi), transparent 3%);
		box-shadow: var(--shadow-sm);
	}

	.detail img {
		grid-row: 1 / 4;
		width: 100%;
		height: 100%;
		min-height: 0;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.identity,
	.empty-detail {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.identity span,
	.empty-detail span {
		color: var(--rust);
		font: 750 7px var(--pksx-font-mono);
		text-transform: uppercase;
	}

	.identity strong,
	.empty-detail strong {
		overflow: hidden;
		font-size: clamp(11px, 2.5cqh, 17px);
		line-height: 1.05;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.identity small,
	.empty-detail small {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: clamp(7px, 1.5cqh, 10px);
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}

	.stats span,
	.moves span {
		min-width: 0;
		padding: 2px 3px;
		overflow: hidden;
		border-radius: 4px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font: 650 clamp(6px, 1.3cqh, 8px) var(--pksx-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stats strong {
		color: var(--ink);
	}

	.moves {
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr;
		align-content: start;
		gap: 2px;
	}

	.detail.compact {
		grid-template-columns: 44px minmax(0, 1fr) auto;
		grid-template-rows: 1fr;
		align-items: center;
	}

	.detail.compact img {
		grid-row: 1;
	}

	.detail.compact .stats {
		display: none;
	}

	.detail.compact .moves {
		grid-template-columns: 1fr 1fr;
	}

	@container stage (max-height: 420px) {
		.detail:not(.compact) {
			grid-template-columns: minmax(42px, 0.7fr) minmax(0, 1.3fr);
			grid-template-rows: auto auto;
			padding: 4px;
		}

		.detail:not(.compact) img {
			grid-row: 1 / 3;
		}

		.detail:not(.compact) .stats,
		.detail:not(.compact) .moves {
			display: none;
		}
	}
</style>
