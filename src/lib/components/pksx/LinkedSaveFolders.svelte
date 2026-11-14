<script lang="ts">
	import { onMount } from 'svelte';
	import { getBoxesSession } from '$lib/pksx/boxes-session';
	import {
		saveFolders,
		supportsSaveFolders,
		scanFolder,
		importLinkedSave,
		type FolderLink,
		type FolderMode,
		type DiscoveredSave
	} from '$lib/pksx/linked-save-folders';
	import {
		getPkhexEngine,
		getSavesStorage,
		invalidateSavesCache,
		invalidateActiveWorkspaceCache
	} from '$lib/pksx/saves-cache';

	let enabled = $state(false);
	let link = $state<FolderLink>({ tree: null, mode: 'dolphin' });
	let saves = $state<DiscoveredSave[]>([]);
	let message = $state('');
	let busy = $state(false);
	let scanning = $state(false);
	let controller: AbortController | undefined;

	onMount(() => {
		enabled = supportsSaveFolders();
		if (enabled)
			void run(async () => {
				link = await saveFolders.status();
			});
		return cancel;
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			busy = false;
		}
	}

	async function pick(mode: FolderMode) {
		await run(async () => {
			const selected = await saveFolders.pick({ mode });
			if (selected.cancelled) return;
			link = selected;
			saves = [];
			message = 'Folder linked. Scan to discover saves.';
		});
	}

	function cancel() {
		controller?.abort();
		void saveFolders.cancel().catch(() => undefined);
	}

	async function scan() {
		controller = new AbortController();
		const signal = controller.signal;
		saves = [];
		scanning = true;
		await run(async () => {
			try {
				await scanFolder({
					plugin: saveFolders,
					mode: link.mode,
					engine: getPkhexEngine(),
					storage: getSavesStorage(),
					signal,
					onSave: (save) => {
						saves = [...saves, save];
					},
					onProgress: (value) => {
						message = value;
					}
				});
			} catch (error) {
				if (signal.aborted) message = 'Scan cancelled. Discovered saves remain available.';
				else throw error;
			} finally {
				scanning = false;
			}
		});
	}

	async function importSave(save: DiscoveredSave) {
		await run(async () => {
			const stored = await importLinkedSave(saveFolders, getPkhexEngine(), getSavesStorage(), save);
			getBoxesSession().selectPrimary({
				type: 'save-file',
				id: stored.id,
				label: stored.originalFileName ?? 'Save File',
				dirty: false
			});
			saves = saves.map((item) => (item.id === save.id ? { ...item, imported: true } : item));
			invalidateSavesCache();
			invalidateActiveWorkspaceCache();
			message = `${save.name} is in Saves. Emulator files are unchanged.`;
		});
	}
</script>

{#if enabled}
	<section aria-labelledby="linked-folders-title" class="linked-folders">
		<h2 id="linked-folders-title">Linked save folder</h2>
		<p>
			Choose Dolphin from the Android folder picker's locations, then its GC folder or a GCI save
			folder. If Dolphin is unavailable, export GCI saves into a folder you can select.
		</p>
		<p>
			Whole RAW/GCP memory cards are unsupported. Use Dolphin's GCI Folder option or export
			individual GCI saves. Imports create app-managed copies in Saves. PKSX never writes to the
			linked folder.
		</p>
		<div class="actions" data-settings-row="linked-folder">
			<button data-settings-control disabled={busy} onclick={() => pick('dolphin')}
				>{link.tree ? 'Relink Dolphin folder' : 'Link Dolphin folder'}</button
			>
			<button data-settings-control disabled={busy} onclick={() => pick('generic')}
				>Choose another save folder</button
			>
			{#if link.tree}
				<button
					data-settings-control
					disabled={busy && !scanning}
					onclick={() => (scanning ? cancel() : scan())}
					>{scanning ? 'Cancel scan' : 'Scan folder'}</button
				>
				<button
					data-settings-control
					disabled={busy}
					onclick={() =>
						run(async () => {
							await saveFolders.unlink();
							link = { tree: null, mode: 'dolphin' };
							saves = [];
							message = 'Folder unlinked. Imported Saves are retained.';
						})}>Unlink</button
				>
			{/if}
		</div>
		{#if link.tree}<p class="folder">
				Linked {link.mode === 'dolphin' ? 'Dolphin' : 'save'} folder: {link.name ??
					'Selected folder'}
			</p>{/if}
		<p role="status">{message}</p>
		{#if link.tree}<p>
				Access removed or folder missing? Relink it using either folder button. A rescan keeps
				existing linked imports. To import an updated revision, use the regular file import in
				Saves.
			</p>{/if}
		{#each saves as save (save.id)}
			<div class="result" data-settings-row={`linked-${save.id}`}>
				<span>{save.path}</span>
				<button
					data-settings-control
					disabled={busy || save.imported}
					onclick={() => importSave(save)}
					>{save.imported ? 'Already in Saves' : `Import ${save.name}`}</button
				>
			</div>
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
