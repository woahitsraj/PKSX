<script lang="ts">
	import type { BoxSourceView } from './types';

	type BoxSourceKey = BoxSourceView['key'];

	interface Props {
		source: BoxSourceView;
		sources: Array<{ key: BoxSourceKey; label: string }>;
		onSelectSource: (key: BoxSourceKey) => void;
		onPreviousBox: () => void;
		onNextBox: () => void;
	}

	let { source, sources, onSelectSource, onPreviousBox, onNextBox }: Props = $props();
</script>

<div class="box-source-controls" aria-label="Box source controls">
	<div class="box-title">
		<h2>{source.activeBoxLabel}</h2>
		<span>
			<em>BOX {String(source.activeBoxNumber).padStart(2, '0')}/{source.boxCount}</em>
			<b>{source.occupied} / {source.capacity} occupied</b>
			<i class={['persistence-tag', source.key]}>
				{source.key === 'pokemon-storage' ? 'AUTO-SAVED' : 'EDITS WORKSPACE'}
			</i>
		</span>
	</div>

	<div class="source-toggle" role="group" aria-label="Box Source">
		{#each sources as option (option.key)}
			<button
				id={`box-source-${option.key}`}
				type="button"
				aria-pressed={option.key === source.key}
				onclick={() => onSelectSource(option.key)}
			>
				{option.label}
			</button>
		{/each}
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

	.persistence-tag {
		font-style: normal;
		font-weight: 750;
		letter-spacing: 0.08em;
		padding: 1px 6px;
		border-radius: var(--pksx-radius-xs);
	}

	.persistence-tag.save-file {
		color: var(--rust);
		background: var(--rust-wash);
	}

	.persistence-tag.pokemon-storage {
		color: var(--pksx-color-feedback-success);
		background: color-mix(in oklab, var(--pksx-color-feedback-success) 14%, transparent);
	}

	.source-toggle {
		flex: 0 0 auto;
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	.source-toggle button {
		min-height: 26px;
		padding: 0 10px;
		border-radius: var(--pksx-radius-sm);
		background: transparent;
		color: var(--ink-mute);
		font:
			700 0.66rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.05em;
	}

	.source-toggle button:hover {
		color: var(--rust);
	}

	.source-toggle button[aria-pressed='true'] {
		background: var(--rust-wash);
		color: var(--rust);
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
