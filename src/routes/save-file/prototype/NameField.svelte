<script lang="ts">
	import type { PrototypeEditor } from './editor-state.svelte';

	let { editor, id = 'sf-trainer-name' }: { editor: PrototypeEditor; id?: string } = $props();

	let editing = $state(false);
	let error = $state<string | null>(null);
	const committed = $derived(editor.profile.trainerName ?? '');
	// Derived with override: resets to the committed value after every commit or abandon.
	let draft = $derived(committed);
	const pending = $derived(editor.pending.has('trainer-name'));
	const fieldState = $derived(
		pending ? 'pending' : error ? 'invalid' : editing && draft !== committed ? 'draft' : 'idle'
	);
	const max = $derived(editor.profile.trainerNameMaxLength);

	async function confirm() {
		const problem = editor.validateName(draft);
		if (problem) {
			error = problem;
			return false;
		}
		error = null;
		editing = false;
		const ok = await editor.commitTrainerName(draft);
		if (!ok) draft = committed;
		return true;
	}

	function abandon() {
		draft = committed;
		error = null;
		editing = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void confirm();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			abandon();
		}
	}

	function onBlur() {
		if (!editing) return;
		if (editor.validateName(draft)) abandon();
		else void confirm();
	}
</script>

<div class="sf-field name" data-state={fieldState} style:--max={max}>
	<label class="sf-caption" for={id}>Trainer name</label>
	<input
		{id}
		class="sf-input"
		maxlength={max}
		value={draft}
		aria-busy={pending}
		aria-invalid={error !== null}
		aria-describedby={`${id}-status`}
		disabled={pending}
		oninput={(event) => {
			editing = true;
			draft = event.currentTarget.value;
			if (error && !editor.validateName(draft)) error = null;
		}}
		onkeydown={onKeydown}
		onblur={onBlur}
	/>
	<p id={`${id}-status`} class={['sf-status', fieldState]} aria-live="polite">
		{#if pending}Saving...{:else if error}{error}{:else if fieldState === 'draft'}Enter saves · Esc
			restores{:else}{draft.length}/{max}{/if}
	</p>
</div>

<style>
	.name {
		display: grid;
		gap: var(--sf-s1);
		min-width: 0;
	}

	.name input {
		width: calc(var(--max) * 1.3ch + var(--sf-s2) * 2 + 2px);
		min-width: 10ch;
		max-width: 100%;
	}
</style>
