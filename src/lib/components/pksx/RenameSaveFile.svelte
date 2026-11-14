<script lang="ts">
	import { tick } from 'svelte';
	import { getSaveDisplayName, type StoredSaveFile } from '$lib/pksx/saves';
	import TakeoverFrame from './TakeoverFrame.svelte';

	let {
		file,
		busy,
		onApply,
		onCancel
	}: {
		file: StoredSaveFile;
		busy: boolean;
		onApply: (name: string | null) => Promise<void>;
		onCancel: () => void;
	} = $props();
	let draft = $state('');
	let reset = $state(false);
	let field: HTMLInputElement;

	function initialize(node: HTMLInputElement) {
		field = node;
		draft = getSaveDisplayName(file);
		void tick().then(() => {
			node.focus();
			node.select();
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
		if (event.target instanceof HTMLInputElement) return;
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			const controls = Array.from(
				document.querySelectorAll<HTMLElement>('[data-rename-control]:not(:disabled)')
			);
			const index = controls.indexOf(document.activeElement as HTMLElement);
			const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
			controls[Math.max(0, Math.min(controls.length - 1, index + offset))]?.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />
<TakeoverFrame labelledby="rename-title" {busy} onBack={onCancel}>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			if (draft.trim() && !busy) void onApply(reset ? null : draft);
		}}
	>
		<h2 id="rename-title">Rename Save File</h2>
		<p>{file.originalFileName ?? 'Save File'}</p>
		<label for="save-display-name">Display name</label>
		<input
			id="save-display-name"
			data-rename-control
			{@attach initialize}
			value={draft}
			oninput={(event) => {
				draft = event.currentTarget.value;
				reset = false;
			}}
			onkeydown={(event) => {
				if (event.key === 'ArrowDown') {
					event.preventDefault();
					document.getElementById('rename-apply')?.focus();
				}
			}}
			disabled={busy}
		/>
		{#if !draft.trim()}<p role="status">Enter a name for this Save File.</p>{/if}
		<div class="commands">
			<button id="rename-apply" data-rename-control type="submit" disabled={busy || !draft.trim()}
				>Apply</button
			>
			<button data-rename-control type="button" disabled={busy} onclick={onCancel}>Cancel</button>
			<button
				data-rename-control
				type="button"
				disabled={busy}
				onclick={() => {
					draft = file.originalFileName ?? 'Save File';
					reset = true;
					field.focus();
				}}>Reset to original filename</button
			>
		</div>
	</form>
</TakeoverFrame>

<style>
	form {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
		min-height: 0;
	}
	h2,
	p {
		margin: 0;
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: var(--pksx-type-display);
	}
	p,
	label,
	button {
		font-size: var(--pksx-type-label);
	}
	input {
		font-size: var(--pksx-type-editable);
	}
	input,
	button {
		min-height: var(--pksx-control-height);
		border: var(--pksx-border-width) solid var(--rule);
		border-radius: var(--pksx-radius-medium);
		background: var(--paper-deep);
		color: var(--ink);
		padding: var(--pksx-space-2);
	}
	.commands {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-2);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--rust);
	}
</style>
