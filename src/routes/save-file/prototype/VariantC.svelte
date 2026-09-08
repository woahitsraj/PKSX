<script lang="ts">
	// C. Ledger: no view switch. Trainer and Money in a leading column (wide) or top block (tall); every pocket in one grouped scroll with sticky headers.
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

	const trainerSupported = $derived(
		editor.profile.trainerNameSupported || editor.profile.genderSupported
	);
	let adding = $state<string | null>(null);

	function jump(key: string) {
		document
			.querySelector<HTMLElement>(`.ledger [data-pocket="${key}"]`)
			?.scrollIntoView({ block: 'start' });
	}
</script>

<div class="sf-proto ledger-root">
	<aside class="lead">
		<p class="sf-filename">{fileName}</p>
		{#if trainerSupported}
			<div class="block">
				{#if editor.profile.trainerNameSupported}<NameField {editor} />{/if}
				{#if editor.profile.genderSupported}<GenderField {editor} compact />{/if}
			</div>
		{/if}
		{#if editor.money.supported}
			<div class="block"><MoneyField {editor} /></div>
		{/if}
	</aside>

	{#if editor.projection.inventory.supported}
		<section class="bag" aria-label="Bag">
			<nav class="jumps" aria-label="Jump to pocket">
				{#each editor.pockets as pocket (pocket.key)}
					<button type="button" class="sf-ctrl sm" onclick={() => jump(pocket.key)}>
						{pocket.label} <span class="sf-count">{pocket.items.length}/{pocket.capacity}</span>
					</button>
				{/each}
			</nav>
			<div class="ledger">
				{#each editor.pockets as pocket (pocket.key)}
					<section data-pocket={pocket.key} aria-labelledby={`ledger-${pocket.key}`}>
						<header class="group">
							<h2 id={`ledger-${pocket.key}`} class="sf-title">{pocket.label}</h2>
							<span class="sf-count">{pocket.items.length}/{pocket.capacity}</span>
							<button
								type="button"
								class="sf-ctrl sm"
								aria-expanded={adding === pocket.key}
								disabled={pocket.full}
								onclick={() => (adding = adding === pocket.key ? null : pocket.key)}
								>{adding === pocket.key ? 'Close' : '+ Add'}</button
							>
						</header>
						{#if adding === pocket.key}
							<AddItemCommand {editor} {pocket} {catalogue} {catalogueError} compact />
						{/if}
						<table>
							<tbody>
								{#each pocket.items as item (item.id)}
									<tr
										class="sf-row"
										data-state={editor.pending.has(`qty:${pocket.key}:${item.id}`) ||
										editor.pending.has(`remove:${pocket.key}:${item.id}`)
											? 'pending'
											: 'idle'}
									>
										<td><span class="sf-name wrap">{item.name}</span></td>
										<td><QuantityStepper {editor} pocket={pocket.key} {item} compact /></td>
									</tr>
								{:else}
									<tr><td colspan="2"><p class="sf-empty">{pocket.label} is empty.</p></td></tr>
								{/each}
							</tbody>
						</table>
					</section>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.ledger-root {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--sf-s2);
		padding: var(--sf-s2);
	}

	.lead {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: var(--sf-s2) var(--sf-s3);
	}

	.lead .sf-filename {
		flex-basis: 100%;
	}

	.block {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sf-s2) var(--sf-s3);
		padding: var(--sf-s2);
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-md);
		background: var(--paper-hi);
	}

	.bag {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--sf-s1);
	}

	.jumps {
		display: flex;
		gap: var(--sf-s1);
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.jumps button {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: var(--sf-s1);
	}

	.ledger {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--rule);
		border-radius: var(--sf-r-md);
		background: var(--paper-hi);
	}

	.group {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--sf-s2);
		padding: var(--sf-s1) var(--sf-s2);
		border-bottom: 1px solid var(--rule-hi);
		background: var(--paper-deep);
	}

	.group h2 {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	td {
		padding: var(--sf-s1) var(--sf-s2);
		border-bottom: 1px solid var(--rule);
		vertical-align: middle;
	}

	td:first-child {
		width: 100%;
	}

	td:last-child {
		width: 1%;
		white-space: nowrap;
	}

	td:last-child :global(.stepper) {
		flex-wrap: nowrap;
	}

	@container sf (aspect-ratio >= 1) {
		.ledger-root {
			grid-template-rows: minmax(0, 1fr);
			grid-template-columns: 260px minmax(0, 1fr);
		}

		.lead {
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: stretch;
			min-height: 0;
			overflow-y: auto;
		}

		.lead .sf-filename {
			flex-basis: auto;
		}

		.block {
			flex-direction: column;
		}
	}
</style>
