<script lang="ts">
	import { tick } from 'svelte';
	import type { StorageBox } from '$lib/pksx/pokemon-storage-catalog';
	import TakeoverFrame from './TakeoverFrame.svelte';

	type Props = {
		boxes: StorageBox[];
		occupied: Record<string, number>;
		deleteBlocked: Record<string, boolean>;
		onAdd: () => Promise<string | null>;
		onRename: (id: string, name: string | null) => Promise<string | null>;
		onMove: (id: string, destination: number) => Promise<string | null>;
		onDelete: (id: string) => Promise<string | null>;
		onClose: () => void;
	};
	let { boxes, occupied, deleteBlocked, onAdd, onRename, onMove, onDelete, onClose }: Props =
		$props();
	let editing = $state<string | null>(null);
	let deleting = $state<string | null>(null);
	let draft = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	const activeBox = $derived(boxes.find((box) => box.id === (editing ?? deleting)));

	function label(box: StorageBox, index: number) {
		return box.name?.trim() || `Box ${String(index + 1).padStart(2, '0')}`;
	}

	async function focusRow(id: string, action: 'rename' | 'delete', index: number) {
		await tick();
		const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-box-action]')];
		const matching = buttons.find(
			(button) => button.dataset.boxId === id && button.dataset.boxAction === action
		);
		const fallbackId = boxes[Math.min(index, boxes.length - 1)]?.id;
		const fallback = buttons.find(
			(button) => button.dataset.boxId === fallbackId && button.dataset.boxAction === 'rename'
		);
		(matching ?? fallback ?? document.querySelector<HTMLButtonElement>('.organizer .add'))?.focus();
	}

	function back() {
		if (busy) return;
		if (editing || deleting) {
			const id = (editing ?? deleting)!;
			const action = editing ? 'rename' : 'delete';
			const index = boxes.findIndex((box) => box.id === id);
			editing = deleting = null;
			error = null;
			void focusRow(id, action, index);
		} else onClose();
	}

	async function run(action: () => Promise<string | null>) {
		if (busy) return;
		const id = editing ?? deleting;
		const rowAction = editing ? 'rename' : 'delete';
		const index = boxes.findIndex((box) => box.id === id);
		busy = true;
		error = null;
		try {
			error = await action();
			if (!error) {
				editing = deleting = null;
				if (id) void focusRow(id, rowAction, index);
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Storage Box change failed.';
		} finally {
			busy = false;
		}
	}
</script>

<TakeoverFrame labelledby="storage-box-organizer-title" onBack={back}>
	<div class="organizer" aria-busy={busy}>
		<header>
			<h2 id="storage-box-organizer-title">Organize Storage Boxes</h2>
			<button
				type="button"
				data-organizer-control
				data-pksx-control-category="small"
				data-organizer-back
				onclick={back}
				disabled={busy}>Close</button
			>
		</header>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if editing && activeBox}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void run(() => onRename(activeBox.id, draft.trim() || null));
				}}
			>
				<label for="storage-box-name">Name for {label(activeBox, boxes.indexOf(activeBox))}</label>
				<input
					id="storage-box-name"
					data-organizer-control
					data-pksx-control-category="composition"
					bind:value={draft}
					disabled={busy}
				/>
				<div class="actions">
					<button
						type="button"
						data-organizer-control
						data-pksx-control-category="small"
						onclick={back}
						disabled={busy}>Cancel</button
					>
					<button
						type="submit"
						data-organizer-control
						data-pksx-control-category="small"
						disabled={busy}>Save name</button
					>
				</div>
			</form>
		{:else if deleting && activeBox}
			<div class="confirmation">
				<p>
					Delete {label(activeBox, boxes.indexOf(activeBox))}? This empty Storage Box will be
					removed.
				</p>
				<div class="actions">
					<button
						id="storage-box-delete-cancel"
						type="button"
						data-organizer-control
						data-pksx-control-category="small"
						onclick={back}
						disabled={busy}>Cancel</button
					>
					<button
						type="button"
						data-organizer-control
						data-pksx-control-category="small"
						disabled={busy}
						onclick={() => void run(() => onDelete(activeBox.id))}>Delete Storage Box</button
					>
				</div>
			</div>
		{:else}
			<div class="list" role="list" aria-label="Storage Boxes">
				{#each boxes as box, index (box.id)}
					<div class="row" role="listitem">
						<div>
							<strong>{label(box, index)}</strong><span>{occupied[box.id] ?? 0} of 30 occupied</span
							>
						</div>
						<div class="actions">
							<button
								type="button"
								data-box-id={box.id}
								data-box-action="rename"
								data-organizer-control
								data-pksx-control-category="small"
								disabled={busy}
								onclick={() => {
									editing = box.id;
									draft = box.name ?? '';
									error = null;
									void tick().then(() => document.getElementById('storage-box-name')?.focus());
								}}>Rename</button
							>
							<button
								type="button"
								data-organizer-control
								data-pksx-control-category="small"
								disabled={busy || index === 0}
								onclick={() => void run(() => onMove(box.id, index - 1))}>Move up</button
							>
							<button
								type="button"
								data-organizer-control
								data-pksx-control-category="small"
								disabled={busy || index === boxes.length - 1}
								onclick={() => void run(() => onMove(box.id, index + 1))}>Move down</button
							>
							<button
								type="button"
								data-box-id={box.id}
								data-box-action="delete"
								data-organizer-control
								data-pksx-control-category="small"
								disabled={busy || boxes.length === 1 || deleteBlocked[box.id]}
								aria-label={`Delete ${label(box, index)}`}
								onclick={() => {
									deleting = box.id;
									error = null;
									void tick().then(() =>
										document.getElementById('storage-box-delete-cancel')?.focus()
									);
								}}>Delete</button
							>
						</div>
					</div>
				{/each}
			</div>
			<button
				type="button"
				data-organizer-control
				data-pksx-control-category="small"
				class="add"
				disabled={busy}
				onclick={() => void run(onAdd)}>Add Storage Box</button
			>
		{/if}
	</div>
</TakeoverFrame>

<style>
	.organizer {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		color: var(--ink);
	}
	header,
	.row,
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}
	header h2 {
		margin: 0;
		font-size: var(--pksx-type-title);
	}
	.list {
		min-height: 0;
		overflow: auto;
		display: grid;
		align-content: start;
		gap: var(--pksx-space-2);
	}
	.row {
		flex-wrap: wrap;
	}
	.actions {
		flex-wrap: wrap;
	}
	.row,
	form,
	.confirmation {
		padding: var(--pksx-space-2);
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
	}
	.row > div:first-child,
	form,
	.confirmation {
		display: grid;
		gap: var(--pksx-space-1);
	}
	.row span {
		color: var(--ink-soft);
		font-size: var(--pksx-type-caption);
	}
	button,
	input {
		padding: 0 var(--pksx-space-2);
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-hi);
		color: var(--ink);
		font: inherit;
	}
	button {
		min-height: var(--pksx-small-control-height);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--rust);
	}
	form input {
		min-height: var(--pksx-control-height);
	}
	form .actions,
	.confirmation .actions {
		justify-content: end;
	}
	.add {
		align-self: start;
	}
	.error {
		margin: 0;
		color: var(--rust);
	}
</style>
