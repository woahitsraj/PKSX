<script module lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	const searches = new SvelteMap<string, string>();
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { PokedexEdit } from '$lib/engine/types';
	import type { WorkspaceState } from '$lib/pksx/backup-workflow';
	import { updateAppChrome } from '$lib/pksx/app-chrome.svelte';
	import {
		getActiveWorkspaceService,
		getCachedActiveWorkspaceBox,
		getSaveFileEditCoordinator,
		loadActiveWorkspaceFromSaves
	} from '$lib/pksx/saves-cache';

	let workspace = $state.raw<WorkspaceState | null>(null);
	let loading = $state(true);
	let message = $state('');
	let pending = $state(false);
	let query = $state('');
	let mounted = false;
	const pokedex = $derived(workspace?.workspace.saveFile?.pokedex);
	const species = $derived(
		pokedex?.species.filter((s) =>
			`${s.id} ${s.name}`.toLowerCase().includes(query.trim().toLowerCase())
		) ?? []
	);

	onMount(() => {
		mounted = true;
		const unsubscribe = getActiveWorkspaceService().subscribe(acceptWorkspace);
		void load();
		return () => {
			mounted = false;
			unsubscribe();
		};
	});

	function acceptWorkspace(next: WorkspaceState | null) {
		if (next?.file.id !== workspace?.file.id)
			query = next ? (searches.get(next.file.id) ?? '') : '';
		workspace = next;
		updateAppChrome({ hasLoadedSave: Boolean(next), carryActive: false });
	}

	async function load() {
		loading = true;
		message = '';
		try {
			const next = await loadActiveWorkspaceFromSaves();
			if (mounted) acceptWorkspace(next);
		} catch (error) {
			if (mounted) message = error instanceof Error ? error.message : String(error);
		} finally {
			if (mounted) loading = false;
		}
	}

	function search(value: string) {
		query = value;
		if (workspace) searches.set(workspace.file.id, value);
	}

	async function apply(edit: PokedexEdit) {
		if (!workspace || pending) return;
		const coordinator = getSaveFileEditCoordinator();
		const origin = coordinator.openWorkspace(workspace, getCachedActiveWorkspaceBox());
		pending = true;
		message = '';
		try {
			const result = await coordinator.enqueueEdit(origin, {
				key: 'pokedex',
				operation: { pokedex: edit }
			});
			if (!mounted) return;
			if (result.ok) acceptWorkspace(result.workspace);
			else {
				if (result.workspace) acceptWorkspace(result.workspace);
				message = result.message;
			}
		} catch (error) {
			if (mounted) message = error instanceof Error ? error.message : String(error);
		} finally {
			if (mounted) pending = false;
		}
	}
</script>

<section
	class="pokedex pksx-density-container"
	data-destination-root="pokedex"
	data-initial-state={loading ? 'loading' : 'ready'}
	aria-label="Pokedex"
>
	<header>
		<button data-destination-focus="back" data-back-control onclick={() => goto(resolve('/boxes'))}
			>Back to Boxes</button
		>
		<h1>Pokedex</h1>
		<span>{workspace?.dirty ? 'Dirty Workspace' : 'Clean Workspace'}</span>
	</header>
	{#if message}<p role="alert">{message} <button onclick={load}>Reload</button></p>{/if}
	{#if loading}
		<p role="status">Loading Pokedex…</p>
	{:else if !workspace}
		<p>No active Save File. Import or choose one in Saves.</p>
	{:else if !pokedex || pokedex.status === 'unavailable'}
		<p>
			{pokedex?.reason ??
				'Pokedex capabilities are unavailable. Reload the Save File to try again.'}
		</p>
	{:else}
		<label class="search"
			>Search species
			<input
				type="search"
				value={query}
				oninput={(event) => search(event.currentTarget.value)}
				data-destination-focus="search"
				data-destination-initial
			/>
		</label>
		<div class="content">
			<div class="species" aria-label="Species">
				<div class="list-heading">
					<p>{species.length} species</p>
					{#if pokedex.fields.length}<button
							data-destination-focus="game-fields"
							onclick={() => {
								document
									.querySelector<HTMLInputElement>('[data-destination-focus^="field-"]')
									?.focus();
							}}>Game-specific state</button
						>{/if}
				</div>
				{#each species as entry (entry.id)}
					<div class="species-row">
						<strong>{String(entry.id).padStart(3, '0')} {entry.name}</strong>
						<button
							aria-label={`${entry.name} Seen`}
							aria-pressed={entry.seen}
							aria-disabled={pending}
							data-destination-focus={`species-${entry.id}-seen`}
							data-destination-fallbacks={JSON.stringify(['search'])}
							onclick={() => apply({ species: entry.id, seen: !entry.seen })}
							>Seen {entry.seen ? '✓' : '·'}</button
						>
						<button
							aria-label={`${entry.name} Caught`}
							aria-pressed={entry.caught}
							aria-disabled={pending}
							data-destination-focus={`species-${entry.id}-caught`}
							data-destination-fallbacks={JSON.stringify(['search'])}
							onclick={() => apply({ species: entry.id, caught: !entry.caught })}
							>Caught {entry.caught ? '✓' : '·'}</button
						>
					</div>
				{:else}<p>No matching species.</p>{/each}
			</div>
			{#if pokedex.fields.length}
				<aside aria-label="Game-specific Pokedex fields">
					<h2>Game-specific state</h2>
					{#each pokedex.fields as field (field.key)}
						<form
							onsubmit={(event) => {
								event.preventDefault();
								const value = new FormData(event.currentTarget).get('value');
								if (typeof value === 'string')
									void apply({ field: field.key, value: Number(value) });
							}}
						>
							<label
								>{field.label}<input
									name="value"
									type="number"
									min={field.min}
									max={field.max}
									step="1"
									value={field.value}
									required
									data-destination-focus={`field-${field.key}`}
								/></label
							>
							<button aria-disabled={pending} data-destination-focus={`apply-${field.key}`}
								>Apply</button
							>
						</form>
					{/each}
				</aside>
			{/if}
		</div>
	{/if}
</section>

<style>
	:global(.app-shell:has(.pokedex)) {
		height: 100dvh;
		min-height: 100dvh;
		overflow: hidden;
	}
	.pokedex {
		font-size: var(--pksx-type-body);
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow: hidden;
	}
	header {
		padding-right: calc(var(--pksx-control-height) + var(--pksx-space-2));
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--pksx-space-2);
	}
	h1 {
		font-size: var(--pksx-type-title);
		margin: 0;
	}
	h2 {
		font-size: var(--pksx-type-body);
	}
	header span {
		margin-left: auto;
	}
	.list-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-2);
	}
	.content {
		overflow: auto;
		min-height: 0;
	}
	.species-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: var(--pksx-space-2);
		align-items: center;
		border-bottom: 1px solid var(--rule);
		padding-block: var(--pksx-space-1);
	}
	button,
	input {
		min-height: var(--pksx-control-height);
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-small);
		padding: var(--pksx-space-1) var(--pksx-space-2);
	}
	button[aria-pressed='true'] {
		background: var(--rust-wash);
		color: var(--ink);
	}
	button[aria-disabled='true'] {
		opacity: 0.6;
	}
	form,
	form label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--pksx-space-2);
	}
	form {
		padding-block: var(--pksx-space-2);
	}
	input {
		min-width: 0;
		max-width: 100%;
	}
</style>
