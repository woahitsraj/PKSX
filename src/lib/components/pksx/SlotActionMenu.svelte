<script lang="ts">
	import type { SlotView } from './types';

	type Align = 'start' | 'center' | 'end';
	type VerticalAlign = 'top' | 'bottom';
	type CommandAvailability = 'available' | 'unsupported' | 'empty-slot' | 'occupied-slot';
	export type SlotActionCommandId =
		| 'pokemon-action'
		| 'move'
		| 'copy'
		| 'clear'
		| 'export'
		| 'legality-check'
		| 'create-pokemon';

	type SlotActionCommand = {
		id: SlotActionCommandId;
		label: string;
		detail: string;
		availability: CommandAvailability;
	};

	interface Props {
		location: string;
		slot: SlotView;
		align?: Align;
		vertical?: VerticalAlign;
		mobileTop?: number | null;
		activeIndex: number;
		onFocusCommand: (index: number) => void;
		onCommand: (command: SlotActionCommandId) => void;
		onClose: () => void;
	}

	let {
		location,
		slot,
		align = 'center',
		vertical = 'top',
		mobileTop = null,
		activeIndex,
		onFocusCommand,
		onCommand,
		onClose
	}: Props = $props();

	const commands = $derived(createCommands(slot));
	const occupied = $derived(slot.kind === 'pokemon');

	function createCommands(slot: SlotView): SlotActionCommand[] {
		if (slot.kind === 'empty') {
			return [
				{
					id: 'create-pokemon',
					label: 'Create Pokemon',
					detail: 'Unavailable: creation is not implemented yet.',
					availability: 'unsupported'
				},
				{
					id: 'move',
					label: 'Move',
					detail: 'Unavailable: Slot is empty.',
					availability: 'empty-slot'
				},
				{
					id: 'copy',
					label: 'Copy',
					detail: 'Unavailable: Slot is empty.',
					availability: 'empty-slot'
				},
				{
					id: 'export',
					label: 'Export',
					detail: 'Unavailable: Slot is empty.',
					availability: 'empty-slot'
				},
				{
					id: 'legality-check',
					label: 'Legality Check',
					detail: 'Unavailable: Slot is empty.',
					availability: 'empty-slot'
				}
			];
		}

		return [
			{
				id: 'pokemon-action',
				label: 'Pokemon Action',
				detail: 'Unavailable: summary view is not implemented yet.',
				availability: 'unsupported'
			},
			{
				id: 'move',
				label: 'Move',
				detail: 'Choose a destination Slot.',
				availability: 'available'
			},
			{
				id: 'copy',
				label: 'Copy',
				detail: 'Choose an empty destination Slot.',
				availability: 'available'
			},
			{
				id: 'clear',
				label: 'Clear Slot',
				detail: 'Remove this Pokemon after confirmation.',
				availability: 'available'
			},
			{
				id: 'export',
				label: 'Export',
				detail: 'Unavailable: Pokemon export is not implemented yet.',
				availability: 'unsupported'
			},
			{
				id: 'legality-check',
				label: 'Legality Check',
				detail: 'Unavailable: Legality Check is not implemented yet.',
				availability: 'unsupported'
			},
			{
				id: 'create-pokemon',
				label: 'Create Pokemon',
				detail: 'Unavailable: Slot already contains a Pokemon.',
				availability: 'occupied-slot'
			}
		];
	}
</script>

<div
	class={[
		'slot-context',
		align === 'start' && 'align-start',
		align === 'end' && 'align-end',
		vertical === 'bottom' && 'vertical-bottom'
	]}
	role="dialog"
	aria-label="Slot actions"
	tabindex="0"
	style:--mobile-surface-top={mobileTop === null ? undefined : `${mobileTop}px`}
