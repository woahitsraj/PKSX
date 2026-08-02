<script lang="ts">
	import type { SlotView } from './types';

	type CommandAvailability = 'available' | 'unsupported' | 'empty-slot' | 'occupied-slot';
	type SlotActionCommandKey =
		| 'pokemon-action'
		| 'create-pokemon'
		| 'move'
		| 'copy'
		| 'clear'
		| 'export'
		| 'legality-check';

	type SlotActionCommand = {
		key: SlotActionCommandKey;
		label: string;
		availability: CommandAvailability;
	};

	interface Props {
		location: string;
		slot: SlotView;
		mobileTop?: number | null;
		viewportTop?: number | null;
		viewportLeft?: number | null;
		activeIndex: number;
		createPokemonAvailable?: boolean;
		onFocusCommand: (index: number) => void;
		onSelectCommand: (command: SlotActionCommandKey) => void;
		onClose: () => void;
	}

	let {
		location,
		slot,
		mobileTop = null,
		viewportTop = null,
		viewportLeft = null,
		activeIndex,
		createPokemonAvailable = false,
		onFocusCommand,
		onSelectCommand,
		onClose
	}: Props = $props();

	const commands = $derived(createCommands(slot, createPokemonAvailable));
	const occupied = $derived(slot.kind === 'pokemon');

	function createCommands(slot: SlotView, canCreatePokemon: boolean): SlotActionCommand[] {
		if (slot.kind === 'empty') {
			return [
				{
					key: 'create-pokemon',
					label: 'Create Pokemon',
					availability: canCreatePokemon ? 'available' : 'unsupported'
				},
				{
					key: 'move',
					label: 'Move',
					availability: 'empty-slot'
				},
				{
					key: 'copy',
					label: 'Copy',
					availability: 'empty-slot'
				},
				{
					key: 'export',
					label: 'Export',
					availability: 'empty-slot'
				},
				{
					key: 'legality-check',
					label: 'Legality Check',
					availability: 'empty-slot'
				}
			];
		}

		return [
			{
				key: 'pokemon-action',
				label: 'Edit',
				availability: 'available'
			},
			{
				key: 'move',
				label: 'Move',
				availability: 'available'
			},
			{
				key: 'copy',
				label: 'Copy',
				availability: 'available'
			},
			{
				key: 'clear',
				label: 'Clear Slot',
				availability: 'available'
			},
			{
				key: 'export',
				label: 'Export',
				availability: 'unsupported'
			},
			{
				key: 'legality-check',
				label: 'Legality Check',
				availability: 'available'
			},
			{
				key: 'create-pokemon',
				label: 'Create Pokemon',
				availability: 'occupied-slot'
			}
		];
	}
</script>

<div
	class={['slot-context', viewportTop !== null && viewportLeft !== null && 'viewport-anchored']}
	role="dialog"
	aria-label="Slot actions"
	tabindex="0"
	style:--mobile-surface-top={mobileTop === null ? undefined : `${mobileTop}px`}
	style:--viewport-surface-top={viewportTop === null ? undefined : `${viewportTop}px`}
	style:--viewport-surface-left={viewportLeft === null ? undefined : `${viewportLeft}px`}
>
	<div class="slot-context-header">
		<p class="slot-context-kicker">{occupied ? 'Edit' : 'Slot Action'}</p>
		<p class="slot-context-location">{location}</p>
	</div>

	<div class="slot-command-stack" role="list" aria-label="Slot Action commands">
		{#each commands as command, index (command.label)}
			<div class="slot-command-row" role="listitem">
				<button
					id={`slot-action-${index}`}
					type="button"
					class:controller-focused={activeIndex === index}
					aria-disabled={command.availability === 'available' ? undefined : 'true'}
					data-availability={command.availability}
					onfocus={() => onFocusCommand(index)}
					onclick={(event) => {
						event.preventDefault();
						onFocusCommand(index);
						if (command.availability === 'available') {
							onSelectCommand(command.key);
						}
					}}
				>
					<span>{command.label}</span>
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
		position: fixed;
		z-index: 500;
		top: var(--viewport-surface-top, 0);
		left: var(--viewport-surface-left, 0);
		width: min(218px, calc(100vw - 24px));
		display: grid;
		gap: 4px;
		padding: 6px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		/* Invisible (but focusable) until the anchor pass places it, so it never flashes unpositioned. */
		opacity: 0;
		pointer-events: none;
	}

	.slot-context.viewport-anchored {
		opacity: 1;
		pointer-events: auto;
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
		justify-content: flex-start;
		cursor: not-allowed;
		opacity: 0.68;
	}

	.slot-command-row button[data-availability='available'] {
		cursor: pointer;
		opacity: 1;
	}

	.slot-command-row button[data-availability='available']:hover,
	.slot-command-row button[data-availability='available']:focus-visible {
		background: var(--rust-wash);
		color: var(--rust);
		outline: none;
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

	@media (max-width: 1024px) {
		.slot-context {
			top: var(--mobile-surface-top, auto);
			right: 12px;
			bottom: auto;
			left: 12px;
			width: auto;
			max-height: max(
				80px,
				calc(100dvh - var(--mobile-surface-top, 76px) - 88px - env(safe-area-inset-bottom, 0px))
			);
			overflow-y: auto;
			opacity: 1;
			pointer-events: auto;
		}

		.close-command {
			position: sticky;
			bottom: 0;
		}
	}
</style>
