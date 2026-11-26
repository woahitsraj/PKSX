<script lang="ts">
	import type { SearchCriterion } from '$lib/engine';
	import type {
		AdvancedFilters,
		AdvancedSearchOptions,
		MatchMode,
		UnavailableCriteria
	} from '$lib/pksx/quick-search/advanced';
	import Combobox from './Combobox.svelte';

	interface Props {
		filters: AdvancedFilters;
		options: AdvancedSearchOptions;
		unavailable: UnavailableCriteria;
		onChange: (filters: AdvancedFilters) => void;
		onReset: () => void;
	}

	let { filters, options, unavailable, onChange, onReset }: Props = $props();
	const uid = $props.id();

	type ValueField = 'species' | 'form' | 'nature' | 'ability' | 'heldItem' | 'originGame';
	const valueFields: { key: ValueField; label: string; criterion?: SearchCriterion }[] = [
		{ key: 'species', label: 'Species' },
		{ key: 'form', label: 'Form', criterion: 'form' },
		{ key: 'nature', label: 'Nature', criterion: 'nature' },
		{ key: 'ability', label: 'Ability', criterion: 'ability' },
		{ key: 'heldItem', label: 'Held item', criterion: 'heldItem' },
		{ key: 'originGame', label: 'Origin game', criterion: 'originGame' }
	];

	function update(changes: Partial<AdvancedFilters>) {
		onChange({ ...filters, ...changes });
	}

	function choices(values: string[], anyLabel: string) {
		return [{ value: '', label: anyLabel }, ...values.map((value) => ({ value, label: value }))];
	}

	function numberValue(event: Event) {
		const raw = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
		const value = Number.parseInt(raw, 10);
		return Number.isFinite(value) && value >= 0 ? value : null;
	}
</script>

