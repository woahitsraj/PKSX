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

<div class="pokemon-creation">
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

		<div class="creation-scroll">
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
		</div>

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

<style>
	.pokemon-creation {
		height: 100%;
		min-height: 0;
		color: var(--ink);
	}

	.pokemon-creation form {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
	}

	.creation-scroll {
		min-height: 0;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	header,
	footer,
	.creation-fields {
		display: flex;
		gap: var(--pksx-space-2);
	}

	header {
		align-items: start;
		justify-content: space-between;
	}

	header div,
	label {
		display: grid;
		gap: var(--pksx-space-1);
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
			750 var(--pksx-type-caption) var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	h2 {
		font-size: var(--pksx-type-title);
	}

	header span,
	.creation-copy,
	.creation-feedback {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 650;
	}

	header button {
		width: var(--pksx-control-height);
		height: var(--pksx-control-height);
		border-radius: 50%;
	}

	.creation-fields label {
		flex: 1;
	}

	input {
		min-width: 0;
		height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-2);
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		font:
			700 var(--pksx-type-body) var(--pksx-font-mono),
			monospace;
	}

	.creation-feedback {
		padding: var(--pksx-space-2);
		border-radius: var(--pksx-radius-sm);
		background: color-mix(in srgb, var(--rust), transparent 90%);
	}

	footer {
		justify-content: end;
	}

	footer button {
		min-height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-3);
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

	@container pksx-density (max-width: 520px) {
		.creation-fields {
			flex-direction: column;
		}
	}
</style>
