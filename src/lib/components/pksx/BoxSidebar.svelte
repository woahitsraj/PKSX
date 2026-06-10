<script lang="ts">
	import type { BoxNavItem } from './types';

	interface Props {
		boxes: BoxNavItem[];
		boxSlotCount: number;
		sourceLabel: string;
		sourceKind: 'save-file' | 'pokemon-storage';
		onSelectBox: (index: number) => void;
	}

	let { boxes, boxSlotCount, sourceLabel, sourceKind, onSelectBox }: Props = $props();
</script>

<nav class="box-sidebar" aria-label="Boxes">
	<div class="sidebar-heading">
		<span>Boxes · {boxes.length}</span>
		<span aria-hidden="true">+</span>
	</div>
	<div class="sidebar-source">
		<span>{sourceKind === 'pokemon-storage' ? 'APP' : 'SAVE'}</span>
		<strong>{sourceLabel}</strong>
	</div>
	<div class="box-list">
		{#each boxes as box (box.index)}
			<button
				type="button"
				class:active={box.active}
				aria-current={box.active ? 'page' : undefined}
				style={`--box-hue: ${box.hue}`}
				onclick={() => onSelectBox(box.index)}
			>
				<i aria-hidden="true"></i>
				<span>
					<strong>{box.name}</strong>
					<small>
						<em>BOX {String(box.index + 1).padStart(2, '0')}</em>
						<b>{box.occupied ?? '—'}/{boxSlotCount}</b>
					</small>
				</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.box-sidebar {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: 12px;
		overflow: hidden;
		border: 0;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.sidebar-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 8px 8px;
		color: var(--ink-mute);
		font:
			700 0.61rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sidebar-source {
		min-width: 0;
		display: grid;
		gap: 3px;
		margin: 0 0 8px;
		padding: 8px;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		box-shadow: var(--shadow-sm);
	}

	.sidebar-source span {
		color: var(--ink-mute);
		font:
			750 0.58rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.sidebar-source strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.78rem;
		line-height: 1.15;
	}

	.box-list {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.box-list button {
		--box-hue: 48;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px;
		border: 1px solid transparent;
		border-radius: var(--pksx-radius-sm);
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.box-list button:hover {
		background: color-mix(in srgb, oklch(0.92 0.06 var(--box-hue)), transparent 60%);
	}

	.box-list button.active {
		border-color: var(--rust-ring);
		background: var(--rust-wash);
	}

	.box-list i {
		width: 5px;
		height: 26px;
		border-radius: 3px;
		background: oklch(0.78 0.12 var(--box-hue));
	}

	.box-list span {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.box-list strong {
		font-size: 0.74rem;
		line-height: 1.15;
	}

	.box-list small {
		display: flex;
		justify-content: space-between;
		gap: 4px;
		color: var(--ink-mute);
		font:
			650 0.58rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.04em;
	}

	.box-list small em {
		font-style: normal;
	}

	.box-list small b {
		color: var(--ink-soft);
		font-weight: 700;
	}

	@media (max-width: 1120px) {
		.box-sidebar {
			display: none;
		}
	}

	@media (max-width: 820px) {
		.box-sidebar,
		.box-list {
			overflow: visible;
			min-height: 0;
		}

		.box-sidebar {
			position: static;
			max-height: none;
		}
	}
</style>
