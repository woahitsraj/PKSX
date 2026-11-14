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
			await tick();
			document.getElementById('apply-storage-batch')?.focus();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Batch preview failed.';
		} finally {
			busy = false;
		}
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
				<button
					type="button"
					disabled={busy}
					onclick={() => {
						preview = null;
					}}>Change destination</button
				>
				<button id="apply-storage-batch" type="button" disabled={busy} onclick={apply}>Apply</button
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
		padding: var(--pksx-space-2);
	}
	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}
	h2,
	p {
		margin: 0;
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--pksx-space-2);
	}
	button {
		min-height: var(--pksx-control-height);
		border-radius: var(--pksx-radius-md);
		padding-inline: var(--pksx-space-2);
	}
</style>
