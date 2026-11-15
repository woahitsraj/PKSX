<script lang="ts">
	import { tick } from 'svelte';
	import TakeoverFrame from './TakeoverFrame.svelte';
	import type { StorageBox } from '$lib/pksx/pokemon-storage-catalog';
	import type { SaveStorageBatch } from '$lib/pksx/save-storage-batch';
	let {
		mode,
		boxes,
		onPreview,
		onApply,
		onClose
	}: {
		mode: 'copy' | 'move';
		boxes: StorageBox[];
		onPreview: (boxId: string) => Promise<SaveStorageBatch>;
		onApply: (batch: SaveStorageBatch) => Promise<void>;
		onClose: () => void;
	} = $props();
	let preview = $state.raw<SaveStorageBatch | null>(null);
	let error = $state('');
	let busy = $state(false);
	async function prepare(boxId: string) {
		busy = true;
		error = '';
		try {
			preview = await onPreview(boxId);
		} catch (cause) {
			error = `${cause instanceof Error ? cause.message : 'Batch preview failed.'} Adjust the selection or choose another Storage Box and preview again.`;
		} finally {
			busy = false;
			await focusStep();
		}
	}
	async function focusStep() {
		await tick();
		document
			.querySelector<HTMLButtonElement>(preview ? '#apply-storage-batch' : '.batch .content button')
			?.focus();
	}
	async function changeDestination() {
		preview = null;
		await focusStep();
	}
	async function apply() {
		if (!preview || busy) return;
		busy = true;
		error = '';
		try {
			await onApply(preview);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Batch failed.';
			preview = null;
		} finally {
			busy = false;
			if (!preview) await focusStep();
		}
	}
	function handleKeydown(event: KeyboardEvent) {
		const controls = [
			...document.querySelectorAll<HTMLButtonElement>('.batch button:not(:disabled)')
		];
		const index = controls.findIndex((control) => control === document.activeElement);
		if (event.key === 'Escape' || event.key === 'Backspace') {
			event.preventDefault();
			back();
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			controls[index]?.click();
		} else if (event.key.startsWith('Arrow')) {
			event.preventDefault();
			const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
			controls[Math.max(0, Math.min(controls.length - 1, index + offset))]?.focus();
		}
	}

	function back() {
		if (!busy) onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<TakeoverFrame labelledby="storage-batch-title" {busy} onBack={back}>
	<section class="batch">
		<header>
			<h2 id="storage-batch-title">{mode === 'copy' ? 'Copy' : 'Move'} to Storage</h2>
			<button type="button" data-controller-back disabled={busy} onclick={back}>Cancel</button>
		</header>
		{#if error}<p role="alert">{error}</p>{/if}
		<div class="content">
			{#if preview}
				<p>Review every destination. Occupied Slots are kept.</p>
				<ol>
					{#each preview.prepared.manifest.records.slice(-preview.labels.length) as record, index (record.recordId)}
						<li>
							{preview.labels[index]} → Storage Box {boxes.findIndex(
								(box) => box.id === record.placement?.storageBoxId
							) + 1}, Slot {(record.placement?.slot ?? 0) + 1}
						</li>
					{/each}
				</ol>
			{:else}
				<p>
					Choose the first destination Storage Box. Empty Slots in this and later boxes will be
					used.
				</p>
				{#each boxes as box, index (box.id)}
					<button type="button" disabled={busy} onclick={() => prepare(box.id)}
						>Storage Box {index + 1}{box.name ? `: ${box.name}` : ''}</button
					>
				{/each}
			{/if}
		</div>
		{#if preview}
			<footer>
				<button type="button" disabled={busy} onclick={changeDestination}>Change destination</button
				>
				<button
					id="apply-storage-batch"
					class="primary"
					type="button"
					disabled={busy}
					onclick={apply}>Apply</button
				>
			</footer>
		{/if}
	</section>
</TakeoverFrame>

<style>
	.batch {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
	}
	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}
	footer {
		justify-content: flex-end;
	}
	h2,
	p,
	ol {
		margin: 0;
	}
	h2 {
		font: 760 var(--pksx-type-title) / 1.1 var(--pksx-font-sans);
	}
	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		line-height: 1.3;
	}
	p[role='alert'] {
		color: var(--pksx-color-feedback-danger);
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--pksx-space-2);
	}
	ol {
		padding: 0;
		list-style: none;
	}
	li {
		padding: var(--pksx-space-2) 0;
		border-bottom: 1px solid var(--rule);
		font-size: var(--pksx-type-body);
	}
	button {
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-1) max(8px, var(--pksx-space-2));
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-weight: 720;
		cursor: pointer;
	}
	.content button {
		text-align: left;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	button:focus-visible {
		outline: 3px solid var(--pksx-color-accent-ring);
		outline-offset: -3px;
	}
	button.primary {
		border-color: var(--rust);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
		--pksx-color-accent-ring: var(--pksx-color-on-accent);
	}
</style>
