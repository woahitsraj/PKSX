<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		countSaveFileLegalityResults,
		filterSaveFileLegalityResults,
		saveFileLegalityOpenControlId,
		type SaveFileLegalityFilter,
		type SaveFileLegalityResult
	} from '$lib/pksx/save-file-legality-report';
	import type { SaveFileLegalityReportViewState } from '$lib/pksx/save-file-legality-report/host.svelte';
	import { keyboardAction } from '$lib/pksx/box-shell';
	import type { NavigationAction } from '$lib/pksx/box-navigation';
	import DelayedSpinner from './DelayedSpinner.svelte';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		fileName: string;
		state: SaveFileLegalityReportViewState;
		onRun: () => void;
		onPreviewFixes: () => void;
		onApplyFixes: () => void;
		onCancel: () => void;
		onClose: () => void;
		onJumpToSlot: (result: SaveFileLegalityResult) => Promise<boolean>;
		onOpenPokemonReport: (result: SaveFileLegalityResult) => Promise<boolean>;
	}

	let {
		fileName,
		state: reportState,
		onRun,
		onPreviewFixes,
		onApplyFixes,
		onCancel,
		onClose,
		onJumpToSlot,
		onOpenPokemonReport
	}: Props = $props();
	let filter = $state<SaveFileLegalityFilter>('all');
	let activeControl = $state(0);
	const results = $derived(reportState.status === 'ready' ? reportState.results : []);
	const counts = $derived(countSaveFileLegalityResults(results));
	const filtered = $derived(filterSaveFileLegalityResults(results, filter));
	const loading = $derived(reportState.status === 'loading');
	const batchBusy = $derived(
		reportState.status === 'ready' &&
			(reportState.batch.status === 'previewing' ||
				reportState.batch.status === 'applying' ||
				reportState.batch.status === 'committing')
	);
	const batchCancelable = $derived(
		reportState.status === 'ready' &&
			(reportState.batch.status === 'previewing' || reportState.batch.status === 'applying')
	);
	const batchCommitting = $derived(
		reportState.status === 'ready' && reportState.batch.status === 'committing'
	);
	const stale = $derived(reportState.status === 'ready' && reportState.stale);
	const batchEntries = $derived.by(() => {
		if (reportState.status !== 'ready') return [];
		return 'entries' in reportState.batch ? reportState.batch.entries : [];
	});
	const fixableCount = $derived(
		batchEntries.filter(({ status }) => status === 'fixable' || status === 'applied').length
	);
	const unfixableCount = $derived(
		batchEntries.filter(({ status }) => status === 'unfixable').length
	);
	const progressPercent = $derived(
		reportState.status === 'loading' && reportState.progress.total > 0
			? Math.round((reportState.progress.checked / reportState.progress.total) * 100)
			: 0
	);
	const filters = $derived([
		{ key: 'all' as const, label: 'All', count: counts.total },
		{ key: 'legal' as const, label: 'Legal', count: counts.legal },
		{ key: 'warning' as const, label: 'Warnings', count: counts.warning },
		{ key: 'illegal' as const, label: 'Illegal', count: counts.illegal }
	]);

	onMount(() => void focusFirstControl());

	async function focusFirstControl() {
		await tick();
		const available = controls();
		const focused = document.activeElement;
		const focusedIndex = focused instanceof HTMLButtonElement ? available.indexOf(focused) : -1;
		activeControl = Math.max(0, focusedIndex);
		if (focusedIndex < 0) available[0]?.focus();
	}

	function controls() {
		return Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-save-legality-control]:not([disabled])')
		);
	}

	function handleKeydown(event: KeyboardEvent) {
		const action = keyboardAction(event);
		if (!action || !['up', 'down', 'left', 'right', 'confirm', 'back'].includes(action)) return;
		event.preventDefault();
		dispatchNavigation(action);
	}

	function dispatchNavigation(action: NavigationAction) {
		if (action === 'back') {
			if (loading || batchCancelable) onCancel();
			else if (batchCommitting) return;
			else onClose();
			return;
		}
		const available = controls();
		if (action === 'confirm') {
			available[activeControl]?.click();
			return;
		}
		const offset = action === 'up' || action === 'left' ? -1 : 1;
		activeControl = Math.max(0, Math.min(available.length - 1, activeControl + offset));
		available[activeControl]?.focus();
	}

	function selectFilter(next: SaveFileLegalityFilter) {
		filter = next;
		queueMicrotask(() => {
			const focused = document.activeElement;
			if (focused instanceof HTMLButtonElement) {
				activeControl = Math.max(0, controls().indexOf(focused));
			}
		});
	}

	function handleBack() {
		if (loading || batchCancelable) onCancel();
		else if (batchCommitting) return;
		else onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<TakeoverFrame
	labelledby="save-legality-title"
	describedby="save-legality-description"
	busy={loading || batchBusy}
	onBack={handleBack}
>
	<div class="save-legality-report">
		<header>
			<div>
				<p class="kicker">{fileName}</p>
				<h2 id="save-legality-title">Save File Legality Report</h2>
				<p id="save-legality-description">Party and occupied Box Slots</p>
			</div>
			<button
				id="save-legality-close"
				type="button"
				class="close"
				data-save-legality-control
				data-pksx-control-category="small"
				aria-label={loading
					? 'Cancel report'
					: batchCancelable
						? 'Cancel batch'
						: batchCommitting
							? 'Saving batch'
							: 'Close report'}
				aria-disabled={batchCommitting}
				onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
				onclick={handleBack}
				>{loading || batchCancelable ? 'Cancel' : batchCommitting ? 'Saving' : 'Esc'}</button
			>
		</header>

		{#if reportState.status === 'loading'}
			<section class="loading" aria-live="polite">
				<DelayedSpinner active label="Checking Save File legality" />
				<strong>{reportState.progress.checked} / {reportState.progress.total || '...'}</strong>
				<progress max={Math.max(1, reportState.progress.total)} value={reportState.progress.checked}
					>{progressPercent}%</progress
				>
				<p>{reportState.progress.location ?? 'Reading occupied Slots...'}</p>
			</section>
		{:else if reportState.status === 'cancelled'}
			<section class="state" aria-live="polite">
				<h3>Report cancelled</h3>
				<p>No Workspace changes were made.</p>
				<button
					type="button"
					data-save-legality-control
					data-pksx-control-category="small"
					onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
					onclick={onRun}>Run again</button
				>
			</section>
		{:else if reportState.status === 'error'}
			<section class="state" aria-live="polite">
				<h3>Report unavailable</h3>
				<p>{reportState.message}</p>
				<button
					type="button"
					data-save-legality-control
					data-pksx-control-category="small"
					onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
					onclick={onRun}>Try again</button
				>
			</section>
		{:else if reportState.status === 'ready'}
			{#if stale}
				<div class="stale" role="status">
					<span>The Workspace changed. Run the report again.</span>
					<button
						type="button"
						data-save-legality-control
						data-pksx-control-category="small"
						onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
						onclick={onRun}>Rerun</button
					>
				</div>
			{/if}
			<div class="summary" aria-label="Legality totals">
				{#each filters as item (item.key)}
					<button
						type="button"
						data-save-legality-control
						data-pksx-control-category="small"
						class:active={filter === item.key}
						aria-pressed={filter === item.key}
						onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
						onclick={() => selectFilter(item.key)}
					>
						<strong>{item.count}</strong><span>{item.label}</span>
					</button>
				{/each}
			</div>

			{#if counts.illegal > 0}
				<section class="batch-panel" aria-label="Batch Legality Fix">
					{#if reportState.batch.status === 'idle'}
						<div class="batch-intro">
							<div>
								<h3>Supported Legality Fixes</h3>
								<p>
									Preview changes for Illegal Pokemon. Warnings and Fishy results stay unchanged.
								</p>
							</div>
							<button
								type="button"
								data-save-legality-control
								data-pksx-control-category="small"
								disabled={stale}
								onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
								onclick={onPreviewFixes}>Preview supported fixes</button
							>
						</div>
					{:else if reportState.batch.status === 'previewing'}
						<div class="batch-progress" aria-live="polite">
							<DelayedSpinner active label="Previewing supported Legality Fixes" />
							<span>Warnings and Fishy results are excluded.</span>
						</div>
					{:else}
						<div class="batch-heading" aria-live="polite">
							<div>
								<h3>
									{reportState.batch.status === 'applied'
										? 'Applied Legality Fixes'
										: 'Legality Fix preview'}
								</h3>
								<p>{fixableCount} supported, {unfixableCount} could not be included.</p>
								<p>Warnings and Fishy results stay unchanged.</p>
							</div>
							{#if reportState.batch.status === 'preview-ready'}
								<button
									type="button"
									data-save-legality-control
									data-pksx-control-category="small"
									disabled={fixableCount === 0 || stale}
									onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
									onclick={onApplyFixes}
									>Apply {fixableCount} supported {fixableCount === 1 ? 'fix' : 'fixes'}</button
								>
							{:else if reportState.batch.status === 'applying' || reportState.batch.status === 'committing'}
								<DelayedSpinner
									active
									label={reportState.batch.status === 'committing'
										? 'Saving supported Legality Fixes'
										: 'Applying supported Legality Fixes'}
								/>
							{:else if reportState.batch.status === 'cancelled' || reportState.batch.status === 'error'}
								<button
									type="button"
									data-save-legality-control
									data-pksx-control-category="small"
									disabled={stale}
									onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
									onclick={onPreviewFixes}>Preview again</button
								>
							{/if}
						</div>
						<div class="batch-entries" role="list" aria-label="Legality Fix outcomes">
							{#each batchEntries as entry (entry.result.id)}
								<article class:unfixable={entry.status === 'unfixable'} role="listitem">
									<div class="result-copy">
										<span class="classification">{entry.status}</span>
										<strong>{entry.result.pokemonLabel}</strong>
										<span class="location">{entry.result.location}</span>
										{#if entry.status === 'unfixable'}
											<p>{entry.reason}</p>
										{:else}
											<ul>
												{#each entry.changes as change (`${change.field}:${change.before}:${change.after}`)}
													<li>
														<strong>{change.field}</strong>: {change.before} to {change.after}
													</li>
												{/each}
											</ul>
										{/if}
									</div>
								</article>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			<div class="results" role="list" aria-label={`${filter} Legality Report results`}>
				{#each filtered as result (result.id)}
					<article class={result.classification} role="listitem">
						<div class="result-copy">
							<span class="classification">{result.classification}</span>
							<strong>{result.pokemonLabel}</strong>
							{#if result.pokemonLabel !== result.speciesName}<small>{result.speciesName}</small
								>{/if}
							<span class="location">{result.location}</span>
							<p>{result.firstIssue}</p>
						</div>
						<div class="actions">
							<button
								id={saveFileLegalityOpenControlId(result)}
								type="button"
								data-save-legality-control
								data-pksx-control-category="small"
								disabled={stale || batchBusy}
								onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
								onclick={() => void onOpenPokemonReport(result)}>Open report</button
							>
							<button
								type="button"
								data-save-legality-control
								data-pksx-control-category="small"
								disabled={stale || batchBusy}
								onfocus={(event) => (activeControl = controls().indexOf(event.currentTarget))}
								onclick={() => void onJumpToSlot(result)}>Go to Slot</button
							>
						</div>
					</article>
				{:else}
					<p class="empty">No results in this filter.</p>
				{/each}
			</div>
		{/if}
	</div>
</TakeoverFrame>

<style>
	.save-legality-report {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
	}

	header,
	.summary,
	.actions,
	.stale,
	.batch-intro,
	.batch-heading {
		display: flex;
		align-items: center;
	}

	header {
		justify-content: space-between;
		gap: var(--pksx-space-3);
	}

	header div,
	.state,
	.loading,
	.result-copy {
		display: grid;
		gap: var(--pksx-space-1);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--pksx-type-title);
	}

	header p,
	.location,
	small,
	.result-copy p,
	.state p,
	.loading p {
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-caption);
	}

	.kicker,
	.classification {
		font: 700 var(--pksx-type-caption) / 1 var(--pksx-font-mono);
		text-transform: uppercase;
	}

	.kicker {
		color: var(--pksx-color-accent-primary);
	}

	.close,
	.state button,
	.stale button,
	.summary button,
	.actions button,
	.batch-panel button {
		min-height: var(--pksx-small-control-height);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font: inherit;
		cursor: pointer;
	}

	.close,
	.state button,
	.stale button,
	.actions button,
	.batch-panel button {
		padding: 0 var(--pksx-space-2);
	}

	button:hover:not(:disabled),
	button:focus-visible,
	.summary button.active {
		border-color: var(--pksx-color-accent-primary);
		background: var(--pksx-color-accent-wash);
		outline: none;
	}

	.loading,
	.state {
		place-content: center;
		justify-items: center;
		padding: var(--pksx-space-4);
		text-align: center;
	}

	.loading progress {
		width: min(360px, 80%);
	}

	.stale {
		justify-content: space-between;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-feedback-warning);
		border-radius: var(--pksx-radius-small);
		font-size: var(--pksx-type-label);
	}

	.summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--pksx-space-1);
	}

	.summary button {
		display: grid;
		justify-items: center;
		gap: 1px;
		padding: var(--pksx-space-1);
	}

	.summary strong {
		font-size: var(--pksx-type-title);
	}

	.summary span {
		font-size: var(--pksx-type-caption);
	}

	.batch-panel {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-panel);
	}

	.batch-intro,
	.batch-heading {
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	.batch-intro > div,
	.batch-heading > div,
	.batch-progress {
		display: grid;
		gap: var(--pksx-space-1);
	}

	.batch-panel p,
	.batch-panel li,
	.batch-progress span {
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-caption);
	}

	.batch-progress {
		justify-items: center;
		text-align: center;
	}

	.batch-entries {
		max-height: min(210px, 34cqh);
		display: grid;
		gap: var(--pksx-space-1);
		overflow-y: auto;
	}

	.batch-entries article {
		border-left-color: var(--pksx-color-accent-primary);
	}

	.batch-entries article.unfixable {
		border-left-color: var(--pksx-color-feedback-danger);
	}

	.batch-entries ul {
		margin: var(--pksx-space-1) 0 0;
		padding-left: var(--pksx-space-3);
	}

	.results {
		min-height: 0;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-1);
		overflow-y: auto;
	}

	article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-border-subtle);
		border-left-width: var(--pksx-space-1);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-subtle);
	}

	article.legal {
		border-left-color: var(--pksx-color-feedback-success);
	}

	article.warning {
		border-left-color: var(--pksx-color-feedback-warning);
	}

	article.illegal {
		border-left-color: var(--pksx-color-feedback-danger);
	}

	.classification {
		color: var(--pksx-color-text-secondary);
	}

	.actions {
		gap: var(--pksx-space-1);
	}

	.actions button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.empty {
		padding: var(--pksx-space-4);
		text-align: center;
	}

	@container pksx-takeover (max-width: 620px) {
		article {
			grid-template-columns: 1fr;
		}

		.actions {
			justify-content: stretch;
		}

		.actions button {
			flex: 1;
		}
	}
</style>
