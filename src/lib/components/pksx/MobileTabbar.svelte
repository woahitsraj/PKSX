<script lang="ts">
	import type { MobileTab } from './types';

	interface Props {
		tabs: MobileTab[];
		activeKey?: string;
		focusIndex?: number | null;
		onFocusTab: (index: number) => void;
		onSelectTab?: (index: number) => void;
	}

	let {
		tabs,
		activeKey = 'boxes',
		focusIndex = null,
		onFocusTab,
		onSelectTab = onFocusTab
	}: Props = $props();
</script>

<nav class="mobile-tabbar" aria-label="Sections (mobile)" style:--tab-count={tabs.length}>
	{#each tabs as tab, index (tab.key)}
		<button
			id={`mobile-tab-${index}`}
			type="button"
			class={[tab.key === activeKey && 'active', focusIndex === index && 'controller-focused']}
			onfocus={() => onFocusTab(index)}
			onclick={() => onSelectTab(index)}
		>
			<span aria-hidden="true">{tab.glyph}</span>
			<small>{tab.label}</small>
		</button>
	{/each}
</nav>

<style>
	.mobile-tabbar {
		display: none;
	}

	@media (max-width: 820px) {
		.mobile-tabbar {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 60;
			display: grid;
			grid-template-columns: repeat(var(--tab-count), minmax(0, 1fr));
			gap: 0;
			padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
			background: var(--paper-hi);
			border-top: 1px solid var(--rule);
			box-shadow: 0 -8px 24px -12px rgba(70, 50, 30, 0.18);
		}

		.mobile-tabbar button {
			display: grid;
			justify-items: center;
			gap: 2px;
			padding: 6px 4px;
			border: 0;
			background: transparent;
			color: var(--ink-mute);
			font: inherit;
			cursor: pointer;
		}

		.mobile-tabbar button.active {
			color: var(--rust);
		}

		.mobile-tabbar button.controller-focused {
			outline: 3px solid color-mix(in srgb, var(--rust), transparent 58%);
			outline-offset: -2px;
		}

		.mobile-tabbar button span {
			font-size: 1.05rem;
			line-height: 1;
		}

		.mobile-tabbar button small {
			font:
				700 0.58rem var(--pksx-font-mono),
				monospace;
			letter-spacing: 0.05em;
		}
	}
</style>
