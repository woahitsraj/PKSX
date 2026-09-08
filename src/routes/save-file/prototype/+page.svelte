<script lang="ts">
	// Three variants of the redesigned Save File editor, switchable via ?variant=, on /save-file/prototype (#169).
	import { dev } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ToastRegion from '$lib/components/pksx/ToastRegion.svelte';
	import type { SaveFileEditableProjection } from '$lib/engine';
	import type { WorkspaceState } from '$lib/pksx/backup-workflow';
	import { updateAppChrome } from '$lib/pksx/app-chrome.svelte';
	import './prototype-tokens.css';
	import PrototypeControls from './PrototypeControls.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import { PrototypeEditor } from './editor-state.svelte';
	import {
		loadCatalogue,
		loadPrototypeWorkspace,
		omitCapabilities,
		stressProjection,
		type Catalogue,
		type OmitKey
	} from './prototype-data';

	const variants = [
		{ key: 'A', name: 'Sheet' },
		{ key: 'B', name: 'Local views' },
		{ key: 'C', name: 'Ledger' }
	];
	const omitCycle = ['', 'money', 'inventory', 'trainer', 'money,inventory'];

	const params = $derived(page.url.searchParams);
	const variant = $derived(
		variants.some((v) => v.key === params.get('variant')?.toUpperCase())
			? params.get('variant')!.toUpperCase()
			: 'A'
	);
	const stress = $derived(params.get('stress') === '1');
	const omit = $derived(params.get('omit') ?? '');
	const showControls = $derived(params.get('controls') !== '0');
	const initialView = $derived(params.get('view') ?? 'bag');
	// chrome=0 hides the current TopBar and tabbar and applies ?inset=t,r,b,l as safe-area insets, so the route
	// receives the Safe Canvas the zero-chrome shell will give it.
	const chrome = $derived(params.get('chrome') !== '0');
	const inset = $derived(
		(params.get('inset') ?? '0,0,0,0').split(',').map((v) => `${Number(v) || 0}px`)
	);

	let workspace = $state<WorkspaceState | null>(null);
	let catalogue = $state<Catalogue | null>(null);
	let catalogueError = $state<string | null>(null);
	let loadError = $state<string | null>(null);

	const fileName = $derived(workspace?.file.originalFileName ?? 'Save File');

	onMount(async () => {
		updateAppChrome({
			route: 'save-file',
			hasLoadedSave: false,
			controllerInputActive: true,
			importSave: null,
			exportSave: null
		});
		try {
			workspace = await loadPrototypeWorkspace();
			try {
				catalogue = await loadCatalogue(workspace);
			} catch (error) {
				catalogueError = error instanceof Error ? error.message : String(error);
			}
		} catch (error) {
			loadError = error instanceof Error ? error.message : String(error);
		}
	});

	// Rebuilt whenever the source data or a stress/omit toggle changes.
	const editor = $derived.by(() => {
		const base = workspace?.workspace.saveFile;
		if (!base) return null;
		let projection = structuredClone($state.snapshot(base)) as SaveFileEditableProjection;
		if (stress) projection = stressProjection(projection, catalogue ?? {});
		const omitted = new Set(omit.split(',').filter(Boolean) as OmitKey[]);
		if (omitted.size) projection = omitCapabilities(projection, omitted);
		return new PrototypeEditor(projection);
	});

	function setParams(next: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(next)) {
			if (value === null || value === '') url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		replaceState(resolve(`/save-file/prototype?${url.searchParams.toString()}`), page.state);
	}

	function onKeydown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLElement &&
			event.target.matches('input, textarea, [contenteditable="true"]')
		)
			return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const index = variants.findIndex((v) => v.key === variant);
		const offset = event.key === 'ArrowLeft' ? -1 : 1;
		setParams({ variant: variants[(index + offset + variants.length) % variants.length].key });
	}
</script>

<svelte:head>
	<title>Save File prototype · PKSX</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if !dev}
	<p>This prototype is available only in development.</p>
{:else}
	<div
		class="sf-canvas"
		data-proto-ready={editor ? 'true' : undefined}
		data-chrome={chrome ? '1' : '0'}
		style:--proto-inset={inset.join(' ')}
	>
		{#if loadError}
			<div class="sf-proto load-state">
				<p>{loadError}</p>
				<button type="button" class="sf-ctrl" onclick={() => location.reload()}>Retry</button>
			</div>
		{:else if !editor}
			<div class="sf-proto load-state" aria-live="polite">Reading {fileName}...</div>
		{:else if variant === 'B'}
			{#key `${stress}${omit}`}
				<VariantB {editor} {catalogue} {catalogueError} {fileName} {initialView} />
			{/key}
		{:else if variant === 'C'}
			<VariantC {editor} {catalogue} {catalogueError} {fileName} />
		{:else}
			<VariantA {editor} {catalogue} {catalogueError} {fileName} />
		{/if}
	</div>
	{#if editor}
		<ToastRegion toasts={editor.toasts} onDismiss={(id) => editor?.dismissToast(id)} />
	{/if}
	{#if showControls && editor}
		<PrototypeControls
			{variants}
			current={variant}
			{stress}
			{omit}
			failNext={editor.failNext}
			lastEvent={editor.lastEvent}
			onChange={(key) => setParams({ variant: key })}
			onToggleStress={() => setParams({ stress: stress ? null : '1' })}
			onCycleOmit={() =>
				setParams({ omit: omitCycle[(omitCycle.indexOf(omit) + 1) % omitCycle.length] })}
			onToggleFail={() => editor && (editor.failNext = !editor.failNext)}
		/>
	{/if}
{/if}

<style>
	/* Prototype-only: the route establishes a definite-size container at every width, as the redesigned shell will. */
	:global(.app-shell:has(.sf-canvas)) {
		height: 100dvh;
		overflow: hidden;
	}

	:global(.app-shell:has(.sf-canvas[data-chrome='0'])) {
		padding: var(--proto-inset, 0);
		gap: 0;
	}

	:global(.app-shell:has(.sf-canvas[data-chrome='0']) > :is(.top-bar, .mobile-tabbar)) {
		display: none;
	}

	.sf-canvas[data-chrome='0'] {
		--proto-inset: 0;
	}

	.load-state {
		display: grid;
		place-content: center;
		gap: var(--sf-s2);
		text-align: center;
	}
</style>
