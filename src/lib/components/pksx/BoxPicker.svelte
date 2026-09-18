<script lang="ts">
	import { tick } from 'svelte';
	import type { BoxPickerControllerFocus, BoxPickerLocation } from '$lib/pksx/box-picker';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		collection: string;
		locations: BoxPickerLocation[];
		activeLocationId: string;
		activeIndex: number;
		boxNameUnavailableReason?: string | null;
		renameMaxLength?: number;
		renameConstraints?: string | null;
		onRenameLocation?: (location: BoxPickerLocation, name: string) => Promise<string | null>;
		onFocusTarget: (focus: BoxPickerControllerFocus) => void;
		onFocusLocation: (index: number) => void;
		onSelectLocation: (location: BoxPickerLocation) => void;
		onColumnCountChange: (columnCount: number) => void;
		onClose: () => void;
	}

	let {
		collection,
		locations,
		activeLocationId,
		activeIndex,
		boxNameUnavailableReason = null,
		renameMaxLength = 0,
		renameConstraints = null,
		onRenameLocation,
		onFocusTarget,
		onFocusLocation,
		onSelectLocation,
		onColumnCountChange,
		onClose
	}: Props = $props();

	let renameLocation = $state<BoxPickerLocation | null>(null);
	let renameDraft = $state('');
	let renameError = $state<string | null>(null);
	let renamePending = $state(false);
	const focusedLocation = $derived(locations[activeIndex] ?? null);

	function focusRenameInput(select = false) {
		const input = document.getElementById('box-name-input');
		if (!(input instanceof HTMLInputElement)) return;
		input.focus();
		if (select) input.select();
	}

	async function beginRename() {
		if (!onRenameLocation || !focusedLocation) return;
		renameLocation = focusedLocation;
		renameDraft = focusedLocation.label;
		renameError = null;
		onFocusTarget({ zone: 'rename-form', locationIndex: activeIndex, formIndex: 0 });
		await tick();
		focusRenameInput(true);
	}

	function cancelRename() {
		if (renamePending) return;
		renameLocation = null;
		renameError = null;
		onFocusTarget({ zone: 'locations', locationIndex: activeIndex, formIndex: 0 });
		queueMicrotask(() => document.getElementById(`box-picker-location-${activeIndex}`)?.focus());
	}

	async function submitRename(event: SubmitEvent) {
		event.preventDefault();
		if (!onRenameLocation || !renameLocation || renamePending) return;
		renamePending = true;
		renameError = null;
		const error = await onRenameLocation(renameLocation, renameDraft);
		renamePending = false;
		if (error) {
			renameError = error;
			await tick();
			focusRenameInput();
			return;
		}
		renameLocation = null;
		onFocusTarget({ zone: 'locations', locationIndex: activeIndex, formIndex: 0 });
		queueMicrotask(() => document.getElementById(`box-picker-location-${activeIndex}`)?.focus());
	}

	function measureColumns(node: HTMLElement) {
		const report = () => {
			const columnCount = getComputedStyle(node)
				.gridTemplateColumns.split(' ')
				.filter(Boolean).length;
			onColumnCountChange(Math.max(1, columnCount));
		};
		const observer = new ResizeObserver(report);
		observer.observe(node);
		report();
		return () => observer.disconnect();
	}
</script>

