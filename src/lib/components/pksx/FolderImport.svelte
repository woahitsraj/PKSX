<script lang="ts">
	import { onMount, tick } from 'svelte';
	import EdgeMenu from './EdgeMenu.svelte';
	import type { StoredSaveFile } from '$lib/pksx/saves';
	import { getPkhexEngine, getSavesStorage } from '$lib/pksx/saves-cache';
	import {
		importFolderCandidates,
		scanFolderFiles,
		type FolderCandidate
	} from '$lib/pksx/folder-import';

	interface Props {
		files: File[];
		onImported: (saves: StoredSaveFile[]) => void;
		onClose: () => void;
	}

	let { files, onImported, onClose }: Props = $props();

	let phase = $state<'scanning' | 'review' | 'importing' | 'done'>('scanning');
	let candidates = $state<FolderCandidate[]>([]);
	let selected = $state<Record<string, boolean>>({});
	let rejected = $state(0);
	let scanError = $state<string | null>(null);
	let imported = $state(0);
	let failed = $state(0);
	let stopped = $state(false);
	let focused = $state('cancel');
	const controller = new AbortController();

	const recognized = $derived(candidates.filter((candidate) => candidate.status === 'recognized'));
	const chosen = $derived(recognized.filter((candidate) => selected[candidate.path]));
	const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
	const status = $derived.by(() => {
		if (phase === 'importing')
			return `Importing ${Math.min(imported + failed + 1, chosen.length)} of ${chosen.length}…`;
		if (phase === 'done')
			return [
				`Imported ${count(imported, 'Save File')}.`,
				failed ? `${failed} failed.` : '',
				stopped ? 'Import stopped before the rest.' : ''
			]
				.filter(Boolean)
				.join(' ');
		const unsupported = candidates.filter((candidate) => candidate.status === 'unsupported').length;
		const unreadable = candidates.filter((candidate) => candidate.status === 'unreadable').length;
		return [
			phase === 'scanning'
				? `Checking files… ${count(recognized.length, 'save')} found.`
				: `${count(recognized.length, 'save')} found.`,
			unsupported ? `${unsupported} unsupported.` : '',
			unreadable ? `${unreadable} unreadable.` : '',
			rejected ? `${count(rejected, 'other file')} skipped.` : '',
			scanError ?? ''
		]
			.filter(Boolean)
			.join(' ');
	});
	const selectable = $derived(phase === 'scanning' || phase === 'review');
	const positions = $derived(
		new Map(recognized.map((candidate, index) => [candidate.path, index]))
	);
	const keys = $derived(
		selectable
			? [...recognized.map((candidate) => candidate.path), 'confirm', 'cancel']
			: ['cancel']
	);
	const domId = (key: string) =>
		key === 'confirm' || key === 'cancel'
			? `folder-import-${key}`
			: `folder-import-row-${positions.get(key)}`;

	function detail(candidate: FolderCandidate) {
		if (candidate.result)
			return candidate.result.ok ? 'Imported' : 'Import failed. ' + candidate.result.error;
		if (candidate.status === 'unsupported') return 'Not a supported save';
		if (candidate.status === 'unreadable') return 'Could not read this file';
		return [candidate.game, candidate.trainer].filter(Boolean).join(' · ');
	}

	async function focus(key: string) {
		focused = key;
		await tick();
		document.getElementById(domId(key))?.focus();
	}

	function move(step: number) {
		const next = Math.max(0, Math.min(keys.length - 1, keys.indexOf(focused) + step));
		void focus(keys[next]);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') cancel();
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(1);
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(-1);
		else return;
		event.preventDefault();
	}

	async function confirm() {
		if (phase !== 'review' || !chosen.length) return;
		phase = 'importing';
		void focus('cancel');
		let saves: StoredSaveFile[] = [];
		try {
			saves = await importFolderCandidates(
				getSavesStorage(),
				getPkhexEngine(),
				chosen,
				controller.signal,
				(candidate) => {
					if (candidate.result?.ok) imported++;
					else failed++;
				}
			);
		} catch (error) {
			scanError = error instanceof Error ? error.message : 'Could not finish the import.';
		}
		stopped = controller.signal.aborted && imported + failed < chosen.length;
		phase = 'done';
		if (saves.length) onImported(saves);
		if (!failed && !stopped) onClose();
		else void focus('cancel');
	}

	function cancel() {
		controller.abort();
		if (phase !== 'importing') onClose();
	}

	onMount(() => {
		void focus('cancel');
		void scanFolderFiles(files, getPkhexEngine(), controller.signal, (candidate) => {
			candidates.push(candidate);
			if (candidate.status === 'recognized') selected[candidate.path] = true;
		})
			.then((value) => (rejected = value))
			.catch((error) => {
				if (!controller.signal.aborted)
					scanError = error instanceof Error ? error.message : 'Could not finish the scan.';
			})
			.finally(() => {
				if (phase === 'scanning') phase = 'review';
			});
		return () => controller.abort();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<EdgeMenu label="Scan a folder" onDismiss={() => phase !== 'importing' && cancel()}>
	<div class="folder-import" aria-busy={phase === 'scanning' || phase === 'importing'}>
		<h2>Scan a folder</h2>
		<p role="status">{status}</p>
		<ul aria-label="Saves in folder">
			{#each candidates as candidate (candidate.path)}
				{@const position = positions.get(candidate.path) ?? -1}
				<li>
					{#if position >= 0}
						<button
							id={`folder-import-row-${position}`}
							type="button"
							class:controller-focused={focused === candidate.path}
							aria-pressed={selected[candidate.path] ?? false}
							disabled={!selectable}
							onfocus={() => (focused = candidate.path)}
							onclick={() => (selected[candidate.path] = !selected[candidate.path])}
						>
							<span class="mark" aria-hidden="true">{selected[candidate.path] ? '✓' : ''}</span>
							<strong>{candidate.name}</strong>
							<small>{detail(candidate)}</small>
							{#if candidate.folder}<small>{candidate.folder}</small>{/if}
						</button>
					{:else}
						<div class="row" data-status={candidate.status}>
							<span class="mark" aria-hidden="true">–</span>
							<strong>{candidate.name}</strong>
							<small>{detail(candidate)}</small>
							{#if candidate.folder}<small>{candidate.folder}</small>{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="actions">
			<button
				id="folder-import-confirm"
				type="button"
				class="primary"
				class:controller-focused={focused === 'confirm'}
				disabled={phase !== 'review' || !chosen.length}
				onfocus={() => (focused = 'confirm')}
				onclick={() => void confirm()}
			>
				<strong>Import {count(chosen.length, 'save')}</strong>
			</button>
			<button
				id="folder-import-cancel"
				type="button"
				class:controller-focused={focused === 'cancel'}
				onfocus={() => (focused = 'cancel')}
				onclick={phase === 'done' ? onClose : cancel}
			>
				<strong
					>{phase === 'done' ? 'Done' : phase === 'importing' ? 'Stop importing' : 'Cancel'}</strong
				>
			</button>
		</div>
	</div>
</EdgeMenu>

<style>
	.folder-import {
		flex: 1 1 auto;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		gap: var(--pksx-space-2);
		min-height: 0;
		padding: var(--pksx-space-3);
	}
	h2,
	p,
	ul {
		margin: 0;
	}
	h2 {
		font-size: var(--pksx-type-display);
	}
	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
	}
	ul {
		display: grid;
		gap: var(--pksx-space-1);
		align-content: start;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--pksx-space-2);
	}
	button,
	.row {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: var(--pksx-space-2);
		align-items: center;
		width: 100%;
		min-height: var(--pksx-control-height);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	button {
		cursor: pointer;
	}
	.actions button {
		grid-template-columns: 1fr;
		text-align: center;
		border-color: var(--rule);
	}
	.actions .primary:not(:disabled) {
		background: var(--rust);
		color: var(--pksx-color-on-accent);
	}
	button:focus-visible,
	button.controller-focused {
		background: var(--rust-wash);
		outline: none;
	}
	.actions .primary:not(:disabled):is(:focus-visible, .controller-focused) {
		outline: var(--pksx-border-width) solid var(--ink);
		outline-offset: 2px;
	}
	@media (hover: hover) {
		ul button:hover {
			background: var(--rust-wash);
		}
	}
	button:disabled {
		cursor: not-allowed;
	}
	.actions button:disabled {
		opacity: 0.58;
	}
	.row {
		color: var(--ink-mute);
	}
	.mark {
		grid-row: span 3;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: var(--pksx-border-width) solid var(--rule-hi);
		border-radius: var(--pksx-radius-small);
		font-weight: 800;
	}
	[aria-pressed='true'] .mark {
		border-color: var(--rust);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
	}
	strong {
		font-size: var(--pksx-type-label);
		overflow-wrap: anywhere;
	}
	small {
		grid-column: 2;
		color: var(--ink-mute);
		font-size: var(--pksx-type-label);
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
</style>
