<script lang="ts">
	import type { PokemonActionKind } from '$lib/engine';
	import type { PokemonActionState } from '$lib/pksx/pokemon-actions';

	interface Props {
		state: Exclude<PokemonActionState, { status: 'idle' }>;
		onSelect: (kind: PokemonActionKind, choiceId?: string) => void;
		onClearSelection: () => void;
		onApply: () => void;
		onClose: () => void;
	}

	let { state, onSelect, onClearSelection, onApply, onClose }: Props = $props();

	const preview = $derived(
		state.status === 'ready' || state.status === 'applying' ? state.preview : null
	);
	const legalityFix = $derived(
		preview?.actions.find((action) => action.kind === 'legality-fix') ?? null
	);
	const evolve = $derived(preview?.actions.find((action) => action.kind === 'evolve') ?? null);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' && event.key !== 'Backspace') return;
		event.preventDefault();
		event.stopPropagation();
		if ((state.status === 'ready' || state.status === 'applying') && state.selection) {
			onClearSelection();
		} else {
			onClose();
		}
	}
</script>

<div class="action-backdrop" role="presentation">
	<div
		class="pokemon-action-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pokemon-action-title"
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<header>
			<div>
				<p>{state.location}</p>
				<h2 id="pokemon-action-title">Pokemon Actions</h2>
			</div>
			<button
				id="pokemon-action-close"
				data-pokemon-action-control
				type="button"
				aria-label="Close Pokemon Actions"
				onclick={onClose}>×</button
			>
		</header>

		<section class="subject" aria-label="Pokemon Action source">
			<strong>{state.pokemonLabel}</strong>
			<span>
				{state.status === 'loading'
					? 'Loading engine-backed actions...'
					: state.status === 'error'
						? 'Pokemon Actions unavailable'
						: state.preview.legalityReport.summary}
			</span>
		</section>

		{#if state.status === 'loading'}
			<p class="message">Asking the PKHeX Engine for available actions and previews...</p>
		{:else if state.status === 'error'}
			<p class="message error" role="alert">{state.message}</p>
		{:else if state.selection}
			<section class="preview" aria-label="Pokemon Action preview">
				<div>
					<p>Preview</p>
					<h3>
						{state.selection.kind === 'legality-fix'
							? 'Legality Fix'
							: `Evolve to ${state.selection.choice?.speciesName ?? 'selected evolution'}`}
					</h3>
				</div>
				{#if state.selection.changes.length > 0}
					<ul>
						{#each state.selection.changes as change (change.field)}
							<li>
								<strong>{change.field}</strong>
								<span>{change.before}</span>
								<b aria-hidden="true">→</b>
								<span>{change.after}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="message">The engine did not report any visible projection changes.</p>
				{/if}
				<p class="warning">
					Apply writes the previewed Pokemon Entity bytes. Cancel leaves them unchanged.
				</p>
			</section>
		{:else}
			<div class="action-list">
				<section>
					<div>
						<p>Repair</p>
						<h3>Legality Fix</h3>
					</div>
					<p>
						{legalityFix?.available
							? `Fix ${state.preview.legalityReport.fixableProblems.join(', ')}.`
							: (legalityFix?.unavailableReason ?? 'No supported fix is available.')}
					</p>
					<button
						data-pokemon-action-control
						type="button"
						disabled={!legalityFix?.available || state.status === 'applying'}
						onclick={() => onSelect('legality-fix')}>Preview Legality Fix</button
					>
				</section>

				<section>
					<div>
						<p>Evolution</p>
						<h3>Evolve</h3>
					</div>
					{#if evolve?.available}
						<div class="evolution-list">
							{#each evolve.choices as choice (choice.id)}
								<button
									data-pokemon-action-control
									type="button"
									disabled={state.status === 'applying'}
									onclick={() => onSelect('evolve', choice.id)}
								>
									<strong>{choice.speciesName}</strong>
									<span>{choice.requirement}</span>
								</button>
							{/each}
						</div>
					{:else}
						<p>{evolve?.unavailableReason ?? 'No direct evolution is available.'}</p>
					{/if}
				</section>
			</div>
		{/if}

		<footer>
			{#if state.status !== 'loading' && state.status !== 'error' && state.selection}
				<button
					data-pokemon-action-control
					type="button"
					disabled={state.status === 'applying'}
					onclick={onClearSelection}>Cancel</button
				>
				<button
					id="pokemon-action-apply"
					data-pokemon-action-control
					class="primary"
					type="button"
					disabled={state.status === 'applying'}
					onclick={onApply}
				>
					{state.status === 'applying' ? 'Applying...' : 'Apply Pokemon Action'}
				</button>
			{:else}
				<button data-pokemon-action-control class="primary" type="button" onclick={onClose}>
					Close
				</button>
			{/if}
		</footer>
	</div>
</div>

<style>
	.action-backdrop {
		position: fixed;
		inset: 0;
		z-index: 330;
		display: grid;
		place-items: center;
		padding: 18px;
		background: color-mix(in oklch, var(--ink) 38%, transparent);
	}

	.pokemon-action-dialog {
		width: min(680px, 100%);
		max-height: min(780px, calc(100dvh - 36px));
		display: grid;
		gap: 12px;
		overflow: auto;
		padding: 14px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
	}

	header,
	footer,
	.subject,
	.action-list section,
	.preview {
		display: flex;
		gap: 10px;
	}

	header,
	footer,
	.subject {
		align-items: center;
		justify-content: space-between;
	}

	header p,
	header h2,
	h3,
	.action-list p,
	.preview p {
		margin: 0;
	}

	header p,
	.action-list section > div p,
	.preview > div p {
		color: var(--rust);
		font:
			700 0.66rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	h2 {
		color: var(--ink);
		font: 760 1.25rem/1.1 var(--pksx-font-display);
	}

	h3 {
		color: var(--ink);
		font: 740 1rem/1.2 var(--pksx-font-display);
	}

	button {
		min-height: 34px;
		padding: 7px 11px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-weight: 720;
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	button:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 50%);
		outline-offset: 2px;
	}

	header button {
		width: 34px;
		padding: 0;
		font-size: 1.35rem;
		line-height: 1;
	}

	.subject,
	.message,
	.action-list section,
	.preview {
		padding: 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
	}

	.subject {
		flex-wrap: wrap;
	}

	.subject span,
	.action-list section > p,
	.message,
	.warning {
		color: var(--ink-mute);
		font-size: 0.84rem;
		line-height: 1.4;
	}

	.message.error {
		color: var(--pksx-color-status-error);
	}

	.action-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.action-list section,
	.preview {
		flex-direction: column;
		align-items: stretch;
	}

	.evolution-list {
		display: grid;
		gap: 6px;
	}

	.evolution-list button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		text-align: left;
	}

	.evolution-list span {
		color: var(--ink-mute);
		font-size: 0.75rem;
	}

	.preview ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.preview li {
		display: grid;
		grid-template-columns: minmax(90px, 0.7fr) 1fr auto 1fr;
		align-items: center;
		gap: 7px;
		padding: 8px;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		font-size: 0.8rem;
	}

	.preview li span {
		overflow-wrap: anywhere;
		color: var(--ink-mute);
	}

	.warning {
		padding-left: 9px;
		border-left: 3px solid var(--rust);
	}

	footer {
		justify-content: flex-end;
	}

	button.primary {
		border-color: var(--rust);
		background: var(--rust);
		color: white;
	}

	@media (max-width: 640px) {
		.action-list {
			grid-template-columns: 1fr;
		}

		.preview li {
			grid-template-columns: 1fr;
		}

		.preview li b {
			display: none;
		}
	}
</style>
