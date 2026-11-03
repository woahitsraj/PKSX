<script lang="ts">
	import EdgeMenu from './EdgeMenu.svelte';

	type Props = {
		mode: 'commands' | 'confirm-empty';
		pokemonLabel: string;
		activeIndex: number;
		busy: boolean;
		onFocus: (index: number) => void;
		onSelect: (index: number) => void;
		onDismiss: () => void;
	};
	let { mode, pokemonLabel, activeIndex, busy, onFocus, onSelect, onDismiss }: Props = $props();
	const commands = ['Restore', 'Delete Permanently', 'Empty Recently Deleted', 'Close'];
</script>

<EdgeMenu
	label={mode === 'commands' ? 'Recently Deleted actions' : 'Empty Recently Deleted?'}
	{onDismiss}
>
	<div class="deleted-menu" aria-busy={busy}>
		{#if mode === 'commands'}
			<p>{pokemonLabel}</p>
			{#each commands as label, index (label)}
				<button
					id={`recently-deleted-command-${index}`}
					type="button"
					data-pksx-control-category="small"
					class:controller-focused={activeIndex === index}
					disabled={busy}
					onfocus={() => onFocus(index)}
					onclick={() => onSelect(index)}>{label}</button
				>
			{/each}
		{:else}
			<h2>Empty Recently Deleted?</h2>
			<p>Permanently delete every Pokemon in Recently Deleted?</p>
			<button
				id="recently-deleted-confirm-0"
				type="button"
				data-pksx-control-category="small"
				class:controller-focused={activeIndex === 0}
				disabled={busy}
				onfocus={() => onFocus(0)}
				onclick={() => onSelect(0)}>Cancel</button
			>
			<button
				id="recently-deleted-confirm-1"
				type="button"
				data-pksx-control-category="small"
				class:controller-focused={activeIndex === 1}
				disabled={busy}
				onfocus={() => onFocus(1)}
				onclick={() => onSelect(1)}>Confirm Empty</button
			>
		{/if}
	</div>
</EdgeMenu>

<style>
	.deleted-menu {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
	}
	.deleted-menu p,
	.deleted-menu h2 {
		margin: 0;
	}
	.deleted-menu button {
		min-height: var(--pksx-small-control-height);
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.deleted-menu button.controller-focused,
	.deleted-menu button:focus-visible {
		outline: 2px solid var(--rust);
	}
</style>
