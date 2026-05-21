<script lang="ts">
	import { onMount } from 'svelte';
	import {
		base64ToBytes,
		createPkhexWorkerEngine,
		type EngineApi,
		type EngineError,
		type PartySlotSummary,
		type BoxSlotSummary,
		type SaveWorkspace
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
		type BoxNavigationState,
		type NavigationAction
	} from '$lib/pksx/box-navigation';
	import { IndexedDbLocalLibraryStorage, type StoredSaveFile } from '$lib/pksx/local-library';
	import BoxSidebar from '$lib/components/pksx/BoxSidebar.svelte';
	import DetailRail from '$lib/components/pksx/DetailRail.svelte';
	import MobileTabbar from '$lib/components/pksx/MobileTabbar.svelte';
	import SlotActionMenu from '$lib/components/pksx/SlotActionMenu.svelte';
	import StatusStrip from '$lib/components/pksx/StatusStrip.svelte';
	import StorageSlot from '$lib/components/pksx/StorageSlot.svelte';
	import TopBar from '$lib/components/pksx/TopBar.svelte';
	import type { BoxNavItem, SlotView } from '$lib/components/pksx/types';

	type LoadedSave = {
		file: StoredSaveFile;
		bytes: Uint8Array;
		workspace: SaveWorkspace;
	};

	const placeholderBoxCount = 3;
	const storage = new IndexedDbLocalLibraryStorage();

	const slotPalette = [16, 28, 48, 100, 140, 180, 195, 210, 220, 260, 280, 295, 330, 52];
	const sectionPills = ['Boxes', 'Editor', 'Saves'];
	const mobileTabs = [
		{ key: 'boxes', label: 'Boxes', glyph: '▦' },
		{ key: 'editor', label: 'Editor', glyph: '✎' },
		{ key: 'saves', label: 'Saves', glyph: '☁' }
	];

	function slotHue(box: number, slot: number, speciesId: number | null): number {
		const seed = speciesId && speciesId > 0 ? speciesId : slot * 31 + box * 7;
		return slotPalette[seed % slotPalette.length];
	}

	function slotHueSecondary(box: number, slot: number, speciesId: number | null): number | null {
		const seed = speciesId && speciesId > 0 ? speciesId : slot * 31 + box * 7;
		if (seed % 3 !== 0) return null;
		const offset = ((seed * 7) % (slotPalette.length - 1)) + 1;
		return slotPalette[(seed + offset) % slotPalette.length];
	}

	function slotStyle(box: number, slot: number, speciesId: number | null): string {
		const primary = slotHue(box, slot, speciesId);
		const secondary = slotHueSecondary(box, slot, speciesId);
		if (secondary === null) {
			return `--slot-hue: ${primary}`;
		}
		return `--slot-hue: ${primary}; --slot-hue-2: ${secondary}`;
	}

	function boxHue(box: number): number {
		return slotPalette[box % slotPalette.length];
	}

	function boxNameFor(box: number): string {
		return `Box ${String(box + 1).padStart(2, '0')}`;
	}

	const placeholderPartySlots: SlotView[] = Array.from({ length: PARTY_SLOT_COUNT }, (_, slot) => ({
		slot,
		label: slot === 0 ? 'Pikachu' : 'Empty',
		detail: slot === 0 ? 'Lv. 5' : '',
		level: slot === 0 ? 5 : null,
		speciesId: slot === 0 ? 25 : null,
		kind: slot === 0 ? 'pokemon' : 'empty'
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
					speciesId: featured ? 25 : null,
					kind: featured ? ('pokemon' as const) : ('empty' as const)
				};
			})
	);

	let navigation = $state<BoxNavigationState>(createInitialNavigationState(placeholderBoxCount));
	let gamepadStatus = $state('No controller detected');
	let loadedSave = $state<LoadedSave | null>(null);
	let importError = $state<string | null>(null);
	let statusMessage = $state('Import a Save File to begin.');
	let busy = $state(false);
	let partyCollapsed = $state(false);
	let darkMode = $state(false);
	let engine: EngineApi | null = null;
	let workspaceLoadRequest = 0;

	const pikachuSpriteUrl = 'https://img.pokemondb.net/sprites/scarlet-violet/normal/pikachu.png';

	const controllerConnected = $derived(
		gamepadStatus !== 'No controller detected' && gamepadStatus.length > 0
	);
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
	const focusedSlot = $derived(
		navigation.focus.zone === 'party'
			? partySlots[navigation.focus.slot]
			: activeBoxSlots[navigation.focus.slot]
	);
	const focusedSlotSummary = $derived(formatFocusedSlotSummary(focusedSlot));
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
						speciesId: null,
						kind: 'empty' as const
					}))
				]
	);

	function dispatch(action: NavigationAction) {
		const previousBox = navigation.activeBox;
		navigation = applyNavigationAction(navigation, action);

		if (loadedSave && navigation.activeBox !== previousBox) {
			void loadWorkspaceForSave(loadedSave, navigation.activeBox);
		}

		queueMicrotask(focusActiveGrid);
	}

	function focusActiveGrid() {
		if (navigation.actionSurfaceOpen) {
			return;
		}

		if (navigation.focus.zone === 'party') {
			document.getElementById('party-grid')?.focus();
		} else {
			document.getElementById('box-grid')?.focus();
		}
	}

	function handleGridKeydown(event: KeyboardEvent) {
		const action = keyboardAction(event);

		if (!action) {
			return;
		}

		event.preventDefault();
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

	function focusParty(slot: number) {
		navigation = { ...navigation, focus: focusPartySlot(slot) };
		queueMicrotask(focusActiveGrid);
	}

	function focusBox(slot: number) {
		navigation = { ...navigation, focus: focusBoxSlot(slot) };
		queueMicrotask(focusActiveGrid);
	}

	function selectBox(index: number) {
		if (index > navigation.activeBox) {
			for (let step = navigation.activeBox; step < index; step += 1) dispatch('nextBox');
		} else if (index < navigation.activeBox) {
			for (let step = navigation.activeBox; step > index; step -= 1) dispatch('previousBox');
		}
	}

	function openFocusedSlot() {
		dispatch('confirm');
	}

	function closeActionSurface() {
		dispatch('back');
	}

	function closeActionSurfaceFromOutside(event: PointerEvent) {
		if (!navigation.actionSurfaceOpen) {
			return;
		}

		const target = event.target;

		if (!(target instanceof Element)) {
			return;
		}

		if (target.closest('.slot-cell, .slot-context, .box-switcher, .party-toggle')) {
			return;
		}

		closeActionSurface();
	}

	function isFocused(zone: 'party' | 'box', slot: number) {
		return navigation.focus.zone === zone && navigation.focus.slot === slot;
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
		engine = createPkhexWorkerEngine('/pkhex-engine');
		void restoreMostRecentSave();
	});

	function openImportPicker() {
		document.getElementById('save-file-input')?.click();
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';

		if (!file) {
			return;
		}

		busy = true;
		workspaceLoadRequest += 1;
		importError = null;
		statusMessage = `Reading ${file.name}...`;

		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const workspace = await loadWorkspace(bytes, file.name, 0);
			const stored = await storage.importSave({ bytes, originalFileName: file.name });

			loadedSave = { file: stored, bytes, workspace };
			navigation = createInitialNavigationState(workspace.summary.boxCount);
			statusMessage = `${file.name} loaded.`;
		} catch (error) {
			importError = getErrorMessage(error);
			statusMessage = loadedSave ? 'Import failed. Current save remains loaded.' : 'Import failed.';
		} finally {
			busy = false;
		}
	}

	async function restoreMostRecentSave() {
		busy = true;
		workspaceLoadRequest += 1;
		importError = null;

		try {
			const [saveFile] = await storage.listSaves();

			if (!saveFile) {
				statusMessage = 'Import a Save File to begin.';
				return;
			}

			const bytes = await storage.getSaveBytes(saveFile.id);
			if (!bytes) {
				statusMessage = 'The most recent Save File is missing its stored bytes.';
				return;
			}

			const workspace = await loadWorkspace(bytes, saveFile.originalFileName ?? undefined, 0);
			loadedSave = { file: saveFile, bytes, workspace };
			navigation = createInitialNavigationState(workspace.summary.boxCount);
			statusMessage = `${saveFile.originalFileName ?? 'Save File'} restored from Local Library.`;
		} catch (error) {
			importError = getErrorMessage(error);
			statusMessage = 'Could not restore the most recent Save File.';
		} finally {
			busy = false;
		}
	}

	async function loadWorkspaceForSave(save: LoadedSave, box: number) {
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
				speciesId: null,
				kind: 'empty'
			});
		}

		return slotViews;
	}

	function createBoxSlotViews(slots: BoxSlotSummary[]): SlotView[] {
		return slots.map((slot) => createSlotView(slot));
	}

	function createSlotView(slot: PartySlotSummary | BoxSlotSummary): SlotView {
		return {
			slot: slot.slot,
			label: slot.isEmpty ? 'Empty' : slot.nickname || `Species ${slot.speciesId}`,
			detail: slot.isEmpty ? '' : `Lv. ${slot.level}`,
			level: slot.isEmpty ? null : slot.level,
			speciesId: slot.isEmpty ? null : slot.speciesId,
			kind: slot.isEmpty ? 'empty' : 'pokemon'
		};
	}

	function formatFocusedSlotSummary(slot: SlotView) {
		if (slot.kind === 'empty') {
			return 'Empty';
		}

		return `${slot.label} ${slot.detail.match(/Lv\. \d+/)?.[0] ?? slot.detail}`;
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

<main
	class={['app-shell', darkMode && 'dark']}
	aria-labelledby="screen-title"
	onpointerdown={closeActionSurfaceFromOutside}
	{@attach gamepadNavigation}
>
	<TopBar
		{sectionPills}
		{saveSummary}
		{boxCount}
		activeBox={navigation.activeBox}
		fileName={loadedSave?.file.originalFileName ?? null}
		{busy}
		hasLoadedSave={loadedSave !== null}
		{darkMode}
		onImport={handleImport}
		onOpenImportPicker={openImportPicker}
		onExport={exportLoadedSave}
		onToggleTheme={() => (darkMode = !darkMode)}
	/>

	{#if importError}
		<StatusStrip variant="error" label="Import error" message={importError} />
	{/if}

	<StatusStrip
		message={busy ? 'Working...' : statusMessage}
		secondary={controllerConnected ? gamepadStatus : null}
	/>

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
				onkeydown={handleGridKeydown}
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
								dualType={slot.kind === 'pokemon' &&
									slotHueSecondary(-1, slot.slot, slot.speciesId) !== null}
								style={slotStyle(-1, slot.slot, slot.speciesId)}
								rowIndex={slot.slot + 1}
								colIndex={1}
								spriteUrl={pikachuSpriteUrl}
								collapsed={partyCollapsed}
								onFocusSlot={() => focusParty(slot.slot)}
								onOpenSlot={openFocusedSlot}
							/>
							{#if navigation.actionSurfaceOpen && isFocused('party', slot.slot)}
								<SlotActionMenu align="start" location={`Party slot ${slot.slot + 1}`} />
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
				onkeydown={handleGridKeydown}
			>
				<div class="zone-header box-header">
					<div class="box-title">
						<h2>{boxNameFor(navigation.activeBox)}</h2>
						<span>
							<em>BOX {String(navigation.activeBox + 1).padStart(2, '0')}/{boxCount}</em>
							<b
								>{activeBoxSlots.filter((slot) => slot.kind === 'pokemon').length} / {BOX_SLOT_COUNT}
								occupied</b
							>
						</span>
					</div>
					<div class="box-switcher" aria-label="Box switcher">
						<button type="button" aria-label="Previous box" onclick={() => dispatch('previousBox')}
							>‹</button
						>
						<button type="button" aria-label="Next box" onclick={() => dispatch('nextBox')}
							>›</button
						>
					</div>
				</div>
				<div class="filter-row" aria-hidden="true">
					<span>compact</span>
					<span>sort · slot</span>
					<span>local</span>
				</div>
				<div class="box-grid">
					{#each visibleBoxSlots as slot (slot.slot)}
						{@const position = getBoxSlotPosition(slot.slot)}
						<div class={['slot-cell', isFocused('box', slot.slot) && 'selected']}>
							<StorageSlot
								id={`box-${navigation.activeBox}-slot-${slot.slot}`}
								{slot}
								zone="box"
								focused={isFocused('box', slot.slot)}
								dualType={slot.kind === 'pokemon' &&
									slotHueSecondary(navigation.activeBox, slot.slot, slot.speciesId) !== null}
								style={slotStyle(navigation.activeBox, slot.slot, slot.speciesId)}
								rowIndex={position.row + 1}
								colIndex={position.column + 1}
								spriteUrl={pikachuSpriteUrl}
								onFocusSlot={() => focusBox(slot.slot)}
								onOpenSlot={openFocusedSlot}
							/>
							{#if navigation.actionSurfaceOpen && isFocused('box', slot.slot)}
								<SlotActionMenu
									align={position.column <= 1
										? 'start'
										: position.column >= BOX_COLUMNS - 2
											? 'end'
											: 'center'}
									location={`Box ${navigation.activeBox + 1}, slot ${slot.slot + 1}`}
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
						{#if navigation.focus.zone === 'box'}
							{@const pos = getBoxSlotPosition(navigation.focus.slot)}
							SLOT {navigation.focus.slot + 1} · ROW {String.fromCharCode(65 + pos.row)} / COL
							{pos.column + 1}
						{:else}
							PARTY SLOT {navigation.focus.slot + 1}
						{/if}
					</strong>
				</div>
			</div>
		</div>

		<DetailRail
			{focusedSlot}
			focusZone={navigation.focus.zone}
			focusSlot={navigation.focus.slot}
			slotHueStyle={`--slot-hue: ${slotHue(navigation.activeBox, navigation.focus.slot, focusedSlot.speciesId)}`}
			spriteUrl={pikachuSpriteUrl}
			{saveSummary}
			activeBoxName={boxNameFor(navigation.activeBox)}
			{slotPalette}
		/>
	</section>

	<MobileTabbar tabs={mobileTabs} />
</main>

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

	.app-shell,
	.app-shell * {
		box-sizing: border-box;
	}

	.app-shell {
		--paper: var(--pksx-color-surface-canvas);
		--paper-hi: var(--pksx-color-surface-panel);
		--paper-deep: var(--pksx-color-surface-subtle);
		--ink: var(--pksx-color-text-primary);
		--ink-soft: var(--pksx-color-text-secondary);
		--ink-mute: var(--pksx-color-text-muted);
		--rule: var(--pksx-color-border-subtle);
		--rule-hi: var(--pksx-color-border-strong);
		--rust: var(--pksx-color-accent-primary);
		--rust-wash: var(--pksx-color-accent-wash);
		--rust-ring: var(--pksx-color-accent-ring);
		--gold: var(--pksx-color-accent-gold);
		--ok: var(--pksx-color-feedback-success);
		--err: var(--pksx-color-feedback-danger);
		--shadow: var(--pksx-shadow-raised);
		--shadow-sm: var(--pksx-shadow-subtle);
		--shadow-deep: var(--pksx-shadow-panel);
		height: 100dvh;
		min-height: 100dvh;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: hidden;
		background:
			radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.5), transparent 40%),
			radial-gradient(circle at 80% 90%, rgba(184, 88, 56, 0.05), transparent 50%),
			repeating-linear-gradient(45deg, transparent 0 6px, rgba(70, 50, 30, 0.012) 6px 7px),
			var(--paper);
		color: var(--ink);
	}

	.app-shell.dark {
		background:
			radial-gradient(circle at 20% 10%, rgba(255, 138, 92, 0.04), transparent 50%),
			radial-gradient(circle at 80% 90%, rgba(120, 140, 180, 0.04), transparent 55%), var(--paper);
	}

	.storage-workspace {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		grid-template-columns: 158px minmax(0, 1fr) 304px;
		align-items: stretch;
		gap: 12px;
		padding: 0;
		overflow: hidden;
		background: transparent;
		box-shadow: none;
	}

	.workspace-column {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: hidden;
	}

	.party-zone,
	.box-zone {
		min-width: 0;
		min-height: 0;
		padding: 12px;
		overflow: hidden;
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

	.zone-header h2 {
		margin: 0;
		color: var(--ink);
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
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

	.box-title {
		display: grid;
		gap: 2px;
	}

	.box-title h2 {
		font-size: 1.45rem;
	}

	.box-title span {
		display: flex;
		gap: 8px;
		color: var(--ink-mute);
		font:
			650 0.62rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.04em;
	}

	.box-title em {
		font-style: normal;
	}

	.box-switcher {
		display: flex;
		gap: 6px;
	}

	.box-switcher button {
		width: 30px;
		min-height: 32px;
		padding: 0;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--ink);
		font-size: 1.1rem;
		font-weight: 700;
	}

	.box-switcher button:hover,
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
		overflow-y: auto;
		padding: 4px;
	}

	.slot-cell {
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.slot-cell.selected {
		z-index: 20;
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
		.app-shell {
			height: auto;
			min-height: 100dvh;
			padding: 10px 10px 78px;
			gap: 10px;
			overflow: visible;
		}

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

		.box-title {
			justify-items: center;
			text-align: center;
		}

		.box-switcher {
			gap: 12px;
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
			grid-template-columns: repeat(5, minmax(50px, 1fr));
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
