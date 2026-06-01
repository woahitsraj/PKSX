<script lang="ts">
	interface Props {
		location: string;
		pokemonLabel: string;
		activeIndex: number;
		onFocusCommand: (index: number) => void;
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { location, pokemonLabel, activeIndex, onFocusCommand, onCancel, onConfirm }: Props =
		$props();
</script>

<div class="confirm-backdrop" role="presentation">
	<div class="clear-confirm" role="dialog" aria-modal="true" aria-labelledby="clear-title">
		<div>
			<p>Clear Slot</p>
			<h2 id="clear-title">{pokemonLabel}</h2>
			<span>{location}</span>
		</div>
		<p class="confirm-copy">This removes the Pokemon from this Save File Slot.</p>
		<div class="confirm-actions">
			<button
				id="clear-confirm-0"
				type="button"
				class:controller-focused={activeIndex === 0}
				onfocus={() => onFocusCommand(0)}
				onclick={onCancel}>Cancel</button
			>
			<button
				id="clear-confirm-1"
				type="button"
				class="danger"
				class:controller-focused={activeIndex === 1}
				onfocus={() => onFocusCommand(1)}
				onclick={onConfirm}>Confirm Clear</button
			>
		</div>
	</div>
</div>

<style>
	.confirm-backdrop {
		position: fixed;
		z-index: 70;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 18px;
		background: color-mix(in srgb, black, transparent 62%);
	}

	.clear-confirm {
		width: min(340px, 100%);
		display: grid;
		gap: 12px;
		padding: 14px;
		border-radius: var(--pksx-radius-lg);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.clear-confirm p,
	.clear-confirm h2,
	.clear-confirm span {
		margin: 0;
	}

	.clear-confirm div:first-child {
		display: grid;
		gap: 3px;
	}

	.clear-confirm div:first-child p {
		color: var(--err);
		font:
			750 0.7rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.clear-confirm h2 {
		font-size: 1rem;
		line-height: 1.2;
	}

	.clear-confirm span,
	.confirm-copy {
		color: var(--ink-soft);
		font-size: 0.76rem;
		font-weight: 650;
	}

	.confirm-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.confirm-actions button {
		min-height: 34px;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		font-size: 0.78rem;
		font-weight: 800;
	}

	.confirm-actions button.danger {
		background: color-mix(in srgb, var(--err), transparent 84%);
		color: var(--err);
	}

	.confirm-actions button.controller-focused {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 52%);
		outline-offset: 2px;
	}
</style>
