<script lang="ts">
	// B. Local views: Trainer | Bag switch; Bag has a pocket rail (wide) or pocket row (tall), pinned Money, internal list scroll.
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
		fileName,
		initialView = 'bag'
	}: {
		editor: PrototypeEditor;
		catalogue: Catalogue | null;
		catalogueError: string | null;
		fileName: string;
		initialView?: string;
	} = $props();

	const trainerSupported = $derived(
		editor.profile.trainerNameSupported || editor.profile.genderSupported
	);
	const bagSupported = $derived(editor.money.supported || editor.projection.inventory.supported);
	// Writable derived: follows ?view= until the user switches.
	let view = $derived<'trainer' | 'bag'>(initialView === 'trainer' ? 'trainer' : 'bag');
	let activeKey = $state('');
	const pocket = $derived(
		editor.pockets.find((p) => p.key === activeKey) ?? editor.pockets[0] ?? null
	);
	const shown = $derived(
		view === 'trainer' && trainerSupported ? 'trainer' : bagSupported ? 'bag' : 'trainer'
	);
</script>

<div class="sf-proto views-root">
	<header class="bar">
		<p class="sf-filename">{fileName}</p>
		{#if trainerSupported && bagSupported}
			<div class="sf-segment sm" role="tablist" aria-label="Save File views">
				<button
					type="button"
					role="tab"
					aria-selected={shown === 'trainer'}
					onclick={() => (view = 'trainer')}>Trainer</button
				>
				<button
					type="button"
					role="tab"
					aria-selected={shown === 'bag'}
					onclick={() => (view = 'bag')}>Bag</button
				>
			</div>
		{/if}
	</header>

	{#if shown === 'trainer'}
		<section class="trainer" aria-label="Trainer">
			<div class="card">
				{#if editor.profile.trainerNameSupported}<NameField {editor} />{/if}
				{#if editor.profile.genderSupported}<GenderField {editor} />{/if}
			</div>
		</section>
	{:else}
		<section class="bag" aria-label="Bag">
			{#if editor.projection.inventory.supported}
				<nav class="rail" aria-label="Pockets">
					{#each editor.pockets as candidate (candidate.key)}
						<button
							type="button"
							class="entry"
							aria-current={pocket?.key === candidate.key ? 'true' : undefined}
							onclick={() => (activeKey = candidate.key)}
						>
							<span class="entry-label">{candidate.label}</span>
							<span class="sf-count">{candidate.items.length}/{candidate.capacity}</span>
						</button>
					{/each}
				</nav>
			{/if}

			<div class="content">
				{#if editor.money.supported}
					<div class="pinned"><MoneyField {editor} inline /></div>
				{/if}
				{#if pocket}
					<div class="pinned">
						<AddItemCommand {editor} {pocket} {catalogue} {catalogueError} compact />
					</div>
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
								<QuantityStepper {editor} pocket={pocket.key} {item} compact />
							</li>
						{:else}
							<li class="sf-empty">{pocket.label} is empty.</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}
</div>

<style>
	.views-root {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--sf-s2);
		padding: var(--sf-s2);
	}

	.bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--sf-s3);
	}

	.trainer {
		display: grid;
		align-content: start;
		justify-items: center;
		overflow-y: auto;
	}

	.card {
		width: 100%;
		max-width: 560px;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sf-s3) var(--sf-s4);
		padding: var(--sf-s3);
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-lg);
		background: var(--paper-hi);
	}

	.bag {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--sf-s2);
	}

	.rail {
		display: flex;
		gap: var(--sf-s1);
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.entry {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: var(--sf-s2);
		height: var(--sf-control-sm);
		padding: 0 var(--sf-s2);
		border: 1px solid var(--rule-hi);
		border-radius: var(--sf-r-sm);
		background: var(--paper-hi);
		font-size: var(--sf-label);
		font-weight: 650;
		white-space: nowrap;
		cursor: pointer;
	}

	.entry[aria-current='true'] {
		border-color: var(--rust);
		background: var(--rust-wash);
		color: var(--rust);
	}

	.content {
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: var(--sf-s1);
	}

	.pinned {
		padding: var(--sf-s1) var(--sf-s2);
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-md);
		background: var(--paper-hi);
	}

	.items {
		margin: 0;
		padding: 0;
		list-style: none;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-md);
		background: var(--paper-hi);
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--sf-s2);
		min-height: var(--sf-control);
		padding: var(--sf-s1) var(--sf-s2);
		border-bottom: 1px solid var(--rule);
	}

	.item:last-child {
		border-bottom: 0;
	}

	@container sf (aspect-ratio >= 1) {
		.bag {
			grid-template-rows: minmax(0, 1fr);
			grid-template-columns: 148px minmax(0, 1fr);
		}

		.rail {
			flex-direction: column;
			overflow-x: hidden;
			overflow-y: auto;
		}

		.entry {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			height: auto;
			min-height: var(--sf-control-sm);
			padding: var(--sf-s1) var(--sf-s2);
			text-align: left;
			white-space: normal;
		}

		.entry-label {
			min-width: 0;
			overflow-wrap: anywhere;
			line-height: var(--sf-lh-tight);
		}
	}

	@container sf (max-width: 420px) {
		.item {
			grid-template-columns: 1fr;
		}
	}
</style>
