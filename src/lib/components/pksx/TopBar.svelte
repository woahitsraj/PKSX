<script lang="ts">
	import type { SaveSummary } from '$lib/engine';

	interface Props {
		sectionPills: string[];
		activeSection?: string;
		saveSummary: SaveSummary | null;
		boxCount: number;
		activeBox: number;
		fileName: string | null;
		busy: boolean;
		hasLoadedSave: boolean;
		darkMode: boolean;
		focusIndex: number | null;
		onFocusControl: (index: number) => void;
		onOpenBoxes: () => void;
		onOpenSaveFile: () => void;
		onOpenSaves: () => void;
		onImport: (file: File) => void;
		onExport: () => void;
		onToggleTheme: () => void;
	}

	let {
		sectionPills,
		activeSection = 'Boxes',
		saveSummary,
		boxCount,
		activeBox,
		fileName,
		busy,
		hasLoadedSave,
		darkMode,
		focusIndex,
		onFocusControl,
		onOpenBoxes,
		onOpenSaveFile,
		onOpenSaves,
		onImport,
		onExport,
		onToggleTheme
	}: Props = $props();

	function handleImportChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';

		if (file) {
			onImport(file);
		}
	}

	function openImportPicker() {
		document.getElementById('quick-save-import')?.click();
	}
</script>

