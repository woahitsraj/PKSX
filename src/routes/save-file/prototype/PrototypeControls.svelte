<script lang="ts">
	// Prototype-only bar. Not part of the design under evaluation. Hidden with ?controls=0.
	interface Props {
		variants: { key: string; name: string }[];
		current: string;
		stress: boolean;
		chrome: boolean;
		omit: string;
		failNext: boolean;
		lastEvent: string;
		onChange: (key: string) => void;
		onToggleStress: () => void;
		onToggleChrome: () => void;
		onCycleOmit: () => void;
		onToggleFail: () => void;
	}

	let {
		variants,
		current,
		stress,
		chrome,
		omit,
		failNext,
		lastEvent,
		onChange,
		onToggleStress,
		onToggleChrome,
		onCycleOmit,
		onToggleFail
	}: Props = $props();
	const index = $derived(
		Math.max(
			0,
			variants.findIndex((variant) => variant.key === current)
		)
	);

	function cycle(offset: number) {
		onChange(variants[(index + offset + variants.length) % variants.length].key);
	}
</script>

<nav class="proto-bar" aria-label="Prototype controls">
	<button type="button" aria-label="Previous variant" onclick={() => cycle(-1)}>←</button>
	<div class="label">
		<strong>{variants[index].key} · {variants[index].name}</strong>
		<span>{lastEvent}</span>
	</div>
	<button type="button" aria-label="Next variant" onclick={() => cycle(1)}>→</button>
	<button type="button" class:on={stress} onclick={onToggleStress}>Stress</button>
	<button type="button" class:on={chrome} onclick={onToggleChrome}>Shell</button>
	<button type="button" class:on={omit !== ''} onclick={onCycleOmit}
		>Omit{omit ? `: ${omit}` : ''}</button
	>
	<button type="button" class:on={failNext} onclick={onToggleFail}>Fail next</button>
</nav>

<style>
	.proto-bar {
		position: fixed;
		z-index: 3100;
		left: 50%;
		bottom: max(6px, env(safe-area-inset-bottom));
		transform: translateX(-50%);
		width: min(640px, calc(100vw - 16px));
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr) 30px auto auto auto auto;
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

	.proto-bar button {
		height: 28px;
		padding: 0 8px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: #34302a;
		color: #f8f2e8;
		font: 700 11px var(--pksx-font-mono);
		cursor: pointer;
		white-space: nowrap;
	}

	.proto-bar button.on {
		background: #c89a3e;
		color: #1a1815;
	}

	.label {
		min-width: 0;
		display: grid;
		text-align: center;
	}

	.label strong,
	.label span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.label strong {
		font-size: 10px;
	}

	.label span {
		color: #c9beb0;
		font-size: 9px;
	}
</style>
