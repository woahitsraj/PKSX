<script lang="ts">
	interface VariantOption {
		key: string;
		name: string;
		note: string;
	}

	interface Props {
		variants: VariantOption[];
		current: string;
		onChange: (key: string) => void;
	}

	let { variants, current, onChange }: Props = $props();
	let currentIndex = $derived(
		Math.max(
			0,
			variants.findIndex((variant) => variant.key === current)
		)
	);
	let currentVariant = $derived(variants[currentIndex]);

	function cycle(offset: number) {
		onChange(variants[(currentIndex + offset + variants.length) % variants.length].key);
	}
</script>

<nav class="prototype-switcher" aria-label="Prototype variants">
	<button type="button" aria-label="Previous variant" onclick={() => cycle(-1)}>←</button>
	<div>
		<strong>{currentVariant.key} · {currentVariant.name}</strong>
		<span>{currentVariant.note}</span>
	</div>
	<button type="button" aria-label="Next variant" onclick={() => cycle(1)}>→</button>
</nav>

<style>
	.prototype-switcher {
		position: fixed;
		z-index: 3100;
		left: 50%;
		bottom: max(6px, env(safe-area-inset-bottom));
		width: min(430px, calc(100vw - 20px));
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) 34px;
		align-items: center;
		gap: 4px;
		padding: 4px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 10px;
		background: rgba(26, 24, 21, 0.94);
		box-shadow: 0 8px 28px rgba(35, 24, 15, 0.28);
		color: #f8f2e8;
		font-family: var(--pksx-font-sans);
	}

	.prototype-switcher button {
		height: 32px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: #34302a;
		color: #f8f2e8;
		font: 800 16px var(--pksx-font-mono);
		cursor: pointer;
	}

	.prototype-switcher button:focus-visible {
		outline: 2px solid #f0b77f;
		outline-offset: 1px;
	}

	.prototype-switcher div {
		min-width: 0;
		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.prototype-switcher strong,
	.prototype-switcher span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prototype-switcher strong {
		font-size: 10px;
	}

	.prototype-switcher span {
		color: #c9beb0;
		font-size: 8px;
	}

	@media (max-height: 420px) {
		.prototype-switcher {
			bottom: 3px;
			width: min(360px, calc(100vw - 12px));
			grid-template-columns: 28px minmax(0, 1fr) 28px;
			padding: 2px;
		}

		.prototype-switcher button {
			height: 24px;
		}

		.prototype-switcher span {
			display: none;
		}
	}
</style>
