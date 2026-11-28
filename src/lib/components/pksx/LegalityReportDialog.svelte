<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		createLegalityReportFindings,
		type LegalityReportState
	} from '$lib/pksx/legality-report';
	import {
		allLegalityFixOperation,
		autoLegalOperation,
		type AutoLegalState,
		type PokemonActionState
	} from '$lib/pksx/pokemon-actions';
	import AutoLegalReview from './AutoLegalReview.svelte';
	import DelayedSpinner from './DelayedSpinner.svelte';

	interface Props {
		state: Exclude<LegalityReportState, { status: 'idle' }>;
		actionState: PokemonActionState;
		autoLegal: AutoLegalState;
		onApplyFix: (fixId: string) => void;
		onApplyAllFixes: () => void;
		onAutoLegal: () => void;
		onApplyAutoLegal: () => void;
		onLeaveAutoLegal: () => void;
		onClose: () => void;
	}

	let {
		state,
		actionState,
		autoLegal,
		onApplyFix,
		onApplyAllFixes,
		onAutoLegal,
		onApplyAutoLegal,
		onLeaveAutoLegal,
		onClose
	}: Props = $props();
	const report = $derived(state.status === 'ready' ? state.report : null);
	const blockingMessage = $derived(
		state.status === 'error' || state.status === 'unavailable' ? state.message : null
	);
	const actionReady = $derived(
		actionState.status === 'ready' || actionState.status === 'applying' ? actionState : null
	);
	const legalityFix = $derived(
		actionReady?.preview.actions.find((action) => action.kind === 'legality-fix') ?? null
	);
	const findings = $derived(report ? createLegalityReportFindings(report, legalityFix) : null);
	const messages = $derived(
		findings?.messages.filter(
			({ line: message }) =>
				!findings.warnings.some(
					({ line: warning }) =>
						warning.identifier === message.identifier &&
						warning.message === message.message &&
						warning.fixId === message.fixId
				)
		) ?? []
	);
	const canApplyAllFixes = $derived(Boolean(actionReady && allLegalityFixOperation(actionReady)));
	const applying = $derived(actionState.status === 'applying');
	const canAutoLegal = $derived(Boolean(actionReady && report && !report.legal));
	const canApplyAutoLegal = $derived(Boolean(autoLegalOperation(autoLegal)));

	onMount(() => {
		void tick().then(() => {
			document.getElementById('legality-report-close')?.focus();
		});
	});
</script>

