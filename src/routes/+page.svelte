<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import {
		base64ToBytes,
		type EngineApi,
		type EngineError,
		type PartySlotSummary,
		type BoxSlotSummary,
		type SaveSlotRef,
		type SlotOperation
	} from '$lib/engine';
	import {
		applyNavigationAction,
		BOX_COLUMNS,
		BOX_SLOT_COUNT,
		createInitialNavigationState,
		focusBoxSlot,
		focusPartySlot,
		getBoxSlotPosition,
		getFocusId,
		PARTY_SLOT_COUNT,
		selectActiveBox,
		type BoxNavigationState,
		type NavigationAction,
		type SlotFocus
	} from '$lib/pksx/box-navigation';
	import {
		createCleanWorkspaceState,
		markAutomaticBackupCreated,
		shouldCreateAutomaticBackup,
		type WorkspaceState
	} from '$lib/pksx/backup-workflow';
	import { updateAppChrome } from '$lib/pksx/app-chrome.svelte';
	import { resolveSpriteCatalogEntry } from '$lib/pksx/sprite-catalog';
	import {
		getCachedActiveWorkspaceBox,
		getLocalLibraryStorage,
		getPkhexEngine,
		invalidateSaveLibraryCache,
		loadActiveWorkspaceFromLibrary,
		setCachedActiveWorkspace
	} from '$lib/pksx/save-library-cache';
	import BoxSidebar from '$lib/components/pksx/BoxSidebar.svelte';
	import BoxSourceControls from '$lib/components/pksx/BoxSourceControls.svelte';
	import ClearSlotConfirm from '$lib/components/pksx/ClearSlotConfirm.svelte';
	import DetailRail from '$lib/components/pksx/DetailRail.svelte';
	import PokemonEditor from '$lib/components/pksx/PokemonEditor.svelte';
	import SlotActionMenu from '$lib/components/pksx/SlotActionMenu.svelte';
	import StatusStrip from '$lib/components/pksx/StatusStrip.svelte';
	import StorageSlot from '$lib/components/pksx/StorageSlot.svelte';
	import ToastRegion from '$lib/components/pksx/ToastRegion.svelte';
	import type { BoxNavItem, BoxSourceView, SlotView } from '$lib/components/pksx/types';
	import {
		applyPokemonEditorEdits,
		cancelPokemonEditor,
		createPokemonEditOperation,
		createPokemonEditorState,
		isSamePokemonEditorSourceIdentity,
		stageLevelExperienceEdit,
		type LevelExperienceEditPayload,
		type PokemonEditorState
	} from '$lib/pksx/pokemon-editor';

	type ToastView = {
		id: string;
		tone: 'info' | 'success' | 'error';
		message: string;
	};

	type PendingSlotOperation = {
		kind: 'move' | 'copy';
		source: SaveSlotRef;
		sourceLabel: string;
		sourcePokemonLabel: string;
	};

	type ClearSlotConfirmation = {
		source: SaveSlotRef;
		location: string;
		pokemonLabel: string;
	};

	const placeholderBoxCount = 3;
	const storage = getLocalLibraryStorage();

	const slotPalette = [16, 28, 48, 100, 140, 180, 195, 210, 220, 260, 280, 295, 330, 52];
	const mobileTabCount = 2;

	function fallbackSlotHue(box: number, slot: number, speciesId: number | null): number {
		const seed = speciesId && speciesId > 0 ? speciesId : slot * 31 + box * 7;
		return slotPalette[seed % slotPalette.length];
	}

	function fallbackSlotHueSecondary(
		box: number,
		slot: number,
		speciesId: number | null
	): number | null {
		const seed = speciesId && speciesId > 0 ? speciesId : slot * 31 + box * 7;
		if (seed % 3 !== 0) return null;
		const offset = ((seed * 7) % (slotPalette.length - 1)) + 1;
		return slotPalette[(seed + offset) % slotPalette.length];
	}

	function slotTypeHues(
		slot: SlotView,
		box: number
	): {
		primaryHue: number;
		primaryChroma: number;
		secondaryHue: number | null;
		secondaryChroma: number;
	} {
		const [primaryType, secondaryType] = slot.kind === 'pokemon' ? (slot.types ?? []) : [];
		const primaryHue =
			typeof primaryType?.hue === 'number'
				? primaryType.hue
				: fallbackSlotHue(box, slot.slot, slot.speciesId);
		const primaryChroma = primaryType?.chroma ?? 0.09;
		const secondaryHue =
			typeof secondaryType?.hue === 'number' && secondaryType.hue !== primaryHue
				? secondaryType.hue
				: slot.kind === 'pokemon' && primaryType
					? null
					: fallbackSlotHueSecondary(box, slot.slot, slot.speciesId);
		const secondaryChroma = secondaryType?.chroma ?? primaryChroma;

		return { primaryHue, primaryChroma, secondaryHue, secondaryChroma };
	}

	function slotStyle(slot: SlotView, box: number): string {
		const { primaryHue, primaryChroma, secondaryHue, secondaryChroma } = slotTypeHues(slot, box);
		if (secondaryHue === null) {
			return `--slot-hue: ${primaryHue}; --slot-chroma: ${primaryChroma}`;
		}
		return `--slot-hue: ${primaryHue}; --slot-chroma: ${primaryChroma}; --slot-hue-2: ${secondaryHue}; --slot-chroma-2: ${secondaryChroma}`;
	}

	function slotHasDualType(slot: SlotView, box: number): boolean {
		return slot.kind === 'pokemon' && slotTypeHues(slot, box).secondaryHue !== null;
	}

	function boxHue(box: number): number {
		return slotPalette[box % slotPalette.length];
	}

	function boxNameFor(box: number): string {
		return `Box ${String(box + 1).padStart(2, '0')}`;
	}

	const placeholderPokemonDetails = {
		gender: '♂',
		nature: 'Modest',
		ability: 'Static',
		heldItem: 'Light Ball',
		types: [{ name: 'Electric', hue: 94, chroma: 0.16 }],
		stats: [
			{ key: 'HP', label: 'HP', value: 20, max: 31, ev: 0 },
			{ key: 'ATK', label: 'ATK', value: 12, max: 31, ev: 0 },
			{ key: 'DEF', label: 'DEF', value: 10, max: 31, ev: 0 },
			{ key: 'SPA', label: 'SPA', value: 15, max: 31, ev: 0 },
			{ key: 'SPD', label: 'SPD', value: 12, max: 31, ev: 0 },
			{ key: 'SPE', label: 'SPE', value: 18, max: 31, ev: 0 }
		],
		moves: [
			{ name: 'Thunder Shock', type: 'Electric', hue: 94, chroma: 0.16, pp: 30 },
			{ name: 'Quick Attack', type: 'Normal', hue: 107, chroma: 0.06, pp: 30 },
			{ name: 'Tail Whip', type: 'Normal', hue: 107, chroma: 0.06, pp: 30 },
			{ name: 'Growl', type: 'Normal', hue: 107, chroma: 0.06, pp: 40 }
		],
		originalTrainer: 'PKSX',
		metLabel: 'Starter Box',
		spriteIdentity: {
			speciesId: 25,
			form: 0,
			isEgg: false,
			isShiny: false,
			displaySex: 'default'
		}
	} satisfies Partial<SlotView>;

	const placeholderPartySlots: SlotView[] = Array.from({ length: PARTY_SLOT_COUNT }, (_, slot) => ({
		slot,
		label: slot === 0 ? 'Pikachu' : 'Empty',
		detail: slot === 0 ? 'Lv. 5' : '',
		level: slot === 0 ? 5 : null,
		experience: slot === 0 ? 125 : null,
		experienceProjection:
			slot === 0
				? {
						minLevel: 1,
						maxLevel: 100,
						minExperience: 0,
						maxExperience: 1_000_000,
						currentLevelMinExperience: 125,
						nextLevelMinExperience: 216,
						currentLevelProgress: 0
					}
				: null,
		speciesId: slot === 0 ? 25 : null,
		form: slot === 0 ? 0 : null,
		isEgg: false,
		spriteIdentity: null,
		kind: slot === 0 ? 'pokemon' : 'empty',
		...(slot === 0 ? placeholderPokemonDetails : {})
	}));

	const placeholderBoxSlotsByBox: SlotView[][] = Array.from(
		{ length: placeholderBoxCount },
		(_, box) =>
			Array.from({ length: BOX_SLOT_COUNT }, (_, slot) => {
				const featured = box === 0 && slot === 0;
				return {
					slot,
					label: featured ? 'Pikachu' : 'Empty',
					detail: featured ? 'Lv. 5' : '',
					level: featured ? 5 : null,
					experience: featured ? 125 : null,
					experienceProjection: featured
						? {
								minLevel: 1,
								maxLevel: 100,
								minExperience: 0,
								maxExperience: 1_000_000,
								currentLevelMinExperience: 125,
								nextLevelMinExperience: 216,
								currentLevelProgress: 0
							}
						: null,
					speciesId: featured ? 25 : null,
					form: featured ? 0 : null,
					isEgg: false,
					spriteIdentity: null,
					kind: featured ? ('pokemon' as const) : ('empty' as const),
					...(featured ? placeholderPokemonDetails : {})
				};
			})
	);

	let navigation = $state<BoxNavigationState>(createInitialNavigationState(placeholderBoxCount));
	let gamepadStatus = $state('No controller detected');
	let loadedSave = $state<WorkspaceState | null>(null);
	let importError = $state<string | null>(null);
	let statusMessage = $state('Import a Save File to begin.');
	let busy = $state(false);
	let pokemonEditor = $state<PokemonEditorState | null>(null);
	let pokemonEditorFeedback = $state<string | null>(null);
	let partyCollapsed = $state(false);
	let actionSurfaceTop = $state<number | null>(null);
	let viewportWidth = $state(1024);
	let pendingSlotOperation = $state<PendingSlotOperation | null>(null);
	let clearSlotConfirmation = $state<ClearSlotConfirmation | null>(null);
	let clearSlotConfirmFocusIndex = $state(0);
	let toasts = $state<ToastView[]>([]);
	let nextToastId = 1;
	let engine: EngineApi | null = null;
	let workspaceLoadRequest = 0;

	const controllerConnected = $derived(
		gamepadStatus !== 'No controller detected' && gamepadStatus.length > 0
	);
	const mobileTabsAvailable = $derived(viewportWidth <= 820);
	const boxCount = $derived(loadedSave?.workspace.summary.boxCount ?? placeholderBoxCount);
	const partySlots = $derived(
		loadedSave ? createPartySlotViews(loadedSave.workspace.partySlots) : placeholderPartySlots
	);
	const activeBoxSlots = $derived(
		loadedSave
			? createBoxSlotViews(loadedSave.workspace.boxSlots)
			: placeholderBoxSlotsByBox[navigation.activeBox]
	);
	const activeFocusId = $derived(getFocusId(navigation.focus, navigation.activeBox));
	const activeSlotFocus = $derived<SlotFocus>(
		navigation.focus.zone === 'party' || navigation.focus.zone === 'box'
			? navigation.focus
			: (navigation.actionOrigin ?? { zone: 'box', slot: 0 })
	);
	const focusedSlot = $derived(
		activeSlotFocus.zone === 'party'
			? partySlots[activeSlotFocus.slot]
			: activeBoxSlots[activeSlotFocus.slot]
	);
	const saveSummary = $derived(loadedSave?.workspace.summary ?? null);
	const boxIndices = $derived(Array.from({ length: boxCount }, (_, index) => index));
	const boxNavItems = $derived<BoxNavItem[]>(
		boxIndices.map((index) => ({
			index,
			name: boxNameFor(index),
			hue: boxHue(index),
			active: index === navigation.activeBox,
			occupied:
				index === navigation.activeBox
					? activeBoxSlots.filter((slot) => slot.kind === 'pokemon').length
					: null
		}))
	);
	const visibleBoxSlots = $derived(
		activeBoxSlots.length >= BOX_SLOT_COUNT
			? activeBoxSlots.slice(0, BOX_SLOT_COUNT)
			: [
					...activeBoxSlots,
					...Array.from({ length: BOX_SLOT_COUNT - activeBoxSlots.length }, (_, index) => ({
						slot: activeBoxSlots.length + index,
						label: 'Empty',
						detail: '',
						level: null,
						experience: null,
						experienceProjection: null,
						speciesId: null,
						form: null,
						isEgg: false,
						spriteIdentity: null,
						kind: 'empty' as const
					}))
				]
	);
	const activeBoxSource = $derived<BoxSourceView>({
		key: 'save-file',
		label: 'Save File',
		activeBoxLabel: boxNameFor(navigation.activeBox),
		activeBoxNumber: navigation.activeBox + 1,
		boxCount,
		occupied: activeBoxSlots.filter((slot) => slot.kind === 'pokemon').length,
		capacity: BOX_SLOT_COUNT
	});
	const activeSlotPositionLabel = $derived(
		activeSlotFocus.zone === 'box'
			? (() => {
					const position = getBoxSlotPosition(activeSlotFocus.slot);
					return `${boxNameFor(navigation.activeBox)} · Slot ${activeSlotFocus.slot + 1} · Row ${String.fromCharCode(65 + position.row)} / Col ${position.column + 1}`;
				})()
			: `Party · Slot ${activeSlotFocus.slot + 1}`
	);

	$effect(() => {
		updateAppChrome({
			route: 'boxes',
			saveSummary,
			boxCount,
			activeBox: navigation.activeBox,
			fileName: loadedSave?.file.originalFileName ?? null,
			busy,
			hasLoadedSave: loadedSave !== null,
			controllerInputActive: true,
			importSave: (file) => void importSaveFile(file),
			exportSave: exportLoadedSave
		});

		return () => {
			updateAppChrome({ controllerInputActive: false });
		};
	});

	function dispatch(action: NavigationAction) {
		if (clearSlotConfirmation) {
			dispatchClearSlotConfirmation(action);
			return;
		}

		if (pokemonEditor) {
			dispatchPokemonEditor(action);
			return;
		}

		if (pendingSlotOperation && action === 'back') {
			cancelPendingSlotOperation();
			return;
		}

		if (pendingSlotOperation && action === 'confirm' && isSlotFocus(navigation.focus)) {
			void completePendingSlotOperation(slotRefForFocus(navigation.focus));
			return;
		}

		const previousFocus = navigation.focus;
		const previousBox = navigation.activeBox;
		navigation = applyNavigationAction(navigation, action, {
			actionCount: getActionCountForFocusedSlot(),
			topControlCount: 5,
			mobileTabCount,
			mobileTabsAvailable
		});

		if (action === 'confirm') {
			activateFocusedControl(previousFocus);
		}

		if (loadedSave && navigation.activeBox !== previousBox) {
			void loadWorkspaceForSave(loadedSave, navigation.activeBox);
		}

		queueMicrotask(focusActiveControl);
		void updateActionSurfaceAnchor();
	}

	function focusActiveControl() {
		document.getElementById(activeFocusId)?.focus();
	}

	function dispatchPokemonEditor(action: NavigationAction) {
		switch (action) {
			case 'left':
			case 'up':
				focusPokemonEditorControl(-1);
				break;
			case 'right':
			case 'down':
				focusPokemonEditorControl(1);
				break;
			case 'confirm':
				activatePokemonEditorControl();
				break;
			case 'back':
				closePokemonEditor();
				break;
			case 'previousBox':
			case 'nextBox':
				break;
		}
	}

	function pokemonEditorControls() {
		return [
			'#pokemon-editor-close',
			'#pokemon-editor-mode',
			'.level-edit-controls input:not([disabled])',
			'#pokemon-editor-apply',
			'#pokemon-editor-cancel',
			'#pokemon-editor-close-footer'
		]
			.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
			.filter((control) => {
				if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
					return !control.disabled;
				}
				return true;
			});
	}

	function focusPokemonEditorControl(direction: -1 | 1) {
		const controls = pokemonEditorControls();
		if (controls.length === 0) {
			return;
		}

		const activeElement = document.activeElement;
		const currentIndex =
			activeElement instanceof HTMLElement ? controls.indexOf(activeElement) : -1;
		const nextIndex =
			currentIndex >= 0
				? (currentIndex + direction + controls.length) % controls.length
				: direction > 0
					? 0
					: controls.length - 1;

		const control = controls[nextIndex];
		control.focus();
		control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function activatePokemonEditorControl() {
		const activeElement = document.activeElement;
		if (activeElement instanceof HTMLButtonElement && !activeElement.disabled) {
			activeElement.click();
		}
	}

	function isSlotFocus(focus: typeof navigation.focus): focus is SlotFocus {
		return focus.zone === 'party' || focus.zone === 'box';
	}

	function dispatchClearSlotConfirmation(action: NavigationAction) {
		switch (action) {
			case 'left':
			case 'up':
				focusClearSlotCommand(clearSlotConfirmFocusIndex - 1);
				break;
			case 'right':
			case 'down':
				focusClearSlotCommand(clearSlotConfirmFocusIndex + 1);
				break;
			case 'confirm':
				if (clearSlotConfirmFocusIndex === 0) {
					cancelClearSlot();
				} else {
					confirmClearSlot();
				}
				break;
			case 'back':
				cancelClearSlot();
				break;
			case 'previousBox':
			case 'nextBox':
				break;
		}
	}

	function handleAppKeydown(event: KeyboardEvent) {
		const action = keyboardAction(event);

		if (!action) {
			return;
		}

		if (pokemonEditor && isNativeEditorActivation(event, action)) {
			return;
		}

		event.preventDefault();
		if (pokemonEditor) {
			dispatch(action);
			return;
		}

		dispatch(action);
	}

	function keyboardAction(event: KeyboardEvent): NavigationAction | null {
		switch (event.key) {
			case 'ArrowUp':
				return 'up';
			case 'ArrowDown':
				return 'down';
			case 'ArrowLeft':
				return 'left';
			case 'ArrowRight':
				return 'right';
			case 'Enter':
			case ' ':
				return 'confirm';
			case 'Escape':
			case 'Backspace':
				return 'back';
			case '[':
			case 'PageUp':
				return 'previousBox';
			case ']':
			case 'PageDown':
				return 'nextBox';
			default:
				return null;
		}
	}

	function isNativeEditorActivation(event: KeyboardEvent, action: NavigationAction) {
		const target = event.target;
		if (!(target instanceof Element)) {
			return false;
		}

		if (target.closest('.pokemon-editor input, .pokemon-editor select, .pokemon-editor textarea')) {
			return action === 'confirm' || action === 'back';
		}

		return action === 'confirm' && target.closest('.pokemon-editor button');
	}

	function focusParty(slot: number) {
		navigation = { ...navigation, focus: focusPartySlot(slot) };
		queueMicrotask(focusActiveControl);
	}

	function focusBox(slot: number) {
		navigation = { ...navigation, focus: focusBoxSlot(slot) };
		queueMicrotask(focusActiveControl);
	}

	function selectBox(index: number) {
		const previousBox = navigation.activeBox;
		navigation = selectActiveBox(navigation, index);

		if (loadedSave && navigation.activeBox !== previousBox) {
			void loadWorkspaceForSave(loadedSave, navigation.activeBox);
		}

		queueMicrotask(focusActiveControl);
	}

	function openFocusedSlot() {
		dispatch('confirm');
	}

	function closeActionSurface() {
		pokemonEditor = null;
		pokemonEditorFeedback = null;
		dispatch('back');
	}

	function slotRefForFocus(focus: SlotFocus = activeSlotFocus): SaveSlotRef {
		return focus.zone === 'party'
			? { zone: 'party', slot: focus.slot }
			: { zone: 'box', box: navigation.activeBox, slot: focus.slot };
	}

	function slotRefKey(ref: SaveSlotRef): string {
		return ref.zone === 'party' ? `party:${ref.slot}` : `box:${ref.box}:${ref.slot}`;
	}

	function locationForSlotRef(ref: SaveSlotRef): string {
		return ref.zone === 'party'
			? `Party Slot ${ref.slot + 1}`
			: `${boxNameFor(ref.box)} Slot ${ref.slot + 1}`;
	}

	function slotForRef(ref: SaveSlotRef): SlotView | null {
		if (ref.zone === 'party') {
			return partySlots[ref.slot] ?? null;
		}

		if (ref.box !== navigation.activeBox) {
			return null;
		}

		return visibleBoxSlots[ref.slot] ?? null;
	}

	function destinationStateFor(
		ref: SaveSlotRef,
		slot: SlotView
	): 'valid' | 'invalid' | 'source' | null {
		if (!pendingSlotOperation) {
			return null;
		}

		if (slotRefKey(ref) === slotRefKey(pendingSlotOperation.source)) {
			return 'source';
		}

		if (pendingSlotOperation.kind === 'copy' && slot.kind === 'pokemon') {
			return 'invalid';
		}

		if (isInvalidPartyAppendDestination(ref, slot)) {
			return 'invalid';
		}

		return 'valid';
	}

	function isInvalidPartyAppendDestination(ref: SaveSlotRef, slot: SlotView | null): boolean {
		return (
			ref.zone === 'party' &&
			slot?.kind === 'empty' &&
			loadedSave !== null &&
			ref.slot > loadedSave.workspace.summary.partyCount
		);
	}

	async function completePendingSlotOperation(destination: SaveSlotRef) {
		if (!pendingSlotOperation) {
			return;
		}

		const pending = pendingSlotOperation;
		const destinationSlot = slotForRef(destination);

		if (slotRefKey(pending.source) === slotRefKey(destination)) {
			pendingSlotOperation = null;
			statusMessage = 'No Slot change made.';
			queueMicrotask(focusActiveControl);
			return;
		}

		if (pending.kind === 'copy' && destinationSlot?.kind === 'pokemon') {
			showToast('error', 'Copy needs an empty destination Slot.');
			statusMessage = 'Copy needs an empty destination Slot.';
			return;
		}

		if (isInvalidPartyAppendDestination(destination, destinationSlot)) {
			showToast('error', 'That Party Slot cannot be used yet.');
			statusMessage = 'That Party Slot cannot be used yet.';
			return;
		}

		await applySlotOperation({
			kind: pending.kind,
			source: pending.source,
			destination
		});
	}

	async function applySlotOperation(operation: SlotOperation) {
		if (!loadedSave) {
			showToast('error', 'Load a Save File before changing Slots.');
			return;
		}

		const activeEngine = engine;
		if (!activeEngine) {
			showToast('error', 'The PKHeX Engine is not ready.');
			return;
		}

		busy = true;
		importError = null;

		try {
			const sourceSlot = slotForRef(operation.source);
			if (sourceSlot !== null && sourceSlot.kind !== 'pokemon') {
				showToast('error', 'Move, Copy, and Clear Slot need an occupied source Slot.');
				statusMessage = 'Slot change failed.';
				return;
			}

			const moveWasSwap =
				operation.kind === 'move' && slotForRef(operation.destination)?.kind === 'pokemon';
			let workingState = loadedSave;
			if (shouldCreateAutomaticBackup(workingState)) {
				statusMessage = 'Creating Backup...';
				await storage.createBackup({
					saveFileId: workingState.file.id,
					bytes: workingState.bytes,
					reason: 'pokemon-movement'
				});
				workingState = markAutomaticBackupCreated(workingState);
				loadedSave = workingState;
			}

			statusMessage = 'Applying Slot change...';
			const result = await activeEngine.applySlotOperation(
				workingState.bytes,
				workingState.file.originalFileName ?? undefined,
				operation,
				navigation.activeBox
			);

			if (!result.ok) {
				throw result.error;
			}

			const nextState: WorkspaceState = {
				...workingState,
				bytes: result.value.bytes,
				workspace: result.value.workspace,
				dirty: workingState.dirty || result.value.mutated,
				restoredFromBackup: null
			};
			if (nextState.dirty) {
				await persistWorkspace(nextState);
			}
			loadedSave = nextState;
			setCachedActiveWorkspace(nextState, navigation.activeBox);
			invalidateSaveLibraryCache();
			pendingSlotOperation = null;
			const focusRef = operation.kind === 'clear' ? operation.source : operation.destination;
			navigation = {
				...navigation,
				activeBox: focusRef.zone === 'box' ? focusRef.box : navigation.activeBox,
				boxCount: Math.max(1, result.value.workspace.summary.boxCount),
				focus:
					focusRef.zone === 'party' ? focusPartySlot(focusRef.slot) : focusBoxSlot(focusRef.slot),
				actionSurfaceOpen: false,
				actionOrigin: null
			};
			statusMessage = successMessageForSlotOperation(operation, moveWasSwap);
			queueMicrotask(focusActiveControl);
		} catch (error) {
			const message = getErrorMessage(error);
			importError = null;
			statusMessage = 'Slot change failed.';
			showToast('error', message);
		} finally {
			busy = false;
		}
	}

	function successMessageForSlotOperation(operation: SlotOperation, moveWasSwap = false): string {
		if (operation.kind === 'clear') {
			return `Cleared ${locationForSlotRef(operation.source)}.`;
		}

		if (operation.kind === 'copy') {
			return `Copied to ${locationForSlotRef(operation.destination)}.`;
		}

		return moveWasSwap
			? `Swapped with ${locationForSlotRef(operation.destination)}.`
			: `Moved to ${locationForSlotRef(operation.destination)}.`;
	}

	function beginPendingSlotOperation(kind: 'move' | 'copy') {
		const source = slotRefForFocus();
		const slot = focusedSlot;

		if (slot.kind !== 'pokemon') {
			return;
		}

		pendingSlotOperation = {
			kind,
			source,
			sourceLabel: locationForSlotRef(source),
			sourcePokemonLabel: slot.label
		};
		pokemonEditor = null;
		pokemonEditorFeedback = null;
		navigation = {
			...navigation,
			actionSurfaceOpen: false,
			actionOrigin: null,
			focus: activeSlotFocus
		};
		queueMicrotask(focusActiveControl);
	}

	function cancelPendingSlotOperation() {
		if (!pendingSlotOperation) {
			return;
		}

		const source = pendingSlotOperation.source;
		pendingSlotOperation = null;
		navigation = {
			...navigation,
			focus: source.zone === 'party' ? focusPartySlot(source.slot) : focusBoxSlot(source.slot)
		};
		statusMessage = 'Slot action cancelled.';
		queueMicrotask(focusActiveControl);
	}

	function requestClearFocusedSlot() {
		const source = slotRefForFocus();
		const slot = focusedSlot;

		if (slot.kind !== 'pokemon') {
			return;
		}

		clearSlotConfirmation = {
			source,
			location: locationForSlotRef(source),
			pokemonLabel: slot.label
		};
		clearSlotConfirmFocusIndex = 0;
		pokemonEditor = null;
		pokemonEditorFeedback = null;
		navigation = {
			...navigation,
			actionSurfaceOpen: false,
			actionOrigin: null,
			focus: activeSlotFocus
		};
		queueMicrotask(focusClearSlotConfirmation);
	}

	async function focusClearSlotConfirmation() {
		await tick();
		document.getElementById(`clear-confirm-${clearSlotConfirmFocusIndex}`)?.focus();
	}

	function focusClearSlotCommand(index: number) {
		clearSlotConfirmFocusIndex = Math.max(0, Math.min(index, 1));
		queueMicrotask(focusClearSlotConfirmation);
	}

	function setClearSlotCommandFocus(index: number) {
		clearSlotConfirmFocusIndex = Math.max(0, Math.min(index, 1));
	}

	function cancelClearSlot() {
		clearSlotConfirmation = null;
		clearSlotConfirmFocusIndex = 0;
		queueMicrotask(focusActiveControl);
	}

	function confirmClearSlot() {
		if (!clearSlotConfirmation) {
			return;
		}

		void applySlotOperation({ kind: 'clear', source: clearSlotConfirmation.source });
		clearSlotConfirmation = null;
		clearSlotConfirmFocusIndex = 0;
	}

	function showToast(tone: ToastView['tone'], message: string) {
		const id = `toast-${nextToastId}`;
		nextToastId += 1;
		toasts = [...toasts, { id, tone, message }].slice(-3);
		setTimeout(() => dismissToast(id), tone === 'error' ? 5200 : 3400);
	}

	function dismissToast(id: string) {
		toasts = toasts.filter((toast) => toast.id !== id);
	}

	function focusActionCommand(index: number) {
		navigation = { ...navigation, focus: { zone: 'actions', index } };
		queueMicrotask(focusActiveControl);
	}

	function getActionCountForFocusedSlot() {
		const slot = focusedSlot;
		return slot.kind === 'pokemon' ? 8 : 6;
	}

	function activateFocusedControl(focus = navigation.focus) {
		if (focus.zone === 'topbar') {
			document.getElementById(`top-control-${focus.index}`)?.click();
		}

		if (focus.zone === 'mobileTabs') {
			document.getElementById(`mobile-tab-${focus.index}`)?.click();
		}

		if (focus.zone === 'actions') {
			const commands =
				focusedSlot.kind === 'pokemon'
					? [
							'pokemon-action',
							'move',
							'copy',
							'clear',
							'export',
							'legality-check',
							'create-pokemon'
						]
					: ['create-pokemon', 'move', 'copy', 'export', 'legality-check'];
			const command = commands[focus.index];
			if (command) {
				selectSlotActionCommand(command);
			}
		}
	}

	function selectSlotActionCommand(command: string) {
		switch (command) {
			case 'pokemon-action':
				openPokemonEditor();
				break;
			case 'move':
				beginPendingSlotOperation('move');
				break;
			case 'copy':
				beginPendingSlotOperation('copy');
				break;
			case 'clear':
				requestClearFocusedSlot();
				break;
			default:
				break;
		}
	}

	function openPokemonEditor() {
		if (!navigation.actionSurfaceOpen || focusedSlot.kind !== 'pokemon') {
			return;
		}

		const result = createPokemonEditorState(
			{
				owner: 'save-file',
				saveFileId: loadedSave?.file.id ?? null,
				slotRef: slotRefForFocus(),
				location: activeSlotPositionLabel
			},
			focusedSlot
		);

		if (!result.ok) {
			statusMessage = result.reason;
			return;
		}

		pokemonEditor = result.state;
		pokemonEditorFeedback = null;
		queueMicrotask(focusPokemonEditorClose);
	}

	function closePokemonEditor() {
		pokemonEditor = null;
		pokemonEditorFeedback = null;
		navigation = { ...navigation, focus: { zone: 'actions', index: 0 } };
		queueMicrotask(focusActiveControl);
	}

	function focusPokemonEditorClose() {
		document.getElementById('pokemon-editor-close')?.focus();
	}

	function focusPokemonEditorApply() {
		const apply = document.getElementById('pokemon-editor-apply');
		if (apply instanceof HTMLButtonElement && !apply.disabled) {
			apply.focus();
			return;
		}

		focusPokemonEditorClose();
	}

	function stagePokemonEditorLevelExperience(payload: LevelExperienceEditPayload) {
		if (!pokemonEditor) {
			return;
		}

		pokemonEditor = stageLevelExperienceEdit(pokemonEditor, payload);
		pokemonEditorFeedback = pokemonEditor.applyOutcome.message;
	}

	function cancelPokemonEditorEdits() {
		if (!pokemonEditor) {
			return;
		}

		pokemonEditor = cancelPokemonEditor(pokemonEditor);
		pokemonEditorFeedback = null;
		queueMicrotask(focusPokemonEditorApply);
	}

	async function applyPokemonEditor() {
		const editor = pokemonEditor;
		if (!editor) {
			return;
		}

		busy = true;
		pokemonEditorFeedback = 'Applying Pokemon edits...';

		try {
			const result = await applyPokemonEditorEdits(editor, {
				verifySource: async (state) => ({
					ok:
						state.source.owner === 'save-file' &&
						isSamePokemonEditorSourceIdentity(state, slotForRef(state.source.slotRef))
				}),
				validate: async (state) => {
					const operation = createPokemonEditOperation(state);
					return operation.ok ? { ok: true } : operation;
				},
				ensureSaveFileBackup: async () => {
					if (!loadedSave) {
						return {
							ok: false,
							status: 'failed',
							message: 'Load a Save File before applying Pokemon edits.',
							reason: 'save-file-unavailable'
						};
					}

					if (!shouldCreateAutomaticBackup(loadedSave)) {
						return { ok: true };
					}

					statusMessage = 'Creating Backup...';
					await storage.createBackup({
						saveFileId: loadedSave.file.id,
						bytes: loadedSave.bytes,
						reason: 'pokemon-editing'
					});
					loadedSave = markAutomaticBackupCreated(loadedSave);
					return { ok: true };
				},
				mutateSaveFilePokemon: async (state) => {
					const activeEngine = engine;
					const workingState = loadedSave;
					const operation = createPokemonEditOperation(state);

					if (!operation.ok) {
						return operation;
					}

					if (!workingState) {
						return {
							ok: false,
							status: 'failed',
							message: 'Load a Save File before applying Pokemon edits.',
							reason: 'save-file-unavailable'
						};
					}

					if (!activeEngine) {
						return {
							ok: false,
							status: 'failed',
							message: 'The PKHeX Engine is not ready.',
							reason: 'engine-unavailable'
						};
					}

					statusMessage = 'Applying Pokemon edits...';
					const mutation = await activeEngine.applyPokemonEditOperation(
						workingState.bytes,
						workingState.file.originalFileName ?? undefined,
						operation.operation,
						navigation.activeBox
					);

					if (!mutation.ok) {
						return {
							ok: false,
							status:
								mutation.error.code === 'unsupported-pokemon-edit' ? 'unsupported' : 'rejected',
							message: mutation.error.message,
							reason: mutation.error.code
						};
					}

					const nextState: WorkspaceState = {
						...workingState,
						bytes: mutation.value.bytes,
						workspace: mutation.value.workspace,
						dirty: workingState.dirty || mutation.value.mutated,
						restoredFromBackup: null
					};

					if (nextState.dirty) {
						await persistWorkspace(nextState);
					}

					loadedSave = nextState;
					setCachedActiveWorkspace(nextState, navigation.activeBox);
					invalidateSaveLibraryCache();

					const updatedSlot = slotViewForRefFromWorkspace(
						nextState.workspace,
						operation.operation.source
					);
					if (!updatedSlot) {
						return {
							ok: false,
							status: 'failed',
							message: 'Pokemon edits applied, but the updated Slot projection was unavailable.',
							reason: 'invalid-engine-response'
						};
					}

					return {
						ok: true,
						slot: updatedSlot,
						message: mutation.value.mutated ? 'Pokemon edits applied.' : 'No Pokemon change made.'
					};
				},
				mutateStoragePokemon: async () => ({
					ok: false,
					status: 'unsupported',
					message: 'Pokemon Storage level and experience editing is not available yet.',
					reason: 'storage-unavailable'
				})
			});

			pokemonEditor = result.state;
			pokemonEditorFeedback = result.outcome.message;
			statusMessage = result.outcome.message ?? statusMessage;
			if (result.outcome.status === 'success') {
				showToast('success', result.outcome.message);
			} else if (result.outcome.status !== 'noop') {
				showToast('error', result.outcome.message ?? 'Pokemon edit failed.');
			}
		} catch (error) {
			const message = getErrorMessage(error);
			pokemonEditorFeedback = message;
			statusMessage = 'Pokemon edit failed.';
			showToast('error', message);
		} finally {
			busy = false;
			queueMicrotask(focusPokemonEditorApply);
		}
	}

	async function updateActionSurfaceAnchor() {
		if (!navigation.actionSurfaceOpen) {
			actionSurfaceTop = null;
			return;
		}

		await tick();

		if (!window.matchMedia('(max-width: 820px)').matches) {
			actionSurfaceTop = null;
			return;
		}

		const focusElement = document.getElementById(getFocusId(activeSlotFocus, navigation.activeBox));
		if (!focusElement) {
			actionSurfaceTop = null;
			return;
		}

		const rect = focusElement.getBoundingClientRect();
		actionSurfaceTop = Math.max(12, rect.bottom + 6);
	}

	function handleWindowResize() {
		if (viewportWidth > 820 && navigation.focus.zone === 'mobileTabs') {
			navigation = { ...navigation, focus: focusBoxSlot(BOX_SLOT_COUNT - BOX_COLUMNS + 1) };
			queueMicrotask(focusActiveControl);
		}

		void updateActionSurfaceAnchor();
	}

	function closeActionSurfaceFromOutside(event: PointerEvent) {
		if (!navigation.actionSurfaceOpen) {
			return;
		}

		if (pokemonEditor) {
			return;
		}

		const target = event.target;

		if (!(target instanceof Element)) {
			return;
		}

		if (
			target.closest('.slot-cell, .slot-context, .box-switcher, .party-toggle, .pokemon-editor')
		) {
			return;
		}

		closeActionSurface();
	}

	function isFocused(zone: 'party' | 'box', slot: number) {
		return activeSlotFocus.zone === zone && activeSlotFocus.slot === slot;
	}

	function gamepadNavigation() {
		if (typeof navigator === 'undefined' || typeof requestAnimationFrame === 'undefined') {
			return;
		}

		let previousPressed: NavigationAction[] = [];
		const repeatState: Partial<Record<NavigationAction, number>> = {};
		let frame = 0;

		const repeatDelay = 280;
		const repeatInterval = 110;

		const read = (time: number) => {
			const gamepad = navigator.getGamepads().find((pad) => pad);

			if (!gamepad) {
				gamepadStatus = 'No controller detected';
				frame = requestAnimationFrame(read);
				return;
			}

			gamepadStatus = `${gamepad.id}`;
			const pressed = readGamepadActions(gamepad);

			for (const action of pressed) {
				const repeatable = isDirectional(action);
				const firstPress = !previousPressed.includes(action);
				const nextRepeatAt = repeatState[action] ?? 0;

				if (firstPress || (repeatable && time >= nextRepeatAt)) {
					dispatch(action);
					repeatState[action] = time + (firstPress ? repeatDelay : repeatInterval);
				}
			}

			for (const action of previousPressed) {
				if (!pressed.includes(action)) {
					delete repeatState[action];
				}
			}

			previousPressed = pressed;

			frame = requestAnimationFrame(read);
		};

		frame = requestAnimationFrame(read);

		return () => cancelAnimationFrame(frame);
	}

	function readGamepadActions(gamepad: Gamepad): NavigationAction[] {
		const actions: NavigationAction[] = [];
		const axisX = gamepad.axes[0] ?? 0;
		const axisY = gamepad.axes[1] ?? 0;

		if (isPressed(gamepad, 12) || axisY < -0.55) actions.push('up');
		if (isPressed(gamepad, 13) || axisY > 0.55) actions.push('down');
		if (isPressed(gamepad, 14) || axisX < -0.55) actions.push('left');
		if (isPressed(gamepad, 15) || axisX > 0.55) actions.push('right');
		if (isPressed(gamepad, 0)) actions.push('confirm');
		if (isPressed(gamepad, 1)) actions.push('back');
		if (isPressed(gamepad, 4)) actions.push('previousBox');
		if (isPressed(gamepad, 5)) actions.push('nextBox');

		return actions;
	}

	function isPressed(gamepad: Gamepad, index: number) {
		return gamepad.buttons[index]?.pressed === true;
	}

	function isDirectional(action: NavigationAction) {
		return action === 'up' || action === 'down' || action === 'left' || action === 'right';
	}

	onMount(() => {
		engine = getPkhexEngine();
		void restoreMostRecentSave();
	});

	async function restoreMostRecentSave() {
		busy = true;
		workspaceLoadRequest += 1;
		importError = null;

		try {
			const restored = await loadActiveWorkspaceFromLibrary();
			if (!restored) {
				statusMessage = 'Open Saves to import a Save File.';
				return;
			}

			loadedSave = restored;
			navigation = selectActiveBox(
				createInitialNavigationState(restored.workspace.summary.boxCount),
				Math.min(
					getCachedActiveWorkspaceBox(),
					Math.max(0, restored.workspace.summary.boxCount - 1)
				)
			);
			statusMessage = restored.dirty
				? `${restored.file.originalFileName ?? 'Save File'} restored from Local Library with unexported changes.`
				: `${restored.file.originalFileName ?? 'Save File'} restored from Local Library.`;
		} catch (error) {
			importError = getErrorMessage(error);
			statusMessage = 'Could not restore the most recent Save File.';
		} finally {
			busy = false;
		}
	}

	async function loadWorkspaceForSave(save: WorkspaceState, box: number) {
		const request = (workspaceLoadRequest += 1);
		busy = true;
		importError = null;

		try {
			const workspace = await loadWorkspace(
				save.bytes,
				save.file.originalFileName ?? undefined,
				box
			);
			if (
				request === workspaceLoadRequest &&
				navigation.activeBox === box &&
				loadedSave?.file.id === save.file.id
			) {
				loadedSave = { ...save, workspace };
				setCachedActiveWorkspace(loadedSave, box);
			}
		} catch (error) {
			if (request === workspaceLoadRequest) {
				importError = getErrorMessage(error);
			}
		} finally {
			if (request === workspaceLoadRequest) {
				busy = false;
			}
		}
	}

	async function loadWorkspace(bytes: Uint8Array, fileName: string | undefined, box: number) {
		if (!engine) {
			throw new Error('The PKHeX Engine is not ready.');
		}

		const result = await engine.loadSaveWorkspace(bytes, fileName, box);

		if (!result.ok) {
			throw result.error;
		}

		return result.value;
	}

	async function persistWorkspace(state: WorkspaceState) {
		await storage.putWorkspace({
			saveFileId: state.file.id,
			bytes: state.bytes,
			dirty: state.dirty,
			automaticBackupCreated: state.automaticBackupCreated
		});
	}

	async function importSaveFile(file: File) {
		const request = (workspaceLoadRequest += 1);
		busy = true;
		importError = null;
		statusMessage = `Reading ${file.name}...`;

		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const workspace = await loadWorkspace(bytes, file.name, 0);
			const saveFile = await storage.importSave({ bytes, originalFileName: file.name });
			await storage.clearWorkspace(saveFile.id);

			if (request === workspaceLoadRequest) {
				loadedSave = createCleanWorkspaceState({ file: saveFile, bytes, workspace });
				setCachedActiveWorkspace(loadedSave, 0);
				invalidateSaveLibraryCache();
				navigation = createInitialNavigationState(workspace.summary.boxCount);
				statusMessage = `${file.name} imported and made active.`;
			}
		} catch (error) {
			if (request === workspaceLoadRequest) {
				importError = getErrorMessage(error);
				statusMessage = 'Import failed. Current active Save File was not changed.';
			}
		} finally {
			if (request === workspaceLoadRequest) {
				busy = false;
			}
		}
	}

	async function exportLoadedSave() {
		if (!loadedSave) {
			return;
		}

		busy = true;
		importError = null;
		statusMessage = 'Serializing Save File...';

		try {
			const activeEngine = engine;
			if (!activeEngine) {
				throw new Error('The PKHeX Engine is not ready.');
			}

			const result = await activeEngine.serializeSave(
				loadedSave.bytes,
				loadedSave.file.originalFileName ?? undefined
			);

			if (!result.ok) {
				throw result.error;
			}

			const bytes = base64ToBytes(result.value.bytesBase64, result.value.byteLength);
			downloadBytes(bytes, createExportFileName(loadedSave.file.originalFileName));
			statusMessage = 'Export ready.';
		} catch (error) {
			importError = getErrorMessage(error);
			statusMessage = 'Export failed.';
		} finally {
			busy = false;
		}
	}

	function downloadBytes(bytes: Uint8Array, fileName: string) {
		const downloadBytes = new Uint8Array(bytes.byteLength);
		downloadBytes.set(bytes);
		const url = URL.createObjectURL(
			new Blob([downloadBytes.buffer], { type: 'application/octet-stream' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}

	function createExportFileName(fileName: string | null) {
		if (!fileName) {
			return 'pksx-export.sav';
		}

		const lastDot = fileName.lastIndexOf('.');
		if (lastDot <= 0) {
			return `${fileName}.pksx`;
		}

		return `${fileName.slice(0, lastDot)}.pksx${fileName.slice(lastDot)}`;
	}

	function createPartySlotViews(slots: PartySlotSummary[]): SlotView[] {
		const slotViews = slots.map((slot) => createSlotView(slot));

		while (slotViews.length < PARTY_SLOT_COUNT) {
			const slot = slotViews.length;
			slotViews.push({
				slot,
				label: 'Empty',
				detail: '',
				level: null,
				experience: null,
				experienceProjection: null,
				speciesId: null,
				form: null,
				isEgg: false,
				spriteIdentity: null,
				kind: 'empty'
			});
		}

		return slotViews;
	}

	function createBoxSlotViews(slots: BoxSlotSummary[]): SlotView[] {
		return slots.map((slot) => createSlotView(slot));
	}

	function slotViewForRefFromWorkspace(
		workspace: WorkspaceState['workspace'],
		ref: SaveSlotRef
	): SlotView | null {
		if (ref.zone === 'party') {
			const slot = workspace.partySlots.find((candidate) => candidate.slot === ref.slot);
			return slot ? createSlotView(slot) : null;
		}

		const slot = workspace.boxSlots.find(
			(candidate) => candidate.box === ref.box && candidate.slot === ref.slot
		);
		return slot ? createSlotView(slot) : null;
	}

	function createSlotView(slot: PartySlotSummary | BoxSlotSummary): SlotView {
		return {
			slot: slot.slot,
			label: slot.isEmpty ? 'Empty' : slot.nickname || `Species ${slot.speciesId}`,
			detail: slot.isEmpty ? '' : `Lv. ${slot.level}`,
			level: slot.isEmpty ? null : slot.level,
			experience: slot.isEmpty ? null : slot.experience,
			experienceProjection: slot.isEmpty ? null : slot.experienceProjection,
			speciesId: slot.isEmpty ? null : slot.speciesId,
			form: slot.isEmpty ? null : slot.form,
			isEgg: !slot.isEmpty && slot.isEgg,
			spriteIdentity: slot.isEmpty ? null : slot.spriteIdentity,
			kind: slot.isEmpty ? 'empty' : 'pokemon',
			gender: slot.gender ?? undefined,
			nature: slot.nature ?? undefined,
			ability: slot.ability ?? undefined,
			heldItem: slot.heldItem ?? undefined,
			types: slot.types,
			stats: slot.stats,
			moves: slot.moves,
			originalTrainer: slot.originalTrainer ?? undefined,
			metLabel: slot.metLabel ?? undefined
		};
	}

	function spriteUrlFor(slot: SlotView): string | null {
		const entry = resolveSpriteCatalogEntry(slot.spriteIdentity);
		return entry ? asset(entry.path) : null;
	}

	function getErrorMessage(error: unknown) {
		if (isEngineError(error)) {
			return error.message;
		}

		if (error instanceof Error && error.message.length > 0) {
			return error.message;
		}

		return 'PKSX could not complete the operation.';
	}

	function isEngineError(error: unknown): error is EngineError {
		return (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			'message' in error &&
			typeof error.message === 'string'
		);
	}
</script>

<svelte:head>
	<title>PKSX Atelier</title>
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	onkeydown={handleAppKeydown}
	onpointerdown={closeActionSurfaceFromOutside}
	onresize={handleWindowResize}
/>

<section class="boxes-route" aria-label="Boxes workspace" {@attach gamepadNavigation}>
	{#if importError}
		<StatusStrip variant="error" label="Import error" message={importError} />
	{/if}

	<StatusStrip
		message={busy ? 'Working...' : statusMessage}
		secondary={controllerConnected ? gamepadStatus : null}
	/>

	{#if loadedSave?.dirty}
		<StatusStrip
			label={loadedSave.restoredFromBackup ? 'Restored Workspace' : 'Dirty Workspace'}
			message={loadedSave.restoredFromBackup
				? 'Backup restored. Export or keep it as a separate Save File.'
				: 'Workspace has unexported changes.'}
		/>
	{/if}

	<section class="storage-workspace" aria-label="Party and box storage">
		<BoxSidebar boxes={boxNavItems} boxSlotCount={BOX_SLOT_COUNT} onSelectBox={selectBox} />

		<div class="workspace-column">
			<div
				id="party-grid"
				class={['party-zone', partyCollapsed && 'collapsed']}
				role="grid"
				tabindex="0"
				aria-label="Party"
				aria-activedescendant={navigation.focus.zone === 'party' ? activeFocusId : undefined}
				aria-rowcount={PARTY_SLOT_COUNT}
				aria-colcount="1"
			>
				<div class="zone-header party-header">
					<button
						class="party-toggle"
						type="button"
						aria-expanded={!partyCollapsed}
						aria-controls="party-list"
						onclick={() => (partyCollapsed = !partyCollapsed)}
					>
						<span aria-hidden="true">▾</span>
						<strong>Party</strong>
					</button>
					<span>6 / 6 · on hand</span>
				</div>
				<div id="party-list" class="party-list">
					{#each partySlots as slot (slot.slot)}
						{@const partyRef = { zone: 'party' as const, slot: slot.slot }}
						<div
							class={['slot-cell', isFocused('party', slot.slot) && 'selected']}
							role="row"
							aria-hidden={partyCollapsed ? 'true' : undefined}
						>
							<StorageSlot
								id={`party-slot-${slot.slot}`}
								{slot}
								zone="party"
								focused={isFocused('party', slot.slot)}
								dualType={slotHasDualType(slot, -1)}
								style={slotStyle(slot, -1)}
								rowIndex={slot.slot + 1}
								colIndex={1}
								spriteUrl={spriteUrlFor(slot)}
								collapsed={partyCollapsed}
								destinationState={destinationStateFor(partyRef, slot)}
								onFocusSlot={() => focusParty(slot.slot)}
								onChooseSlot={pendingSlotOperation
									? () => {
											void completePendingSlotOperation(partyRef);
										}
									: undefined}
								onOpenSlot={openFocusedSlot}
							/>
							{#if navigation.actionSurfaceOpen && isFocused('party', slot.slot)}
								<SlotActionMenu
									align="start"
									{slot}
									location={`Party slot ${slot.slot + 1}`}
									mobileTop={actionSurfaceTop}
									activeIndex={navigation.focus.zone === 'actions' ? navigation.focus.index : 0}
									onFocusCommand={focusActionCommand}
									onSelectCommand={selectSlotActionCommand}
									onClose={closeActionSurface}
								/>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div
				id="box-grid"
				class="box-zone"
				role="grid"
				tabindex="0"
				aria-label={`Box ${navigation.activeBox + 1}`}
				aria-activedescendant={navigation.focus.zone === 'box' ? activeFocusId : undefined}
				aria-rowcount="5"
				aria-colcount={BOX_COLUMNS}
			>
				<div class="zone-header box-header">
					<BoxSourceControls
						source={activeBoxSource}
						onPreviousBox={() => dispatch('previousBox')}
						onNextBox={() => dispatch('nextBox')}
					/>
				</div>
				<div class="filter-row" aria-hidden="true">
					<span>compact</span>
					<span>sort · slot</span>
					<span>local</span>
				</div>
				<div class="box-grid">
					{#each visibleBoxSlots as slot (slot.slot)}
						{@const position = getBoxSlotPosition(slot.slot)}
						{@const boxRef = { zone: 'box' as const, box: navigation.activeBox, slot: slot.slot }}
						<div class={['slot-cell', isFocused('box', slot.slot) && 'selected']}>
							<StorageSlot
								id={`box-${navigation.activeBox}-slot-${slot.slot}`}
								{slot}
								zone="box"
								focused={isFocused('box', slot.slot)}
								dualType={slotHasDualType(slot, navigation.activeBox)}
								style={slotStyle(slot, navigation.activeBox)}
								rowIndex={position.row + 1}
								colIndex={position.column + 1}
								spriteUrl={spriteUrlFor(slot)}
								destinationState={destinationStateFor(boxRef, slot)}
								onFocusSlot={() => focusBox(slot.slot)}
								onChooseSlot={pendingSlotOperation
									? () => {
											void completePendingSlotOperation(boxRef);
										}
									: undefined}
								onOpenSlot={openFocusedSlot}
							/>
							{#if navigation.actionSurfaceOpen && isFocused('box', slot.slot)}
								<SlotActionMenu
									align={position.column <= 2
										? 'start'
										: position.column >= BOX_COLUMNS - 3
											? 'end'
											: 'center'}
									vertical={position.row === 0 ? 'top' : 'bottom'}
									{slot}
									location={`Box ${navigation.activeBox + 1}, slot ${slot.slot + 1}`}
									mobileTop={actionSurfaceTop}
									activeIndex={navigation.focus.zone === 'actions' ? navigation.focus.index : 0}
									onFocusCommand={focusActionCommand}
									onSelectCommand={selectSlotActionCommand}
									onClose={closeActionSurface}
								/>
							{/if}
						</div>
					{/each}
				</div>
				<div class="box-footer">
					{#if controllerConnected}
						<span><kbd>A</kbd> Pick</span>
						<span><kbd>X</kbd> Multi</span>
						<span><kbd>Y</kbd> Mark</span>
						<span><kbd>B</kbd> Back</span>
					{/if}
					<strong>
						{#if activeSlotFocus.zone === 'box'}
							{@const pos = getBoxSlotPosition(activeSlotFocus.slot)}
							SLOT {activeSlotFocus.slot + 1} · ROW {String.fromCharCode(65 + pos.row)} / COL
							{pos.column + 1}
						{:else}
							PARTY SLOT {activeSlotFocus.slot + 1}
						{/if}
					</strong>
				</div>
			</div>
		</div>

		<DetailRail
			{focusedSlot}
			focusZone={activeSlotFocus.zone}
			focusSlot={activeSlotFocus.slot}
			slotHueStyle={slotStyle(focusedSlot, navigation.activeBox)}
			spriteUrl={spriteUrlFor(focusedSlot)}
			{saveSummary}
			activeBoxName={boxNameFor(navigation.activeBox)}
			positionLabel={activeSlotPositionLabel}
		/>
	</section>
</section>

{#if pokemonEditor}
	<PokemonEditor
		editor={pokemonEditor}
		{saveSummary}
		spriteUrl={spriteUrlFor(pokemonEditor.slot)}
		slotHueStyle={slotStyle(pokemonEditor.slot, navigation.activeBox)}
		feedback={pokemonEditorFeedback}
		onStageLevelExperience={stagePokemonEditorLevelExperience}
		onApply={applyPokemonEditor}
		onCancelEdits={cancelPokemonEditorEdits}
		onClose={closePokemonEditor}
	/>
{/if}

{#if clearSlotConfirmation}
	<ClearSlotConfirm
		location={clearSlotConfirmation.location}
		pokemonLabel={clearSlotConfirmation.pokemonLabel}
		activeIndex={clearSlotConfirmFocusIndex}
		onFocusCommand={setClearSlotCommandFocus}
		onCancel={cancelClearSlot}
		onConfirm={confirmClearSlot}
	/>
{/if}

<ToastRegion {toasts} onDismiss={dismissToast} />

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: var(--pksx-color-surface-canvas);
		color: var(--pksx-color-text-primary);
		font-family: var(--pksx-font-sans);
		font-weight: 500;
	}

	@media (min-width: 821px) {
		:global(html),
		:global(body) {
			height: 100%;
			overflow: hidden;
		}
	}

	:global(strong) {
		font-weight: 650;
	}

	button {
		border: 0;
		font: inherit;
		cursor: pointer;
	}

	.boxes-route {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.storage-workspace {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		grid-template-columns: 158px minmax(0, 1fr) 304px;
		align-items: stretch;
		gap: 12px;
		padding: 0;
		overflow: visible;
		background: transparent;
		box-shadow: none;
	}

	.workspace-column {
		position: relative;
		z-index: 10;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: visible;
	}

	.party-zone,
	.box-zone {
		min-width: 0;
		min-height: 0;
		padding: 12px;
		overflow: visible;
		border: 0;
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
		outline: none;
	}

	.box-zone {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
	}

	.box-zone:focus-visible,
	.party-zone:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 65%);
		outline-offset: 3px;
	}

	.zone-header {
		min-height: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 0;
		margin-bottom: 10px;
	}

	.zone-header span {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.party-header {
		margin-bottom: 9px;
	}

	.party-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		background: transparent;
		box-shadow: none;
		color: var(--ink);
	}

	.party-toggle span {
		display: inline-block;
		color: var(--ink-soft);
		transition: transform 160ms ease;
	}

	.party-zone.collapsed .party-toggle span {
		transform: rotate(-90deg);
	}

	.party-list {
		display: grid;
		grid-template-columns: repeat(6, minmax(52px, 80px));
		justify-content: center;
		gap: 6px;
	}

	.party-zone.collapsed .party-list {
		display: none;
	}

	.party-toggle:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.filter-row {
		display: flex;
		justify-content: flex-end;
		gap: 5px;
		margin-bottom: 10px;
	}

	.filter-row span {
		padding: 3px 9px;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font:
			600 0.62rem var(--pksx-font-mono),
			monospace;
	}

	.box-grid {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(6, minmax(52px, 80px));
		grid-template-rows: repeat(5, minmax(52px, 80px));
		grid-auto-rows: 80px;
		justify-content: center;
		align-content: start;
		gap: 6px;
		overflow: visible;
		padding: 4px;
	}

	.slot-cell {
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.slot-cell.selected {
		z-index: 120;
	}

	.box-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
		color: var(--ink-soft);
		font-size: 0.72rem;
		font-weight: 650;
	}

	.box-footer strong {
		margin-left: auto;
		color: var(--ink-mute);
		font:
			650 0.65rem var(--pksx-font-mono),
			monospace;
	}

	@media (max-width: 1120px) {
		.storage-workspace {
			grid-template-columns: minmax(0, 1fr) 280px;
		}
	}

	@media (max-width: 820px) {
		.storage-workspace,
		.workspace-column,
		.party-zone,
		.box-zone,
		.box-grid {
			overflow: visible;
			min-height: 0;
		}

		.box-header {
			justify-content: center;
		}

		.workspace-column {
			order: 1;
			position: static;
			max-height: none;
		}

		.storage-workspace {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.party-zone,
		.box-zone {
			border-radius: var(--pksx-radius-lg);
			padding: 10px;
		}

		.party-list {
			grid-template-columns: repeat(6, minmax(44px, 1fr));
			gap: 6px;
		}

		.box-grid {
			grid-template-columns: repeat(6, minmax(42px, 1fr));
			grid-template-rows: none;
			grid-auto-rows: auto;
			align-content: start;
		}

		.box-grid .slot-cell {
			aspect-ratio: 1;
		}
	}

	@media (max-width: 520px) {
		.filter-row,
		.box-footer span:nth-child(2) {
			display: none;
		}

		.box-grid {
			gap: 6px;
		}
	}
</style>
