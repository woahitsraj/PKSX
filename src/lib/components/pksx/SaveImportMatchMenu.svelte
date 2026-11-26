<script lang="ts">
	import { onMount, tick } from 'svelte';
	import EdgeMenu from './EdgeMenu.svelte';
	import type { SaveImportMatchChoice } from '$lib/pksx/save-import-match';

	interface Props {
		fileName: string;
		matches: SaveImportMatchChoice[];
		confirmDirtyId: string | null;
		busy: boolean;
		onReplace: (id: string) => void;
		onImportNew: () => void;
		onCancel: () => void;
	}

	let { fileName, matches, confirmDirtyId, busy, onReplace, onImportNew, onCancel }: Props =
		$props();

	type Command = {
		id: string;
		label: string;
		detail?: string;
		disabled?: boolean;
		run: () => void;
	};
	const commands = $derived<Command[]>([
		...matches.map((match) => ({
			id: 'replace-' + match.id,
			label:
				confirmDirtyId === match.id
					? 'Replace your unsaved changes?'
					: matches.length > 1
						? 'Replace ' + match.name
						: 'Replace Existing',
			detail: [
				match.exact ? 'Exact copy' : 'Different revision',
				match.game,
				match.trainer,
				match.fileName,
				match.linked
					? 'Linked to an emulator file, so it cannot be replaced'
					: match.dirty
						? 'Unsaved changes go to a Backup first'
						: null
			]
				.filter(Boolean)
				.join(' · '),
			disabled: match.linked,
			run: () => onReplace(match.id)
		})),
		{ id: 'new', label: 'Import as New', detail: 'Keep both copies', run: onImportNew },
		{ id: 'cancel', label: 'Cancel', run: onCancel }
	]);
	const exact = $derived(matches.every((match) => match.exact));
	let index = $state(0);

	async function focus(next: number) {
		index = Math.max(0, Math.min(commands.length - 1, next));
		await tick();
		document.getElementById(`save-import-match-command-${index}`)?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onCancel();
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') void focus(index + 1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') void focus(index - 1);
		else return;
		event.preventDefault();
	}

	onMount(() => void focus(commands.findIndex((command) => !command.disabled)));
</script>

<svelte:window onkeydown={handleKeydown} />

<EdgeMenu label="Already in Saves" onDismiss={onCancel}>
	<div class="save-import-match" aria-busy={busy}>
		<h2>Already in Saves</h2>
		<p>
			{fileName}
			{exact
				? 'is an exact copy of a Save File already in Saves.'
				: 'looks like another revision of a Save File in Saves.'}
		</p>
		<div class="commands">
			{#each commands as command, position (command.id)}
				<button
					id={`save-import-match-command-${position}`}
					type="button"
					class:controller-focused={index === position}
					disabled={busy || command.disabled}
					onfocus={() => (index = position)}
					onclick={command.run}
				>
					<strong>{command.label}</strong>
					{#if command.detail}<small>{command.detail}</small>{/if}
				</button>
			{/each}
		</div>
	</div>
</EdgeMenu>

<style>
	.save-import-match {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--pksx-type-display);
	}
	p {
		color: var(--ink-soft);
		overflow-wrap: anywhere;
	}
	.commands {
		display: grid;
		gap: var(--pksx-space-1);
	}
	button {
		display: grid;
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
	strong,
	small {
		font-size: var(--pksx-type-label);
	}
	small {
		color: var(--ink-mute);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
</style>
