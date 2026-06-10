<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type { SaveSummary } from '$lib/engine';
	import type {
		PokemonEditorDraftEdits,
		PokemonMoveSetEditPayload,
		PokemonStatEditPayload,
		PokemonEditorState
	} from '$lib/pksx/pokemon-editor';
	import {
		maxPpForPpUps,
		moveSetEditPayloadFromSlot,
		statEditPayloadFromSlot,
		type PokemonStatKey
	} from '$lib/pksx/pokemon-editor';

	interface Props {
		editor: PokemonEditorState;
		saveSummary: SaveSummary | null;
		spriteUrl: string | null;
		slotHueStyle: string;
		feedback: string | null;
		applying: boolean;
		onApply: (draft: PokemonEditorDraftEdits) => void;
		onCancelEdits: () => void;
		onClose: () => void;
	}

	type DraftMoveSlot = {
		slot: number;
		move: number;
		pp: string;
		ppUps: string;
	};

	type DraftStats = Record<PokemonStatKey, string>;

	let {
		editor,
		saveSummary,
		spriteUrl,
		slotHueStyle,
		feedback,
		applying,
		onApply,
		onCancelEdits,
		onClose
	}: Props = $props();

	let editMode = $state<'level' | 'experience'>('level');
	let openMovePickerIndex = $state<number | null>(null);
	let moveSearch = $state('');
	let activeMoveOptionIndex = $state(0);
	let editingInputId = $state<string | null>(null);
	const slot = $derived(editor.slot);
	const statKeys = ['HP', 'ATK', 'DEF', 'SPA', 'SPD', 'SPE'] as const satisfies PokemonStatKey[];
	const baseIvs = $derived(statEditPayloadFromSlot(slot, 'iv'));
	const baseEvs = $derived(statEditPayloadFromSlot(slot, 'ev'));
	const baseMoveSet = $derived(moveSetEditPayloadFromSlot(slot));
	let draftNickname = $state(untrack(() => slot.label));
	let draftLevel = $state(untrack(() => String(slot.level ?? 1)));
	let draftExperience = $state(untrack(() => String(slot.experience ?? 0)));
	let draftIvs = $state<DraftStats>(untrack(() => statsToDraft(baseIvs)));
	let draftEvs = $state<DraftStats>(untrack(() => statsToDraft(baseEvs)));
	let draftMoves = $state<DraftMoveSlot[]>(
		untrack(() =>
			baseMoveSet.moves.map((move) => ({
				slot: move.slot,
				move: move.move,
				pp: String(move.pp ?? 0),
				ppUps: String(move.ppUps ?? 0)
			}))
		)
	);
	let lastAppliedDraftSignature = $state('');
	const statEditConstraints = $derived(slot.statEditConstraints);
	const moveSetEditConstraints = $derived(slot.moveSetEditConstraints);
	const canEditStats = $derived(statEditConstraints?.supported ?? false);
	const canEditMoveSet = $derived(moveSetEditConstraints?.supported ?? false);
	const moveOptions = $derived(moveSetEditConstraints?.availableMoves ?? []);
	const totalEvs = $derived(
		statKeys.reduce((total, key) => {
			const value = parseDraftNumber(draftEvs[key]);
			return Number.isFinite(value) ? total + value : total;
		}, 0)
	);
	const draftEditCount = $derived(countDraftEdits());
	const draftDirty = $derived(draftEditCount > 0);
	const currentDraftSignature = $derived(createDraftSignature());
	const speciesLabel = $derived(
		slot.speciesId ? `Species #${String(slot.speciesId).padStart(4, '0')}` : 'Unknown species'
	);
	const sourceLabel = $derived(
		editor.source.owner === 'save-file' ? 'Save File Pokemon' : 'Pokemon Storage Pokemon'
	);
	const statusText = $derived(
		feedback && (!draftDirty || lastAppliedDraftSignature === currentDraftSignature)
			? feedback
			: draftDirty
				? `${draftEditCount} Pokemon edit${draftEditCount === 1 ? '' : 's'} drafted.`
				: (editor.applyOutcome.message ?? 'No Pokemon edits staged.')
	);
	const experienceProjection = $derived(slot.experienceProjection);
	const canEditLevelExperience = $derived(experienceProjection !== null);
	const levelRangeLabel = $derived(
		experienceProjection
			? `${experienceProjection.minLevel}-${experienceProjection.maxLevel}`
			: 'Unsupported'
	);
	const experienceRangeLabel = $derived(
		experienceProjection
			? `${experienceProjection.minExperience.toLocaleString()}-${experienceProjection.maxExperience.toLocaleString()}`
			: 'Unsupported'
	);
	const currentExperienceLabel = $derived(
		slot.experience === null ? 'Unknown' : slot.experience.toLocaleString()
	);
	const nextLevelLabel = $derived(
		experienceProjection && slot.level !== null && slot.level < experienceProjection.maxLevel
			? experienceProjection.nextLevelMinExperience.toLocaleString()
			: 'Max'
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
	function toggleEditMode() {
		editMode = editMode === 'level' ? 'experience' : 'level';
	}

	function handleNicknameInput(event: Event) {
		const target = event.currentTarget;
		if (target instanceof HTMLInputElement) {
			draftNickname = target.value;
		}
	}

	function setDraftLevel(value: string) {
		draftLevel = value;
	}

	function setDraftExperience(value: string) {
		draftExperience = value;
	}

	function setIv(key: PokemonStatKey, value: string) {
		draftIvs = { ...draftIvs, [key]: value };
	}

	function setEv(key: PokemonStatKey, value: string) {
		draftEvs = { ...draftEvs, [key]: value };
	}

	function setMove(index: number, value: string) {
		const moveId = Number(value);
		const option = moveOptions.find((candidate) => candidate.id === moveId);
		if (!option) return;

		const moves = draftMoves.map((move) => ({ ...move }));
		moves[index] = {
			slot: index,
			move: option.id,
			pp: String(maxPpForPpUps(option.maxPp, 0)),
			ppUps: '0'
		};
		draftMoves = moves;
		closeMovePicker(true);
	}

	function setMovePp(index: number, value: string) {
		const moves = draftMoves.map((move) => ({ ...move }));
		moves[index] = { ...moves[index], pp: value };
		draftMoves = moves;
	}

	function setMovePpUps(index: number, value: string) {
		const moves = draftMoves.map((move) => ({ ...move }));
		moves[index] = { ...moves[index], ppUps: value };
		draftMoves = moves;
	}

	function optionForMove(moveId: number) {
		return moveOptions.find((option) => option.id === moveId);
	}

	function maxPpForMove(move: DraftMoveSlot) {
		const option = optionForMove(move.move);
		const ppUps = parseDraftNumber(move.ppUps);
		return maxPpForPpUps(option?.maxPp ?? 0, Number.isInteger(ppUps) ? ppUps : 0);
	}

	function openMovePicker(index: number) {
		if (applying) return;
		if (openMovePickerIndex === index) {
			closeMovePicker(true);
			return;
		}

		const selectedOptionIndex = moveOptions.findIndex(
			(option) => option.id === draftMoves[index]?.move
		);
		openMovePickerIndex = index;
		moveSearch = '';
		activeMoveOptionIndex = selectedOptionIndex >= 0 ? selectedOptionIndex : 0;
		void tick().then(() => {
			document.getElementById(`pokemon-editor-move-${index}-search`)?.focus();
		});
	}

	function closeMovePicker(restoreTriggerFocus = false) {
		const pickerIndex = openMovePickerIndex;
		openMovePickerIndex = null;
		moveSearch = '';
		activeMoveOptionIndex = 0;

		if (restoreTriggerFocus && pickerIndex !== null) {
			void tick().then(() => {
				document.getElementById(`pokemon-editor-move-${pickerIndex}`)?.focus();
			});
		}
	}

	function filteredMoveOptions() {
		const query = moveSearch.trim().toLowerCase();
		if (!query) return moveOptions;

		return moveOptions.filter(
			(option) =>
				option.name.toLowerCase().includes(query) ||
				option.type.toLowerCase().includes(query) ||
				String(option.id).includes(query)
		);
	}

	function handleMoveSearchInput(event: Event) {
		const target = event.currentTarget;
		if (target instanceof HTMLInputElement) {
			moveSearch = target.value;
			activeMoveOptionIndex = 0;
		}
	}

	function handleMoveSearchKeydown(event: KeyboardEvent, moveIndex: number) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMovePicker(true);
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, activeMoveOptionIndex);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, filteredMoveOptions().length - 1);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			selectActiveMoveOption(moveIndex);
		}
	}

	function handleMoveOptionKeydown(event: KeyboardEvent, moveIndex: number, optionIndex: number) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMovePicker(true);
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, optionIndex + 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, optionIndex - 1);
			return;
		}

		if (event.key === 'Home') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, 0);
			return;
		}

		if (event.key === 'End') {
			event.preventDefault();
			event.stopPropagation();
			focusMoveOption(moveIndex, filteredMoveOptions().length - 1);
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			selectMoveOption(moveIndex, optionIndex);
		}
	}

	function focusMoveOption(moveIndex: number, optionIndex: number) {
		const options = filteredMoveOptions();
		if (options.length === 0) return;

		const nextIndex = (optionIndex + options.length) % options.length;
		activeMoveOptionIndex = nextIndex;
		const option = options[nextIndex];
		void tick().then(() => {
			document.getElementById(moveOptionId(moveIndex, option.id))?.focus();
		});
	}

	function selectActiveMoveOption(moveIndex: number) {
		selectMoveOption(moveIndex, activeMoveOptionIndex);
	}

	function selectMoveOption(moveIndex: number, optionIndex: number) {
		const option = filteredMoveOptions()[optionIndex];
		if (!option) return;
		setMove(moveIndex, String(option.id));
	}

	function moveOptionId(moveIndex: number, optionId: number) {
		return `pokemon-editor-move-${moveIndex}-option-${optionId}`;
	}

	function movePickerListId(moveIndex: number) {
		return `pokemon-editor-move-${moveIndex}-list`;
	}

	function activeMoveOptionId(moveIndex: number) {
		const option = filteredMoveOptions()[activeMoveOptionIndex];
		return option ? moveOptionId(moveIndex, option.id) : undefined;
	}

	function handleMoveOptionFocus(optionIndex: number) {
		activeMoveOptionIndex = optionIndex;
	}

	function isInputEditing(id: string) {
		return editingInputId === id;
	}

	function activateDraftInput(id: string, selectValue = true) {
		editingInputId = id;
		void tick().then(() => {
			const input = document.getElementById(id);
			if (input instanceof HTMLInputElement) {
				input.focus();
				if (selectValue) input.select();
			}
		});
	}

	function deactivateDraftInput(id: string) {
		if (editingInputId === id) {
			editingInputId = null;
		}
	}

	function handleDraftInputKeydown(event: KeyboardEvent, id: string) {
		if (!isInputEditing(id) && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			event.stopPropagation();
			activateDraftInput(id);
			return;
		}

		if (isInputEditing(id) && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			deactivateDraftInput(id);
		}
	}

	function draftInputEditingValue(id: string) {
		return isInputEditing(id) ? 'true' : 'false';
	}

	function handleApply() {
		lastAppliedDraftSignature = currentDraftSignature;
		onApply(buildDraftEdits());
	}

	function handleCancelEdits() {
		resetDraftsFromSlot();
		lastAppliedDraftSignature = '';
		onCancelEdits();
	}

	function createDraftSignature() {
		return JSON.stringify(buildDraftEdits());
	}

	function resetDraftsFromSlot() {
		draftNickname = slot.label;
		draftLevel = String(slot.level ?? 1);
		draftExperience = String(slot.experience ?? 0);
		draftIvs = statsToDraft(baseIvs);
		draftEvs = statsToDraft(baseEvs);
		draftMoves = baseMoveSet.moves.map((move) => ({
			slot: move.slot,
			move: move.move,
			pp: String(move.pp ?? 0),
			ppUps: String(move.ppUps ?? 0)
		}));
	}

	function countDraftEdits() {
		let count = 0;
		if (draftNickname !== slot.label) count += 1;
		if (isLevelExperienceDirty()) count += 1;
		if (isDraftStatsDirty(draftIvs, baseIvs)) count += 1;
		if (isDraftStatsDirty(draftEvs, baseEvs)) count += 1;
		if (isDraftMoveSetDirty()) count += 1;
		return count;
	}

	function buildDraftEdits(): PokemonEditorDraftEdits {
		const draft: PokemonEditorDraftEdits = {};
		if (draftNickname !== slot.label) draft.nickname = draftNickname;
		if (isLevelExperienceDirty()) {
			draft.levelExperience =
				editMode === 'level'
					? { mode: 'level', level: parseDraftNumber(draftLevel) }
					: { mode: 'experience', experience: parseDraftNumber(draftExperience) };
		}
		if (isDraftStatsDirty(draftIvs, baseIvs)) draft.ivs = draftStatsToPayload(draftIvs);
		if (isDraftStatsDirty(draftEvs, baseEvs)) draft.evs = draftStatsToPayload(draftEvs);
		if (isDraftMoveSetDirty()) draft.moveSet = draftMoveSetToPayload();
		return draft;
	}

	function isLevelExperienceDirty() {
		return editMode === 'level'
			? draftLevel !== String(slot.level ?? 1)
			: draftExperience !== String(slot.experience ?? 0);
	}

	function isDraftStatsDirty(draft: DraftStats, base: PokemonStatEditPayload) {
		return statKeys.some((key) => draft[key] !== String(base[key]));
	}

	function isDraftMoveSetDirty() {
		return draftMoves.some((move, index) => {
			const base = baseMoveSet.moves[index];
			return (
				move.move !== (base?.move ?? 0) ||
				move.pp !== String(base?.pp ?? 0) ||
				move.ppUps !== String(base?.ppUps ?? 0)
			);
		});
	}

	function draftStatsToPayload(draft: DraftStats): PokemonStatEditPayload {
		return Object.fromEntries(
			statKeys.map((key) => [key, parseDraftNumber(draft[key])])
		) as PokemonStatEditPayload;
	}

	function draftMoveSetToPayload(): PokemonMoveSetEditPayload {
		return {
			moves: draftMoves.map((move, index) => ({
				slot: index,
				move: move.move,
				pp: parseDraftNumber(move.pp),
				ppUps: parseDraftNumber(move.ppUps)
			}))
		};
	}

	function statsToDraft(stats: PokemonStatEditPayload): DraftStats {
		return Object.fromEntries(statKeys.map((key) => [key, String(stats[key])])) as DraftStats;
	}

	function parseDraftNumber(value: string) {
		if (value.trim() === '') return Number.NaN;
		return Number(value);
	}
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

			<div class="editor-panel nickname-panel" aria-label="Nickname Editing">
				<div class="panel-title">
					<span>Nickname</span>
					<small>Engine validated</small>
				</div>
				<label class="nickname-field">
					<span>Nickname</span>
					<input
						id="pokemon-editor-nickname"
						type="text"
						value={draftNickname}
						autocomplete="off"
						disabled={applying}
						readonly={!isInputEditing('pokemon-editor-nickname')}
						data-controller-editing={draftInputEditingValue('pokemon-editor-nickname')}
						aria-describedby="pokemon-editor-nickname-hint"
						onpointerdown={() => activateDraftInput('pokemon-editor-nickname', false)}
						onclick={() => activateDraftInput('pokemon-editor-nickname', false)}
						onblur={() => deactivateDraftInput('pokemon-editor-nickname')}
						onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-nickname')}
						oninput={handleNicknameInput}
					/>
				</label>
				<p id="pokemon-editor-nickname-hint">
					Leave empty to restore the default species nickname.
				</p>
			</div>

			<div class="editor-panel" aria-label="Level and Experience Editing">
				<div class="panel-title">
					<span>Level / Experience</span>
					<small>{canEditLevelExperience ? 'Editable' : 'Unsupported'}</small>
				</div>
				<div class="level-edit-grid">
					<span>Current level</span>
					<strong>{slot.level ?? 'Unknown'}</strong>
					<span>Experience</span>
					<strong>{currentExperienceLabel}</strong>
					<span>Next level</span>
					<strong>{nextLevelLabel}</strong>
				</div>
				<div class="level-edit-controls">
					<button
						id="pokemon-editor-mode"
						type="button"
						class="mode-switch"
						role="switch"
						aria-checked={editMode === 'experience'}
						aria-label={`Editing ${editMode === 'level' ? 'Level' : 'Experience'}`}
						disabled={!canEditLevelExperience || applying}
						onclick={toggleEditMode}
					>
						<span>Level</span>
						<span>EXP</span>
						<i aria-hidden="true"></i>
					</button>
					{#if editMode === 'level'}
						<label>
							<span>Level</span>
							<input
								id="pokemon-editor-level"
								type="number"
								min={experienceProjection?.minLevel ?? 1}
								max={experienceProjection?.maxLevel ?? 100}
								step="1"
								value={draftLevel}
								disabled={!canEditLevelExperience || applying}
								readonly={!isInputEditing('pokemon-editor-level')}
								data-controller-editing={draftInputEditingValue('pokemon-editor-level')}
								onpointerdown={() => activateDraftInput('pokemon-editor-level', false)}
								onclick={() => activateDraftInput('pokemon-editor-level', false)}
								onblur={() => deactivateDraftInput('pokemon-editor-level')}
								onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-level')}
								oninput={(event) => {
									const target = event.currentTarget;
									if (target instanceof HTMLInputElement) setDraftLevel(target.value);
								}}
							/>
							<em>{levelRangeLabel}</em>
						</label>
					{:else}
						<label>
							<span>Experience</span>
							<input
								id="pokemon-editor-experience"
								type="number"
								min={experienceProjection?.minExperience ?? 0}
								max={experienceProjection?.maxExperience ?? 0}
								step="1"
								value={draftExperience}
								disabled={!canEditLevelExperience || applying}
								readonly={!isInputEditing('pokemon-editor-experience')}
								data-controller-editing={draftInputEditingValue('pokemon-editor-experience')}
								onpointerdown={() => activateDraftInput('pokemon-editor-experience', false)}
								onclick={() => activateDraftInput('pokemon-editor-experience', false)}
								onblur={() => deactivateDraftInput('pokemon-editor-experience')}
								onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-experience')}
								oninput={(event) => {
									const target = event.currentTarget;
									if (target instanceof HTMLInputElement) setDraftExperience(target.value);
								}}
							/>
							<em>{experienceRangeLabel}</em>
						</label>
					{/if}
				</div>
			</div>

			<div class="editor-panel" aria-label="Move Set Editing">
				<div class="panel-title">
					<span>Move Set</span>
					<small>{canEditMoveSet ? 'Editable' : 'Unsupported'}</small>
				</div>
				{#if canEditMoveSet}
					<div class="move-edit-controls">
						{#each draftMoves as move, index (index)}
							{@const option = optionForMove(move.move)}
							{@const maxPp = maxPpForMove(move)}
							<div class="move-edit-row">
								<div class="move-picker-field">
									<span id={`pokemon-editor-move-${index}-label`}>Move {index + 1}</span>
									<button
										id={`pokemon-editor-move-${index}`}
										type="button"
										class="move-picker-trigger"
										aria-labelledby={`pokemon-editor-move-${index}-label pokemon-editor-move-${index}-name`}
										aria-haspopup="listbox"
										aria-expanded={openMovePickerIndex === index}
										aria-controls={movePickerListId(index)}
										disabled={applying}
										onclick={() => openMovePicker(index)}
									>
										<span id={`pokemon-editor-move-${index}-name`}>{option?.name ?? 'Empty'}</span>
										<em>{option?.type ?? 'None'}</em>
									</button>
									{#if openMovePickerIndex === index}
										<div class="move-picker-popover">
											<input
												id={`pokemon-editor-move-${index}-search`}
												type="search"
												aria-label={`Search moves for Move ${index + 1}`}
												placeholder="Search moves"
												value={moveSearch}
												data-controller-editing="true"
												aria-controls={movePickerListId(index)}
												aria-activedescendant={activeMoveOptionId(index)}
												oninput={handleMoveSearchInput}
												onkeydown={(event) => handleMoveSearchKeydown(event, index)}
											/>
											<div
												id={movePickerListId(index)}
												class="move-picker-list"
												role="listbox"
												aria-labelledby={`pokemon-editor-move-${index}-label`}
											>
												{#each filteredMoveOptions() as option, optionIndex (option.id)}
													<button
														id={moveOptionId(index, option.id)}
														type="button"
														class="move-picker-option"
														class:active={activeMoveOptionIndex === optionIndex}
														role="option"
														aria-selected={option.id === move.move}
														tabindex={activeMoveOptionIndex === optionIndex ? 0 : -1}
														style={`--type-hue: ${option.hue}; --type-chroma: ${option.chroma ?? 0.08}`}
														onclick={() => setMove(index, String(option.id))}
														onfocus={() => handleMoveOptionFocus(optionIndex)}
														onkeydown={(event) =>
															handleMoveOptionKeydown(event, index, optionIndex)}
													>
														<strong>{option.name}</strong>
														<span>{option.type}</span>
														<em>{option.maxPp} PP</em>
													</button>
												{:else}
													<p class="move-picker-empty">No moves found.</p>
												{/each}
											</div>
										</div>
									{/if}
								</div>
								<label>
									<span>PP</span>
									<input
										id={`pokemon-editor-move-${index}-pp`}
										type="number"
										min="0"
										max={maxPp}
										step="1"
										value={move.pp}
										disabled={applying || move.move === 0}
										readonly={!isInputEditing(`pokemon-editor-move-${index}-pp`)}
										data-controller-editing={draftInputEditingValue(
											`pokemon-editor-move-${index}-pp`
										)}
										onpointerdown={() =>
											activateDraftInput(`pokemon-editor-move-${index}-pp`, false)}
										onclick={() => activateDraftInput(`pokemon-editor-move-${index}-pp`, false)}
										onblur={() => deactivateDraftInput(`pokemon-editor-move-${index}-pp`)}
										onkeydown={(event) =>
											handleDraftInputKeydown(event, `pokemon-editor-move-${index}-pp`)}
										oninput={(event) => {
											const target = event.currentTarget;
											if (target instanceof HTMLInputElement) setMovePp(index, target.value);
										}}
									/>
								</label>
								<label>
									<span>PP Ups</span>
									<input
										id={`pokemon-editor-move-${index}-pp-ups`}
										type="number"
										min="0"
										max="3"
										step="1"
										value={move.ppUps}
										disabled={applying || move.move === 0}
										readonly={!isInputEditing(`pokemon-editor-move-${index}-pp-ups`)}
										data-controller-editing={draftInputEditingValue(
											`pokemon-editor-move-${index}-pp-ups`
										)}
										onpointerdown={() =>
											activateDraftInput(`pokemon-editor-move-${index}-pp-ups`, false)}
										onclick={() => activateDraftInput(`pokemon-editor-move-${index}-pp-ups`, false)}
										onblur={() => deactivateDraftInput(`pokemon-editor-move-${index}-pp-ups`)}
										onkeydown={(event) =>
											handleDraftInputKeydown(event, `pokemon-editor-move-${index}-pp-ups`)}
										oninput={(event) => {
											const target = event.currentTarget;
											if (target instanceof HTMLInputElement) setMovePpUps(index, target.value);
										}}
									/>
								</label>
							</div>
						{/each}
					</div>
				{:else}
					<p class="unsupported-copy">
						{moveSetEditConstraints?.unsupportedReason ??
							'Move Set Editing is not supported for this Pokemon format.'}
					</p>
				{/if}
			</div>

			{#if slot.moves && slot.moves.length > 0}
				<div class="editor-panel" aria-label="Visible Move Set Projection">
					<div class="panel-title">
						<span>Visible Moves</span>
						<small>Projection</small>
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
				<div class="editor-panel" aria-label="IV and EV Editing">
					<div class="panel-title">
						<span>IV / EV</span>
						<small
							>{canEditStats
								? `EV total ${totalEvs}/${statEditConstraints?.maxTotalEv ?? 0}`
								: 'Unsupported'}</small
						>
					</div>
					{#if canEditStats}
						<div class="stat-edit-controls">
							{#each statKeys as key (key)}
								<label>
									<span>{key} IV</span>
									<input
										id={`pokemon-editor-${key.toLowerCase()}-iv`}
										type="number"
										min={statEditConstraints?.minIv ?? 0}
										max={statEditConstraints?.maxIv ?? 31}
										step="1"
										value={draftIvs[key]}
										disabled={applying}
										readonly={!isInputEditing(`pokemon-editor-${key.toLowerCase()}-iv`)}
										data-controller-editing={draftInputEditingValue(
											`pokemon-editor-${key.toLowerCase()}-iv`
										)}
										onpointerdown={() =>
											activateDraftInput(`pokemon-editor-${key.toLowerCase()}-iv`, false)}
										onclick={() =>
											activateDraftInput(`pokemon-editor-${key.toLowerCase()}-iv`, false)}
										onblur={() => deactivateDraftInput(`pokemon-editor-${key.toLowerCase()}-iv`)}
										onkeydown={(event) =>
											handleDraftInputKeydown(event, `pokemon-editor-${key.toLowerCase()}-iv`)}
										oninput={(event) => {
											const target = event.currentTarget;
											if (target instanceof HTMLInputElement) setIv(key, target.value);
										}}
									/>
								</label>
								<label>
									<span>{key} EV</span>
									<input
										id={`pokemon-editor-${key.toLowerCase()}-ev`}
										type="number"
										min={statEditConstraints?.minEv ?? 0}
										max={statEditConstraints?.maxEv ?? 255}
										step="1"
										value={draftEvs[key]}
										disabled={applying}
										readonly={!isInputEditing(`pokemon-editor-${key.toLowerCase()}-ev`)}
										data-controller-editing={draftInputEditingValue(
											`pokemon-editor-${key.toLowerCase()}-ev`
										)}
										onpointerdown={() =>
											activateDraftInput(`pokemon-editor-${key.toLowerCase()}-ev`, false)}
										onclick={() =>
											activateDraftInput(`pokemon-editor-${key.toLowerCase()}-ev`, false)}
										onblur={() => deactivateDraftInput(`pokemon-editor-${key.toLowerCase()}-ev`)}
										onkeydown={(event) =>
											handleDraftInputKeydown(event, `pokemon-editor-${key.toLowerCase()}-ev`)}
										oninput={(event) => {
											const target = event.currentTarget;
											if (target instanceof HTMLInputElement) setEv(key, target.value);
										}}
									/>
								</label>
							{/each}
						</div>
					{:else}
						<p class="unsupported-copy">
							{statEditConstraints?.unsupportedReason ??
								'IV and EV Editing is not supported for this Pokemon format.'}
						</p>
					{/if}
				</div>

				<div class="editor-panel" aria-label="Stats">
					<div class="panel-title">
						<span>Stats</span>
						<small>Engine projection</small>
					</div>
					<div class="stat-grid">
						{#each slot.stats as stat (stat.key)}
							<span>{stat.label}</span>
							<strong>{stat.value}</strong>
							<em>IV {stat.iv ?? 0} / EV {stat.ev ?? 0}</em>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<footer class="editor-actions">
		<p id="pokemon-editor-status">
			{statusText}
		</p>
		<button
			id="pokemon-editor-apply"
			type="button"
			class="unsupported-apply"
			disabled={!draftDirty || applying}
			onclick={handleApply}
		>
			{applying ? 'Applying...' : 'Apply edits'}
		</button>
		<button
			id="pokemon-editor-cancel"
			type="button"
			class="close-editor"
			disabled={!draftDirty || applying}
			onclick={handleCancelEdits}
		>
			Cancel edits
		</button>
		<button id="pokemon-editor-close-footer" type="button" class="close-editor" onclick={onClose}>
			Close
		</button>
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
	.stat-grid,
	.level-edit-grid {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 7px 12px;
		padding: 10px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.field-grid span,
	.level-edit-grid span,
	.stat-grid span,
	.stat-grid em {
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.field-grid strong,
	.level-edit-grid strong,
	.stat-grid strong {
		min-width: 0;
		overflow-wrap: anywhere;
		font-size: 0.82rem;
	}

	.editor-panel {
		display: grid;
		gap: 8px;
	}

	.nickname-field {
		display: grid;
		gap: 5px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.nickname-field span,
	.nickname-panel p {
		margin: 0;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.nickname-field input {
		width: 100%;
		min-width: 0;
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
		font:
			750 0.86rem var(--pksx-font-mono),
			monospace;
	}

	.nickname-field input:disabled {
		opacity: 0.55;
	}

	.level-edit-controls {
		display: grid;
		grid-template-columns: 154px minmax(160px, 1fr);
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.mode-switch {
		min-height: 44px;
		border-radius: var(--pksx-radius-sm);
		font:
			800 0.72rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.mode-switch {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: center;
		padding: 4px;
		background: var(--paper-hi);
		color: var(--ink-mute);
		overflow: hidden;
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--rust), transparent 56%);
	}

	.mode-switch span {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		min-height: 36px;
		transition:
			color 140ms ease,
			opacity 140ms ease;
	}

	.mode-switch i {
		position: absolute;
		inset: 4px auto 4px 4px;
		width: calc(50% - 4px);
		border-radius: calc(var(--pksx-radius-sm) - 2px);
		background: var(--rust);
		transition: transform 140ms ease;
	}

	.mode-switch[aria-checked='true'] i {
		transform: translateX(100%);
	}

	.mode-switch[aria-checked='false'] span:first-child,
	.mode-switch[aria-checked='true'] span:nth-child(2) {
		color: white;
		text-shadow: 0 1px 0 color-mix(in srgb, var(--ink), transparent 68%);
	}

	.mode-switch[aria-checked='false'] span:nth-child(2),
	.mode-switch[aria-checked='true'] span:first-child {
		opacity: 0.62;
	}

	.mode-switch:disabled {
		opacity: 0.55;
	}

	.level-edit-controls label {
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 4px;
	}

	.stat-edit-controls,
	.move-edit-controls {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.stat-edit-controls {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.move-edit-row {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) 74px 84px;
		gap: 8px;
		align-items: start;
	}

	.stat-edit-controls label,
	.move-edit-controls label,
	.move-picker-field {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	.stat-edit-controls label span,
	.move-edit-controls label span,
	.move-picker-field > span,
	.unsupported-copy {
		margin: 0;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.stat-edit-controls input,
	.move-edit-controls input,
	.move-picker-trigger {
		width: 100%;
		min-width: 0;
		height: 38px;
		padding: 0 8px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
		font:
			750 0.74rem var(--pksx-font-mono),
			monospace;
	}

	.move-picker-field {
		position: relative;
	}

	.move-picker-trigger {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		gap: 8px;
		text-align: left;
	}

	.move-picker-trigger span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.move-picker-trigger em {
		color: var(--ink-mute);
		font:
			650 0.58rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.move-picker-popover {
		position: absolute;
		z-index: 2;
		top: calc(100% + 5px);
		left: 0;
		right: 0;
		display: grid;
		gap: 6px;
		padding: 8px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
	}

	.move-picker-popover input {
		height: 34px;
	}

	.move-picker-list {
		max-height: 184px;
		display: grid;
		gap: 4px;
		overflow-y: auto;
	}

	.move-picker-option {
		width: 100%;
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content max-content;
		align-items: center;
		gap: 6px;
		padding: 7px 8px;
		border: 1px solid transparent;
		border-radius: var(--pksx-radius-sm);
		background: oklch(0.92 var(--type-chroma, 0.07) var(--type-hue, 100));
		color: color-mix(in srgb, var(--ink), black 9%);
		text-align: left;
	}

	.move-picker-option strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.74rem;
	}

	.move-picker-option span,
	.move-picker-option em,
	.move-picker-empty {
		color: color-mix(in srgb, var(--ink), transparent 18%);
		font:
			650 0.57rem var(--pksx-font-mono),
			monospace;
		line-height: 1;
		text-transform: uppercase;
	}

	.move-picker-option[aria-selected='true'] {
		border-color: color-mix(in srgb, var(--rust), transparent 38%);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rust), transparent 38%);
	}

	.move-picker-option.active,
	.move-picker-option:focus-visible {
		border-color: color-mix(in srgb, var(--rust), transparent 20%);
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 55%);
		outline-offset: 1px;
	}

	.move-picker-empty {
		margin: 0;
		padding: 8px;
		text-transform: none;
	}

	.stat-edit-controls input:disabled,
	.move-edit-controls input:disabled,
	.move-picker-trigger:disabled {
		opacity: 0.55;
	}

	.unsupported-copy {
		padding: 10px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
		text-transform: none;
	}

	.level-edit-controls label span,
	.level-edit-controls label em {
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.level-edit-controls input {
		width: 100%;
		min-width: 0;
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
		font:
			750 0.86rem var(--pksx-font-mono),
			monospace;
	}

	.level-edit-controls button:disabled,
	.level-edit-controls input:disabled {
		opacity: 0.55;
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

	.unsupported-apply:disabled {
		cursor: not-allowed;
		opacity: 0.56;
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

		.level-edit-controls {
			grid-template-columns: 1fr;
		}

		.stat-edit-controls,
		.move-edit-row {
			grid-template-columns: 1fr 1fr;
		}

		.move-edit-row .move-picker-field {
			grid-column: 1 / -1;
		}
	}
</style>
