<script lang="ts">
	import type { BackupMetadata } from '$lib/pksx/local-library';

	interface Props {
		backups: BackupMetadata[];
		busy: boolean;
		dirty: boolean;
		restored: boolean;
		activeIndex: number;
		onFocusCommand: (index: number) => void;
		onCreateManualBackup: () => void;
		onRestoreBackup: (backup: BackupMetadata) => void;
		onKeepAsSeparateSave: () => void;
		onClose: () => void;
	}

	let {
		backups,
		busy,
		dirty,
		restored,
		activeIndex,
		onFocusCommand,
		onCreateManualBackup,
		onRestoreBackup,
		onKeepAsSeparateSave,
		onClose
	}: Props = $props();

	const backupReasonLabels: Record<BackupMetadata['reason'], string> = {
		manual: 'Manual',
		'pokemon-movement': 'Pokemon movement',
		'pokemon-editing': 'Pokemon editing',
		'trainer-editing': 'Trainer editing',
		'inventory-editing': 'Inventory editing',
		'legality-fix': 'Legality Fix',
		evolution: 'Evolution'
	};

	function formatTimestamp(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}
</script>

<div class="backup-scrim" role="presentation">
	<div
		class="backup-browser"
		role="dialog"
		aria-modal="true"
		aria-labelledby="backup-browser-title"
	>
		<header>
			<div>
				<p>Local Library</p>
				<h2 id="backup-browser-title">Backups</h2>
			</div>
			<button
				id="backup-command-0"
				type="button"
				class:controller-focused={activeIndex === 0}
				aria-disabled={busy}
				onfocus={() => onFocusCommand(0)}
				onclick={() => {
					if (!busy) onCreateManualBackup();
				}}
			>
				Create
			</button>
			<button
				id={`backup-command-${backups.length + 2}`}
				type="button"
				class="icon-button"
				class:controller-focused={activeIndex === backups.length + 2}
				aria-label="Close backups"
				onfocus={() => onFocusCommand(backups.length + 2)}
				onclick={onClose}
			>
				×
			</button>
		</header>

		{#if dirty}
			<p class="restore-note">
				Current Workspace has unexported changes. Restoring a Backup requires confirmation.
			</p>
		{/if}

		<div class="restored-actions">
			<span>{restored ? 'Restored Backup is active' : 'No restored Backup is active'}</span>
			<button
				id="backup-command-1"
				type="button"
				class:controller-focused={activeIndex === 1}
				aria-disabled={busy || !restored}
				onfocus={() => onFocusCommand(1)}
				onclick={() => {
					if (!busy && restored) onKeepAsSeparateSave();
				}}
			>
				Keep as Save File
			</button>
		</div>

		<div class="backup-list" aria-label="Backups">
			{#each backups as backup, index (backup.id)}
				<article class="backup-row">
					<div>
						<strong>{backupReasonLabels[backup.reason]}</strong>
						<span>{formatTimestamp(backup.createdAt)} · {backup.byteLength} bytes</span>
					</div>
					<button
						id={`backup-command-${index + 2}`}
						type="button"
						class:controller-focused={activeIndex === index + 2}
						aria-disabled={busy}
						onfocus={() => onFocusCommand(index + 2)}
						onclick={() => {
							if (!busy) onRestoreBackup(backup);
						}}
					>
						Restore
					</button>
				</article>
			{:else}
				<p class="empty-state">No Backups yet.</p>
			{/each}
		</div>
	</div>
</div>

<style>
	.backup-scrim {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 18px;
		background: color-mix(in srgb, var(--ink), transparent 68%);
	}

	.backup-browser {
		width: min(620px, 100%);
		max-height: min(680px, calc(100dvh - 36px));
		display: flex;
		flex-direction: column;
		gap: 14px;
		overflow: hidden;
		padding: 16px;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		color: var(--ink);
		box-shadow: var(--shadow-deep);
	}

	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 10px;
	}

	header p {
		margin: 0 0 3px;
		color: var(--ink-mute);
		font:
			700 0.67rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	h2 {
		margin: 0;
		font-size: 1.55rem;
		line-height: 1;
		letter-spacing: 0;
	}

	button {
		min-height: 34px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		box-shadow: var(--shadow-sm);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 750;
		cursor: pointer;
	}

	button:not([aria-disabled='true']):hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.55;
	}

	button.controller-focused {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 58%);
		outline-offset: 2px;
	}

	.icon-button {
		width: 34px;
		padding: 0;
		font-size: 1.2rem;
	}

	.restore-note,
	.empty-state {
		margin: 0;
		padding: 10px 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--rust-wash);
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 650;
	}

	.restored-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 700;
	}

	.backup-list {
		min-height: 0;
		display: grid;
		gap: 8px;
		overflow-y: auto;
		padding: 2px;
	}

	.backup-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	.backup-row div {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	.backup-row span {
		color: var(--ink-mute);
		font:
			650 0.68rem var(--pksx-font-mono),
			monospace;
	}

	@media (max-width: 520px) {
		.backup-scrim {
			align-items: end;
			padding: 10px;
		}

		.backup-browser {
			max-height: calc(100dvh - 20px);
			border-radius: var(--pksx-radius-lg);
		}

		.restored-actions,
		.backup-row {
			grid-template-columns: 1fr;
		}

		.restored-actions {
			align-items: stretch;
		}
	}
</style>
