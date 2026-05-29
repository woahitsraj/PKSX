<script lang="ts">
	import type { SaveSummary } from '$lib/engine';
	import type { PokemonEditorState } from '$lib/pksx/pokemon-editor';

	interface Props {
		editor: PokemonEditorState;
		saveSummary: SaveSummary | null;
		spriteUrl: string | null;
		slotHueStyle: string;
		feedback: string | null;
		onUnsupportedApply: () => void;
		onClose: () => void;
	}

	let {
		editor,
		saveSummary,
		spriteUrl,
		slotHueStyle,
		feedback,
		onUnsupportedApply,
		onClose
	}: Props = $props();

	const slot = $derived(editor.slot);
	const speciesLabel = $derived(
		slot.speciesId ? `Species #${String(slot.speciesId).padStart(4, '0')}` : 'Unknown species'
	);
	const sourceLabel = $derived(
		editor.source.owner === 'save-file' ? 'Save File Pokemon' : 'Pokemon Storage Pokemon'
	);
	const identityRows = $derived(
		[
			slot.gender ? { label: 'Gender', value: slot.gender } : null,
			slot.nature ? { label: 'Nature', value: slot.nature } : null,
			slot.ability ? { label: 'Ability', value: slot.ability } : null,
			slot.heldItem ? { label: 'Held Item', value: slot.heldItem } : null,
			slot.originalTrainer || saveSummary?.trainerName
				? {
						label: 'Original Trainer',
						value: slot.originalTrainer ?? saveSummary?.trainerName ?? ''
					}
				: null,
			slot.metLabel ? { label: 'Met', value: slot.metLabel } : null
		].filter((row): row is { label: string; value: string } => row !== null)
	);
</script>

<div class="pokemon-editor-backdrop" role="presentation" onclick={onClose}></div>
<div
	class="pokemon-editor"
	role="dialog"
	aria-modal="true"
	aria-labelledby="pokemon-editor-title"
	aria-describedby="pokemon-editor-status"
	style={slotHueStyle}
