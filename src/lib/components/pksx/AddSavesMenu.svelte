<script lang="ts">
	import { onMount, tick } from 'svelte';
	import EdgeMenu from './EdgeMenu.svelte';
	import type { FolderLink } from '$lib/pksx/linked-save-folders';
	import { emulatorName, folderProfile } from '$lib/pksx/linked-save-folders/profiles';

	interface Props {
		folders: FolderLink[];
		counts: Record<string, number>;
		failed: Record<string, boolean>;
		scanning: boolean;
		busy: boolean;
		onLink?: () => void;
		onImport: () => void;
		onScanFolder?: () => void;
		onScan: () => void;
		onUnlink: (folder: FolderLink) => void;
		onClose: () => void;
	}

	let {
		folders,
		counts,
		failed,
		scanning,
		busy,
		onLink,
		onImport,
		onScanFolder,
		onScan,
		onUnlink,
		onClose
	}: Props = $props();

	type Command = { id: string; label: string; detail?: string; mark?: string; run: () => void };
	const commands = $derived<Command[]>([
		{ id: 'file', label: 'Import file', mark: '+', run: onImport },
		...(onScanFolder
			? [
					{
						id: 'scan-folder',
						label: 'Scan a folder',
						detail: 'Import several saves at once',
						mark: '⌕',
						run: onScanFolder
					}
				]
			: []),
		...(onLink
			? [
					{
						id: 'folder',
						label: 'Link folder',
						detail: "Pick an emulator's save folder, like Dolphin's GC",
						mark: '⇄',
						run: onLink
					}
				]
			: []),
		...(folders.length
			? [{ id: 'scan', label: scanning ? 'Stop scan' : 'Scan again', run: onScan }]
			: []),
		...folders.map((folder) => ({
			id: 'unlink-' + folder.tree,
			label: 'Unlink ' + folder.name,
			detail: failed[folder.tree]
				? "Can't read. Link it again."
				: [
						emulatorName(folder.emulator ?? folderProfile(folder.tree, folder.name)),
						saveCount(counts[folder.tree] ?? 0)
					]
						.filter(Boolean)
						.join(' · '),
			run: () => onUnlink(folder)
		}))
	]);
	const linkedCount = $derived(
		commands.findIndex((command) => command.id === 'scan' || command.id.startsWith('unlink-'))
	);
	const saveCount = (count: number) => `${count} ${count === 1 ? 'save' : 'saves'}`;
	let index = $state(0);

	async function focus(next: number) {
		index = Math.max(0, Math.min(commands.length - 1, next));
		await tick();
		document.getElementById(`add-saves-command-${index}`)?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') void focus(index + 1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') void focus(index - 1);
		else return;
		event.preventDefault();
	}

	onMount(() => void focus(0));
</script>

<svelte:window onkeydown={handleKeydown} />

<EdgeMenu label="Add saves" onDismiss={onClose}>
	<div class="add-saves" aria-busy={busy}>
		<h2>Add saves</h2>
		<div class="commands">
			{#each commands as command, position (command.id)}
				{#if position === linkedCount}<h3>Linked</h3>{/if}
				<button
					id={`add-saves-command-${position}`}
					type="button"
					class:controller-focused={index === position}
					disabled={busy && command.id !== 'scan'}
					onfocus={() => (index = position)}
					onclick={command.run}
				>
					{#if command.mark}<span class="mark" aria-hidden="true">{command.mark}</span>{/if}
					<strong>{command.label}</strong>
					{#if command.detail}<small>{command.detail}</small>{/if}
				</button>
			{/each}
		</div>
	</div>
</EdgeMenu>

<style>
	.add-saves {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
	}
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: var(--pksx-type-display);
	}
	h3 {
		margin-top: var(--pksx-space-2);
		padding-top: var(--pksx-space-2);
		border-top: var(--pksx-border-width) solid var(--rule);
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 700;
	}
	.commands {
		display: grid;
		gap: var(--pksx-space-1);
	}
	button {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: var(--pksx-space-2);
		align-items: center;
		width: 100%;
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:focus-visible,
	button.controller-focused {
		background: var(--rust-wash);
		outline: none;
	}
	@media (hover: hover) {
		button:hover {
			background: var(--rust-wash);
		}
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.58;
	}
	.mark {
		grid-row: span 2;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--pksx-radius-small);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
		font-weight: 800;
	}
	strong {
		font-size: var(--pksx-type-label);
	}
	small {
		grid-column: 2;
		color: var(--ink-mute);
		font-size: var(--pksx-type-label);
		line-height: 1.25;
	}
	button:not(:has(.mark)) :is(strong, small) {
		grid-column: 1 / -1;
	}
</style>
