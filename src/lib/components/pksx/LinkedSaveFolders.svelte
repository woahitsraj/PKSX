<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { supportsSaveFolders } from '$lib/pksx/linked-save-folders';
	import { emulatorProfiles } from '$lib/pksx/linked-save-folders/profiles';
	import { linkedSaveDiscovery as discovery } from '$lib/pksx/linked-save-folders/runtime.svelte';

	let enabled = $state(false);
	onMount(() => {
		enabled = supportsSaveFolders();
	});
</script>

{#if enabled}
	<section aria-labelledby="linked-folders-title" class="linked-folders">
		<h2 id="linked-folders-title">Linked save folders</h2>
		<p>
			Choose a folder once. PKSX finds recognized Pokemon saves automatically, adds them to Saves,
			and scans again when you return to the app. Link more folders for other emulators.
		</p>
		<div class="actions" data-settings-row="linked-folders">
			<button
				data-settings-control
				disabled={discovery.scanning || discovery.picking}
				onclick={() => discovery.chooseFolder()}>Choose save folder</button
			>
			{#if discovery.folders.length}
				<button
					data-settings-control
					disabled={discovery.picking}
					onclick={() => (discovery.scanning ? discovery.cancel() : discovery.scan())}
					>{discovery.scanning ? 'Cancel scan' : 'Scan linked folders'}</button
				>
			{/if}
			<a data-settings-control href={resolve('/saves')}>Open Saves</a>
		</div>
		<p role="status">{discovery.message}</p>
		{#each discovery.folders as folder (folder.tree)}
			<div class="result" data-settings-row={`linked-${folder.tree}`}>
				<span>{folder.name}</span>
				{#if discovery.reports[folder.tree] && !discovery.errors[folder.tree]}<p>
						{discovery.reports[folder.tree]}
					</p>{/if}
				<button
					data-settings-control
					disabled={discovery.scanning || discovery.picking}
					onclick={() => discovery.unlink(folder)}>Unlink {folder.name}</button
				>
				{#if discovery.errors[folder.tree]}<p role="alert">
						{discovery.errors[folder.tree]} Choose the folder again to relink. Existing Saves are retained.
					</p>{/if}
			</div>
		{/each}
		<p>
			Use the emulator's exported location in the Android picker where available. Android may hide
			private app folders. In that case, export battery saves to a folder you can select. Save
			states, ROMs, and whole RAW/GCP memory cards are unsupported. For Dolphin, use GCI Folder or
			export individual GCI saves.
		</p>
		<ul>
			{#each emulatorProfiles as profile (profile.id)}<li>
					<strong>{profile.name}</strong>: {profile.folder}
				</li>{/each}
		</ul>
		{#each discovery.saves as save (save.identity)}
			<p class="folder">{save.folder.name} / {save.path}: In Saves</p>
		{/each}
	</section>
{/if}

<style>
	.linked-folders {
		padding: var(--pksx-space-3);
		margin-bottom: var(--pksx-space-3);
		border: var(--pksx-border-width) solid var(--rule);
		border-radius: var(--pksx-radius-large);
		background: var(--paper-hi);
	}
	h2 {
		margin: 0;
		font-size: var(--pksx-type-title);
	}
	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
	}
	.folder,
	.result span {
		overflow-wrap: anywhere;
	}
	.actions,
	.result {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-2);
		align-items: center;
	}
	.result {
		padding-block: var(--pksx-space-2);
		border-top: var(--pksx-border-width) solid var(--rule);
	}
	.result span {
		flex: 1 1 180px;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--pksx-control-height);
	}
	button {
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--rule);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink);
		font: inherit;
	}
	button:disabled {
		opacity: 0.6;
	}
</style>
