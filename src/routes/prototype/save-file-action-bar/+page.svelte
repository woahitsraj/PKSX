<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PrototypeSwitcher from '../box-first/PrototypeSwitcher.svelte';
	import FloatingDockVariant from './FloatingDockVariant.svelte';
	import ShellStackVariant from './ShellStackVariant.svelte';
	import TabTakeoverVariant from './TabTakeoverVariant.svelte';

	// Three bottom action contracts, switchable with ?variant=, on a deterministic Save File mock.
	const variants = [
		{
			key: 'A',
			name: 'Shell stack',
			note: 'The shell composes route actions above mobile navigation'
		},
		{
			key: 'B',
			name: 'Tab takeover',
			note: 'Staged edits replace mobile navigation with Apply and Cancel'
		},
		{
			key: 'C',
			name: 'Floating route dock',
			note: 'The route positions its own action pill above the tabs'
		}
	];
	const initialVariant = page.url.searchParams.get('variant')?.toUpperCase() ?? 'A';
	let current = $state(
		variants.some((variant) => variant.key === initialVariant) ? initialVariant : 'A'
	);
	let viewport = $state<'mobile' | 'desktop'>('mobile');
	let committedName = $state('RAJAN');
	let committedMoney = $state('3200');
	let draftName = $state('RAJAN');
	let draftMoney = $state('3200');
	let lastAction = $state('No action yet');
	const stagedCount = $derived(
		Number(draftName !== committedName) + Number(draftMoney !== committedMoney)
	);
	const showControls = $derived(browser && page.url.searchParams.get('controls') !== '0');
	const contract = $derived(
		current === 'A'
			? 'Owner: shell · navigation: always available · spacing: shell'
			: current === 'B'
				? `Owner: shell · navigation: ${stagedCount > 0 ? 'hidden while staged' : 'available'} · spacing: shell`
				: 'Owner: route · navigation: always available · spacing: route and shell'
	);

	function changeVariant(key: string) {
		current = key;
		const controls = page.url.searchParams.get('controls') === '0' ? '&controls=0' : '';
		replaceState(resolve(`/prototype/save-file-action-bar?variant=${key}${controls}`), page.state);
		lastAction = `Switched to ${variants.find((variant) => variant.key === key)?.name}`;
	}

	function stageSample() {
		draftName = 'MAY';
		draftMoney = '4800';
		lastAction = 'Staged sample Trainer and Money edits';
	}

	function cancelEdits() {
		draftName = committedName;
		draftMoney = committedMoney;
		lastAction = 'Cancelled all staged edits';
	}

	function applyEdits() {
		committedName = draftName;
		committedMoney = draftMoney;
		lastAction = 'Applied edits to the mock Workspace';
	}

	function navigate(destination: string) {
		lastAction = `Selected ${destination}. The prototype keeps you here.`;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLElement &&
			event.target.matches('input, textarea, [contenteditable="true"]')
		)
			return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

		event.preventDefault();
		const index = variants.findIndex((variant) => variant.key === current);
		const offset = event.key === 'ArrowLeft' ? -1 : 1;
		changeVariant(variants[(index + offset + variants.length) % variants.length].key);
	}
</script>

<svelte:head>
	<title>Save File action bar prototype · PKSX</title>
	<meta
		name="description"
		content="Throwaway prototype comparing three bottom action bar contracts."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<main class="prototype-canvas">
	<header class="prototype-toolbar">
		<div>
			<strong>Bottom action bar prototype</strong>
			<span>{stagedCount} staged · {contract}</span>
			<small>{lastAction}</small>
		</div>
		<div class="prototype-actions">
			<button
				type="button"
				class:active={viewport === 'mobile'}
				onclick={() => (viewport = 'mobile')}>Mobile</button
			>
			<button
				type="button"
				class:active={viewport === 'desktop'}
				onclick={() => (viewport = 'desktop')}>Desktop</button
			>
			<button type="button" onclick={stageSample}>Stage sample</button>
		</div>
	</header>

	<div class={['prototype-stage', viewport]}>
		{#if current === 'A'}
			<ShellStackVariant
				{viewport}
				{draftName}
				{draftMoney}
				{stagedCount}
				onNameInput={(value) => (draftName = value)}
				onMoneyInput={(value) => (draftMoney = value)}
				onApply={applyEdits}
				onCancel={cancelEdits}
				onNavigate={navigate}
			/>
		{:else if current === 'B'}
			<TabTakeoverVariant
				{viewport}
				{draftName}
				{draftMoney}
				{stagedCount}
				onNameInput={(value) => (draftName = value)}
				onMoneyInput={(value) => (draftMoney = value)}
				onApply={applyEdits}
				onCancel={cancelEdits}
				onNavigate={navigate}
			/>
		{:else}
			<FloatingDockVariant
				{viewport}
				{draftName}
				{draftMoney}
				{stagedCount}
				onNameInput={(value) => (draftName = value)}
				onMoneyInput={(value) => (draftMoney = value)}
				onApply={applyEdits}
				onCancel={cancelEdits}
				onNavigate={navigate}
			/>
		{/if}
	</div>

	{#if dev && showControls}
		<PrototypeSwitcher {variants} {current} onChange={changeVariant} />
	{/if}
</main>

<style>
	:global(.app-shell:has(.prototype-canvas)) {
		padding: 0;
		gap: 0;
	}

	.prototype-canvas {
		position: fixed;
		z-index: 3000;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 10px;
		padding: 10px 12px 64px;
		overflow: hidden;
		background:
			radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.62), transparent 38%),
			repeating-linear-gradient(45deg, transparent 0 6px, rgba(70, 50, 30, 0.012) 6px 7px),
			var(--paper);
		color: var(--ink);
	}

	.prototype-toolbar {
		width: min(1100px, 100%);
		justify-self: center;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 8px 10px;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-lg);
		background: color-mix(in srgb, var(--paper-hi), transparent 4%);
		box-shadow: var(--shadow-sm);
	}

	.prototype-toolbar > div:first-child {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.prototype-toolbar strong {
		font-size: 0.78rem;
	}

	.prototype-toolbar span,
	.prototype-toolbar small {
		overflow: hidden;
		color: var(--ink-mute);
		font: 650 0.55rem var(--pksx-font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prototype-actions {
		display: flex;
		flex: 0 0 auto;
		gap: 4px;
	}

	.prototype-actions button {
		padding: 6px 9px;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		font: 750 0.62rem var(--pksx-font-sans);
	}

	.prototype-actions button.active {
		border-color: var(--rust);
		background: var(--rust-wash);
		color: var(--rust);
	}

	.prototype-stage {
		min-width: 0;
		min-height: 0;
		justify-self: center;
		width: min(1100px, 100%);
		overflow: hidden;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		transition: width 180ms ease;
	}

	.prototype-stage.mobile {
		width: min(390px, 100%);
	}

	@media (max-width: 620px) {
		.prototype-canvas {
			padding: 6px 6px 60px;
		}

		.prototype-toolbar {
			align-items: stretch;
			flex-direction: column;
			gap: 6px;
		}

		.prototype-toolbar span {
			display: none;
		}

		.prototype-actions button {
			flex: 1;
		}
	}
</style>
