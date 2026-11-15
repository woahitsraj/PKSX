<script lang="ts">
	import type { SlotMenuCommand, SlotMenuCommandKey } from '$lib/pksx/slot-menu';
	import DelayedSpinner from './DelayedSpinner.svelte';
	import EdgeMenu from './EdgeMenu.svelte';

	interface Props {
		location: string;
		label?: string;
		idPrefix?: string;
		commands: SlotMenuCommand[];
		activeIndex: number;
		availabilityPending?: boolean;
		pendingLabel?: string | null;
		onFocusCommand: (index: number) => void;
		onSelectCommand: (command: SlotMenuCommandKey) => void;
		onClose: () => void;
	}

	let {
		location,
		label = 'Slot actions',
		idPrefix = 'slot-action',
		commands,
		activeIndex,
		availabilityPending = false,
		pendingLabel = null,
		onFocusCommand,
		onSelectCommand,
		onClose
	}: Props = $props();

	const pending = $derived(availabilityPending || pendingLabel !== null);
</script>

<EdgeMenu {label} onDismiss={onClose}>
	<div class="slot-context" aria-busy={pending ? 'true' : undefined}>
		<div class="slot-context-header">
			<p class="slot-context-location">{location}</p>
			<DelayedSpinner active={pending} label={pendingLabel ?? 'Loading Slot actions'} />
		</div>

		<div
			class="slot-command-stack"
			role="list"
			aria-label={label === 'Slot actions' ? 'Slot Menu commands' : 'Selection Menu commands'}
		>
			{#each commands as command, index (command.label)}
				<div class="slot-command-row" role="listitem">
					<button
						id={`${idPrefix}-${index}`}
						type="button"
						data-pksx-control-category="small"
						class={{ 'controller-focused': activeIndex === index }}
						aria-disabled={command.reason ? 'true' : undefined}
						aria-describedby={command.reason ? `${idPrefix}-${index}-reason` : undefined}
						data-availability={command.availability}
						onfocus={(event) => {
							onFocusCommand(index);
							event.currentTarget.parentElement?.scrollIntoView({ block: 'nearest' });
						}}
						onclick={(event) => {
							event.preventDefault();
							onFocusCommand(index);
							if (!command.reason) {
								onSelectCommand(command.key);
							}
						}}
					>
						<strong>{command.label}</strong>
					</button>
					{#if command.reason}
						<span id={`${idPrefix}-${index}-reason`} class="slot-command-reason"
							>{command.reason}</span
						>
					{/if}
				</div>
			{/each}
			<div class="slot-command-row" role="listitem">
				<button
					id={`${idPrefix}-${commands.length}`}
					type="button"
					data-pksx-control-category="small"
					data-availability="available"
					class={{ 'controller-focused': activeIndex === commands.length }}
					onfocus={(event) => {
						onFocusCommand(commands.length);
						event.currentTarget.parentElement?.scrollIntoView({ block: 'nearest' });
					}}
					onclick={onClose}><strong>Close</strong></button
				>
			</div>
		</div>
	</div>
</EdgeMenu>

<style>
	.slot-context {
		min-height: 0;
		display: grid;
		gap: var(--pksx-space-1);
		padding: var(--pksx-space-2);
		overflow-y: auto;
	}

	.slot-context-header {
		display: grid;
		gap: var(--pksx-space-1);
		padding-bottom: var(--pksx-space-1);
		border-bottom: 1px solid var(--rule);
	}

	.slot-context-location {
		margin: 0;
		color: var(--ink-mute);
		font-size: var(--pksx-type-label);
		font-weight: 650;
		line-height: 1.25;
	}

	.slot-command-stack {
		display: grid;
		gap: var(--pksx-space-1);
	}

	.slot-command-row {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.slot-command-row button {
		width: 100%;
		min-height: var(--pksx-small-control-height);
		padding: var(--pksx-space-1) var(--pksx-space-2);
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: transparent;
		box-shadow: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		transition: transform 120ms var(--pksx-ease-out);
	}

	.slot-command-row button:active:not([aria-disabled='true']) {
		transform: scale(0.97);
	}

	.slot-command-row button {
		height: var(--pksx-small-control-height);
		display: flex;
		align-items: center;
		justify-content: flex-start;
		cursor: not-allowed;
		opacity: 0.68;
	}

	.slot-command-row button[data-availability='available'] {
		cursor: pointer;
		opacity: 1;
	}

	.slot-command-row button[data-availability='available']:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.slot-command-row button:focus-visible,
	.slot-command-row button.controller-focused {
		color: var(--rust);
		outline: 3px solid var(--rust-ring);
		outline-offset: -3px;
	}

	.slot-command-row button.controller-focused {
		opacity: 1;
	}

	.slot-command-row strong {
		font-size: var(--pksx-type-label);
		font-weight: 750;
		line-height: 1.15;
	}

	.slot-command-reason {
		color: var(--ink-mute);
		font-size: var(--pksx-type-label);
		font-weight: 600;
		line-height: 1.25;
		text-align: left;
		padding: 0 var(--pksx-space-2) var(--pksx-space-1);
	}
</style>
