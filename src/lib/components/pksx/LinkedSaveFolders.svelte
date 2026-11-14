<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { supportsSaveFolders } from '$lib/pksx/linked-save-folders';
	import { emulatorProfiles } from '$lib/pksx/linked-save-folders/profiles';
	import { linkedSaveDiscovery as discovery } from '$lib/pksx/linked-save-folders/runtime.svelte';

	let enabled = $state(false);
	let confirmation = $state('');
	onMount(() => {
		enabled = supportsSaveFolders();
	});
</script>

{#if enabled}
	<section aria-labelledby="linked-folders-title" class="linked-folders">
		<h2 id="linked-folders-title">Linked save folders</h2>
		<p>
			Choose a folder once and allow read/write access. PKSX finds recognized Pokemon saves
			automatically, adds them to Saves, and scans again when you return to the app. Link more
			folders for other emulators.
		</p>
		<div class="actions" data-settings-row="linked-folders">
			<button
				data-settings-control
				disabled={discovery.scanning || discovery.picking || discovery.sourceBusy}
				onclick={() => discovery.chooseFolder()}>Choose save folder</button
			>
			{#if discovery.folders.length}
				<button
					data-settings-control
					disabled={discovery.picking || discovery.sourceBusy}
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
					disabled={discovery.scanning || discovery.picking || discovery.sourceBusy}
					onclick={() => discovery.unlink(folder)}>Unlink {folder.name}</button
				>
				{#if discovery.errors[folder.tree]}<p role="alert">
						{discovery.errors[folder.tree]} Choose the folder again to relink. Existing Saves are retained.
					</p>{/if}
			</div>
		{/each}
		<p>
			Export writes a linked Save File back to its original document. Close the emulator before
			Export. PKSX checks for external changes and saves a Backup before writing. Use Export a copy
			to keep a separate file.
		</p>
		{#each discovery.sources as source (source.file.id)}
			{#if source.kind !== 'current'}
				<div class="result" data-settings-row={`source-${source.file.id}`}>
					<strong>{source.file.originalFileName ?? 'Save File'}</strong>
					{#if source.kind === 'unavailable'}
						<p role="alert">
							{source.message} Imported Saves and Backups remain available. Choose the folder again to
							restore access.
						</p>
					{:else if source.kind === 'changed'}
						<p>
							{source.localChanges
								? 'Both the emulator and this Workspace have changed.'
								: 'A new external version is available.'}
							{source.valid
								? 'You can load it after preserving your current version in Backups.'
								: 'The external bytes are not a recognized save. Your Workspace is retained; use Export a copy.'}
						</p>
						{#if source.valid}
							{#if confirmation === `${source.file.id}:${source.externalHash}`}
								<p>
									Replace this Workspace with the external version? Its current bytes and imported
									baseline will be preserved in Backups.
								</p>
								<button
									data-settings-control
									disabled={discovery.scanning || discovery.sourceBusy}
									onclick={() => {
										confirmation = '';
										void discovery.loadExternal(source, true);
									}}>Confirm load external version</button
								>
								<button
									data-settings-control
									disabled={discovery.sourceBusy}
									onclick={() => (confirmation = '')}>Keep current Workspace</button
								>
							{:else}
								<button
									data-settings-control
									disabled={discovery.scanning || discovery.sourceBusy}
									onclick={() => (confirmation = `${source.file.id}:${source.externalHash}`)}
									>Load external version</button
								>
							{/if}
						{/if}
					{:else if source.kind === 'recovery'}
						<p role="alert">
							Export was interrupted and the source differs from both expected versions. Your
							Workspace and the original external Backup are retained.
						</p>
						{#if confirmation === `${source.file.id}:${source.externalHash}`}
							<p>
								Restore the original external Backup? PKSX will back up the current source bytes
								first and verify the restored file.
							</p>
							<button
								data-settings-control
								disabled={discovery.scanning || discovery.sourceBusy}
								onclick={() => {
									confirmation = '';
									void discovery.recoverSource(source);
								}}>Confirm restore external Backup</button
							>
							<button
								data-settings-control
								disabled={discovery.sourceBusy}
								onclick={() => (confirmation = '')}>Cancel recovery</button
							>
						{:else}
							<button
								data-settings-control
								disabled={discovery.scanning || discovery.sourceBusy}
								onclick={() => (confirmation = `${source.file.id}:${source.externalHash}`)}
								>Restore original external Backup</button
							>
						{/if}
					{/if}
				</div>
			{/if}
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
