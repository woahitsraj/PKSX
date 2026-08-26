<script lang="ts">
	interface Props {
		stagedCount: number;
		compact?: boolean;
		onApply: () => void;
		onCancel: () => void;
	}

	let { stagedCount, compact = false, onApply, onCancel }: Props = $props();
</script>

<div class={['action-controls', compact && 'compact']}>
	<span class="count">{stagedCount}</span>
	<div class="copy">
		<strong>{stagedCount} staged {stagedCount === 1 ? 'edit' : 'edits'}</strong>
		{#if !compact}<small>Save File bytes stay untouched until Apply.</small>{/if}
	</div>
	<button type="button" disabled={stagedCount === 0} onclick={onCancel}>Cancel</button>
	<button type="button" class="apply" disabled={stagedCount === 0} onclick={onApply}>Apply</button>
</div>

<style>
	.action-controls {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 9px;
		padding: 9px 12px;
		background: var(--paper-hi);
	}

	.count {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border-radius: var(--pksx-radius-md);
		background: var(--gold);
		color: white;
		font-weight: 900;
	}

	.copy {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.copy strong,
	.copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.copy strong {
		font-size: 0.72rem;
	}

	.copy small {
		color: var(--ink-mute);
		font-size: 0.56rem;
	}

	button {
		min-height: 32px;
		padding: 0 11px;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
		color: var(--ink);
		font: 800 0.65rem var(--pksx-font-sans);
	}

	button.apply {
		border-color: transparent;
		background: var(--rust);
		color: white;
	}

	button:disabled {
		opacity: 0.42;
	}

	.compact {
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		padding: 7px;
		border: 1px solid color-mix(in srgb, var(--gold), transparent 25%);
		border-radius: 999px;
		box-shadow: 0 12px 30px -14px rgba(42, 36, 28, 0.55);
	}

	.compact .count {
		width: 28px;
		height: 28px;
		border-radius: 999px;
	}

	.compact button {
		min-height: 28px;
		border-radius: 999px;
	}
</style>
