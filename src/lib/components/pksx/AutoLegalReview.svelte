<script lang="ts">
	import type { AutoLegalState } from '$lib/pksx/pokemon-actions';
	import DelayedSpinner from './DelayedSpinner.svelte';

	interface Props {
		state: Exclude<AutoLegalState, { status: 'idle' }>;
		pokemonLabel: string;
	}

	let { state, pokemonLabel }: Props = $props();
	const preview = $derived(state.status === 'ready' ? state.preview : null);
	const remaining = $derived(
		preview?.status === 'unresolved'
			? preview.source.warnings.filter((line) => line.severity === 'Invalid')
			: []
	);
</script>

<div class="report-scroll" role="region" aria-label="Auto Legal review" data-auto-legal-review>
	<div class="summary">
		<div class="judgement">
			{#if preview?.status === 'repaired'}<span class="legal">Legal candidate</span>
			{:else if preview?.status === 'already-legal'}<span class="legal">Legal</span>
			{:else if preview || state.status === 'error'}<span>Not repaired</span>{/if}
			<strong>{pokemonLabel}</strong>
		</div>
		{#if state.status === 'loading'}
			<DelayedSpinner active label="Finding a legal candidate" />
		{:else if state.status === 'error'}
			<p>{state.message}</p>
		{:else if preview?.status === 'repaired'}
			<p>
				The Legality Check passes for this candidate. Apply writes these {preview.changes.length}
				changes.
			</p>
			{#if preview.method === 'automod'}
				<p data-auto-legal-encounter-note>
					This candidate uses a different encounter. Check the met and egg data before Apply.
				</p>
			{/if}
		{:else if preview?.status === 'already-legal'}
			<p>This Pokemon is already legal. Nothing changes.</p>
		{:else if preview}
			<p>{preview.reason ?? 'Auto Legal found no legal candidate.'} Nothing changes.</p>
		{/if}
	</div>

	{#if preview?.status === 'repaired'}
		<ul class="changes" aria-label="Auto Legal changes" data-auto-legal-changes>
			{#each preview.changes as change (JSON.stringify( [change.field, change.before, change.after] ))}
				<li>
					<span>{change.field}</span>
					<p><del>{change.before || 'None'}</del> → <ins>{change.after || 'None'}</ins></p>
				</li>
			{/each}
		</ul>
	{:else if remaining.length > 0}
		<section aria-label="Remaining findings">
			<h3>Remaining findings</h3>
			<ul class="changes">
				{#each remaining as line, index (`${index}-${line.identifier}`)}
					<li>
						<span>{line.identifier}</span>
						<p>{line.message}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.report-scroll {
		min-height: 0;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.summary {
		display: grid;
		gap: var(--pksx-space-1);
		padding-bottom: var(--pksx-space-2);
		border-bottom: 1px solid var(--rule);
	}

	.judgement {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--pksx-space-1);
	}

	.judgement span {
		color: var(--pksx-color-feedback-danger);
		font: 800 var(--pksx-type-body) var(--pksx-font-sans);
	}

	.judgement span.legal {
		color: var(--pksx-color-feedback-success);
	}

	h3,
	p {
		margin: 0;
	}

	h3 {
		color: var(--ink);
		font: 750 var(--pksx-type-body)/1.2 var(--pksx-font-sans);
	}

	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 2px;
		padding: var(--pksx-space-1) 0;
		border-bottom: 1px solid var(--rule);
	}

	li span {
		color: var(--ink);
		font: 750 var(--pksx-type-label) var(--pksx-font-sans);
	}

	del {
		text-decoration: none;
	}

	ins {
		color: var(--ink);
		font-weight: 700;
		text-decoration: none;
	}
</style>
