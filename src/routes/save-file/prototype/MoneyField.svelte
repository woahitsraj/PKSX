<script lang="ts">
	import type { PrototypeEditor } from './editor-state.svelte';
	import { formatMoney } from './prototype-data';

	let {
		editor,
		id = 'sf-money',
		inline = false
	}: { editor: PrototypeEditor; id?: string; inline?: boolean } = $props();

	let editing = $state(false);
	let error = $state<string | null>(null);
	const committed = $derived(editor.money.value ?? 0);
	// Derived with override: resets to the committed value after every commit or abandon.
	let draft = $derived(String(committed));
	const pending = $derived(editor.pending.has('money'));
	const fieldState = $derived(
		pending
			? 'pending'
			: error
				? 'invalid'
				: editing && Number(draft) !== committed
					? 'draft'
					: 'idle'
	);
	const digits = $derived(formatMoney(editor.money.max).length);

	async function confirm(value = Number(draft)) {
		const problem = editor.validateMoney(String(value));
		if (problem) {
			error = problem;
			return;
		}
		error = null;
		editing = false;
		const ok = await editor.commitMoney(value);
		if (!ok) draft = String(committed);
	}

	function abandon() {
		draft = String(committed);
		error = null;
		editing = false;
	}

	// An operator consumes a valid typed draft and produces one combined commit (#209).
	function step(delta: number) {
		const base = editing && !editor.validateMoney(draft) ? Number(draft) : committed;
		const next = Math.min(editor.money.max, Math.max(editor.money.min, base + delta));
		void confirm(next);
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
</script>

<div class={['sf-field money', inline && 'inline']} data-state={fieldState} style:--digits={digits}>
	<label class="sf-caption" for={id}>Money</label>
	<div class="control">
		<button
			type="button"
			class="sf-ctrl icon"
			aria-label="Decrease money"
			disabled={pending || committed <= editor.money.min}
			onclick={() => step(-1)}>−</button
		>
		<input
			{id}
			class="sf-input num"
			type="number"
			inputmode="numeric"
			min={editor.money.min}
			max={editor.money.max}
			value={draft}
			aria-busy={pending}
			aria-invalid={error !== null}
			aria-describedby={`${id}-status`}
			disabled={pending}
			oninput={(event) => {
				editing = true;
				draft = event.currentTarget.value;
				if (error && !editor.validateMoney(draft)) error = null;
			}}
			onkeydown={onKeydown}
			onblur={() => editing && (editor.validateMoney(draft) ? abandon() : void confirm())}
		/>
		<button
			type="button"
			class="sf-ctrl icon"
			aria-label="Increase money"
			disabled={pending || committed >= editor.money.max}
			onclick={() => step(1)}>+</button
		>
	</div>
	<p id={`${id}-status`} class={['sf-status', fieldState]} aria-live="polite">
		{#if pending}Saving...{:else if error}{error}{:else if fieldState === 'draft'}Enter saves · Esc
			restores{:else}of {formatMoney(editor.money.max)}{/if}
	</p>
</div>

<style>
	.money {
		display: grid;
		gap: var(--sf-s1);
		min-width: 0;
	}

	.money.inline {
		grid-template-columns: auto auto;
		grid-template-areas:
			'label control'
			'status control';
		align-items: center;
		column-gap: var(--sf-s3);
	}

	.money.inline label {
		grid-area: label;
	}

	.money.inline .control {
		grid-area: control;
	}

	.money.inline .sf-status {
		grid-area: status;
	}

	.control {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--sf-s1);
		align-items: center;
		width: fit-content;
		max-width: 100%;
	}

	.control input {
		width: calc(var(--digits) * 1ch + var(--sf-s2) * 2 + 2px);
		font-size: var(--sf-title);
	}
</style>
