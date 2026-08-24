<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	type VariantKey = 'A' | 'B' | 'C';
	type PrototypeSave = {
		id: string;
		game: string;
		trainer: string;
		fileName: string;
		boxes: number;
		pokemon: number;
		played: string;
		active?: boolean;
		party: string[];
	};

	let { variant }: { variant: string } = $props();

	const variants: { key: VariantKey; name: string }[] = [
		{ key: 'A', name: 'Cartridge grid' },
		{ key: 'B', name: 'Party cards' },
		{ key: 'C', name: 'Save strips' }
	];
	const saves: PrototypeSave[] = [
		{
			id: 'emerald',
			game: 'Pokemon Emerald',
			trainer: 'RAJAN',
			fileName: 'emerald-main.sav',
			boxes: 14,
			pokemon: 173,
			played: '86.4h',
			active: true,
			party: ['S', 'G', 'M', 'A', 'F', 'R']
		},
		{
			id: 'crystal',
			game: 'Pokemon Crystal',
			trainer: 'KRIS',
			fileName: 'crystal-cart.sav',
			boxes: 14,
			pokemon: 96,
			played: '41.2h',
			party: ['T', 'E', 'U', 'S', 'P', 'D']
		},
		{
			id: 'platinum',
			game: 'Pokemon Platinum',
			trainer: 'LUCAS',
			fileName: 'platinum.nds.sav',
			boxes: 18,
			pokemon: 248,
			played: '112.8h',
			party: ['I', 'S', 'R', 'G', 'L', 'T']
		},
		{
			id: 'violet',
			game: 'Pokemon Violet',
			trainer: 'VIOLET',
			fileName: 'main',
			boxes: 32,
			pokemon: 411,
			played: '159.6h',
			party: ['M', 'T', 'C', 'A', 'B', 'K']
		},
		{
			id: 'colosseum',
			game: 'Pokemon Colosseum',
			trainer: 'WES',
			fileName: 'card-a.raw',
			boxes: 3,
			pokemon: 57,
			played: '29.1h',
			party: ['E', 'U', 'M', 'H', 'S', 'T']
		}
	];

	let focusedId = $state('emerald');
	const currentIndex = $derived(
		Math.max(
			0,
			variants.findIndex((item) => item.key === variant)
		)
	);
	const current = $derived(variants[currentIndex] ?? variants[0]);
	const focusedSave = $derived(saves.find((save) => save.id === focusedId));

	function setVariant(index: number) {
		const next = variants[(index + variants.length) % variants.length];
		const url = new URL(page.url);
		url.searchParams.set('variant', next.key);
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		) {
			return;
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			setVariant(currentIndex - 1);
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			setVariant(currentIndex + 1);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Three disposable Saves layouts, switchable with ?variant=A|B|C on the existing route. -->
<section class="saves-prototype" aria-label={`Saves layout prototype ${current.key}`}>
	<header class="prototype-header">
		<div>
			<span class="eyebrow">On this device</span>
			<h1>Saves</h1>
		</div>
		<div class="storage-summary" aria-label="Pokemon Storage summary">
			<span class="storage-mark">30</span>
			<span><strong>Pokemon Storage</strong><small>30 Pokemon in 3 boxes</small></span>
		</div>
	</header>

	<div class="save-canvas variant-{current.key.toLowerCase()}">
		{#if current.key === 'A'}
			<div class="cartridge-grid" aria-label="Imported Save Files">
				{#each saves as save (save.id)}
					<button
						type="button"
						class:active={save.active}
						class:focused={focusedId === save.id}
						onclick={() => (focusedId = save.id)}
					>
						<span class="cartridge-spine"></span>
						<span class="card-heading">
							<strong>{save.game}</strong>
							{#if save.active}<em>Active</em>{/if}
						</span>
						<span class="trainer">{save.trainer}</span>
						<span class="file-name">{save.fileName}</span>
						<span class="card-stats"><b>{save.boxes}</b> boxes <i></i> {save.pokemon} Pokemon</span>
					</button>
				{/each}
				<button type="button" class="import-card" onclick={() => (focusedId = 'import')}>
					<span class="plus">+</span><strong>Import a Save File</strong><small>Choose a file</small>
				</button>
			</div>
		{:else if current.key === 'B'}
			<div class="party-grid" aria-label="Imported Save Files">
				{#each saves as save (save.id)}
					<button
						type="button"
						class:active={save.active}
						class:focused={focusedId === save.id}
						onclick={() => (focusedId = save.id)}
					>
						<span class="party-card-heading">
							<span><strong>{save.game}</strong><small>{save.fileName}</small></span>
							{#if save.active}<em>Active</em>{/if}
						</span>
						<span class="party-balls" aria-label="Party preview">
							{#each save.party as pokemon, index (`${save.id}-${index}`)}<i>{pokemon}</i>{/each}
						</span>
						<span class="party-meta">
							<b>{save.trainer}</b><span>{save.boxes} boxes</span><span>{save.played}</span>
						</span>
					</button>
				{/each}
				<button type="button" class="party-import" onclick={() => (focusedId = 'import')}>
					<span>+</span><strong>Import a Save File</strong><small>Add another adventure</small>
				</button>
			</div>
		{:else}
			<div class="save-strips" aria-label="Imported Save Files">
				{#each saves as save, index (save.id)}
					<button
						type="button"
						class:active={save.active}
						class:focused={focusedId === save.id}
						onclick={() => (focusedId = save.id)}
					>
						<span class="strip-index">{String(index + 1).padStart(2, '0')}</span>
						<span class="strip-title"
							><strong>{save.game}</strong><small>{save.fileName}</small></span
						>
						<span class="strip-trainer"><small>Trainer</small>{save.trainer}</span>
						<span class="strip-boxes"><b>{save.boxes}</b><small>boxes</small></span>
						{#if save.active}<em>Active</em>{/if}
					</button>
				{/each}
				<button type="button" class="strip-import" onclick={() => (focusedId = 'import')}>
					<span class="strip-index">+</span><strong>Import a Save File</strong><small
						>Choose a file</small
					>
				</button>
			</div>
		{/if}
	</div>

	<nav class="prototype-switcher" aria-label="Prototype variants">
		<button type="button" aria-label="Previous variant" onclick={() => setVariant(currentIndex - 1)}
			>←</button
		>
		<span>
			<strong>{current.key} · {current.name}</strong>
			<small>Focus: {focusedSave?.game ?? 'Import'} · Active: Pokemon Emerald</small>
		</span>
		<button type="button" aria-label="Next variant" onclick={() => setVariant(currentIndex + 1)}
			>→</button
		>
	</nav>
</section>

<style>
	:global(.app-shell:has(.saves-prototype)) {
		padding: 0;
		gap: 0;
	}

	:global(.app-shell:has(.saves-prototype) > :not(.saves-prototype)) {
		display: none !important;
	}

	.saves-prototype,
	.saves-prototype * {
		box-sizing: border-box;
	}

	.saves-prototype {
		--canvas: #f0eadf;
		--paper: #fffaf0;
		--ink: #211d17;
		--muted: #746958;
		--rule: #d9cfbf;
		--rust: #b85838;
		--rust-wash: #f5e1d7;
		position: relative;
		width: 100%;
		height: 100dvh;
		min-height: 0;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
		background:
			linear-gradient(90deg, transparent 24px, rgba(184, 88, 56, 0.04) 25px, transparent 26px),
			var(--canvas);
		color: var(--ink);
		font-family: var(--pksx-font-sans);
		container-type: size;
	}

	.prototype-header {
		flex: 0 0 auto;
		min-height: 46px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 4px;
	}

	.prototype-header h1,
	.prototype-header span,
	.prototype-header strong,
	.prototype-header small {
		margin: 0;
	}

	.prototype-header h1 {
		font-size: clamp(1.65rem, 6cqh, 2.35rem);
		line-height: 0.9;
		letter-spacing: -0.04em;
	}

	.eyebrow {
		display: block;
		margin-bottom: 3px !important;
		color: var(--rust);
		font: 750 0.58rem var(--pksx-font-mono);
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.storage-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 9px;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: rgba(255, 250, 240, 0.68);
	}

	.storage-summary > span:last-child {
		display: grid;
		gap: 1px;
	}

	.storage-summary strong,
	.storage-summary small {
		font-size: 0.65rem;
		line-height: 1.1;
	}

	.storage-summary small {
		color: var(--muted);
		font-family: var(--pksx-font-mono);
	}

	.storage-mark {
		width: 27px;
		height: 27px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #26382f;
		color: #d8eedc;
		font: 800 0.66rem var(--pksx-font-mono);
	}

	.save-canvas {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}

	.cartridge-grid,
	.party-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 8px;
	}

	.cartridge-grid > button,
	.party-grid > button,
	.save-strips > button {
		position: relative;
		min-width: 0;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.cartridge-grid > button:focus-visible,
	.party-grid > button:focus-visible,
	.save-strips > button:focus-visible,
	.cartridge-grid > button.focused,
	.party-grid > button.focused,
	.save-strips > button.focused {
		outline: 3px solid rgba(184, 88, 56, 0.42);
		outline-offset: -3px;
	}

	.cartridge-grid > button {
		min-height: 112px;
		padding: 11px 12px 10px 17px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: auto auto auto 1fr;
		gap: 2px 8px;
		border-radius: 7px 14px 14px 7px;
		box-shadow: 0 3px 7px rgba(74, 52, 30, 0.08);
	}

	.cartridge-spine {
		position: absolute;
		inset: -1px auto -1px -1px;
		width: 7px;
		border-radius: 7px 0 0 7px;
		background: #365e4b;
	}

	.cartridge-grid > button:nth-child(2n) .cartridge-spine {
		background: #7563a8;
	}

	.cartridge-grid > button:nth-child(3n) .cartridge-spine {
		background: #cb8c3f;
	}

	.card-heading {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.card-heading strong {
		overflow: hidden;
		font-size: 0.9rem;
		line-height: 1.1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-heading em,
	.party-card-heading em,
	.save-strips em {
		flex: 0 0 auto;
		align-self: start;
		padding: 3px 5px;
		border-radius: 4px;
		background: var(--rust);
		color: white;
		font: 800 0.49rem var(--pksx-font-mono);
		font-style: normal;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.trainer {
		font: 800 0.69rem var(--pksx-font-mono);
		letter-spacing: 0.08em;
	}

	.file-name,
	.card-stats {
		color: var(--muted);
		font: 650 0.6rem var(--pksx-font-mono);
	}

	.file-name {
		grid-column: 1 / -1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-stats {
		grid-column: 1 / -1;
		align-self: end;
		padding-top: 7px;
		border-top: 1px solid var(--rule);
	}

	.card-stats b {
		color: var(--ink);
	}

	.card-stats i {
		display: inline-block;
		width: 3px;
		height: 3px;
		margin: 0 5px 2px;
		border-radius: 50%;
		background: var(--rust);
	}

	.cartridge-grid > .import-card {
		place-items: center;
		align-content: center;
		grid-template-columns: auto;
		grid-template-rows: auto auto auto;
		gap: 3px;
		padding-left: 12px;
		border-style: dashed;
		border-radius: 14px;
		text-align: center;
		box-shadow: none;
	}

	.plus {
		font-size: 1.25rem;
		line-height: 1;
	}

	.import-card small,
	.party-import small,
	.strip-import small {
		color: var(--muted);
		font: 650 0.58rem var(--pksx-font-mono);
	}

	.party-grid > button {
		min-height: 148px;
		padding: 11px;
		display: grid;
		gap: 8px;
		border-radius: 14px;
		box-shadow: 0 4px 8px rgba(74, 52, 30, 0.08);
	}

	.party-grid > button.active {
		background: linear-gradient(145deg, var(--rust-wash), var(--paper) 58%);
		border-color: rgba(184, 88, 56, 0.5);
	}

	.party-card-heading {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.party-card-heading > span {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.party-card-heading strong,
	.party-card-heading small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.party-card-heading strong {
		font-size: 0.86rem;
	}

	.party-card-heading small {
		color: var(--muted);
		font: 600 0.57rem var(--pksx-font-mono);
	}

	.party-balls {
		min-width: 0;
		width: 100%;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 5px;
	}

	.party-balls i {
		min-width: 0;
		width: 100%;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 1px solid rgba(38, 56, 47, 0.18);
		border-radius: 50%;
		background: #e3eddf;
		color: #365e4b;
		font: 850 0.59rem var(--pksx-font-mono);
		font-style: normal;
	}

	.party-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font: 650 0.58rem var(--pksx-font-mono);
	}

	.party-meta b {
		margin-right: auto;
		color: var(--ink);
	}

	.party-grid > .party-import {
		place-items: center;
		align-content: center;
		gap: 2px;
		border-style: dashed;
		box-shadow: none;
		text-align: center;
	}

	.party-import > span {
		font-size: 1.4rem;
	}

	.save-strips {
		display: grid;
		gap: 6px;
	}

	.save-strips > button {
		min-height: 58px;
		padding: 7px 10px;
		display: grid;
		grid-template-columns: 34px minmax(120px, 1.5fr) minmax(72px, 0.7fr) 54px auto;
		align-items: center;
		gap: 10px;
		border-radius: 6px;
		box-shadow: 0 2px 5px rgba(74, 52, 30, 0.06);
	}

	.save-strips > button.active {
		border-left: 5px solid var(--rust);
		padding-left: 6px;
	}

	.strip-index {
		color: var(--rust);
		font: 850 0.7rem var(--pksx-font-mono);
	}

	.strip-title,
	.strip-trainer,
	.strip-boxes {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.strip-title strong,
	.strip-title small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.strip-title strong {
		font-size: 0.78rem;
	}

	.strip-title small,
	.strip-trainer small,
	.strip-boxes small {
		color: var(--muted);
		font: 600 0.52rem var(--pksx-font-mono);
	}

	.strip-trainer,
	.strip-boxes {
		font: 800 0.65rem var(--pksx-font-mono);
	}

	.save-strips > .strip-import {
		grid-template-columns: 34px auto 1fr;
		border-style: dashed;
		box-shadow: none;
	}

	.prototype-switcher {
		position: fixed;
		z-index: 5;
		left: 50%;
		bottom: 8px;
		transform: translateX(-50%);
		min-width: min(350px, calc(100vw - 16px));
		display: grid;
		grid-template-columns: 38px 1fr 38px;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 999px;
		background: rgba(24, 22, 19, 0.94);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
		color: white;
		backdrop-filter: blur(10px);
	}

	.prototype-switcher button {
		width: 38px;
		height: 38px;
		border: 0;
		background: transparent;
		color: white;
		font-size: 1rem;
		cursor: pointer;
	}

	.prototype-switcher > span {
		display: grid;
		gap: 1px;
		text-align: center;
	}

	.prototype-switcher strong {
		font-size: 0.66rem;
	}

	.prototype-switcher small {
		color: #c9c3b9;
		font: 550 0.51rem var(--pksx-font-mono);
	}

	@container (max-width: 430px) {
		.saves-prototype {
			padding: 9px;
		}

		.prototype-header {
			min-height: 56px;
		}

		.storage-summary {
			padding: 5px 7px;
		}

		.storage-summary strong {
			font-size: 0.61rem;
		}

		.storage-summary small {
			max-width: 108px;
		}

		.cartridge-grid,
		.party-grid {
			grid-template-columns: 1fr;
		}

		.save-strips > button {
			grid-template-columns: 28px minmax(0, 1fr) 48px auto;
			gap: 7px;
		}

		.strip-trainer {
			display: none;
		}

		.save-strips > .strip-import {
			grid-template-columns: 28px minmax(0, 1fr);
		}

		.strip-import small {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}
	}
</style>