>
	<div class="slot-context-header">
		<p class="slot-context-kicker">{occupied ? 'Pokemon Action' : 'Slot Action'}</p>
		<p class="slot-context-location">{location}</p>
	</div>

	<div class="slot-command-stack" role="list" aria-label="Slot Action commands">
		{#each commands as command, index (command.label)}
			<div class="slot-command-row" role="listitem">
				<button
					id={`slot-action-${index}`}
					type="button"
					class:controller-focused={activeIndex === index}
					aria-label={command.availability === 'available'
						? `${command.label}: ${command.detail}`
						: `${command.label} unavailable: ${command.detail.replace('Unavailable: ', '')}`}
					data-availability={command.availability}
					aria-disabled={command.availability === 'available' ? undefined : 'true'}
					onfocus={() => onFocusCommand(index)}
					onclick={(event) => {
						event.preventDefault();
						onFocusCommand(index);
						if (command.availability === 'available') {
							onCommand(command.id);
						}
					}}
				>
					<span>{command.label}</span>
					<small>{command.availability === 'available' ? 'Ready' : 'Unavailable'}</small>
				</button>
			</div>
		{/each}
	</div>

	<button
		id={`slot-action-${commands.length}`}
		type="button"
		class="close-command"
		class:controller-focused={activeIndex === commands.length}
		onfocus={() => onFocusCommand(commands.length)}
		onclick={onClose}>Close</button
	>
</div>

<style>
	.slot-context {
		position: absolute;
		z-index: 200;
		top: calc(100% + 8px);
		left: 50%;
		width: min(218px, calc(100vw - 24px));
		display: grid;
		gap: 4px;
		padding: 6px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		transform: translateX(-50%);
	}

	.slot-context.align-start {
		top: 0;
		left: calc(100% + 8px);
		transform: none;
	}

	.slot-context.align-end {
		top: 0;
		right: calc(100% + 8px);
		left: auto;
		transform: none;
	}

	.slot-context.vertical-bottom {
		top: auto;
		bottom: 0;
	}

	.slot-context-header {
		display: grid;
		gap: 2px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--rule);
	}

	.slot-context-kicker,
	.slot-context-location {
		margin: 0;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.25;
	}

	.slot-context-kicker {
		color: var(--rust);
		text-transform: uppercase;
	}

	.slot-command-stack {
		display: grid;
		gap: 3px;
	}

	.slot-command-row {
		min-width: 0;
	}

	.slot-command-row button,
	.close-command {
		width: 100%;
		min-height: 27px;
		padding: 4px 8px;
		border: 0;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		box-shadow: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}

	.slot-command-row button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		cursor: not-allowed;
		opacity: 0.68;
	}

	.slot-command-row button.controller-focused,
	.close-command.controller-focused {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 55%);
		outline-offset: 1px;
		opacity: 1;
	}

	.slot-command-row span,
	.close-command {
		font-size: 0.78rem;
		font-weight: 750;
		line-height: 1.15;
	}

	.slot-command-row small {
		flex: 0 0 auto;
		color: var(--ink-mute);
		font:
			650 0.56rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.slot-command-row button[data-availability='empty-slot'],
	.slot-command-row button[data-availability='occupied-slot'] {
		background: var(--paper-deep);
	}

	.close-command {
		background: var(--rust);
		color: white;
		cursor: pointer;
		text-align: center;
	}

	.close-command:hover,
	.close-command:focus-visible {
		background: var(--rust-ring);
		outline: none;
	}

	@media (max-width: 820px) {
		.slot-context,
		.slot-context.align-start,
		.slot-context.align-end,
		.slot-context.vertical-bottom {
			position: fixed;
			top: var(--mobile-surface-top, auto);
			right: 12px;
			bottom: auto;
			left: 12px;
			width: auto;
			max-height: max(80px, calc(100dvh - var(--mobile-surface-top, 76px) - 88px));
			overflow-y: auto;
			transform: none;
		}

		.close-command {
			position: sticky;
			bottom: 0;
		}
	}
</style>
