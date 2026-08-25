<script lang="ts">
	import type { PrototypePokemon } from '../box-first/prototype-data';

	interface Props {
		entry: PrototypePokemon | null;
		index: number;
		active: boolean;
		onSelect: (index: number) => void;
	}

	let { entry, index, active, onSelect }: Props = $props();
</script>

<div class="cell">
	<button
		type="button"
		class={['slot', entry ? `tone-${entry.tone}` : 'empty', active && 'active']}
		aria-label={entry ? `Slot ${index + 1}, ${entry.name}` : `Empty slot ${index + 1}`}
		aria-pressed={active}
		onclick={() => onSelect(index)}
		onfocus={() => onSelect(index)}
	>
		<span class="index">{index + 1}</span>
		{#if entry}
			<img class="sprite" src={entry.sprite} alt="" width="96" height="96" />
			<span class="name">{entry.name}</span>
			<span class="level">{entry.level}</span>
		{/if}
	</button>
</div>

<style>
	/* The cell is the allocated space; degradation keys on it, never on the band. */
	.cell {
		container-type: size;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		place-items: center;
	}

	.slot {
		position: relative;
		width: min(100cqw, 100cqh);
		height: min(100cqw, 100cqh);
		padding: 0;
		overflow: hidden;
		border: var(--t-border) solid color-mix(in srgb, var(--rule-hi), transparent 25%);
		border-radius: var(--t-radius-md);
		background: color-mix(in oklch, var(--paper-hi) 78%, var(--slot-color, #bea96f) 22%);
		box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
		cursor: pointer;
	}

	.slot.active {
		z-index: 1;
		border-color: var(--rust);
		outline: var(--t-ring) solid var(--rust);
		outline-offset: calc(var(--t-ring) * -1);
	}

	.slot.empty {
		border-style: dashed;
		background: color-mix(in srgb, var(--paper-deep), transparent 32%);
		box-shadow: none;
	}

	.sprite {
		position: absolute;
		inset: 6% 6% 16%;
		width: 88%;
		height: 78%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.index {
		position: absolute;
		top: 2px;
		left: 3px;
		color: color-mix(in srgb, var(--ink), transparent 40%);
		font: 700 var(--t-caption) / 1 var(--t-mono);
	}

	.name,
	.level {
		position: absolute;
		bottom: 2px;
		font-size: var(--t-caption);
		font-weight: 750;
		line-height: 1;
	}

	.name {
		left: 3px;
		max-width: 66%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.level {
		right: 3px;
		color: var(--ink-soft);
	}

	/* Degrade order: 1 name and level, 2 index, 3 sprite fills the Slot. */
	@container (max-height: 66px) or (max-width: 66px) {
		.name,
		.level {
			display: none;
		}

		.sprite {
			inset: 4%;
			width: 92%;
			height: 92%;
		}
	}

	@container (max-height: 46px) or (max-width: 46px) {
		.index {
			display: none;
		}

		.sprite {
			inset: 0;
			width: 100%;
			height: 100%;
		}
	}

	.tone-fire {
		--slot-color: #df7957;
	}
	.tone-electric {
		--slot-color: #d9b84f;
	}
	.tone-psychic {
		--slot-color: #cf7e9e;
	}
	.tone-water {
		--slot-color: #6daac5;
	}
	.tone-dragon {
		--slot-color: #9382c4;
	}
	.tone-dark {
		--slot-color: #756b72;
	}
	.tone-fighting {
		--slot-color: #b46a56;
	}
	.tone-steel {
		--slot-color: #8fa8a7;
	}
	.tone-rock {
		--slot-color: #b29b62;
	}
</style>