<header class="top-bar" aria-label="Current save summary">
	<button type="button" class="brand-lockup" aria-label="Open boxes" onclick={onOpenBoxes}>
		<div class="brand-mark" aria-hidden="true">P</div>
		<div>
			<h1 id="screen-title">PKSX</h1>
			<p>save editor · atelier</p>
		</div>
	</button>
	<div class="section-pills" aria-label="Available sections">
		{#each sectionPills as pill (pill)}
			{#if pill === 'Boxes'}
				<button
					id="top-control-0"
					type="button"
					class:active={activeSection === pill}
					class:controller-focused={focusIndex === 0}
					aria-current={activeSection === pill ? 'page' : undefined}
					onfocus={() => onFocusControl(0)}
					onclick={onOpenBoxes}>{pill}</button
				>
			{:else if pill === 'Save File'}
				<button
					id="top-control-1"
					type="button"
					class:active={activeSection === pill}
					class:controller-focused={focusIndex === 1}
					aria-current={activeSection === pill ? 'page' : undefined}
					onfocus={() => onFocusControl(1)}
					onclick={onOpenSaveFile}>{pill}</button
				>
			{:else if pill === 'Saves'}
				<button
					id="top-control-4"
					type="button"
					class:active={activeSection === pill}
					class:controller-focused={focusIndex === 4}
					aria-current={activeSection === pill ? 'page' : undefined}
					aria-disabled={busy}
					onfocus={() => onFocusControl(4)}
					onclick={() => {
						if (!busy) onOpenSaves();
					}}>{pill}</button
				>
			{:else}
				<button
					id={pill === 'Dex' ? 'top-control-2' : 'top-control-3'}
					type="button"
					class:active={activeSection === pill}
					class:controller-focused={focusIndex === (pill === 'Dex' ? 2 : 3)}
					aria-disabled="true"
					onfocus={() => onFocusControl(pill === 'Dex' ? 2 : 3)}
				>
					{pill}
				</button>
			{/if}
		{/each}
	</div>
	<div class="search-shell" aria-hidden="true">
		<span>⌕</span>
		<span>
			Search {saveSummary?.boxCount ? saveSummary.boxCount * (saveSummary.boxSlotCount ?? 30) : 842}
			creatures...
		</span>
		<kbd>⌘K</kbd>
	</div>
	<div class="save-actions" aria-label="Save File actions">
		<input
			id="quick-save-import"
			type="file"
			aria-label="Quick save import"
			disabled={busy}
			onchange={handleImportChange}
		/>
		<button
			type="button"
			id="top-control-5"
			class:controller-focused={focusIndex === 5}
			aria-disabled={busy}
			onfocus={() => onFocusControl(5)}
			onclick={() => {
				if (!busy) openImportPicker();
			}}
		>
			Import
		</button>
		<button
			type="button"
			id="top-control-6"
			class:controller-focused={focusIndex === 6}
			aria-disabled={busy || !hasLoadedSave}
			onfocus={() => onFocusControl(6)}
			onclick={() => {
				if (!busy && hasLoadedSave) onExport();
			}}>Export</button
		>
	</div>
	<div
		id="save-file-chip"
		class="save-chip"
		title={fileName ?? 'No Save File'}
		aria-label="Save File status"
	>
		<i aria-hidden="true"></i>
		<div>
			<strong>{fileName ?? 'No Save File'}</strong>
			<span>
				{#if saveSummary?.trainerName}·{saveSummary.trainerName}{:else}Box {activeBox +
						1}/{boxCount}{/if}
			</span>
		</div>
		<span class="save-chip-status" aria-hidden="true">▾</span>
	</div>
	<span class="online-indicator" aria-label="Offline mode">● OFFLINE</span>
	<button
		class="theme-toggle"
		id="top-control-7"
		class:controller-focused={focusIndex === 7}
		type="button"
		aria-label={darkMode ? 'Use light mode' : 'Use dark mode'}
		onfocus={() => onFocusControl(7)}
		onclick={onToggleTheme}
	>
		{darkMode ? '☀' : '☾'}
	</button>
</header>

<style>
	.top-bar {
		display: grid;
		grid-template-columns: auto auto minmax(180px, 1fr) auto auto auto auto;
		align-items: center;
		gap: 10px;
		padding: 10px;
		border: 0;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.brand-mark {
		width: 36px;
		height: 36px;
		border-radius: var(--pksx-radius-md);
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--paper-hi);
		font-size: 17px;
		font-weight: 800;
		box-shadow: var(--shadow);
	}

	.brand-lockup h1 {
		margin: 0;
		color: var(--ink);
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
	}

	.brand-lockup p {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.section-pills {
		display: flex;
		gap: 2px;
		padding-left: 10px;
		border-left: 1px solid var(--rule-hi);
	}

	.section-pills button {
		padding: 7px 12px;
		border: 0;
		border-radius: var(--pksx-radius-sm);
		background: transparent;
		color: var(--ink-soft);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 650;
		cursor: default;
	}

	.section-pills button {
		cursor: pointer;
	}

	.section-pills .active {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.search-shell,
	.save-chip,
	.save-actions button,
	.theme-toggle,
	.online-indicator {
		border: 0;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--ink);
	}

	.search-shell {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		color: var(--ink-soft);
		font-size: 0.76rem;
	}

	.search-shell span:nth-child(2),
	.save-chip strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	kbd {
		padding: 1px 5px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-xs);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font:
			600 0.62rem var(--pksx-font-mono),
			monospace;
	}

	.save-actions {
		display: flex;
		gap: 6px;
	}

	.save-actions input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.save-actions button,
	.theme-toggle {
		min-height: 32px;
		display: grid;
		place-items: center;
		padding: 0 12px;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}

	.save-actions button:not(:disabled):hover,
	.theme-toggle:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.section-pills button.controller-focused,
	.save-actions button.controller-focused,
	.theme-toggle.controller-focused {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 58%);
		outline-offset: 2px;
	}

	.section-pills button[aria-disabled='true'],
	.save-actions button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.save-chip {
		min-width: 166px;
		max-width: 230px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 11px;
		text-align: left;
	}

	.save-chip i {
		width: 7px;
		height: 7px;
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--ok);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok), transparent 70%);
	}

	.save-chip div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.save-chip span {
		color: var(--ink-mute);
		font:
			600 0.65rem var(--pksx-font-mono),
			monospace;
	}

	.save-chip-status {
		margin-left: auto;
		color: var(--ink-mute);
		font-size: 0.7rem;
	}

	.online-indicator {
		padding: 6px 10px;
		color: var(--ok);
		font:
			700 0.62rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.06em;
		white-space: nowrap;
	}

	.theme-toggle {
		width: 34px;
		padding: 0;
		font-size: 0.95rem;
	}

	@media (max-width: 1120px) {
		.top-bar {
			grid-template-columns: auto auto minmax(0, 1fr) auto auto auto;
		}

		.search-shell {
			display: none;
		}
	}

	@media (max-width: 820px) {
		.top-bar {
			grid-template-columns: auto 1fr auto auto auto;
			border-radius: var(--pksx-radius-lg);
			gap: 8px;
			padding: 8px;
		}

		.section-pills,
		.save-chip,
		.online-indicator {
			display: none;
		}
	}

	@media (max-width: 520px) {
		.brand-lockup p {
			display: none;
		}

		.brand-lockup h1 {
			font-size: 1.1rem;
		}

		.save-actions button {
			padding: 0 10px;
		}
	}
</style>
