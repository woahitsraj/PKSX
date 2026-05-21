<script lang="ts">
	type Align = 'start' | 'center' | 'end';

	interface Props {
		location: string;
		align?: Align;
	}

	let { location, align = 'center' }: Props = $props();
</script>

<div
	class={['slot-context', align === 'start' && 'align-start', align === 'end' && 'align-end']}
	role="dialog"
	aria-label="Slot actions"
>
	<p class="slot-context-location">{location}</p>
	<button type="button" disabled>View</button>
	<button type="button" disabled>Move</button>
	<button type="button" disabled>Export</button>
</div>

<style>
	.slot-context {
		position: absolute;
		z-index: 40;
		top: calc(100% + 8px);
		left: 50%;
		width: 150px;
		display: grid;
		gap: 6px;
		padding: 8px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		transform: translateX(-50%);
	}

	.slot-context.align-start {
		left: 0;
		transform: none;
	}

	.slot-context.align-end {
		right: 0;
		left: auto;
		transform: none;
	}

	.slot-context-location {
		margin: 0 0 2px;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
	}

	.slot-context button {
		width: 100%;
		min-height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		text-align: left;
		cursor: not-allowed;
		opacity: 0.55;
	}
</style>
