<script lang="ts">
	import type { InventoryItemProjection } from '$lib/engine';
	import type { PrototypeEditor } from './editor-state.svelte';

	let {
		editor,
		pocket,
		item,
		compact = false
	}: {
		editor: PrototypeEditor;
		pocket: string;
		item: InventoryItemProjection;
		compact?: boolean;
	} = $props();

	let editing = $state(false);
	let error = $state<string | null>(null);
	let confirmingRemove = $state(false);
	const qtyKey = $derived(`qty:${pocket}:${item.id}`);
	const removeKey = $derived(`remove:${pocket}:${item.id}`);
	// Derived with override: resets to the committed value after every commit or abandon.
	let draft = $derived(String(item.quantity));
	const pending = $derived(editor.pending.has(qtyKey) || editor.pending.has(removeKey));
	const fieldState = $derived(
		pending
			? 'pending'
			: error
				? 'invalid'
				: editing && Number(draft) !== item.quantity
					? 'draft'
					: 'idle'
	);
	const digits = $derived(String(item.maxQuantity).length);
	const inputId = $derived(`sf-qty-${pocket}-${item.id}`);

	async function confirm(value = Number(draft)) {
		const problem = editor.validateQuantity(value, item.maxQuantity);
		if (problem) {
			error = problem;
			return;
		}
		error = null;
		editing = false;
		const ok = await editor.setQuantity(pocket, item.id, value);
		if (!ok) draft = String(item.quantity);
	}

	function abandon() {
		draft = String(item.quantity);
		error = null;
		editing = false;
	}

	function step(delta: number) {
		const base =
			editing && !editor.validateQuantity(Number(draft), item.maxQuantity)
				? Number(draft)
				: item.quantity;
		void confirm(Math.min(item.maxQuantity, Math.max(1, base + delta)));
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

	async function remove() {
		confirmingRemove = false;
		await editor.removeItem(pocket, item.id);
	}
</script>

<div
	class={['sf-field stepper', compact && 'compact']}
	data-state={fieldState}
	role="group"
	aria-label={`${item.name} quantity`}
>
	{#if confirmingRemove}
		<span class="confirm-copy">Remove {item.name}?</span>
		<button type="button" class={['sf-ctrl danger', compact && 'sm']} onclick={remove}
			>Confirm Remove</button
		>
		<button
			type="button"
			class={['sf-ctrl', compact && 'sm']}
			onclick={() => (confirmingRemove = false)}
			onkeydown={(event) => event.key === 'Escape' && (confirmingRemove = false)}>Cancel</button
		>
	{:else}
		<button
			type="button"
			class={['sf-ctrl icon', compact && 'sm']}
			aria-label={`Decrease ${item.name}`}
			disabled={pending || item.quantity <= 1}
			onclick={() => step(-1)}>−</button
		>
		<input
			id={inputId}
			class="sf-input num"
			type="number"
			inputmode="numeric"
			min="1"
			max={item.maxQuantity}
			value={draft}
			style:--digits={digits}
			aria-label={`${item.name} quantity`}
			aria-busy={pending}
			aria-invalid={error !== null}
			aria-describedby={error ? `${inputId}-status` : undefined}
			disabled={pending}
			oninput={(event) => {
				editing = true;
				draft = event.currentTarget.value;
				if (error && !editor.validateQuantity(Number(draft), item.maxQuantity)) error = null;
			}}
			onkeydown={onKeydown}
			onblur={() =>
				editing &&
				(editor.validateQuantity(Number(draft), item.maxQuantity) ? abandon() : void confirm())}
		/>
		<button
			type="button"
			class={['sf-ctrl icon', compact && 'sm']}
			aria-label={`Increase ${item.name}`}
			disabled={pending || item.quantity >= item.maxQuantity}
			onclick={() => step(1)}>+</button
		>
		<button
			type="button"
			class={['sf-ctrl danger', compact && 'sm']}
			disabled={pending}
			onclick={() => (confirmingRemove = true)}>Remove</button
		>
		{#if pending}
			<span class="sf-status pending">Saving...</span>
		{:else if error}
			<span id={`${inputId}-status`} class="sf-status invalid" aria-live="polite">{error}</span>
		{/if}
	{/if}
</div>

<style>
	.stepper {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--sf-s1);
		min-width: 0;
	}

	.stepper input {
		width: calc(max(var(--digits), 2) * 1ch + var(--sf-s2) * 2 + 2px);
		text-align: center;
	}

	.compact input {
		height: var(--sf-control-sm);
		padding: 0 var(--sf-s1);
		font-size: var(--sf-label);
	}

	.confirm-copy {
		min-width: 0;
		overflow: hidden;
		font-size: var(--sf-label);
		font-weight: 650;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sf-status {
		flex-basis: 100%;
		text-align: right;
	}
</style>
