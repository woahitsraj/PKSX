<script lang="ts">
	import ActionControls from './ActionControls.svelte';
	import PrototypeMobileTabs from './PrototypeMobileTabs.svelte';
	import SaveFileMock from './SaveFileMock.svelte';

	interface Props {
		viewport: 'mobile' | 'desktop';
		draftName: string;
		draftMoney: string;
		stagedCount: number;
		onNameInput: (value: string) => void;
		onMoneyInput: (value: string) => void;
		onApply: () => void;
		onCancel: () => void;
		onNavigate: (destination: string) => void;
	}

	let {
		viewport,
		draftName,
		draftMoney,
		stagedCount,
		onNameInput,
		onMoneyInput,
		onApply,
		onCancel,
		onNavigate
	}: Props = $props();
</script>

<section class={['variant', viewport]} aria-label="Tab takeover variant">
	<SaveFileMock {viewport} {draftName} {draftMoney} {onNameInput} {onMoneyInput} />
	<div class="bottom-region">
		{#if viewport === 'desktop' || stagedCount > 0}
			<ActionControls {stagedCount} compact={viewport === 'mobile'} {onApply} {onCancel} />
			{#if viewport === 'mobile' && stagedCount > 0}
				<p>Sections return after Apply or Cancel</p>
			{/if}
		{:else}
			<PrototypeMobileTabs {onNavigate} />
		{/if}
	</div>
</section>

<style>
	.variant {
		--mock-bottom-inset: 53px;
		position: relative;
		height: 100%;
		overflow: hidden;
	}

	.variant.mobile {
		--mock-bottom-inset: 52px;
	}

	.bottom-region {
		position: absolute;
		z-index: 10;
		right: 0;
		bottom: 0;
		left: 0;
		border-top: 1px solid var(--rule-hi);
		background: var(--paper-hi);
		box-shadow: 0 -10px 26px -18px rgba(42, 36, 28, 0.7);
	}

	.mobile .bottom-region :global(.action-controls) {
		margin: 7px;
	}

	p {
		margin: -3px 0 4px;
		color: var(--ink-mute);
		font: 700 0.5rem var(--pksx-font-mono);
		text-align: center;
		text-transform: uppercase;
	}
</style>
