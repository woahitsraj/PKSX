<script lang="ts">
	const sections = [
		'Identity',
		'Moves',
		'Stats',
		'Nature',
		'Ability',
		'Held Item',
		'Trainer',
		'Origin',
		'Ribbons',
		'Contest',
		'Legality'
	];
	const rows = [
		['HP', 31, 4, 157],
		['Attack', 31, 252, 148],
		['Defense', 28, 0, 132],
		['Sp. Atk', 30, 0, 121],
		['Sp. Def', 31, 0, 133],
		['Speed', 31, 252, 140]
	] as const;
</script>

<div class="backdrop">
	<section class="takeover" aria-label="Pokemon Editor">
		<nav class="rail" aria-label="Sections" data-scroll>
			{#each sections as section, index (section)}
				<button type="button" class:current={index === 2} class:staged={index === 2 || index === 1}>
					{section}
				</button>
			{/each}
		</nav>
		<div class="content">
			<header class="identity">
				<img
					src="/sprites/pokemon/species/0006-form-00-sex-default-normal.png"
					alt=""
					width="64"
					height="64"
				/>
				<div>
					<strong class="title">Charizard</strong>
					<span class="meta">Lv 68 · Fire / Flying · Emerald.sav</span>
				</div>
				<button type="button" class="chip staged-chip">2 staged</button>
				<button type="button" class="chip" aria-label="Close">✕</button>
			</header>
			<div class="section-head">
				<strong>IV / EV</strong>
				<span class="caption">EV total 508 / 510</span>
			</div>
			<div class="table" data-scroll>
				<span class="caption">Stat</span>
				<span class="caption">IV</span>
				<span class="caption">EV</span>
				<span class="caption">Total</span>
				{#each rows as [name, iv, ev, total] (name)}
					<span class="stat-name">{name}</span>
					<input class="ctrl" type="number" value={iv} aria-label={`${name} IV`} />
					<input class="ctrl" type="number" value={ev} aria-label={`${name} EV`} />
					<span class="total">{total}</span>
				{/each}
			</div>
			<footer class="apply">
				<span class="validation">Valid. 2 edits ready to apply.</span>
				<button type="button" class="ctrl">Discard</button>
				<button type="button" class="ctrl primary">Apply</button>
			</footer>
		</div>
	</section>
</div>

<style>
	.backdrop {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: stretch;
		background: var(--paper);
	}

	.takeover {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: 148px minmax(0, 1fr);
		background: var(--paper-hi);
		box-sizing: border-box;
	}

	.rail {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--t-space-1);
		overflow: auto;
		border-right: var(--t-border) solid var(--rule);
		background: var(--paper-deep);
	}

	.rail button {
		position: relative;
		flex: none;
		height: var(--t-control-sm);
		padding: 0 var(--t-space-2);
		border: 0;
		border-radius: var(--t-radius-sm);
		background: transparent;
		font-size: var(--t-label);
		font-weight: 650;
		text-align: left;
		cursor: pointer;
	}

	.rail .current {
		background: var(--paper-hi);
		color: var(--rust);
	}

	.rail .staged::after {
		content: '';
		position: absolute;
		top: 50%;
		right: var(--t-space-2);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--rust);
		transform: translateY(-50%);
	}

	.content {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		gap: var(--t-space-1);
		padding: var(--t-space-1) var(--t-space-2);
	}

	.identity {
		display: grid;
		grid-template-columns: var(--t-control) minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--t-space-2);
	}

	.identity img {
		width: var(--t-control);
		height: var(--t-control);
		object-fit: contain;
		image-rendering: pixelated;
	}

	.identity div {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.title {
		font-size: var(--t-title);
		line-height: var(--t-lh-tight);
	}

	.meta {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: var(--t-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.staged-chip {
		color: var(--rust);
		cursor: pointer;
	}

	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-size: var(--t-body);
	}

	.table {
		display: grid;
		grid-template-columns: minmax(56px, 0.8fr) 1fr 1fr minmax(40px, 0.6fr);
		grid-auto-rows: max-content;
		align-content: start;
		gap: calc(var(--t-unit) / 2) var(--t-space-2);
		overflow: auto;
	}

	.stat-name {
		align-self: center;
		font-size: var(--t-label);
		font-weight: 650;
	}

	.table input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		font-family: var(--t-mono);
	}

	.total {
		align-self: center;
		font: 700 var(--t-body) / 1 var(--t-mono);
		text-align: right;
	}

	.apply {
		display: flex;
		align-items: center;
		gap: var(--t-space-2);
		padding-top: var(--t-space-1);
		border-top: var(--t-border) solid var(--rule);
	}

	.validation {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--ok);
		font-size: var(--t-label);
		font-weight: 650;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Taller than wide: the section rail becomes a scrolling top row. */
	@container (max-aspect-ratio: 1 / 1) {
		.takeover {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.rail {
			flex-direction: row;
			overflow-x: auto;
			border-right: 0;
			border-bottom: var(--t-border) solid var(--rule);
		}

		.rail button {
			white-space: nowrap;
		}
	}

	/* Tall band: the Takeover bounds to a centered panel over a dimmed Backdrop (#158). */
	@container style(--band: tall) {
		.backdrop {
			place-items: center;
			background: color-mix(in srgb, var(--ink), transparent 55%);
		}

		.takeover {
			width: min(760px, 92%);
			height: min(560px, 88%);
			border-radius: var(--t-radius-lg);
			box-shadow: var(--shadow-deep);
			overflow: hidden;
		}
	}
</style>
