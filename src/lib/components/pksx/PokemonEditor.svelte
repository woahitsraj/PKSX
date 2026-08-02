<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type {
		PokemonBattleFieldProjection,
		PokemonSpeciesFormEditProjection,
		SaveSummary
	} from '$lib/engine';
	import Combobox, { type ComboboxOption } from '$lib/components/pksx/Combobox.svelte';
	import type {
		PokemonEditorDraftEdits,
		PokemonMetDataEditPayload,
		PokemonMoveSetEditPayload,
		PokemonSpeciesFormEditPayload,
		PokemonStatEditPayload,
		PokemonEditorState
	} from '$lib/pksx/pokemon-editor';
	import {
		maxPpForPpUps,
		moveSetEditPayloadFromSlot,
		statEditPayloadFromSlot,
		type PokemonStatKey
	} from '$lib/pksx/pokemon-editor';
	import { getSpriteIdentityLabels } from '$lib/pksx/sprite-catalog';

	interface Props {
		editor: PokemonEditorState;
		saveSummary: SaveSummary | null;
		spriteUrl: string | null;
		slotHueStyle: string;
		feedback: string | null;
		applying: boolean;
		speciesFormProjection: PokemonSpeciesFormEditProjection | null;
		speciesFormLoading: boolean;
		speciesFormError: string | null;
		onApply: (draft: PokemonEditorDraftEdits) => void;
		onPreviewSpeciesForm: (target: PokemonSpeciesFormEditPayload) => void;
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
	type DraftFriendship = Record<string, string>;

	let {
		editor,
		saveSummary,
		spriteUrl,
		slotHueStyle,
		feedback,
		applying,
		speciesFormProjection,
		speciesFormLoading,
		speciesFormError,
		onApply,
		onPreviewSpeciesForm,
		onCancelEdits,
		onClose
	}: Props = $props();

	let editMode = $state<'level' | 'experience'>('level');
	let editingInputId = $state<string | null>(null);
	const slot = $derived(editor.slot);
	let draftSpeciesId = $state(untrack(() => slot.speciesId ?? 0));
	let draftForm = $state(untrack(() => slot.form ?? 0));
	const speciesFormPreview = $derived(
		speciesFormProjection?.preview.speciesId === draftSpeciesId &&
			speciesFormProjection.preview.form === draftForm
			? speciesFormProjection.preview
			: null
	);
	const statKeys = ['HP', 'ATK', 'DEF', 'SPA', 'SPD', 'SPE'] as const satisfies PokemonStatKey[];
	const baseIvs = $derived(statEditPayloadFromSlot(slot, 'iv'));
	const baseEvs = $derived(statEditPayloadFromSlot(slot, 'ev'));
	const baseMoveSet = $derived(moveSetEditPayloadFromSlot(slot));
	const friendshipEditConstraints = $derived(slot.friendshipEditConstraints);
	const baseFriendship = $derived(
		Object.fromEntries(
			(friendshipEditConstraints?.fields ?? []).map((field) => [field.key, String(field.value)])
		) as DraftFriendship
	);
	const battleFields = $derived(slot.battleFields ?? []);
	let draftNickname = $state(untrack(() => slot.label));
	let draftLevel = $state(untrack(() => String(slot.level ?? 1)));
	let draftExperience = $state(untrack(() => String(slot.experience ?? 0)));
	const originalTrainerEditConstraints = $derived(slot.originalTrainerEditConstraints);
	let draftOriginalTrainerName = $state(
		untrack(() => slot.originalTrainerEditConstraints?.currentName ?? '')
	);
	let draftTrainerId = $state(
		untrack(() => String(slot.originalTrainerEditConstraints?.currentTrainerId ?? 0))
	);
	let draftSecretId = $state(
		untrack(() => String(slot.originalTrainerEditConstraints?.currentSecretId ?? 0))
	);
	let draftTrainerGenderId = $state(
		untrack(() => slot.originalTrainerEditConstraints?.currentGenderId ?? 0)
	);
	let draftLanguageId = $state(
		untrack(() => slot.originalTrainerEditConstraints?.currentLanguageId ?? 0)
	);
	let draftNatureId = $state(untrack(() => slot.natureEditConstraints?.currentNatureId ?? -1));
	let draftHeldItemId = $state(untrack(() => slot.heldItemEditConstraints?.currentItemId ?? 0));
	let draftAbilityIndex = $state(
		untrack(() => slot.abilityEditConstraints?.currentAbilityIndex ?? -1)
	);
	let draftMetLocationId = $state(
		untrack(() => slot.metDataEditConstraints?.currentLocationId ?? 0)
	);
	let draftMetLevel = $state(
		untrack(() => String(slot.metDataEditConstraints?.currentMetLevel ?? 0))
	);
	let draftMetDate = $state(untrack(() => slot.metDataEditConstraints?.currentMetDate ?? ''));
	let draftOriginGameId = $state(
		untrack(() => slot.metDataEditConstraints?.currentOriginGameId ?? 0)
	);
	let draftBallId = $state(untrack(() => slot.metDataEditConstraints?.currentBallId ?? 0));
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
	let draftFriendship = $state<DraftFriendship>(untrack(() => ({ ...baseFriendship })));
	let draftBattleFields = $state<Record<string, number>>(
		untrack(() => battleFieldsToDraft(battleFields))
	);
	let lastAppliedDraftSignature = $state('');
	const statEditConstraints = $derived(slot.statEditConstraints);
	const moveSetEditConstraints = $derived(slot.moveSetEditConstraints);
	const natureEditConstraints = $derived(slot.natureEditConstraints);
	const heldItemEditConstraints = $derived(slot.heldItemEditConstraints);
	const abilityEditConstraints = $derived(slot.abilityEditConstraints);
	const metDataEditConstraints = $derived(slot.metDataEditConstraints);
	const canEditStats = $derived(statEditConstraints?.supported ?? false);
	const canEditMoveSet = $derived(moveSetEditConstraints?.supported ?? false);
	const canEditNature = $derived(natureEditConstraints?.supported ?? false);
	const canEditHeldItem = $derived(heldItemEditConstraints?.supported ?? false);
	const canEditAbility = $derived(abilityEditConstraints?.supported ?? false);
	const canEditFriendship = $derived(friendshipEditConstraints?.supported ?? false);
	const canEditMetData = $derived(metDataEditConstraints?.supported ?? false);
	const canEditOriginalTrainer = $derived(originalTrainerEditConstraints?.supported ?? false);
	const unsupportedOriginalTrainerFields = $derived(
		[
			originalTrainerEditConstraints?.supportsSecretId ? null : 'Secret ID',
			originalTrainerEditConstraints?.supportsGender ? null : 'gender',
			originalTrainerEditConstraints?.supportsLanguage ? null : 'language'
		].filter((field): field is string => field !== null)
	);
	const metLocationOptions = $derived(
		metDataEditConstraints?.locationGroups.find((group) => group.originGameId === draftOriginGameId)
			?.options ?? []
	);
	const moveOptions = $derived(moveSetEditConstraints?.availableMoves ?? []);
	const moveComboboxOptions = $derived(
		moveOptions.map(
			(option) =>
				({
					value: String(option.id),
					label: option.name,
					meta: option.type,
					detail: `${option.maxPp} PP`,
					hue: option.hue,
					chroma: option.chroma
				}) satisfies ComboboxOption
		)
	);
	const unavailableHeldItemCount = $derived(
		heldItemEditConstraints?.options.filter((option) => !option.available).length ?? 0
	);
	const unavailableAbilityOptions = $derived(
		abilityEditConstraints?.options.filter((option) => !option.available) ?? []
	);
	const originalNature = $derived(
		natureEditConstraints?.options.find(
			(option) => option.id === natureEditConstraints.originalNatureId
		)
	);
	const statNature = $derived(
		natureEditConstraints?.options.find(
			(option) => option.id === natureEditConstraints.statNatureId
		)
	);
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
	const spriteIdentityLabels = $derived(getSpriteIdentityLabels(slot.spriteIdentity));
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
			slot.nature
				? {
						label: natureEditConstraints?.usesStatNature ? 'Original Nature' : 'Nature',
						value: slot.nature
					}
				: null,
			natureEditConstraints?.usesStatNature && statNature
				? { label: 'Stat Nature', value: statNature.name }
				: null,
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

	function handleSpeciesChange(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) return;
		draftSpeciesId = Number(target.value);
		draftForm = 0;
		onPreviewSpeciesForm({ speciesId: draftSpeciesId, form: draftForm });
	}

	function handleFormChange(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) return;
		draftForm = Number(target.value);
		onPreviewSpeciesForm({ speciesId: draftSpeciesId, form: draftForm });
	}

	function setDraftLevel(value: string) {
		draftLevel = value;
	}

	function setDraftExperience(value: string) {
		draftExperience = value;
	}

	function setDraftOriginalTrainerName(value: string) {
		draftOriginalTrainerName = value;
	}

	function setDraftTrainerId(value: string) {
		draftTrainerId = value;
	}

	function setDraftSecretId(value: string) {
		draftSecretId = value;
	}

	function setDraftMetLocation(value: string) {
		draftMetLocationId = Number(value);
	}

	function setDraftMetLevel(value: string) {
		draftMetLevel = value;
	}

	function setDraftMetDate(value: string) {
		draftMetDate = value;
	}

	function setDraftOriginGame(value: string) {
		draftOriginGameId = Number(value);
		const locations =
			metDataEditConstraints?.locationGroups.find(
				(group) => group.originGameId === draftOriginGameId
			)?.options ?? [];
		if (!locations.some((option) => option.id === draftMetLocationId)) {
			draftMetLocationId = locations[0]?.id ?? 0;
		}
	}

	function setDraftBall(value: string) {
		draftBallId = Number(value);
	}

	function setDraftNature(value: string) {
		draftNatureId = Number(value);
	}

	function setDraftHeldItem(value: string) {
		draftHeldItemId = Number(value);
	}

	function setDraftAbility(value: string) {
		draftAbilityIndex = Number(value);
	}

	function heldItemOptionLabel(
		option: NonNullable<typeof heldItemEditConstraints>['options'][number]
	) {
		return `${option.name}${option.available ? '' : ' (Unavailable for format)'}`;
	}

	function abilityOptionLabel(
		option: NonNullable<typeof abilityEditConstraints>['options'][number]
	) {
		const slotLabel = option.hidden ? 'Hidden Ability' : `Ability ${option.index + 1}`;
		return `${slotLabel}: ${option.name}${option.available ? '' : ' (Unavailable)'}`;
	}

	function setIv(key: PokemonStatKey, value: string) {
		draftIvs = { ...draftIvs, [key]: value };
	}

	function setEv(key: PokemonStatKey, value: string) {
		draftEvs = { ...draftEvs, [key]: value };
	}

	function setFriendship(key: string, value: string) {
		draftFriendship = { ...draftFriendship, [key]: value };
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

	function setBattleField(key: string, value: string) {
		draftBattleFields = { ...draftBattleFields, [key]: Number(value) };
	}

	function optionForMove(moveId: number) {
		return moveOptions.find((option) => option.id === moveId);
	}

	function maxPpForMove(move: DraftMoveSlot) {
		const option = optionForMove(move.move);
		const ppUps = parseDraftNumber(move.ppUps);
		return maxPpForPpUps(option?.maxPp ?? 0, Number.isInteger(ppUps) ? ppUps : 0);
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
		draftSpeciesId = slot.speciesId ?? 0;
		draftForm = slot.form ?? 0;
		draftNickname = slot.label;
		draftLevel = String(slot.level ?? 1);
		draftExperience = String(slot.experience ?? 0);
		draftOriginalTrainerName = originalTrainerEditConstraints?.currentName ?? '';
		draftTrainerId = String(originalTrainerEditConstraints?.currentTrainerId ?? 0);
		draftSecretId = String(originalTrainerEditConstraints?.currentSecretId ?? 0);
		draftTrainerGenderId = originalTrainerEditConstraints?.currentGenderId ?? 0;
		draftLanguageId = originalTrainerEditConstraints?.currentLanguageId ?? 0;
		draftNatureId = slot.natureEditConstraints?.currentNatureId ?? -1;
		draftHeldItemId = slot.heldItemEditConstraints?.currentItemId ?? 0;
		draftAbilityIndex = slot.abilityEditConstraints?.currentAbilityIndex ?? -1;
		draftMetLocationId = metDataEditConstraints?.currentLocationId ?? 0;
		draftMetLevel = String(metDataEditConstraints?.currentMetLevel ?? 0);
		draftMetDate = metDataEditConstraints?.currentMetDate ?? '';
		draftOriginGameId = metDataEditConstraints?.currentOriginGameId ?? 0;
		draftBallId = metDataEditConstraints?.currentBallId ?? 0;
		draftIvs = statsToDraft(baseIvs);
		draftEvs = statsToDraft(baseEvs);
		draftMoves = baseMoveSet.moves.map((move) => ({
			slot: move.slot,
			move: move.move,
			pp: String(move.pp ?? 0),
			ppUps: String(move.ppUps ?? 0)
		}));
		draftFriendship = { ...baseFriendship };
		draftBattleFields = battleFieldsToDraft(battleFields);
	}

	function countDraftEdits() {
		let count = 0;
		if (isSpeciesFormDirty()) count += 1;
		if (draftNickname !== slot.label) count += 1;
		if (isLevelExperienceDirty()) count += 1;
		if (isNatureDirty()) count += 1;
		if (isHeldItemDirty()) count += 1;
		if (isAbilityDirty()) count += 1;
		if (isMetDataDirty()) count += 1;
		if (isOriginalTrainerDirty()) count += 1;
		if (isDraftStatsDirty(draftIvs, baseIvs)) count += 1;
		if (isDraftStatsDirty(draftEvs, baseEvs)) count += 1;
		if (isDraftMoveSetDirty()) count += 1;
		if (isDraftFriendshipDirty()) count += 1;
		count += changedBattleFields().length;
		return count;
	}

	function buildDraftEdits(): PokemonEditorDraftEdits {
		const draft: PokemonEditorDraftEdits = {};
		if (isSpeciesFormDirty()) {
			draft.speciesForm = { speciesId: draftSpeciesId, form: draftForm };
		}
		if (draftNickname !== slot.label) draft.nickname = draftNickname;
		if (isLevelExperienceDirty()) {
			draft.levelExperience =
				editMode === 'level'
					? { mode: 'level', level: parseDraftNumber(draftLevel) }
					: { mode: 'experience', experience: parseDraftNumber(draftExperience) };
		}
		if (isNatureDirty()) draft.natureId = draftNatureId;
		if (isHeldItemDirty()) draft.heldItemId = draftHeldItemId;
		if (isAbilityDirty()) draft.abilityIndex = draftAbilityIndex;
		if (isMetDataDirty()) draft.metData = draftMetDataToPayload();
		if (isOriginalTrainerDirty() && originalTrainerEditConstraints) {
			draft.originalTrainer = {
				name: draftOriginalTrainerName,
				trainerId: parseDraftNumber(draftTrainerId)
			};
			if (originalTrainerEditConstraints.supportsSecretId) {
				draft.originalTrainer.secretId = parseDraftNumber(draftSecretId);
			}
			if (originalTrainerEditConstraints.supportsGender) {
				draft.originalTrainer.genderId = draftTrainerGenderId;
			}
			if (originalTrainerEditConstraints.supportsLanguage) {
				draft.originalTrainer.languageId = draftLanguageId;
			}
		}
		if (isDraftStatsDirty(draftIvs, baseIvs)) draft.ivs = draftStatsToPayload(draftIvs);
		if (isDraftStatsDirty(draftEvs, baseEvs)) draft.evs = draftStatsToPayload(draftEvs);
		if (isDraftMoveSetDirty()) draft.moveSet = draftMoveSetToPayload();
		if (isDraftFriendshipDirty()) {
			draft.friendship = {
				fields: (friendshipEditConstraints?.fields ?? [])
					.filter((field) => draftFriendship[field.key] !== String(field.value))
					.map((field) => ({ key: field.key, value: parseDraftNumber(draftFriendship[field.key]) }))
			};
		}
		const battleFieldEdits = changedBattleFields();
		if (battleFieldEdits.length > 0) draft.battleFields = { fields: battleFieldEdits };
		return draft;
	}

	function isSpeciesFormDirty() {
		return draftSpeciesId !== slot.speciesId || draftForm !== (slot.form ?? 0);
	}

	function isLevelExperienceDirty() {
		return editMode === 'level'
			? draftLevel !== String(slot.level ?? 1)
			: draftExperience !== String(slot.experience ?? 0);
	}

	function isOriginalTrainerDirty() {
		const constraints = originalTrainerEditConstraints;
		return (
			constraints !== undefined &&
			(draftOriginalTrainerName !== constraints.currentName ||
				draftTrainerId !== String(constraints.currentTrainerId) ||
				(constraints.supportsSecretId && draftSecretId !== String(constraints.currentSecretId)) ||
				(constraints.supportsGender && draftTrainerGenderId !== constraints.currentGenderId) ||
				(constraints.supportsLanguage && draftLanguageId !== constraints.currentLanguageId))
		);
	}

	function isNatureDirty() {
		return draftNatureId !== (natureEditConstraints?.currentNatureId ?? -1);
	}

	function isHeldItemDirty() {
		return draftHeldItemId !== (heldItemEditConstraints?.currentItemId ?? 0);
	}

	function isAbilityDirty() {
		return draftAbilityIndex !== (abilityEditConstraints?.currentAbilityIndex ?? -1);
	}

	function isMetDataDirty() {
		return (
			draftMetLocationId !== (metDataEditConstraints?.currentLocationId ?? 0) ||
			draftMetLevel !== String(metDataEditConstraints?.currentMetLevel ?? 0) ||
			draftMetDate !== (metDataEditConstraints?.currentMetDate ?? '') ||
			draftOriginGameId !== (metDataEditConstraints?.currentOriginGameId ?? 0) ||
			draftBallId !== (metDataEditConstraints?.currentBallId ?? 0)
		);
	}

	function draftMetDataToPayload(): PokemonMetDataEditPayload {
		return {
			locationId: draftMetLocationId,
			metLevel: parseDraftNumber(draftMetLevel),
			...(metDataEditConstraints?.supportsMetDate
				? { metDate: draftMetDate.length > 0 ? draftMetDate : null }
				: {}),
			...(metDataEditConstraints?.supportsOriginGame ? { originGameId: draftOriginGameId } : {}),
			...(metDataEditConstraints?.supportsBall ? { ballId: draftBallId } : {})
		};
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

	function isDraftFriendshipDirty() {
		return (friendshipEditConstraints?.fields ?? []).some(
			(field) => draftFriendship[field.key] !== String(field.value)
		);
	}

	function changedBattleFields() {
		return battleFields
			.filter((field) => draftBattleFields[field.key] !== field.value)
			.map((field) => ({
				key: field.key,
				value: draftBattleFields[field.key] ?? Number.NaN
			}));
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

	function battleFieldsToDraft(fields: PokemonBattleFieldProjection[]) {
		return Object.fromEntries(fields.map((field) => [field.key, field.value]));
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
				{#if spriteIdentityLabels.form}<span>{spriteIdentityLabels.form}</span>{/if}
				{#if spriteIdentityLabels.shiny}<span>{spriteIdentityLabels.shiny}</span>{/if}
				{#if spriteIdentityLabels.displaySex}<span>{spriteIdentityLabels.displaySex}</span>{/if}
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

			<div class="editor-panel" aria-label="Species and Form Editing">
				<div class="panel-title">
					<span>Species / Form</span>
					<small>{speciesFormProjection ? 'Engine choices' : 'Unavailable'}</small>
				</div>
				{#if speciesFormProjection}
					<div class="species-form-controls">
						<label>
							<span>Species</span>
							<select
								id="pokemon-editor-species"
								value={draftSpeciesId}
								disabled={applying || speciesFormLoading}
								onchange={handleSpeciesChange}
							>
								{#each speciesFormProjection.availableSpecies as species (species.id)}
									<option value={species.id}>{species.name}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Form</span>
							<select
								id="pokemon-editor-form"
								value={draftForm}
								disabled={applying || speciesFormLoading}
								onchange={handleFormChange}
							>
								{#each speciesFormProjection.availableForms as form (form.id)}
									<option value={form.id}>{form.name}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="species-form-preview" aria-live="polite">
						{#if speciesFormLoading || !speciesFormPreview}
							<p>Loading PKHeX cascade preview...</p>
						{:else}
							<strong>{speciesFormPreview.speciesName} · {speciesFormPreview.formName}</strong>
							<span class:illegal={!speciesFormPreview.legal}
								>{speciesFormPreview.legal ? 'Legal preview' : 'Legality issues expected'}</span
							>
							<ul>
								{#each speciesFormPreview.consequences as consequence (consequence)}
									<li>{consequence}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{:else}
					<p class="unsupported-copy">
						{speciesFormError ?? 'Species and Form Editing is not supported for this Pokemon.'}
					</p>
				{/if}
			</div>

			{#if battleFields.length > 0}
				<div class="editor-panel" aria-label="Generation-Specific Battle Field Editing">
					<div class="panel-title">
						<span>Battle Fields</span>
						<small
							>{battleFields.some((field) => field.supported) ? 'Editable' : 'Unsupported'}</small
						>
					</div>
					<div class="battle-field-controls">
						{#each battleFields as field (field.key)}
							<label>
								<span>{field.label}</span>
								<select
									id={`pokemon-editor-battle-field-${field.key}`}
									value={draftBattleFields[field.key]}
									disabled={!field.supported || applying}
									onchange={(event) => setBattleField(field.key, event.currentTarget.value)}
								>
									{#each field.options as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
							{#if !field.supported && field.unsupportedReason}
								<p>{field.unsupportedReason}</p>
							{/if}
						{/each}
					</div>
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

			<div class="editor-panel" aria-label="Nature Editing">
				<div class="panel-title">
					<span>Nature</span>
					<small>{canEditNature ? 'Engine constrained' : 'Unsupported'}</small>
				</div>
				{#if canEditNature}
					<div class="nature-edit-summary">
						<span
							>{natureEditConstraints?.usesStatNature ? 'Original Nature' : 'Current Nature'}</span
						>
						<strong>{originalNature?.name ?? slot.nature ?? 'Unknown'}</strong>
						{#if natureEditConstraints?.usesStatNature}
							<span>Stat Nature</span>
							<strong>{statNature?.name ?? 'Unknown'}</strong>
						{/if}
					</div>
					<label class="nature-edit-controls">
						<span>Nature choice</span>
						<select
							id="pokemon-editor-nature"
							value={draftNatureId}
							disabled={applying}
							onchange={(event) => setDraftNature(event.currentTarget.value)}
						>
							{#each natureEditConstraints?.options ?? [] as option (option.id)}
								<option value={option.id}>{option.name} — {option.effect}</option>
							{/each}
						</select>
					</label>
					<p class="nature-edit-hint">
						{natureEditConstraints?.usesStatNature
							? 'Changes the stat Nature while preserving the original Nature.'
							: 'Changes the underlying Nature for this Pokemon format.'}
					</p>
				{:else}
					<p class="unsupported-copy">
						{natureEditConstraints?.unsupportedReason ??
							'Nature Editing is not supported for this Pokemon format.'}
					</p>
				{/if}
			</div>

			<div class="editor-panel" aria-label="Held Item Editing">
				<div class="panel-title">
					<span>Held Item</span>
					<small>{canEditHeldItem ? 'Engine constrained' : 'Unsupported'}</small>
				</div>
				{#if heldItemEditConstraints && heldItemEditConstraints.options.length > 0}
					<label class="held-item-edit-controls">
						<span>Held Item choice</span>
						<select
							id="pokemon-editor-held-item"
							value={draftHeldItemId}
							disabled={!canEditHeldItem || applying}
							onchange={(event) => setDraftHeldItem(event.currentTarget.value)}
						>
							{#each heldItemEditConstraints.options as option (option.id)}
								<option value={option.id} disabled={!option.available}>
									{heldItemOptionLabel(option)}
								</option>
							{/each}
						</select>
					</label>
					<p class="held-item-restrictions">
						{#if draftHeldItemId === 0}
							No item is selected.
						{:else if unavailableHeldItemCount > 0}
							{unavailableHeldItemCount} item
							{unavailableHeldItemCount === 1 ? 'is' : 'choices are'} unavailable for this Pokemon Entity
							format.
						{:else}
							Choices are limited to the active Save File and Pokemon Entity format.
						{/if}
					</p>
				{:else}
					<p class="unsupported-copy">
						{heldItemEditConstraints?.unsupportedReason ??
							'Held Item Editing is not supported for this Pokemon Entity format.'}
					</p>
				{/if}
			</div>

			<div class="editor-panel" aria-label="Ability Editing">
				<div class="panel-title">
					<span>Ability</span>
					<small>{canEditAbility ? 'Engine constrained' : 'Unsupported'}</small>
				</div>
				{#if abilityEditConstraints && abilityEditConstraints.options.length > 0}
					<label class="ability-edit-controls">
						<span>Ability choice</span>
						<select
							id="pokemon-editor-ability"
							value={draftAbilityIndex}
							disabled={!canEditAbility || applying}
							onchange={(event) => setDraftAbility(event.currentTarget.value)}
						>
							{#each abilityEditConstraints.options as option (option.index)}
								<option value={option.index} disabled={!option.available}>
									{abilityOptionLabel(option)}
								</option>
							{/each}
						</select>
					</label>
					{#if unavailableAbilityOptions.length > 0}
						<ul class="ability-restrictions" aria-label="Unavailable Ability choices">
							{#each unavailableAbilityOptions as option (option.index)}
								<li>{option.unavailableReason ?? `${option.name} is unavailable.`}</li>
							{/each}
						</ul>
					{/if}
				{:else}
					<p class="unsupported-copy">
						{abilityEditConstraints?.unsupportedReason ??
							'Ability Editing is not supported for this Pokemon format.'}
					</p>
				{/if}
			</div>

			<div class="editor-panel" aria-label="Met Data Editing">
				<div class="panel-title">
					<span>Met Data</span>
					<small>{canEditMetData ? 'Engine constrained' : 'Unsupported'}</small>
				</div>
				{#if canEditMetData}
					<div class="met-data-edit-controls">
						<label>
							<span>Met location</span>
							<select
								id="pokemon-editor-met-location"
								value={draftMetLocationId}
								disabled={applying || metLocationOptions.length === 0}
								onchange={(event) => setDraftMetLocation(event.currentTarget.value)}
							>
								{#each metLocationOptions as option (option.id)}
									<option value={option.id}>{option.name}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Met level</span>
							<input
								id="pokemon-editor-met-level"
								type="number"
								min={metDataEditConstraints?.minMetLevel ?? 0}
								max={metDataEditConstraints?.maxMetLevel ?? 100}
								step="1"
								value={draftMetLevel}
								disabled={applying}
								readonly={!isInputEditing('pokemon-editor-met-level')}
								data-controller-editing={draftInputEditingValue('pokemon-editor-met-level')}
								onpointerdown={() => activateDraftInput('pokemon-editor-met-level', false)}
								onclick={() => activateDraftInput('pokemon-editor-met-level', false)}
								onblur={() => deactivateDraftInput('pokemon-editor-met-level')}
								onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-met-level')}
								oninput={(event) => setDraftMetLevel(event.currentTarget.value)}
							/>
						</label>
						{#if metDataEditConstraints?.supportsOriginGame}
							<label>
								<span>Origin game</span>
								<select
									id="pokemon-editor-origin-game"
									value={draftOriginGameId}
									disabled={applying}
									onchange={(event) => setDraftOriginGame(event.currentTarget.value)}
								>
									{#each metDataEditConstraints.originGames as option (option.id)}
										<option value={option.id}>{option.name}</option>
									{/each}
								</select>
							</label>
						{/if}
						{#if metDataEditConstraints?.supportsBall}
							<label>
								<span>Ball</span>
								<select
									id="pokemon-editor-ball"
									value={draftBallId}
									disabled={applying}
									onchange={(event) => setDraftBall(event.currentTarget.value)}
								>
									{#each metDataEditConstraints.balls as option (option.id)}
										<option value={option.id}>{option.name}</option>
									{/each}
								</select>
							</label>
						{/if}
						{#if metDataEditConstraints?.supportsMetDate}
							<label>
								<span>Met date</span>
								<input
									id="pokemon-editor-met-date"
									type="date"
									min="2000-01-01"
									max="2255-12-31"
									value={draftMetDate}
									disabled={applying}
									readonly={!isInputEditing('pokemon-editor-met-date')}
									data-controller-editing={draftInputEditingValue('pokemon-editor-met-date')}
									onpointerdown={() => activateDraftInput('pokemon-editor-met-date', false)}
									onclick={() => activateDraftInput('pokemon-editor-met-date', false)}
									onblur={() => deactivateDraftInput('pokemon-editor-met-date')}
									onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-met-date')}
									oninput={(event) => setDraftMetDate(event.currentTarget.value)}
								/>
							</label>
						{/if}
					</div>
					<p class="met-data-hint">
						Location, origin game, and ball choices come from the PKHeX Engine. Invalid encounter
						combinations remain staged.
					</p>
				{:else}
					<p class="unsupported-copy">
						{metDataEditConstraints?.unsupportedReason ??
							'Met Data Editing is not supported for this Pokemon Entity format.'}
					</p>
				{/if}
			</div>

			<div class="editor-panel" aria-label="Original Trainer Data Editing">
				<div class="panel-title">
					<span>Original Trainer</span>
					<small>{canEditOriginalTrainer ? 'Engine validated' : 'Unsupported'}</small>
				</div>
				{#if canEditOriginalTrainer && originalTrainerEditConstraints}
					<div class="trainer-edit-controls">
						<label class="trainer-name-field">
							<span>Name</span>
							<input
								id="pokemon-editor-original-trainer-name"
								type="text"
								maxlength={originalTrainerEditConstraints.maxNameLength}
								value={draftOriginalTrainerName}
								disabled={applying}
								readonly={!isInputEditing('pokemon-editor-original-trainer-name')}
								data-controller-editing={draftInputEditingValue(
									'pokemon-editor-original-trainer-name'
								)}
								onpointerdown={() =>
									activateDraftInput('pokemon-editor-original-trainer-name', false)}
								onclick={() => activateDraftInput('pokemon-editor-original-trainer-name', false)}
								onblur={() => deactivateDraftInput('pokemon-editor-original-trainer-name')}
								onkeydown={(event) =>
									handleDraftInputKeydown(event, 'pokemon-editor-original-trainer-name')}
								oninput={(event) => {
									const target = event.currentTarget;
									if (target instanceof HTMLInputElement) setDraftOriginalTrainerName(target.value);
								}}
							/>
						</label>
						<label>
							<span>Trainer ID</span>
							<input
								id="pokemon-editor-trainer-id"
								type="number"
								min={originalTrainerEditConstraints.minTrainerId}
								max={originalTrainerEditConstraints.maxTrainerId}
								step="1"
								value={draftTrainerId}
								disabled={applying}
								readonly={!isInputEditing('pokemon-editor-trainer-id')}
								data-controller-editing={draftInputEditingValue('pokemon-editor-trainer-id')}
								onpointerdown={() => activateDraftInput('pokemon-editor-trainer-id', false)}
								onclick={() => activateDraftInput('pokemon-editor-trainer-id', false)}
								onblur={() => deactivateDraftInput('pokemon-editor-trainer-id')}
								onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-trainer-id')}
								oninput={(event) => {
									const target = event.currentTarget;
									if (target instanceof HTMLInputElement) setDraftTrainerId(target.value);
								}}
							/>
						</label>
						{#if originalTrainerEditConstraints.supportsSecretId}
							<label>
								<span>Secret ID</span>
								<input
									id="pokemon-editor-secret-id"
									type="number"
									min={originalTrainerEditConstraints.minTrainerId}
									max={originalTrainerEditConstraints.maxTrainerId}
									step="1"
									value={draftSecretId}
									disabled={applying}
									readonly={!isInputEditing('pokemon-editor-secret-id')}
									data-controller-editing={draftInputEditingValue('pokemon-editor-secret-id')}
									onpointerdown={() => activateDraftInput('pokemon-editor-secret-id', false)}
									onclick={() => activateDraftInput('pokemon-editor-secret-id', false)}
									onblur={() => deactivateDraftInput('pokemon-editor-secret-id')}
									onkeydown={(event) => handleDraftInputKeydown(event, 'pokemon-editor-secret-id')}
									oninput={(event) => {
										const target = event.currentTarget;
										if (target instanceof HTMLInputElement) setDraftSecretId(target.value);
									}}
								/>
							</label>
						{/if}
						{#if originalTrainerEditConstraints.supportsGender}
							<label>
								<span>Gender</span>
								<select
									id="pokemon-editor-trainer-gender"
									value={draftTrainerGenderId}
									disabled={applying}
									onchange={(event) => {
										draftTrainerGenderId = Number(event.currentTarget.value);
									}}
								>
									{#each originalTrainerEditConstraints.genders as option (option.id)}
										<option value={option.id}>{option.name}</option>
									{/each}
								</select>
							</label>
						{/if}
						{#if originalTrainerEditConstraints.supportsLanguage}
							<label>
								<span>Language</span>
								<select
									id="pokemon-editor-pokemon-language"
									value={draftLanguageId}
									disabled={applying}
									onchange={(event) => {
										draftLanguageId = Number(event.currentTarget.value);
									}}
								>
									{#each originalTrainerEditConstraints.languages as option (option.id)}
										<option value={option.id}>{option.name}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
					{#if unsupportedOriginalTrainerFields.length > 0}
						<p class="unsupported-copy">
							This Pokemon Entity format does not support editing:
							{unsupportedOriginalTrainerFields.join(', ')}.
						</p>
					{/if}
				{:else}
					<p class="unsupported-copy">
						{originalTrainerEditConstraints?.unsupportedReason ??
							'Original Trainer Data Editing is not supported for this Pokemon Entity format.'}
					</p>
				{/if}
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

			<div class="editor-panel" aria-label="Friendship Editing">
				<div class="panel-title">
					<span>Friendship</span>
					<small>{canEditFriendship ? 'Editable' : 'Unsupported'}</small>
				</div>
				{#if canEditFriendship}
					<div class="stat-edit-controls">
						{#each friendshipEditConstraints?.fields ?? [] as field (field.key)}
							<label>
								<span>{field.label} ({field.min}-{field.max})</span>
								<input
									id={`pokemon-editor-${field.key}`}
									type="number"
									min={field.min}
									max={field.max}
									step="1"
									value={draftFriendship[field.key]}
									disabled={applying}
									readonly={!isInputEditing(`pokemon-editor-${field.key}`)}
									data-controller-editing={draftInputEditingValue(`pokemon-editor-${field.key}`)}
									onpointerdown={() => activateDraftInput(`pokemon-editor-${field.key}`, false)}
									onclick={() => activateDraftInput(`pokemon-editor-${field.key}`, false)}
									onblur={() => deactivateDraftInput(`pokemon-editor-${field.key}`)}
									onkeydown={(event) =>
										handleDraftInputKeydown(event, `pokemon-editor-${field.key}`)}
									oninput={(event) => {
										const target = event.currentTarget;
										if (target instanceof HTMLInputElement) setFriendship(field.key, target.value);
									}}
								/>
							</label>
						{/each}
					</div>
				{:else}
					<p class="unsupported-copy">
						{friendshipEditConstraints?.unsupportedReason ??
							'Friendship Editing is not supported for this Pokemon format.'}
					</p>
				{/if}
			</div>

			<div class="editor-panel" aria-label="Move Set Editing">
				<div class="panel-title">
					<span>Move Set</span>
					<small>{canEditMoveSet ? 'Editable' : 'Unsupported'}</small>
				</div>
				{#if canEditMoveSet}
					<div class="move-edit-controls">
						{#each draftMoves as move, index (index)}
							{@const maxPp = maxPpForMove(move)}
							<div class="move-edit-row">
								<div class="move-picker-field">
									<span id={`pokemon-editor-move-${index}-label`}>Move {index + 1}</span>
									<Combobox
										id={`pokemon-editor-move-${index}`}
										labelledBy={`pokemon-editor-move-${index}-label`}
										value={String(move.move)}
										options={moveComboboxOptions}
										placeholder="Empty"
										searchLabel={`Search moves for Move ${index + 1}`}
										searchPlaceholder="Search moves"
										disabled={applying}
										onSelect={(value) => setMove(index, value)}
									/>
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
	.icon-close:focus,
	.close-editor:hover,
	.close-editor:focus-visible,
	.close-editor:focus,
	.unsupported-apply:hover,
	.unsupported-apply:focus-visible,
	.unsupported-apply:focus,
	.pokemon-editor button:focus,
	.pokemon-editor input:focus {
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
	.level-edit-grid,
	.nature-edit-summary {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 7px 12px;
		padding: 10px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.field-grid span,
	.level-edit-grid span,
	.nature-edit-summary span,
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
	.nature-edit-summary strong,
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

	.battle-field-controls {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.battle-field-controls label {
		display: grid;
		gap: 5px;
	}

	.battle-field-controls span,
	.battle-field-controls p {
		margin: 0;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.2;
	}

	.battle-field-controls span {
		text-transform: uppercase;
	}

	.battle-field-controls select {
		width: 100%;
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

	.battle-field-controls select:disabled {
		opacity: 0.55;
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

	.nature-edit-controls,
	.held-item-edit-controls,
	.ability-edit-controls {
		display: grid;
		gap: 5px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.met-data-edit-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.met-data-edit-controls label {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	.met-data-edit-controls span,
	.met-data-hint,
	.nature-edit-controls span,
	.nature-edit-hint,
	.held-item-edit-controls span,
	.held-item-restrictions,
	.ability-edit-controls span,
	.ability-restrictions {
		margin: 0;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		line-height: 1.2;
	}

	.met-data-edit-controls span,
	.nature-edit-controls span,
	.held-item-edit-controls span,
	.ability-edit-controls span {
		text-transform: uppercase;
	}

	.met-data-edit-controls input,
	.met-data-edit-controls select,
	.nature-edit-controls select,
	.held-item-edit-controls select,
	.ability-edit-controls select {
		width: 100%;
		min-width: 0;
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
		font:
			750 0.78rem var(--pksx-font-mono),
			monospace;
	}

	.met-data-edit-controls input:disabled,
	.met-data-edit-controls select:disabled,
	.nature-edit-controls select:disabled,
	.held-item-edit-controls select:disabled,
	.ability-edit-controls select:disabled {
		opacity: 0.55;
	}

	.ability-restrictions {
		padding: 0 12px 0 28px;
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

	.species-form-controls {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: 12px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.species-form-controls label,
	.species-form-preview {
		display: grid;
		gap: 5px;
	}

	.species-form-controls span,
	.species-form-preview span {
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		text-transform: uppercase;
	}

	.species-form-controls select {
		min-width: 0;
		height: 44px;
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
	}

	.species-form-preview {
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.species-form-preview p,
	.species-form-preview ul {
		margin: 0;
	}

	.species-form-preview ul {
		display: grid;
		gap: 4px;
		padding-left: 18px;
	}

	.species-form-preview .illegal {
		color: var(--rust);
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
	.trainer-edit-controls,
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

	.trainer-edit-controls {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.trainer-name-field {
		grid-column: 1 / -1;
	}

	.move-edit-row {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) 74px 84px;
		gap: 8px;
		align-items: start;
	}

	.stat-edit-controls label,
	.trainer-edit-controls label,
	.move-edit-controls label,
	.move-picker-field {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	.stat-edit-controls label span,
	.trainer-edit-controls label span,
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
	.trainer-edit-controls input,
	.trainer-edit-controls select,
	.move-edit-controls input {
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

	.stat-edit-controls input:disabled,
	.trainer-edit-controls input:disabled,
	.trainer-edit-controls select:disabled,
	.move-edit-controls input:disabled {
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

	@media (max-width: 1024px) {
		.pokemon-editor {
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			width: auto;
			max-height: none;
			border-radius: 0;
			transform: none;
			padding: calc(14px + env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right))
				calc(14px + env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left));
		}

		.editor-body {
			overflow-y: auto;
		}
	}

	@media (max-width: 720px) {
		.editor-body {
			grid-template-columns: 1fr;
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

		.species-form-controls {
			grid-template-columns: 1fr;
		}

		.met-data-edit-controls,
		.stat-edit-controls,
		.move-edit-row {
			grid-template-columns: 1fr 1fr;
		}

		.move-edit-row .move-picker-field {
			grid-column: 1 / -1;
		}
	}
</style>