{#snippet matchToggle(label: string, value: MatchMode, onSelect: (value: MatchMode) => void)}
	<div class="match" role="group" aria-label={label}>
		{#each ['all', 'any'] as const as option (option)}
			<button
				type="button"
				data-pksx-control-category="small"
				aria-pressed={value === option}
				onclick={() => onSelect(option)}>{option === 'all' ? 'All' : 'Any'}</button
			>
		{/each}
	</div>
{/snippet}

<div class="advanced-filters" role="group" aria-label="Advanced filters">
	<div class="row heading">
		<span>Match</span>
		{@render matchToggle('Match criteria', filters.match, (match) => update({ match }))}
		<button type="button" class="reset" data-pksx-control-category="small" onclick={onReset}
			>Reset</button
		>
	</div>

	{#each valueFields as field (field.key)}
		{@const reason = field.criterion ? unavailable[field.criterion] : undefined}
		<div class="field">
			<span id={`${uid}-${field.key}`}>{field.label}</span>
			<Combobox
				labelledBy={`${uid}-${field.key}`}
				value={filters[field.key]}
				options={choices(options[field.key], `Any ${field.label.toLowerCase()}`)}
				placeholder={`Any ${field.label.toLowerCase()}`}
				searchLabel={`Search ${field.label.toLowerCase()}`}
				disabled={Boolean(reason)}
				describedBy={reason ? `${uid}-${field.key}-reason` : undefined}
				onSelect={(value) => update({ [field.key]: value })}
			/>
			{#if reason}<small id={`${uid}-${field.key}-reason`}>{reason}</small>{/if}
		</div>
	{/each}

	<div class="field">
		<span id={`${uid}-shiny`}>Shiny</span>
		<Combobox
			labelledBy={`${uid}-shiny`}
			value={filters.shiny}
			options={[
				{ value: '', label: 'Any' },
				{ value: 'shiny', label: 'Shiny' },
				{ value: 'not-shiny', label: 'Not shiny' }
			]}
			placeholder="Any"
			onSelect={(value) => update({ shiny: value as AdvancedFilters['shiny'] })}
		/>
	</div>

	<div class="field">
		<span id={`${uid}-legality`}>Legality</span>
		<Combobox
			labelledBy={`${uid}-legality`}
			value={filters.legality}
			options={[
				{ value: '', label: 'Any' },
				{ value: 'legal', label: 'Legal' },
				{ value: 'illegal', label: 'Illegal' }
			]}
			placeholder="Any"
			disabled={Boolean(unavailable.legality)}
			describedBy={unavailable.legality ? `${uid}-legality-reason` : undefined}
			onSelect={(value) => update({ legality: value as AdvancedFilters['legality'] })}
		/>
		{#if unavailable.legality}<small id={`${uid}-legality-reason`}>{unavailable.legality}</small
			>{/if}
	</div>

	<div class="field">
		<div class="row">
			<span id={`${uid}-moves`}>Moves</span>
			{@render matchToggle('Match moves', filters.moveMatch, (moveMatch) => update({ moveMatch }))}
		</div>
		<Combobox
			labelledBy={`${uid}-moves`}
			value=""
			options={options.moves
				.filter((move) => !filters.moves.includes(move))
				.map((move) => ({ value: move, label: move }))}
			placeholder={filters.moves.length >= 4 ? 'Four moves selected' : 'Add a move'}
			searchLabel="Search moves"
			disabled={filters.moves.length >= 4}
			onSelect={(move) => update({ moves: [...filters.moves, move] })}
		/>
		{#if filters.moves.length > 0}
			<ul class="chips" aria-label="Selected moves">
				{#each filters.moves as move (move)}
					<li>
						<button
							type="button"
							data-pksx-control-category="small"
							aria-label={`Remove ${move}`}
							onclick={() => update({ moves: filters.moves.filter((item) => item !== move) })}
							>{move} ×</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="field">
		<span>Level</span>
		<div class="row numbers">
			<input
				type="number"
				min="1"
				max="100"
				inputmode="numeric"
				aria-label="Minimum level"
				placeholder="Min"
				value={filters.minLevel ?? ''}
				oninput={(event) => update({ minLevel: numberValue(event) })}
			/>
			<input
				type="number"
				min="1"
				max="100"
				inputmode="numeric"
				aria-label="Maximum level"
				placeholder="Max"
				value={filters.maxLevel ?? ''}
				oninput={(event) => update({ maxLevel: numberValue(event) })}
			/>
		</div>
	</div>

	<div class="field">
		<div class="row">
			<span>IV floor</span>
			{@render matchToggle('Match IV stats', filters.ivMatch, (ivMatch) => update({ ivMatch }))}
		</div>
		<input
			type="number"
			min="0"
			inputmode="numeric"
			aria-label="Minimum IV"
			placeholder="Any"
			value={filters.ivFloor ?? ''}
			oninput={(event) => update({ ivFloor: numberValue(event) })}
		/>
	</div>

	<div class="field">
		<div class="row">
			<span>EV floor</span>
			{@render matchToggle('Match EV stats', filters.evMatch, (evMatch) => update({ evMatch }))}
		</div>
		<input
			type="number"
			min="0"
			inputmode="numeric"
			aria-label="Minimum EV"
			placeholder="Any"
			value={filters.evFloor ?? ''}
			oninput={(event) => update({ evFloor: numberValue(event) })}
		/>
	</div>
</div>

<style>
	.advanced-filters {
		display: grid;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2) var(--pksx-space-3);
	}

	.field {
		min-width: 0;
		display: grid;
		gap: var(--pksx-space-1);
	}

	.row {
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	.heading {
		padding-bottom: var(--pksx-space-2);
		border-bottom: var(--pksx-border-width) solid var(--pksx-color-border-subtle);
	}

	span,
	small {
		color: var(--pksx-color-text-secondary);
		font-size: var(--pksx-type-label);
		line-height: 1.25;
	}

	.match {
		display: flex;
		gap: var(--pksx-space-1);
	}

	button {
		min-height: var(--pksx-small-control-height);
		padding: 0 var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font: 600 var(--pksx-type-label) / 1 var(--pksx-font-sans);
		cursor: pointer;
	}

	button[aria-pressed='true'] {
		border-color: var(--pksx-color-accent-primary);
		background: var(--pksx-color-accent-wash);
	}

	button:focus-visible,
	input:focus-visible {
		outline: var(--pksx-border-width) solid var(--pksx-color-accent-primary);
		outline-offset: 1px;
	}

	.reset {
		margin-left: auto;
	}

	.numbers input {
		flex: 1;
	}

	input {
		min-width: 0;
		min-height: var(--pksx-control-height);
		padding: 0 var(--pksx-space-2);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-subtle);
		color: var(--pksx-color-text-primary);
		font-family: var(--pksx-font-sans);
		font-size: var(--pksx-type-editable);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
