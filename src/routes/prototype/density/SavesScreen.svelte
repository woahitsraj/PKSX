<script lang="ts">
	const saves = [
		['Pokemon Emerald', 'RAJAN', 'emerald-main.sav', 14, 173, true],
		['Pokemon Crystal', 'KRIS', 'crystal-cart.sav', 14, 96, false],
		['Pokemon Platinum', 'LUCAS', 'platinum.nds.sav', 18, 248, false],
		['Pokemon Violet', 'VIOLET', 'main', 32, 411, false],
		['Pokemon Colosseum', 'WES', 'card-a.raw', 3, 57, false]
	] as const;
</script>

<section class="saves" aria-label="Saves">
	<header>
		<div>
			<span class="caption">On this device</span>
			<h1 class="display">Saves</h1>
		</div>
		<div class="summary" aria-label="Pokemon Storage summary">
			<strong>Pokemon Storage</strong><span class="caption">30 Pokemon · 3 boxes</span>
		</div>
	</header>
	<div class="grid" data-scroll>
		{#each saves as [game, trainer, file, boxes, count, active] (file)}
			<button type="button" class="card" class:active>
				<span class="spine"></span>
				<span class="head"
					><strong class="title">{game}</strong>{#if active}<em class="chip">Active</em>{/if}</span
				>
				<span class="trainer">{trainer}</span>
				<span class="file caption">{file}</span>
				<span class="stats"><b>{boxes}</b> boxes · <b>{count}</b> Pokemon</span>
			</button>
		{/each}
		<button type="button" class="card import">
			<span class="plus">+</span><strong class="title">Import a Save File</strong>
		</button>
	</div>
</section>

<style>
	.saves {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--t-space-2);
		padding: var(--t-space-2);
		box-sizing: border-box;
	}

	header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--t-space-3);
	}

	.display {
		margin: 0;
		font-size: var(--t-display);
		font-weight: 850;
		line-height: 0.95;
	}

	.summary {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding: var(--t-space-1) var(--t-space-2);
		border-radius: var(--t-radius-md);
		background: var(--paper-deep);
		font-size: var(--t-label);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		grid-auto-rows: max-content;
		gap: var(--t-space-2);
		overflow: auto;
	}

	.card {
		position: relative;
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		gap: 2px;
		min-height: calc(var(--t-control) * 3.2);
		padding: var(--t-space-2) var(--t-space-3) var(--t-space-2) calc(var(--t-space-3) + 6px);
		border: var(--t-border) solid var(--rule-hi);
		border-radius: var(--t-radius-sm) var(--t-radius-lg) var(--t-radius-lg) var(--t-radius-sm);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		text-align: left;
		cursor: pointer;
	}

	.spine {
		position: absolute;
		inset: 0 auto 0 0;
		width: 6px;
		border-radius: var(--t-radius-sm) 0 0 var(--t-radius-sm);
		background: var(--rule-hi);
	}

	.active .spine {
		background: var(--rust);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--t-space-2);
	}

	.title {
		font-size: var(--t-title);
		line-height: var(--t-lh-tight);
	}

	.head em {
		font-style: normal;
		color: var(--rust);
	}

	.trainer {
		font: 800 var(--t-body) / 1.2 var(--t-mono);
	}

	.file {
		text-transform: none;
		letter-spacing: 0;
		color: var(--ink-mute);
	}

	.stats {
		align-self: end;
		color: var(--ink-soft);
		font-size: var(--t-label);
	}

	.import {
		grid-template-rows: auto auto;
		align-content: center;
		justify-items: center;
		border-style: dashed;
		box-shadow: none;
	}

	.plus {
		font-size: var(--t-display);
		line-height: 1;
		color: var(--rust);
	}
</style>
