<script lang="ts">
	import type { PrototypePokemon } from './prototype-data';

	interface Props {
		entry: PrototypePokemon | null;
		index: number;
		active: boolean;
		party?: boolean;
		onSelect: (entry: PrototypePokemon | null, index: number) => void;
	}

	let { entry, index, active, party = false, onSelect }: Props = $props();
</script>

<div class="slot-frame">
	<button
		type="button"
		class={['prototype-slot', entry ? `tone-${entry.tone}` : 'empty', active && 'active']}
		aria-label={entry
			? `${party ? 'Party' : 'Box'} slot ${index + 1}, ${entry.name}`
			: `Empty slot ${index + 1}`}
		aria-pressed={active}
		onfocus={() => onSelect(entry, index)}
		onclick={() => onSelect(entry, index)}
	>
		<span class="slot-index">{party ? `P${index + 1}` : index + 1}</span>
		{#if entry}
			<img src={entry.sprite} alt="" width="96" height="96" />
			<span class="slot-name">{entry.name}</span>
			<span class="slot-level">Lv {entry.level}</span>
		{:else}
			<span class="empty-mark" aria-hidden="true"></span>
		{/if}
	</button>
</div>

<style>
	.slot-frame {
		container-type: size;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		place-items: center;
	}

	.prototype-slot {
		position: relative;
		width: min(100cqw, 100cqh);
		height: min(100cqw, 100cqh);
		min-width: 0;
		min-height: 0;
		padding: 2px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--rule-hi), transparent 25%);
		border-radius: 7px;
		background: color-mix(in oklch, var(--paper-hi) 78%, var(--slot-color, #bea96f) 22%);
		box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.prototype-slot:hover,
	.prototype-slot:focus-visible,
	.prototype-slot.active {
		z-index: 2;
		border-color: var(--rust);
		outline: 2px solid var(--rust);
		outline-offset: -2px;
	}

	.prototype-slot:active {
		transform: scale(0.98);
	}

	.prototype-slot.empty {
		border-style: dashed;
		background: color-mix(in srgb, var(--paper-deep), transparent 32%);
		box-shadow: none;
	}

	.prototype-slot img {
		position: absolute;
		inset: 8% 8% 14%;
		width: 84%;
		height: 78%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.slot-index {
		position: absolute;
		top: 2px;
		left: 3px;
		z-index: 2;
		color: color-mix(in srgb, var(--ink), transparent 36%);
		font: 700 clamp(6px, 1.25cqh, 8px) var(--pksx-font-mono);
	}

	.slot-name,
	.slot-level {
		position: absolute;
		z-index: 2;
		bottom: 2px;
		font-size: clamp(6px, 1.4cqh, 9px);
		font-weight: 750;
		line-height: 1;
	}

	.slot-name {
		left: 3px;
		max-width: 68%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slot-level {
		right: 3px;
		color: var(--ink-soft);
	}

	.empty-mark {
		position: absolute;
		inset: 31%;
		border: 1px dashed var(--rule-hi);
		border-radius: 50%;
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

	@container stage (max-height: 420px) {
		.slot-name,
		.slot-level {
			display: none;
		}

		.prototype-slot img {
			inset: 5%;
			width: 90%;
			height: 90%;
		}
	}
</style>
