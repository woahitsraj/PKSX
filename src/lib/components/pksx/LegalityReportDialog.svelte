<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { LegalityReportState } from '$lib/pksx/legality-report';

	interface Props {
		state: Exclude<LegalityReportState, { status: 'idle' }>;
		onClose: () => void;
	}

	let { state, onClose }: Props = $props();
	const report = $derived(state.status === 'ready' ? state.report : null);
	const blockingMessage = $derived(
		state.status === 'error' || state.status === 'unavailable' ? state.message : null
	);

	onMount(() => {
		void tick().then(() => {
			document.getElementById('legality-report-close')?.focus();
		});
	});

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.key === 'Escape' ||
			event.key === 'Backspace' ||
			event.key === 'Enter' ||
			event.key === ' '
		) {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		}
	}
</script>

<div class="report-backdrop" role="presentation">
	<div
		class="legality-report"
		class:legal={report?.legal}
		class:illegal={report && !report.legal}
		role="dialog"
		aria-modal="true"
		aria-labelledby="legality-report-title"
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<header>
			<div>
				<p class="kicker">{state.location}</p>
				<h2 id="legality-report-title">Legality Check</h2>
			</div>
			<button
				id="legality-report-close"
				type="button"
				class="icon-close"
				aria-label="Close report"
				onclick={onClose}
			>
				×
			</button>
		</header>

		<div class="summary">
			<div class="judgement">
				<span>{report?.judgement ?? (state.status === 'loading' ? 'Checking' : 'Unavailable')}</span
				>
				<strong>{state.pokemonLabel}</strong>
			</div>
			<p>
				{#if state.status === 'loading'}
					Asking PKHeX Engine for a report...
				{:else if report}
					{report.summary}
				{:else}
					{blockingMessage}
				{/if}
			</p>
		</div>

		{#if report}
			<div class="report-columns">
				<section aria-label="Warnings">
					<h3>Warnings</h3>
					{#if report.warnings.length > 0}
						<ul>
							{#each report.warnings as line, index (`warning-${index}-${line.identifier}`)}
								<li>
									<span>{line.identifier}</span>
									<p>{line.message}</p>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="empty-copy">No warnings returned.</p>
					{/if}
				</section>

				<section aria-label="Messages">
					<h3>Messages</h3>
					{#if report.messages.length > 0}
						<ul>
							{#each report.messages as line, index (`message-${index}-${line.identifier}`)}
								<li>
									<span>{line.identifier}</span>
									<p>{line.message}</p>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="empty-copy">No issues returned.</p>
					{/if}
				</section>
			</div>
		{/if}

		<footer>
			<button type="button" class="close-report" onclick={onClose}>Close</button>
		</footer>
	</div>
</div>

<style>
	.report-backdrop {
		position: fixed;
		inset: 0;
		z-index: 320;
		display: grid;
		place-items: center;
		padding: 18px;
		background: color-mix(in oklch, var(--ink) 34%, transparent);
	}

	.legality-report {
		width: min(640px, 100%);
		max-height: min(760px, calc(100vh - 36px));
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
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.kicker,
	h2,
	h3,
	p {
		margin: 0;
	}

	.kicker {
		color: var(--ink-mute);
		font:
			650 0.68rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	h2 {
		color: var(--ink);
		font: 750 1.25rem/1.1 var(--pksx-font-display);
	}

	h3 {
		color: var(--ink);
		font:
			720 0.78rem/1.2 var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.icon-close,
	.close-report {
		border: 0;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.icon-close {
		width: 32px;
		height: 32px;
		font-size: 1.35rem;
		line-height: 1;
	}

	.close-report {
		min-height: 34px;
		padding: 6px 14px;
		background: var(--rust);
		color: white;
		font-weight: 720;
	}

	.summary {
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
	}

	.judgement {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.judgement span {
		color: var(--rust);
		font:
			800 0.8rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.legality-report.legal .judgement span {
		color: oklch(50% 0.13 148);
	}

	.legality-report.illegal .judgement span {
		color: oklch(48% 0.17 25);
	}

	.summary p,
	.empty-copy,
	li p {
		color: var(--ink-mute);
		font-size: 0.86rem;
		line-height: 1.4;
	}

	.report-columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.report-columns section {
		display: grid;
		align-content: start;
		gap: 8px;
	}

	ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: 3px;
		padding: 8px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
	}

	li span {
		color: var(--ink);
		font:
			700 0.68rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.icon-close:focus-visible,
	.close-report:focus-visible {
		outline: 2px solid var(--pksx-color-accent-primary);
		outline-offset: 2px;
	}

	@media (max-width: 640px) {
		.report-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
