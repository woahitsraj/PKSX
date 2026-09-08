<script lang="ts">
	import Combobox from '$lib/components/pksx/Combobox.svelte';
	import type { InventoryPocketProjection } from '$lib/engine';
	import type { PrototypeEditor } from './editor-state.svelte';
	import type { Catalogue } from './prototype-data';

	let {
		editor,
		pocket,
		catalogue,
		catalogueError = null,
		compact = false
	}: {
		editor: PrototypeEditor;
		pocket: InventoryPocketProjection;
		catalogue: Catalogue | null;
		catalogueError?: string | null;
		compact?: boolean;
	} = $props();

	let selected = $state('');
	let quantity = $state(1);
	const pending = $derived(editor.pending.has(`add:${pocket.key}`));
	const available = $derived.by(() => {
		const have = new Set(pocket.items.map((item) => item.id));
		return (catalogue?.[pocket.key] ?? []).filter((item) => !have.has(item.id));
	});
	const option = $derived(available.find((item) => String(item.id) === selected));
	const options = $derived(
		available.map((item) => ({
			value: String(item.id),
			label: item.name,
			detail: `Max ${item.maxQuantity}`
		}))
	);
	const status = $derived(
		catalogueError
			? catalogueError
			: !catalogue
				? 'Loading items...'
				: pocket.full
					? `${pocket.label} is full`
					: `${available.length} available`
	);

	async function add() {
		if (!option) return;
		const ok = await editor.addItem(pocket.key, option, quantity);
		if (ok) {
			selected = '';
			quantity = 1;
		}
	}
</script>

<div class={['sf-row add', compact && 'compact']} data-state={pending ? 'pending' : 'idle'}>
	<div class="picker">
		<Combobox
			id={`sf-add-${pocket.key}`}
			ariaLabel={`Add an item to ${pocket.label}`}
			value={selected}
			{options}
			placeholder={`Add to ${pocket.label}`}
			searchLabel={`Search items for ${pocket.label}`}
			disabled={pending || pocket.full || !catalogue || Boolean(catalogueError)}
			onSelect={(value) => {
				selected = value;
				quantity = 1;
			}}
		/>
	</div>
	<input
		class="sf-input num"
		type="number"
		inputmode="numeric"
		min="1"
		max={option?.maxQuantity ?? 1}
		value={quantity}
		aria-label="Quantity to add"
		disabled={!option || pending}
		oninput={(event) => (quantity = Number(event.currentTarget.value))}
	/>
	<button
		type="button"
		class={['sf-ctrl primary', compact && 'sm']}
		disabled={!option || pending || quantity < 1 || quantity > (option?.maxQuantity ?? 1)}
		onclick={add}>{pending ? 'Saving...' : 'Add'}</button
	>
	<span class={['sf-status', catalogueError && 'invalid']}>
		{status}
		{#if catalogueError}<button type="button" class="sf-ctrl sm">Retry</button>{/if}
	</span>
</div>

<style>
	.add {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		grid-template-areas:
			'picker qty add'
			'status status status';
		gap: var(--sf-s1) var(--sf-s2);
		align-items: center;
		min-width: 0;
		padding: var(--sf-s1);
		border: 1px solid transparent;
		border-radius: var(--sf-r-md);
	}

	.picker {
		grid-area: picker;
		min-width: 0;
	}

	.add input {
		grid-area: qty;
		width: calc(3ch + var(--sf-s2) * 2 + 2px);
		text-align: center;
	}

	.add > button {
		grid-area: add;
	}

	.sf-status {
		grid-area: status;
		display: flex;
		align-items: center;
		gap: var(--sf-s2);
	}

	.compact input {
		height: var(--sf-control-sm);
	}
</style>
