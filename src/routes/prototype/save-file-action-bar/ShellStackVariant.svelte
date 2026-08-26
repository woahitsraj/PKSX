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

<section class={['variant', viewport]} aria-label="Shell stack variant">
	<SaveFileMock {viewport} {draftName} {draftMoney} {onNameInput} {onMoneyInput} />
	<div class="shell-region">
		<ActionControls {stagedCount} {onApply} {onCancel} />
		{#if viewport === 'mobile'}<PrototypeMobileTabs {onNavigate} />{/if}
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
		--mock-bottom-inset: 104px;
	}

	.shell-region {
		position: absolute;
		z-index: 10;
		right: 0;
		bottom: 0;
		left: 0;
		border-top: 1px solid color-mix(in srgb, var(--gold), transparent 25%);
		box-shadow: 0 -10px 26px -18px rgba(42, 36, 28, 0.7);
	}
</style>