<div class="legality-report" class:legal={report?.legal} class:illegal={report && !report.legal}>
	<header>
		<div>
			<h2 id="legality-report-title">
				{autoLegal.status === 'idle' ? 'Legality Check' : 'Auto Legal'}
			</h2>
			<p class="kicker">{state.location}</p>
		</div>
		<button
			id="legality-report-close"
			data-legality-report-control
			type="button"
			class="icon-close"
			aria-label="Close report"
			onclick={onClose}
		>
			×
		</button>
	</header>

	{#if autoLegal.status !== 'idle'}
		<AutoLegalReview state={autoLegal} pokemonLabel={state.pokemonLabel} />
	{:else}
		<div class="report-scroll" role="region" aria-label="Legality Report findings">
			<div class="summary">
				<div class="judgement">
					{#if report}<span>{report.judgement}</span>{:else if state.status !== 'loading'}<span
							>Unavailable</span
						>{/if}
					<strong>{state.pokemonLabel}</strong>
				</div>
				{#if state.status === 'loading'}
					<DelayedSpinner active label="Checking legality" />
				{:else}
					<p>
						{#if report}
							{report.summary}
						{:else}
							{blockingMessage}
						{/if}
					</p>
					{#each findings?.unmatchedFixes ?? [] as fix (fix.id)}
						<div
							class="proposed-fixes"
							aria-label={`${fix.label} proposed fixes`}
							data-legality-proposed-fixes
						>
							<p class="proposal-label">{fix.label}</p>
							{#each fix.changes as change (JSON.stringify( [change.field, change.before, change.after] ))}
								<p><strong>{change.field}:</strong> {change.before} → {change.after}</p>
							{/each}
							<button
								data-legality-report-control
								type="button"
								class="apply-fix"
								onclick={() => onApplyFix(fix.id)}
								disabled={applying}>Apply {fix.label} Fix</button
							>
						</div>
					{/each}
					{#if findings && findings.combinedProposals.length > 0}
						<div
							class="proposed-fixes"
							aria-label="Apply all Fixes proposed changes"
							data-legality-proposed-fixes
						>
							<p class="proposal-label">Apply all Fixes changes</p>
							{#each findings.combinedProposals as change (JSON.stringify( [change.field, change.before, change.after] ))}
								<p><strong>{change.field}:</strong> {change.before} → {change.after}</p>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			{#if report}
				<div class="report-columns">
					<section aria-label="Warnings">
						<h3>Warnings</h3>
						{#if report.warnings.length > 0}
							<ul>
								{#each findings?.warnings ?? [] as finding, index (`warning-${index}-${finding.line.identifier}`)}
									{@const fix = finding.fix}
									<li>
										<span>{finding.line.identifier}</span>
										<p>{finding.line.message}</p>
										{#if finding.proposals.length > 0 || fix}
											<div
												class="proposed-fixes"
												aria-label="Proposed fixes"
												data-legality-proposed-fixes
											>
												{#each finding.proposals as change (JSON.stringify( [change.field, change.before, change.after] ))}
													<p><strong>{change.field}:</strong> {change.before} → {change.after}</p>
												{/each}
												{#if fix}
													<button
														data-legality-report-control
														type="button"
														class="apply-fix"
														onclick={() => onApplyFix(fix.id)}
														disabled={applying}>Apply {fix.label} Fix</button
													>
												{/if}
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="empty-copy">No warnings returned.</p>
						{/if}
					</section>

					{#if messages.length > 0}
						<section aria-label="Messages">
							<h3>Messages</h3>
							<ul>
								{#each messages as finding, index (`message-${index}-${finding.line.identifier}`)}
									{@const fix = finding.fix}
									<li>
										<span>{finding.line.identifier}</span>
										<p>{finding.line.message}</p>
										{#if finding.proposals.length > 0 || fix}
											<div
												class="proposed-fixes"
												aria-label="Proposed fixes"
												data-legality-proposed-fixes
											>
												{#each finding.proposals as change (JSON.stringify( [change.field, change.before, change.after] ))}
													<p><strong>{change.field}:</strong> {change.before} → {change.after}</p>
												{/each}
												{#if fix}
													<button
														data-legality-report-control
														type="button"
														class="apply-fix"
														onclick={() => onApplyFix(fix.id)}
														disabled={applying}>Apply {fix.label} Fix</button
													>
												{/if}
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<footer>
		{#if autoLegal.status !== 'idle'}
			<button
				id="auto-legal-back"
				data-legality-report-control
				type="button"
				class="secondary"
				onclick={onLeaveAutoLegal}
				disabled={applying}
			>
				{autoLegal.status === 'loading' ? 'Cancel' : 'Back'}
			</button>
			{#if canApplyAutoLegal}
				<button
					id="auto-legal-apply"
					data-legality-report-control
					type="button"
					class="close-report"
					onclick={onApplyAutoLegal}
					disabled={applying}
				>
					Apply
				</button>
			{/if}
			<DelayedSpinner active={applying} label="Applying Auto Legal" />
		{:else}
			{#if canAutoLegal}
				<button
					id="legality-auto-legal"
					data-legality-report-control
					type="button"
					class="secondary"
					onclick={onAutoLegal}
					disabled={applying}
				>
					Auto Legal
				</button>
			{/if}
			{#if canApplyAllFixes}
				<button
					id="legality-quick-fix-apply"
					data-legality-report-control
					type="button"
					class="close-report"
					onclick={onApplyAllFixes}
					disabled={applying}
				>
					Apply all Fixes
				</button>
				<DelayedSpinner active={applying} label="Applying fixes" />
			{:else}
				<button data-legality-report-control type="button" class="close-report" onclick={onClose}
					>Close</button
				>
			{/if}
		{/if}
	</footer>
</div>

<style>
	.legality-report {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow: hidden;
	}

	.report-scroll {
		min-height: 0;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-2);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	.kicker,
	h2,
	h3,
	p {
		margin: 0;
	}

	.kicker {
		margin-top: 2px;
		color: var(--ink-soft);
		font: 650 var(--pksx-type-label) var(--pksx-font-sans);
	}

	h2 {
		color: var(--ink);
		font: 750 var(--pksx-type-title)/1.1 var(--pksx-font-sans);
	}

	h3 {
		color: var(--ink);
		font: 750 var(--pksx-type-body)/1.2 var(--pksx-font-sans);
	}

	.icon-close,
	.apply-fix,
	.close-report,
	footer button {
		border: 0;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.icon-close {
		width: var(--pksx-control-height);
		height: var(--pksx-control-height);
		font-size: var(--pksx-icon-size);
		line-height: 1;
	}

	.close-report {
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-1) var(--pksx-space-3);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
		font-weight: 720;
	}

	.apply-fix {
		justify-self: start;
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-1) max(8px, var(--pksx-space-2));
		border: 1px solid var(--rule-hi);
		background: var(--paper-hi);
		font-weight: 700;
	}

	footer button {
		min-height: var(--pksx-control-height);
	}

	footer .secondary {
		padding: var(--pksx-space-1) var(--pksx-space-3);
		border: 1px solid var(--rule-hi);
		background: var(--paper-hi);
		font-weight: 700;
	}

	.secondary:focus-visible {
		outline: 3px solid var(--pksx-color-accent-ring);
		outline-offset: -3px;
	}

	.proposed-fixes {
		display: grid;
		gap: var(--pksx-space-1);
		padding-top: var(--pksx-space-1);
		border-top: 1px solid var(--rule);
	}

	.proposed-fixes p {
		color: var(--ink);
	}

	.proposed-fixes .proposal-label {
		color: var(--ink-soft);
		font: 700 var(--pksx-type-label) var(--pksx-font-sans);
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
		color: var(--rust);
		font: 800 var(--pksx-type-body) var(--pksx-font-sans);
	}

	.legality-report.legal .judgement span {
		color: var(--pksx-color-feedback-success);
	}

	.legality-report.illegal .judgement span {
		color: var(--pksx-color-feedback-danger);
	}

	.summary p,
	.empty-copy,
	li p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		line-height: 1.25;
	}

	.report-columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--pksx-space-2);
	}

	.report-columns section {
		display: grid;
		align-content: start;
		gap: var(--pksx-space-1);
	}

	.report-columns section:only-child {
		grid-column: 1 / -1;
	}

	ul {
		display: grid;
		gap: var(--pksx-space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		gap: var(--pksx-space-1);
		padding: var(--pksx-space-2) 0;
		border-bottom: 1px solid var(--rule);
	}

	li span {
		color: var(--ink);
		font: 750 var(--pksx-type-label) var(--pksx-font-sans);
	}

	.icon-close:focus-visible,
	.apply-fix:focus-visible,
	.close-report:focus-visible {
		outline: 3px solid var(--pksx-color-accent-ring);
		outline-offset: -3px;
	}

	@container pksx-density (max-width: 640px) {
		.report-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
