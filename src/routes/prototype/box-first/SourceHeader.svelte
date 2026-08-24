<script lang="ts">
	interface Props {
		boxName?: string;
	}

	let { boxName = 'Sky Pillar' }: Props = $props();
</script>

<header class="source-header">
	<button type="button" class="source-chip" aria-label="Open Box Menu for Emerald.sav">
		<span>SAVE</span><strong>Emerald.sav</strong><i aria-hidden="true">▾</i>
	</button>
	<button type="button" class="box-arrow" aria-label="Previous box">‹</button>
	<strong class="box-name">14 · {boxName}</strong>
	<button type="button" class="box-arrow" aria-label="Next box">›</button>
</header>

<style>
	.source-header {
		min-width: 0;
		min-height: 20px;
		display: grid;
		grid-template-columns: minmax(0, auto) 22px minmax(0, 1fr) 22px;
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
		min-width: 0;
		height: 100%;
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
		height: 100%;
		border-radius: 5px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1;
	}

	.box-name {
		overflow: hidden;
		color: var(--ink-soft);
		font-size: clamp(8px, 1.8cqh, 11px);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-header button:focus-visible {
		outline: 2px solid var(--rust);
		outline-offset: -1px;
	}
</style>
