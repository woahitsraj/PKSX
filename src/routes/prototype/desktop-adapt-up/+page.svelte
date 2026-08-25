<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PrototypeSwitcher from '../box-first/PrototypeSwitcher.svelte';
	import BoxScreen from '../density/BoxScreen.svelte';
	import CanvasFrame from '../density/CanvasFrame.svelte';
	import EditorScreen from '../density/EditorScreen.svelte';
	import SavesScreen from '../density/SavesScreen.svelte';
	import '../density/tokens.css';
	import TwoPaneBoxScreen from './TwoPaneBoxScreen.svelte';

	// Three large-canvas rule sets for #203, switchable via ?variant= on /prototype/desktop-adapt-up.
	const variants = [
		{
			key: 'A',
			name: 'Natural stretch',
			note: '13px body · single pane · no width caps',
			rules: ['Fixed 13px body', 'Single Box Pane', 'No maximum widths', 'No desktop-only actions']
		},
		{
			key: 'B',
			name: 'Reading island',
			note: '15px step · single pane · capped content',
			rules: [
				'15px body at 900×700',
				'Single pane until opened',
				'800px pane · 260px rail · 1200px Saves',
				'No desktop-only actions'
			]
		},
		{
			key: 'C',
			name: 'Auto workbench',
			note: '15px step · two panes · capped content',
			rules: [
				'15px body at 900×700',
				'Two panes open when they fit',
				'640px panes · 260px rail · 1200px Saves',
				'No desktop-only actions',
				'Adds a Focus Zone by canvas size'
			]
		}
	];
	const canvases = [
		{ label: 'Steam Deck', raw: '1280×800', width: 1280, height: 800, band: 'tall', scale: 0.64 },
		{ label: 'Desktop', raw: '1920×1080', width: 1920, height: 1080, band: 'tall', scale: 0.43 }
	] as const;
	const screens = [
		{ key: 'boxes', name: 'Boxes' },
		{ key: 'editor', name: 'Pokemon Editor' },
		{ key: 'saves', name: 'Saves' }
	] as const;

	const param = (key: string) => (browser ? page.url.searchParams.get(key) : null);
	const initialVariant = param('variant')?.toUpperCase() ?? 'A';
	let current = $state(
		variants.some((variant) => variant.key === initialVariant) ? initialVariant : 'A'
	);
	const currentVariant = $derived(
		variants.find((variant) => variant.key === current) ?? variants[0]
	);
	const live = $derived(param('live'));
	const only = $derived(param('screen'));
	const showControls = $derived(browser && param('controls') !== '0');

	function changeVariant(key: string) {
		current = key;
		const url = new URL(page.url);
		url.searchParams.set('variant', key);
		replaceState(resolve(`/prototype/desktop-adapt-up?${url.searchParams.toString()}`), page.state);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLElement &&
			event.target.matches('input, textarea, [contenteditable]')
		) {
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const index = variants.findIndex((variant) => variant.key === current);
		const offset = event.key === 'ArrowLeft' ? -1 : 1;
		changeVariant(variants[(index + offset + variants.length) % variants.length].key);
	}
</script>

