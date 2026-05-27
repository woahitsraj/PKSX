<script lang="ts">
	import type { BoxSourceView } from './types';

	interface Props {
		source: BoxSourceView;
		onPreviousBox: () => void;
		onNextBox: () => void;
	}

	let { source, onPreviousBox, onNextBox }: Props = $props();
</script>

<div class="box-source-controls" aria-label="Box source controls">
	<div class="box-title">
		<h2>{source.activeBoxLabel}</h2>
		<span>
			<em>BOX {String(source.activeBoxNumber).padStart(2, '0')}/{source.boxCount}</em>
			<b>{source.occupied} / {source.capacity} occupied</b>
		</span>
	</div>

	<div class="box-switcher" aria-label={`${source.label} box switcher`}>
		<button type="button" aria-label="Previous box" onclick={onPreviousBox}>‹</button>
		<button type="button" aria-label="Next box" onclick={onNextBox}>›</button>
	</div>
</div>

<style>
	.box-source-controls {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.box-title {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.box-title h2 {
		margin: 0;
		font-size: 1.45rem;
		line-height: 1;
	}

	.box-title span {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.04em;
	}

	.box-title em {
		font-style: normal;
	}

	.box-title b {
		font-weight: 700;
	}

	.box-switcher {
		flex: 0 0 auto;
		display: flex;
		gap: 6px;
	}

	.box-switcher button {
		width: 30px;
		min-height: 32px;
		padding: 0;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--ink);
		font-size: 1.1rem;
		font-weight: 700;
	}

	.box-switcher button:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	@media (max-width: 820px) {
		.box-source-controls {
			flex-wrap: wrap;
			justify-content: center;
		}

		.box-title {
			justify-items: center;
			text-align: center;
		}

		.box-switcher {
			gap: 12px;
		}
	}
</style>