>
	<header class="editor-header">
		<div>
			<p>{sourceLabel}</p>
			<h2 id="pokemon-editor-title">{slot.label}</h2>
			<span>{editor.source.location}</span>
		</div>
		<button
			id="pokemon-editor-close"
			type="button"
			class="icon-close"
			aria-label="Close Pokemon Editor"
			onclick={onClose}
		>
			×
		</button>
	</header>

	<div class="editor-body">
		<div class="editor-portrait">
			{#if spriteUrl}
				<img src={spriteUrl} alt="" width="180" height="180" />
			{:else}
				<span aria-hidden="true"></span>
			{/if}
			{#if slot.types && slot.types.length > 0}
				<div class="type-row" aria-label="Types">
					{#each slot.types as type (type.name)}
						<span
							class="type-chip"
							style={`--type-hue: ${type.hue}; --type-chroma: ${type.chroma ?? 0.09}`}
							>{type.name}</span
						>
					{/each}
				</div>
			{/if}
		</div>

		<div class="editor-summary">
			<div class="summary-strip" aria-label="Pokemon identity">
				<strong>{speciesLabel}</strong>
				{#if slot.level !== null}<span>Level {slot.level}</span>{/if}
				{#if slot.form !== null && slot.form > 0}<span>Form {slot.form}</span>{/if}
				{#if slot.isEgg}<span>Egg</span>{/if}
			</div>

			{#if identityRows.length > 0}
				<div class="field-grid" aria-label="Projected Pokemon fields">
					{#each identityRows as row (row.label)}
						<span>{row.label}</span>
						<strong>{row.value}</strong>
					{/each}
				</div>
			{/if}

			{#if slot.moves && slot.moves.length > 0}
				<div class="editor-panel" aria-label="Move Set">
					<div class="panel-title">
						<span>Move Set</span>
						<small>Read only</small>
					</div>
					<div class="move-grid">
						{#each slot.moves as move, index (`${index}-${move.name}`)}
							<div
								class="move-chip"
								style={`--type-hue: ${move.hue}; --type-chroma: ${move.chroma ?? 0.09}`}
							>
								<strong>{move.name}</strong>
								<span>{move.type}</span>
								{#if move.pp !== null && move.pp !== undefined}
									<em>{move.pp} PP</em>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if slot.stats && slot.stats.length > 0}
				<div class="editor-panel" aria-label="Stats">
					<div class="panel-title">
						<span>Stats</span>
						<small>Engine projection</small>
					</div>
					<div class="stat-grid">
						{#each slot.stats as stat (stat.key)}
							<span>{stat.label}</span>
							<strong>{stat.value}</strong>
							<em>EV {stat.ev ?? 0}</em>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<footer class="editor-actions">
		<p id="pokemon-editor-status">
			{feedback ?? 'Editing is staged here once engine mutation support is available.'}
		</p>
		<button type="button" class="unsupported-apply" onclick={onUnsupportedApply}>
			Apply edits
		</button>
		<button type="button" class="close-editor" onclick={onClose}>Close</button>
	</footer>
</div>

<style>
	.pokemon-editor-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: color-mix(in srgb, var(--ink), transparent 55%);
	}

	.pokemon-editor {
		position: fixed;
		z-index: 90;
		top: 50%;
		left: 50%;
		width: min(760px, calc(100vw - 28px));
		max-height: min(680px, calc(100dvh - 28px));
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 14px;
		overflow: hidden;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
		transform: translate(-50%, -50%);
	}

	.editor-header,
	.editor-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.editor-header {
		justify-content: space-between;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--rule);
	}

	.editor-header p,
	.editor-header h2,
	.editor-header span,
	.editor-actions p {
		margin: 0;
	}

	.editor-header p,
	.editor-header span,
	.panel-title small,
	.editor-actions p {
		color: var(--ink-mute);
		font:
			650 0.66rem var(--pksx-font-mono),
			monospace;
		line-height: 1.2;
	}

	.editor-header p {
		color: var(--rust);
		text-transform: uppercase;
	}

	.editor-header h2 {
		margin-top: 2px;
		font-size: 1.22rem;
		line-height: 1.1;
	}

	.icon-close {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink);
		font-size: 1.35rem;
		line-height: 1;
	}

	.icon-close:hover,
	.icon-close:focus-visible,
	.close-editor:hover,
	.close-editor:focus-visible,
	.unsupported-apply:hover,
	.unsupported-apply:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 55%);
		outline-offset: 1px;
	}

	.editor-body {
		min-height: 0;
		display: grid;
		grid-template-columns: 228px minmax(0, 1fr);
		gap: 14px;
		overflow: hidden;
	}

	.editor-portrait {
		position: relative;
		min-height: 268px;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 10px;
		border-radius: var(--pksx-radius-lg);
		background:
			radial-gradient(
				circle at 34% 32%,
				color-mix(in srgb, var(--paper-hi), #ffc7c7 42%),
				transparent 48%
			),
			linear-gradient(
				135deg,
				oklch(0.9 var(--slot-chroma, 0.08) calc(var(--slot-hue, 48) + 150)),
				oklch(0.76 var(--slot-chroma, 0.17) var(--slot-hue, 48))
			);
		overflow: hidden;
	}

	.editor-portrait img {
		width: min(70%, 172px);
		height: min(70%, 172px);
		object-fit: contain;
		filter: drop-shadow(0 14px 8px color-mix(in srgb, var(--ink), transparent 72%));
	}

	.editor-portrait > span {
		width: 92px;
		height: 92px;
		border: 1px dashed color-mix(in srgb, var(--ink), transparent 40%);
		border-radius: var(--pksx-radius-lg);
	}

	.type-row,
	.summary-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.type-chip,
	.summary-strip span,
	.summary-strip strong {
		padding: 4px 8px;
		border-radius: 6px;
		background: oklch(0.88 var(--type-chroma, 0.08) var(--type-hue, var(--slot-hue, 48)));
		color: color-mix(in srgb, var(--ink), black 8%);
		font:
			750 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.summary-strip strong {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.editor-summary {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
		padding-right: 2px;
	}

	.field-grid,
	.stat-grid {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 7px 12px;
		padding: 10px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.field-grid span,
	.stat-grid span,
	.stat-grid em {
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.field-grid strong,
	.stat-grid strong {
		min-width: 0;
		overflow-wrap: anywhere;
		font-size: 0.82rem;
	}

	.editor-panel {
		display: grid;
		gap: 8px;
	}

	.panel-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--ink);
		font-size: 0.78rem;
		font-weight: 800;
	}

	.move-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}

	.move-chip {
		min-width: 0;
		display: grid;
		gap: 3px;
		padding: 8px;
		border-radius: var(--pksx-radius-sm);
		background: oklch(0.9 var(--type-chroma, 0.07) var(--type-hue, 100));
		color: color-mix(in srgb, var(--ink), black 10%);
	}

	.move-chip strong {
		overflow-wrap: anywhere;
		font-size: 0.76rem;
		line-height: 1.1;
	}

	.move-chip span,
	.move-chip em {
		font:
			650 0.58rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.stat-grid {
		grid-template-columns: max-content 42px minmax(54px, 1fr);
		align-items: center;
	}

	.editor-actions {
		justify-content: flex-end;
		padding-top: 12px;
		border-top: 1px solid var(--rule);
	}

	.editor-actions p {
		margin-right: auto;
	}

	.unsupported-apply,
	.close-editor {
		min-height: 34px;
		padding: 7px 12px;
		border-radius: var(--pksx-radius-sm);
		font-size: 0.78rem;
		font-weight: 800;
	}

	.unsupported-apply {
		background: var(--paper-deep);
		color: var(--ink-soft);
	}

	.close-editor {
		background: var(--rust);
		color: white;
	}

	@media (max-width: 720px) {
		.pokemon-editor {
			top: 12px;
			bottom: 12px;
			max-height: none;
			transform: translateX(-50%);
		}

		.editor-body {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}

		.editor-summary {
			overflow: visible;
		}

		.editor-portrait {
			min-height: 190px;
		}

		.move-grid {
			grid-template-columns: 1fr;
		}

		.editor-actions {
			flex-wrap: wrap;
		}

		.editor-actions p {
			flex-basis: 100%;
		}
	}
</style>
