<script lang="ts">
	import { onMount, tick } from 'svelte';
	import EdgeMenu from './EdgeMenu.svelte';
	import DelayedSpinner from './DelayedSpinner.svelte';
	import { getSaveDisplayName, type StoredSaveFile } from '$lib/pksx/saves';

	interface Props {
		files: StoredSaveFile[];
		busy: boolean;
		onUnhide: (file: StoredSaveFile) => void;
		onOpen: (file: StoredSaveFile) => void;
		onClose: () => void;
	}

	let { files, busy, onUnhide, onOpen, onClose }: Props = $props();

	type Command = { id: string; label: string; name: string; heading?: string; run: () => void };
	const commands = $derived<Command[]>(
		files.length
			? files.flatMap((file) => [
					{
						id: 'unhide-' + file.id,
						label: 'Unhide',
						heading: getSaveDisplayName(file),
						name: 'Unhide ' + getSaveDisplayName(file),
						run: () => onUnhide(file)
					},
					{
						id: 'open-' + file.id,
						label: 'Open',
						name: 'Open ' + getSaveDisplayName(file) + ' in Boxes',
						run: () => onOpen(file)
					}
				])
			: [{ id: 'close', label: 'Close', name: 'Close', run: onClose }]
	);
	let index = $state(0);

	async function focus(next: number) {
		index = Math.max(0, Math.min(commands.length - 1, next));
		await tick();
		document.getElementById(`hidden-saves-command-${index}`)?.focus();
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

<EdgeMenu label="Hidden saves" onDismiss={onClose}>
	<div class="hidden-saves" aria-busy={busy}>
		<h2>Hidden saves</h2>
		{#if !files.length}<p>No Save Files are hidden. Hide one from its Save File Menu.</p>{/if}
		<div class="commands">
			{#each commands as command, position (command.id)}
				{#if command.heading}<h3>{command.heading}</h3>{/if}
				<button
					id={`hidden-saves-command-${position}`}
					type="button"
					class={{ 'controller-focused': index === position }}
					aria-label={command.name}
					disabled={busy}
					onfocus={() => (index = position)}
					onclick={command.run}
				>
					<strong>{command.label}</strong>
				</button>
			{/each}
		</div>
		<DelayedSpinner active={busy} label="Opening Save File" />
	</div>
</EdgeMenu>

<style>
	.hidden-saves {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--pksx-type-display);
	}
	h3 {
		padding-top: var(--pksx-space-2);
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		line-height: 1.35;
	}
	.commands {
		display: grid;
		gap: var(--pksx-space-1);
	}
	button {
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
	strong {
		font-size: var(--pksx-type-label);
	}
</style>