<TakeoverFrame labelledby="box-picker-title" onBack={renameLocation ? cancelRename : onClose}>
	<div class="box-picker">
		<header>
			<div>
				<h2 id="box-picker-title">Choose a Box</h2>
				<p>{collection}</p>
				{#if boxNameUnavailableReason}
					<p class="box-name-unavailable" role="note">{boxNameUnavailableReason}</p>
				{/if}
			</div>
			<div class="header-actions">
				{#if onRenameLocation && focusedLocation && !renameLocation}
					<button
						id="box-picker-rename-command"
						type="button"
						data-pksx-control-category="small"
						class="rename-button"
						onfocus={() =>
							onFocusTarget({
								zone: 'rename-command',
								locationIndex: activeIndex,
								formIndex: 0
							})}
						onclick={beginRename}>Rename Box</button
					>
				{/if}
				<button
					type="button"
					data-pksx-control-category="icon-only"
					aria-label="Close Box Picker"
					disabled={renamePending}
					onclick={renameLocation ? cancelRename : onClose}>×</button
				>
			</div>
		</header>

		{#if renameLocation}
			<form
				class="rename-form"
				aria-label={`Rename ${renameLocation.label}`}
				onsubmit={submitRename}
			>
				<label for="box-name-input">Box Name</label>
				<input
					id="box-name-input"
					data-pksx-control-category="composition"
					bind:value={renameDraft}
					maxlength={renameMaxLength}
					aria-describedby="box-name-constraints box-name-error"
					aria-invalid={renameError ? 'true' : undefined}
					disabled={renamePending}
					onfocus={() =>
						onFocusTarget({ zone: 'rename-form', locationIndex: activeIndex, formIndex: 0 })}
					oninput={() => (renameError = null)}
					onkeydown={(event) => {
						event.stopPropagation();
						if (event.key === 'Escape') cancelRename();
					}}
				/>
				{#if renameConstraints}
					<p id="box-name-constraints">{renameConstraints}</p>
				{/if}
				<p id="box-name-error" class="rename-error" aria-live="polite">{renameError ?? ''}</p>
				<div class="rename-actions">
					<button
						id="box-name-cancel"
						type="button"
						disabled={renamePending}
						onfocus={() =>
							onFocusTarget({ zone: 'rename-form', locationIndex: activeIndex, formIndex: 1 })}
						onclick={cancelRename}>Cancel</button
					>
					<button
						id="box-name-submit"
						type="submit"
						disabled={renamePending}
						onfocus={() =>
							onFocusTarget({ zone: 'rename-form', locationIndex: activeIndex, formIndex: 2 })}
						>Rename</button
					>
				</div>
			</form>
		{:else}
			<div class="box-picker-grid" aria-label={`${collection} Boxes`} {@attach measureColumns}>
				{#each locations as location, index (location.id)}
					{@const numericLabel =
						location.location.kind === 'physical-box'
							? `Box ${String(location.location.box + 1).padStart(2, '0')}`
							: location.label}
					<button
						id={`box-picker-location-${index}`}
						type="button"
						data-pksx-control-category="card"
						class:controller-focused={activeIndex === index}
						aria-label={`${numericLabel}: ${location.label}, ${location.detail}`}
						aria-current={location.id === activeLocationId ? 'true' : undefined}
						onfocus={() => onFocusLocation(index)}
						onclick={() => onSelectLocation(location)}
					>
						<strong>{location.label}</strong>
						<span>{location.detail}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</TakeoverFrame>

<style>
	.box-picker {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-3);
		overflow: hidden;
		color: var(--ink);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	header div {
		display: grid;
		gap: var(--pksx-border-width);
	}

	.header-actions,
	.rename-actions {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-2);
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--pksx-type-title);
	}

	p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
	}

	.box-name-unavailable {
		font-size: var(--pksx-type-caption);
	}

	header button {
		width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}

	header .rename-button {
		width: auto;
		padding: 0 var(--pksx-space-2);
		font-size: var(--pksx-type-label);
	}

	.rename-form {
		align-self: start;
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3);
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
	}

	.rename-form label {
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	.rename-form input {
		min-height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--rule);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-hi);
		color: var(--ink);
		font: 750 var(--pksx-type-editable) var(--pksx-font-sans);
	}

	.rename-error {
		min-height: 1em;
		color: var(--rust);
	}

	.rename-actions {
		justify-content: end;
	}

	.rename-actions button {
		min-height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-3);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-hi);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink);
		font: inherit;
		font-weight: 750;
	}

	.box-picker-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		align-content: start;
		gap: var(--pksx-space-2);
		overflow: auto;
	}

	.box-picker-grid button {
		min-height: 76px;
		display: grid;
		place-content: center;
		gap: var(--pksx-space-1);
		padding: var(--pksx-space-2);
		border: var(--pksx-border-width) solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink);
		font: inherit;
		text-align: center;
		cursor: pointer;
	}

	.box-picker-grid button:hover,
	.box-picker-grid button:focus-visible,
	.box-picker-grid button.controller-focused {
		border-color: color-mix(in srgb, var(--rust), transparent 55%);
		background: var(--rust-wash);
		color: var(--rust);
		outline: none;
	}

	.box-picker-grid button[aria-current='true'] {
		box-shadow: inset 0 0 0 2px var(--rust);
	}

	.box-picker-grid strong {
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	.box-picker-grid span {
		color: var(--ink-soft);
		font: 650 var(--pksx-type-caption) / 1 var(--pksx-font-mono);
	}
</style>
