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

<section class={['variant', viewport]} aria-label="Floating route dock variant">
	<SaveFileMock {viewport} {draftName} {draftMoney} {onNameInput} {onMoneyInput} />
	<div class="route-dock"><ActionControls {stagedCount} compact {onApply} {onCancel} /></div>
	{#if viewport === 'mobile'}
		<div class="tabs"><PrototypeMobileTabs {onNavigate} /></div>
	{/if}
</section>

<style>
	.variant {
		--mock-bottom-inset: 70px;
		position: relative;
		height: 100%;
		overflow: hidden;
	}

	.variant.mobile {
		--mock-bottom-inset: 112px;
	}

	.route-dock {
		position: absolute;
		z-index: 12;
		right: 14px;
		bottom: 12px;
		width: min(460px, calc(100% - 28px));
	}

	.mobile .route-dock {
		right: 10px;
		bottom: 58px;
		left: 10px;
		width: auto;
	}

	.tabs {
		position: absolute;
		z-index: 10;
		right: 0;
		bottom: 0;
		left: 0;
	}
</style>
