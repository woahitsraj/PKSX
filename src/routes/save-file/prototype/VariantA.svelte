<script lang="ts">
	// A. Sheet: one scrolling column, Trainer then Bag, one pocket shown at a time via a chip row.
	import AddItemCommand from './AddItemCommand.svelte';
	import GenderField from './GenderField.svelte';
	import MoneyField from './MoneyField.svelte';
	import NameField from './NameField.svelte';
	import QuantityStepper from './QuantityStepper.svelte';
	import type { PrototypeEditor } from './editor-state.svelte';
	import type { Catalogue } from './prototype-data';

	let {
		editor,
		catalogue,
		catalogueError,
		fileName
	}: {
		editor: PrototypeEditor;
		catalogue: Catalogue | null;
		catalogueError: string | null;
		fileName: string;
	} = $props();

	let activeKey = $state('');
	const trainerSupported = $derived(
		editor.profile.trainerNameSupported || editor.profile.genderSupported
	);
	const bagSupported = $derived(editor.money.supported || editor.projection.inventory.supported);
	const pocket = $derived(
		editor.pockets.find((p) => p.key === activeKey) ?? editor.pockets[0] ?? null
	);
</script>

<div class="sf-proto sheet-root">
	<div class="sheet">
		<p class="sf-filename">{fileName}</p>

		{#if trainerSupported}
			<section aria-labelledby="sheet-trainer">
				<h2 id="sheet-trainer" class="sf-title">Trainer</h2>
				<div class="fields">
					{#if editor.profile.trainerNameSupported}<NameField {editor} />{/if}
					{#if editor.profile.genderSupported}<GenderField {editor} />{/if}
				</div>
			</section>
		{/if}

		{#if bagSupported}
			<section aria-labelledby="sheet-bag">
				<h2 id="sheet-bag" class="sf-title">Bag</h2>
				{#if editor.money.supported}<MoneyField {editor} />{/if}

				{#if editor.projection.inventory.supported}
					<div class="pockets" role="tablist" aria-label="Pockets">
						{#each editor.pockets as candidate (candidate.key)}
							<button
								type="button"
								role="tab"
								class="sf-ctrl sm"
								aria-selected={pocket?.key === candidate.key}
								onclick={() => (activeKey = candidate.key)}
							>
								{candidate.label}
								<span class="sf-count">{candidate.items.length}/{candidate.capacity}</span>
							</button>
						{/each}
					</div>

					{#if pocket}
						<AddItemCommand {editor} {pocket} {catalogue} {catalogueError} />
						<ul class="items" aria-label={`${pocket.label} items`}>
							{#each pocket.items as item (item.id)}
								<li
									class="sf-row item"
									data-state={editor.pending.has(`qty:${pocket.key}:${item.id}`) ||
									editor.pending.has(`remove:${pocket.key}:${item.id}`)
										? 'pending'
										: 'idle'}
								>
									<span class="sf-name clip" title={item.name}>{item.name}</span>
									<QuantityStepper {editor} pocket={pocket.key} {item} />
								</li>
							{:else}
								<li class="sf-empty">{pocket.label} is empty.</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.sheet-root {
		display: grid;
		justify-items: center;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.sheet {
		width: 100%;
		max-width: 720px;
		display: grid;
		gap: var(--sf-s4);
		padding: var(--sf-s2) var(--sf-s2) var(--sf-s4);
	}

	section {
		display: grid;
		gap: var(--sf-s3);
	}

	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sf-s3) var(--sf-s4);
	}

	.pockets {
		display: flex;
		gap: var(--sf-s1);
		overflow-x: auto;
		padding-bottom: var(--sf-s1);
		scrollbar-width: thin;
	}

	.pockets button {
		display: inline-flex;
		align-items: center;
		gap: var(--sf-s2);
		flex: 0 0 auto;
	}

	.pockets button[aria-selected='true'] {
		border-color: var(--rust);
		background: var(--rust-wash);
		color: var(--rust);
	}

	.items {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--sf-s1);
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--sf-s2);
		min-height: var(--sf-control);
		padding: var(--sf-s1) var(--sf-s2);
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-md);
		background: var(--paper-hi);
	}

	@container sf (max-width: 420px) {
		.item {
			grid-template-columns: 1fr;
		}
	}
</style>
