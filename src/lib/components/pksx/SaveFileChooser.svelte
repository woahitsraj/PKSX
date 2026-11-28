<script lang="ts">
	import { onMount, tick } from 'svelte';
	import EdgeMenu from './EdgeMenu.svelte';
	import DelayedSpinner from './DelayedSpinner.svelte';
	import { getSaveDisplayName, type SaveFileId, type StoredSaveFile } from '$lib/pksx/saves';

	interface Props {
		title: string;
		saveFiles: StoredSaveFile[];
		trainers: Record<SaveFileId, string | undefined>;
		activeSaveFileId: SaveFileId | null;
		activeIndex: number;
		busyId: SaveFileId | null;
		onFocusIndex: (index: number) => void;
		onOpen: (saveFile: StoredSaveFile) => void;
		onMenu: (saveFile: StoredSaveFile) => void;
		onClose: () => void;
	}

	let {
		title,
		saveFiles,
		trainers,
		activeSaveFileId,
		activeIndex,
		busyId,
		onFocusIndex,
		onOpen,
		onMenu,
		onClose
	}: Props = $props();
	let root = $state<HTMLElement>();

	async function focus(next: number) {
		onFocusIndex(Math.max(0, Math.min(saveFiles.length - 1, next)));
		await tick();
		root?.querySelector<HTMLElement>(`#save-file-chooser-row-${activeIndex}`)?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.key === 'Escape') onClose();
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') void focus(activeIndex + 1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') void focus(activeIndex - 1);
		else if (event.key.toLowerCase() === 'x' && saveFiles[activeIndex])
			onMenu(saveFiles[activeIndex]);
		else return;
		event.preventDefault();
	}

	onMount(() => void focus(activeIndex));
</script>

<svelte:window onkeydown={handleKeydown} />

<EdgeMenu label={'Choose ' + title + ' Save File'} onDismiss={onClose}>
	<div class="chooser" aria-busy={busyId !== null} bind:this={root}>
		<header>
			<h2>{title}</h2>
			<span>{saveFiles.length} Save Files</span>
		</header>
		<div class="rows">
			{#each saveFiles as saveFile, index (saveFile.id)}
				{@const name = getSaveDisplayName(saveFile)}
				<div class={['row', { 'controller-focused': index === activeIndex }]}>
					<button
						id={`save-file-chooser-row-${index}`}
						type="button"
						class="open"
						aria-label={'Open ' + name + ' in Boxes'}
						onfocus={() => onFocusIndex(index)}
						onclick={() => onOpen(saveFile)}
					>
						<strong>{name}</strong>
						{#if saveFile.id === activeSaveFileId}<em>Active</em>{/if}
						<small>{trainers[saveFile.id] ?? 'Unknown Trainer'}</small>
						{#if saveFile.displayName}
							<small class="file-name">{saveFile.originalFileName ?? 'No original filename'}</small>
						{/if}
						<DelayedSpinner active={busyId === saveFile.id} label={`Opening ${name}`} />
					</button>
					<button
						type="button"
						class="menu"
						data-pksx-control-category="small"
						tabindex="-1"
						aria-label={'Open Save File Menu for ' + name}
						onpointerdown={(event) => event.preventDefault()}
						onclick={() => onMenu(saveFile)}>•••</button
					>
				</div>
			{/each}
		</div>
	</div>
</EdgeMenu>

<style>
	.chooser {
		min-height: 0;
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
	}
	header {
		display: grid;
		gap: var(--pksx-space-1);
		padding-bottom: var(--pksx-space-2);
		border-bottom: var(--pksx-border-width) solid var(--rule);
	}
	h2 {
		margin: 0;
		font-size: var(--pksx-type-title);
	}
	header span,
	small {
		color: var(--ink-soft);
		font: 600 var(--pksx-type-label) / 1.25 var(--pksx-font-sans);
	}
	.rows {
		display: grid;
		gap: var(--pksx-space-1);
	}
	.row {
		position: relative;
		border-radius: var(--pksx-radius-medium);
	}
	.row.controller-focused,
	.row:has(:focus-visible) {
		background: var(--rust-wash);
	}
	.open {
		width: 100%;
		min-height: var(--pksx-control-height);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 2px var(--pksx-space-2);
		padding: var(--pksx-space-2) calc(var(--pksx-small-control-height) + var(--pksx-space-3))
			var(--pksx-space-2) var(--pksx-space-3);
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.open:focus-visible {
		outline: none;
	}
	@media (hover: hover) {
		.open:hover {
			background: var(--rust-wash);
		}
	}
	strong {
		overflow: hidden;
		font-size: var(--pksx-type-label);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	em {
		padding: 3px 6px;
		border-radius: var(--pksx-radius-small);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
		font: 750 var(--pksx-type-label) / 1 var(--pksx-font-sans);
		font-style: normal;
	}
	small {
		grid-column: 1 / -1;
	}
	.file-name {
		overflow: hidden;
		font-family: var(--pksx-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu {
		position: absolute;
		top: var(--pksx-space-2);
		right: var(--pksx-space-2);
		min-width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		padding: 0 7px;
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font: 800 var(--pksx-type-label) / 1 var(--pksx-font-mono);
		cursor: pointer;
	}
	.menu:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}
</style>
