<script lang="ts">
	import EdgeMenu from './EdgeMenu.svelte';
	import DelayedSpinner from './DelayedSpinner.svelte';

	let {
		confirmation = null,
		canRecover,
		activeIndex,
		busy,
		onFocusCommand,
		onExport,
		onRestore,
		onRecover,
		onConfirm,
		onClose
	}: {
		confirmation?: string | null;
		canRecover: boolean;
		activeIndex: number;
		busy: boolean;
		onFocusCommand: (index: number) => void;
		onExport: () => void;
		onRestore: () => void;
		onRecover: () => void;
		onConfirm: () => void;
		onClose: () => void;
	} = $props();
</script>

<EdgeMenu
	label={confirmation ? 'Replace Pokemon Storage?' : 'Pokemon Storage Backup'}
	onDismiss={onClose}
>
	<div class="backup-menu" aria-busy={busy}>
		<header>
			<h2>{confirmation ? 'Replace Pokemon Storage?' : 'Pokemon Storage Backup'}</h2>
			<p>{confirmation ?? 'Export a complete backup or restore one from this device.'}</p>
			<p>Checksums detect damage. The archive is not encrypted and may include trainer metadata.</p>
		</header>
		<div class="commands">
			{#if confirmation}
				<button
					id="storage-backup-command-0"
					type="button"
					disabled={busy}
					class:controller-focused={activeIndex === 0}
					onfocus={() => onFocusCommand(0)}
					onclick={onClose}>Keep Current Storage</button
				>
				<button
					id="storage-backup-command-1"
					type="button"
					disabled={busy}
					class="danger"
					class:controller-focused={activeIndex === 1}
					onfocus={() => onFocusCommand(1)}
					onclick={onConfirm}>Replace Storage</button
				>
			{:else}
				<button
					id="storage-backup-command-0"
					type="button"
					disabled={busy}
					class:controller-focused={activeIndex === 0}
					onfocus={() => onFocusCommand(0)}
					onclick={onExport}>Export Backup</button
				>
				<button
					id="storage-backup-command-1"
					type="button"
					disabled={busy}
					class:controller-focused={activeIndex === 1}
					onfocus={() => onFocusCommand(1)}
					onclick={onRestore}>Restore Backup</button
				>
				<button
					id="storage-backup-command-2"
					type="button"
					disabled={busy || !canRecover}
					class:controller-focused={activeIndex === 2}
					onfocus={() => onFocusCommand(2)}
					onclick={onRecover}>Recover Previous Storage</button
				>
				{#if !canRecover}
					<p class="recovery-note">
						A previous collection becomes available after restoring a backup.
					</p>
				{/if}
			{/if}
			<DelayedSpinner active={busy} label="Working with Pokemon Storage Backup" />
		</div>
	</div>
</EdgeMenu>

<style>
	.backup-menu {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		overflow-y: auto;
	}
	header {
		display: grid;
		gap: var(--pksx-space-1);
		border-bottom: var(--pksx-border-width) solid var(--rule);
		padding-bottom: var(--pksx-space-2);
	}
	header h2,
	header p {
		margin: 0;
	}
	header h2 {
		font-size: var(--pksx-type-display);
	}
	header p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		line-height: 1.35;
	}
	.commands {
		display: grid;
		gap: var(--pksx-space-1);
	}
	.commands button {
		width: 100%;
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper-deep);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		text-align: left;
		cursor: pointer;
	}
	.commands button:hover,
	.commands button:focus-visible,
	.commands button.controller-focused {
		border-color: color-mix(in srgb, var(--rust), transparent 55%);
		background: var(--rust-wash);
		outline: none;
	}
	.commands button.danger {
		color: var(--err);
	}
	.commands button:disabled {
		cursor: not-allowed;
		opacity: 0.58;
	}
	.recovery-note {
		margin: 0;
		color: var(--ink-soft);
		font-size: var(--pksx-type-caption);
	}
</style>