<svelte:head>
	<title>Desktop adapt-up prototype · PKSX</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<main class="desktop-wall" class:live={Boolean(live)}>
	{#if live}
		<div class="live-frame" data-canvas="live">
			<div class={['density-root', 'variant-C', 'desktop-root', `desktop-${current}`]}>
				{#if live === 'boxes'}
					{#if current === 'C'}<TwoPaneBoxScreen />{:else}<BoxScreen />{/if}
				{:else if live === 'editor'}
					<EditorScreen />
				{:else}
					<SavesScreen />
				{/if}
			</div>
		</div>
	{:else}
		<header class="study-head">
			<div>
				<span class="eyebrow">Issue 203 · large Tall canvases</span>
				<h1>{currentVariant.key} · {currentVariant.name}</h1>
			</div>
			<div class="rules">
				{#each currentVariant.rules as rule, index (rule)}
					<span><b>{index + 1}</b>{rule}</span>
				{/each}
			</div>
		</header>
		{#each screens.filter((screen) => !only || screen.key === only) as screen (screen.key)}
			<section class="row">
				<h2>{screen.name}</h2>
				<div class="frames">
					{#each canvases as canvas (canvas.label)}
						<CanvasFrame {...canvas}>
							<div class={['density-root', 'variant-C', 'desktop-root', `desktop-${current}`]}>
								{#if screen.key === 'boxes'}
									{#if current === 'C'}<TwoPaneBoxScreen />{:else}<BoxScreen />{/if}
								{:else if screen.key === 'editor'}
									<EditorScreen />
								{:else}
									<SavesScreen />
								{/if}
							</div>
						</CanvasFrame>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
	{#if dev && showControls}
		<PrototypeSwitcher {variants} {current} onChange={changeVariant} />
	{/if}
</main>

<style>
	:global(.app-shell:has(.desktop-wall)) {
		padding: 0;
		gap: 0;
	}

	.desktop-wall {
		position: fixed;
		z-index: 3000;
		inset: 0;
		overflow: auto;
		padding: 18px 18px 82px;
		background: #d9cfbc;
		color: #2a241c;
		font-family: var(--pksx-font-sans);
	}

	.desktop-wall.live {
		padding: 0;
		overflow: hidden;
	}

	.study-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 18px;
	}

	.eyebrow {
		color: #8c3f28;
		font: 750 10px/1.2 var(--pksx-font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1,
	h2 {
		margin: 0;
	}

	h1 {
		font-size: 24px;
		letter-spacing: -0.03em;
	}

	h2 {
		margin-bottom: 7px;
		font-size: 13px;
	}

	.rules {
		display: grid;
		grid-template-columns: repeat(2, minmax(190px, 1fr));
		gap: 4px 14px;
	}

	.rules span {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.rules b {
		width: 16px;
		height: 16px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #2a241c;
		color: #f8f2e8;
		font: 700 9px var(--pksx-font-mono);
	}

	.row {
		margin-bottom: 22px;
	}

	.frames {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 16px;
		overflow-x: auto;
		padding-bottom: 8px;
	}

	.live-frame {
		container-type: size;
		width: 100%;
		height: 100dvh;
		--band: tall;
	}

	:global(.desktop-root) {
		container-type: size;
		width: 100%;
		height: 100%;
	}

	:global(.desktop-B),
	:global(.desktop-C) {
		--desktop-gutter: clamp(18px, 3cqw, 48px);
	}

	:global(.desktop-B:has(.box-screen)),
	:global(.desktop-C:has(.workbench)) {
		display: grid;
		place-items: center;
	}

	:global(.desktop-B .box-screen) {
		width: min(1080px, calc(100% - var(--desktop-gutter) * 2));
		height: min(720px, calc(100% - var(--desktop-gutter) * 2));
		grid-template-columns: minmax(0, 800px) minmax(240px, 260px);
		margin: auto;
	}

	:global(.desktop-B .saves),
	:global(.desktop-C .saves) {
		width: min(1200px, calc(100% - var(--desktop-gutter) * 2));
		margin: auto;
	}

	:global(.desktop-B .saves .grid),
	:global(.desktop-C .saves .grid) {
		grid-template-columns: repeat(4, minmax(240px, 1fr));
	}

	@container (min-width: 900px) and (min-height: 700px) {
		:global(.desktop-B),
		:global(.desktop-C) {
			--t-caption: 11px;
			--t-label: 13px;
			--t-body: 15px;
			--t-title: 18px;
			--t-display: 28px;
		}
	}

	@media (max-width: 900px) {
		.study-head {
			align-items: flex-start;
			flex-direction: column;
		}

		.rules {
			grid-template-columns: 1fr;
		}
	}
</style>
