<script lang="ts">
	import type { SlotView } from './types';

	interface Props {
		id: string;
		slot: SlotView;
		zone: 'party' | 'box';
		focused: boolean;
		dualType: boolean;
		style: string;
		rowIndex: number;
		colIndex: number;
		spriteUrl: string;
		collapsed?: boolean;
		onFocusSlot: () => void;
		onOpenSlot: () => void;
	}

	let {
		id,
		slot,
		zone,
		focused,
		dualType,
		style,
		rowIndex,
		colIndex,
		spriteUrl,
		collapsed = false,
		onFocusSlot,
		onOpenSlot
	}: Props = $props();

	const zoneClass = $derived(zone === 'party' ? 'party-slot' : 'box-slot');
	const slotNumber = $derived(zone === 'party' ? `P${slot.slot + 1}` : String(slot.slot + 1));
</script>

<button
	{id}
	class={['slot', zoneClass, slot.kind, dualType && 'dual-type', focused && 'focused']}
	type="button"
	role="gridcell"
	tabindex="-1"
	{style}
	aria-selected={focused}
	aria-rowindex={rowIndex}
	aria-colindex={colIndex}
	aria-hidden={collapsed ? 'true' : undefined}
	onfocus={onFocusSlot}
	onclick={onFocusSlot}
	ondblclick={onOpenSlot}
>
	<span class="slot-number">{slotNumber}</span>
	{#if slot.kind === 'pokemon'}
		<img class="slot-sprite" src={spriteUrl} alt="" width="96" height="96" />
	{:else}
		<span class="slot-sprite empty-sprite" aria-hidden="true"></span>
	{/if}
	<span class="slot-label">
		{#if slot.kind === 'pokemon' && slot.level !== null}<em>L{slot.level}</em>{/if}
		<span>{slot.label}</span>
	</span>
	{#if slot.detail}
		<span class="slot-detail">{slot.detail}</span>
	{/if}
</button>

<style>
	.slot {
		--slot-hue: 48;
		--slot-hue-2: var(--slot-hue);
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: var(--pksx-radius-md);
		background: oklch(0.9 0.09 var(--slot-hue));
		box-shadow: var(--shadow-sm);
		color: var(--ink);
		overflow: visible;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.slot.dual-type {
		background: linear-gradient(
			135deg,
			oklch(0.9 0.09 var(--slot-hue)) 0%,
			oklch(0.9 0.09 var(--slot-hue)) 55%,
			oklch(0.9 0.09 var(--slot-hue-2)) 55%,
			oklch(0.9 0.09 var(--slot-hue-2)) 100%
		);
	}

	:global(.app-shell.dark) .slot {
		background: oklch(0.46 0.11 var(--slot-hue));
	}

	:global(.app-shell.dark) .slot.dual-type {
		background: linear-gradient(
			135deg,
			oklch(0.46 0.11 var(--slot-hue)) 0%,
			oklch(0.46 0.11 var(--slot-hue)) 55%,
			oklch(0.46 0.11 var(--slot-hue-2)) 55%,
			oklch(0.46 0.11 var(--slot-hue-2)) 100%
		);
	}

	.slot.pokemon:hover,
	.slot.focused {
		transform: translateY(-1px);
		box-shadow:
			0 0 0 2.5px var(--rust),
			var(--shadow);
	}

	.slot.empty {
		border: 1.5px dashed var(--rule-hi);
		background: color-mix(in srgb, var(--paper-deep), transparent 35%);
		box-shadow: none;
	}

	.slot.empty.focused {
		border-style: solid;
		border-color: var(--rust);
		box-shadow:
			0 0 0 2.5px var(--rust),
			var(--shadow);
	}

	.box-slot,
	.party-slot {
		aspect-ratio: 1;
	}

	.slot-number {
		position: absolute;
		top: 4px;
		left: 5px;
		color: color-mix(in srgb, var(--ink), transparent 30%);
		font:
			700 0.48rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.04em;
	}

	.slot-sprite {
		width: 76%;
		height: 76%;
		aspect-ratio: auto;
		border-radius: 0;
		background: none;
		box-shadow: none;
		object-fit: contain;
		image-rendering: auto;
		pointer-events: none;
	}

	.slot.pokemon .slot-sprite {
		position: absolute;
		top: 9px;
		left: 50%;
		width: 62%;
		height: calc(100% - 44px);
		transform: translateX(-50%);
	}

	.empty-sprite {
		width: 34%;
		height: 34%;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-sm);
	}

	.slot-label,
	.slot-detail {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.box-slot .slot-label,
	.party-slot .slot-label {
		position: absolute;
		left: 4px;
		right: 4px;
		bottom: 5px;
		color: color-mix(in srgb, var(--ink), transparent 22%);
		font-size: 0.53rem;
		font-weight: 750;
		text-align: center;
	}

	.box-slot .slot-detail,
	.party-slot .slot-detail {
		display: none;
	}

	.box-slot .slot-label em,
	.party-slot .slot-label em {
		display: block;
		margin-bottom: 1px;
		color: color-mix(in srgb, var(--ink), transparent 45%);
		font:
			700 0.5rem var(--pksx-font-mono),
			monospace;
		font-style: normal;
		letter-spacing: 0.04em;
	}

	.box-slot .slot-label span,
	.party-slot .slot-label span {
		display: block;
	}

	@media (max-width: 820px) {
		.party-slot {
			min-height: 56px;
			padding: 4px;
		}

		.party-slot.pokemon .slot-sprite {
			top: 7px;
			width: 42px;
			height: calc(100% - 34px);
		}

		.party-slot .slot-detail {
			display: none;
		}

		.box-slot {
			min-height: 62px;
		}
	}
</style>
