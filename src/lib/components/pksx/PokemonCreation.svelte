<script lang="ts">
	import type { PokemonCreationDraft } from '$lib/pksx/pokemon-creation';

	interface Props {
		location: string;
		feedback: string | null;
		applying: boolean;
		onApply: (draft: PokemonCreationDraft) => void;
		onClose: () => void;
	}

	let { location, feedback, applying, onApply, onClose }: Props = $props();
	let speciesId = $state<number | undefined>(undefined);
	let level = $state(5);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onApply({
			...(speciesId === undefined ? {} : { speciesId }),
			level
		});
	}
</script>

<div class="creation-backdrop" role="presentation">
	<div
		class="pokemon-creation"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pokemon-creation-title"
	>
		<form onsubmit={submit}>
			<header>
				<div>
					<p>Create Pokemon</p>
					<h2 id="pokemon-creation-title">New Pokemon</h2>
					<span>{location}</span>
				</div>
				<button
					id="pokemon-creation-close"
					type="button"
					aria-label="Close Create Pokemon"
					disabled={applying}
					onclick={onClose}>×</button
				>
			</header>

			<p class="creation-copy">Leave Species ID blank to use PKHeX defaults for this Save File.</p>

			<div class="creation-fields">
				<label>
					<span>Species ID</span>
					<input
						id="pokemon-creation-species"
						type="number"
						min="1"
						step="1"
						placeholder="Save File default"
						disabled={applying}
						bind:value={speciesId}
					/>
				</label>
				<label>
					<span>Level</span>
					<input
						id="pokemon-creation-level"
						type="number"
						min="1"
						max="100"
						step="1"
						required
						disabled={applying}
						bind:value={level}
					/>
				</label>
			</div>

			{#if feedback}
				<p class="creation-feedback" role="status">{feedback}</p>
			{/if}

			<footer>
				<button id="pokemon-creation-cancel" type="button" disabled={applying} onclick={onClose}
					>Cancel</button
				>
				<button id="pokemon-creation-apply" type="submit" disabled={applying}>
					{applying ? 'Creating...' : 'Apply creation'}
				</button>
			</footer>
		</form>
	</div>
</div>

<style>
	.creation-backdrop {
		position: fixed;
		z-index: 700;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 18px;
		background: color-mix(in srgb, black, transparent 50%);
	}

	.pokemon-creation {
		width: min(440px, 100%);
		padding: 16px;
		border-radius: var(--pksx-radius-lg);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.pokemon-creation form {
		display: grid;
		gap: 14px;
	}

	header,
	footer,
	.creation-fields {
		display: flex;
		gap: 10px;
	}

	header {
		align-items: start;
		justify-content: space-between;
	}

	header div,
	label {
		display: grid;
		gap: 4px;
	}

	p,
	h2,
	header span {
		margin: 0;
	}

	header p,
	label span {
		color: var(--rust);
		font:
			750 0.68rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	h2 {
		font-size: 1.1rem;
	}

	header span,
	.creation-copy,
	.creation-feedback {
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 650;
	}

	header button {
		width: 34px;
		height: 34px;
		border-radius: 50%;
	}

	.creation-fields label {
		flex: 1;
	}

	input {
		min-width: 0;
		height: 38px;
		padding: 0 10px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		font:
			700 0.82rem var(--pksx-font-mono),
			monospace;
	}

	.creation-feedback {
		padding: 8px 10px;
		border-radius: var(--pksx-radius-sm);
		background: color-mix(in srgb, var(--rust), transparent 90%);
	}

	footer {
		justify-content: end;
	}

	footer button {
		min-height: 36px;
		padding: 0 14px;
		border-radius: var(--pksx-radius-sm);
		font-weight: 800;
	}

	#pokemon-creation-apply {
		background: var(--rust);
		color: white;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 48%);
		outline-offset: 2px;
	}

	@media (max-width: 520px) {
		.creation-fields {
			flex-direction: column;
		}
	}
</style>
