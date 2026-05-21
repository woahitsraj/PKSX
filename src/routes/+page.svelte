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

	type SlotView = {
		slot: number;
		label: string;
		detail: string;
		level: number | null;
		speciesId: number | null;
		kind: 'pokemon' | 'empty';
	};

	type LoadedSave = {
		file: StoredSaveFile;
		bytes: Uint8Array;
		workspace: SaveWorkspace;
	};

	const placeholderBoxCount = 3;
	const storage = new IndexedDbLocalLibraryStorage();

	const slotPalette = [16, 28, 48, 100, 140, 180, 195, 210, 220, 260, 280, 295, 330, 52];
	const placeholderBoxNames = [
		'Starters',
		'Cinder Pass',
		'Reef Trial',
		'Sunroom',
		'Hex Lab',
		'Vault A',
		'Trades',
		'Breed Pool',
		'Shiny Den'
	];
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
		return placeholderBoxNames[box] ?? `Box ${String(box + 1).padStart(2, '0')}`;
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
	<header class="top-bar" aria-label="Current save summary">
		<div class="brand-lockup">
			<div class="brand-mark" aria-hidden="true">P</div>
			<div>
				<h1 id="screen-title">PKSX</h1>
				<p>save editor · atelier</p>
			</div>
		</div>
		<div class="section-pills" aria-label="Available sections">
			{#each sectionPills as pill (pill)}
				<span class:active={pill === 'Boxes'}>{pill}</span>
			{/each}
		</div>
		<div class="search-shell" aria-hidden="true">
			<span>⌕</span>
			<span
				>Search {saveSummary?.boxCount
					? saveSummary.boxCount * (saveSummary.boxSlotCount ?? 30)
					: 842} creatures…</span
			>
			<kbd>⌘K</kbd>
		</div>
		<div class="save-actions" aria-label="Save File actions">
			<input
				id="save-file-input"
				class="file-input"
				type="file"
				aria-label="Import Save File"
				onchange={handleImport}
			/>
			<button type="button" disabled={busy} onclick={openImportPicker}>Import</button>
			<button type="button" disabled={busy || !loadedSave} onclick={exportLoadedSave}>Export</button
			>
		</div>
		<div class="save-chip" title={loadedSave?.file.originalFileName ?? 'No Save File'}>
			<i aria-hidden="true"></i>
			<div>
				<strong>{loadedSave?.file.originalFileName ?? 'No Save File'}</strong>
				<span>
					{#if saveSummary?.trainerName}·{saveSummary.trainerName}{:else}Box
						{navigation.activeBox + 1}/{boxCount}{/if}
				</span>
			</div>
			<span class="save-chip-status" aria-hidden="true">▾</span>
		</div>
		<span class="online-indicator" aria-label="Offline mode">● OFFLINE</span>
		<button
			class="theme-toggle"
			type="button"
			aria-label={darkMode ? 'Use light mode' : 'Use dark mode'}
			onclick={() => (darkMode = !darkMode)}
		>
			{darkMode ? '☀' : '☾'}
		</button>
	</header>

	{#if importError}
		<section class="error-strip" role="alert">
			<strong>Import error</strong>
			<span>{importError}</span>
		</section>
	{/if}

	<section class="status-strip" aria-live="polite">
		<span>{busy ? 'Working...' : statusMessage}</span>
		{#if controllerConnected}
			<span>{gamepadStatus}</span>
		{/if}
	</section>

	<section class="storage-workspace" aria-label="Party and box storage">
		<nav class="box-sidebar" aria-label="Boxes">
			<div class="sidebar-heading">
				<span>Boxes · {boxCount}</span>
				<span aria-hidden="true">+</span>
			</div>
			<div class="box-list">
				{#each boxIndices as index (index)}
					<button
						type="button"
						class:active={index === navigation.activeBox}
						aria-current={index === navigation.activeBox ? 'page' : undefined}
						style={`--box-hue: ${boxHue(index)}`}
						onclick={() => {
							if (index > navigation.activeBox) {
								for (let step = navigation.activeBox; step < index; step += 1) dispatch('nextBox');
							} else if (index < navigation.activeBox) {
								for (let step = navigation.activeBox; step > index; step -= 1)
									dispatch('previousBox');
							}
						}}
					>
						<i aria-hidden="true"></i>
						<span>
							<strong>{boxNameFor(index)}</strong>
							<small>
								<em>BOX {String(index + 1).padStart(2, '0')}</em>
								<b
									>{index === navigation.activeBox
										? activeBoxSlots.filter((slot) => slot.kind === 'pokemon').length
										: '—'}/{BOX_SLOT_COUNT}</b
								>
							</small>
						</span>
					</button>
				{/each}
			</div>
		</nav>

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
							<button
								id={`party-slot-${slot.slot}`}
								class={[
									'slot',
									'party-slot',
									slot.kind,
									slot.kind === 'pokemon' &&
										slotHueSecondary(-1, slot.slot, slot.speciesId) !== null &&
										'dual-type',
									isFocused('party', slot.slot) && 'focused'
								]}
								type="button"
								role="gridcell"
								tabindex="-1"
								style={slotStyle(-1, slot.slot, slot.speciesId)}
								aria-selected={isFocused('party', slot.slot)}
								aria-rowindex={slot.slot + 1}
								aria-colindex="1"
								onclick={() => focusParty(slot.slot)}
								ondblclick={openFocusedSlot}
							>
								<span class="slot-number">P{slot.slot + 1}</span>
								{#if slot.kind === 'pokemon'}
									<img class="slot-sprite" src={pikachuSpriteUrl} alt="" width="96" height="96" />
								{:else}
									<span class="slot-sprite empty-sprite" aria-hidden="true"></span>
								{/if}
								<span class="slot-label">
									{#if slot.kind === 'pokemon' && slot.level !== null}<em>L{slot.level}</em>{/if}
									<span>{slot.label}</span>
								</span>
								{#if slot.detail}
									<span class="slot-detail">{slot.detail}</span>
								{/if}
							</button>
							{#if navigation.actionSurfaceOpen && isFocused('party', slot.slot)}
								<div class="slot-context align-start" role="dialog" aria-label="Slot actions">
									<p class="slot-context-location">Party slot {slot.slot + 1}</p>
									<button type="button" disabled>View</button>
									<button type="button" disabled>Move</button>
									<button type="button" disabled>Export</button>
								</div>
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
							<button
								id={`box-${navigation.activeBox}-slot-${slot.slot}`}
								class={[
									'slot',
									'box-slot',
									slot.kind,
									slot.kind === 'pokemon' &&
										slotHueSecondary(navigation.activeBox, slot.slot, slot.speciesId) !== null &&
										'dual-type',
									isFocused('box', slot.slot) && 'focused'
								]}
								type="button"
								role="gridcell"
								tabindex="-1"
								style={slotStyle(navigation.activeBox, slot.slot, slot.speciesId)}
								aria-selected={isFocused('box', slot.slot)}
								aria-rowindex={position.row + 1}
								aria-colindex={position.column + 1}
								onclick={() => focusBox(slot.slot)}
								ondblclick={openFocusedSlot}
							>
								<span class="slot-number">{slot.slot + 1}</span>
								{#if slot.kind === 'pokemon'}
									<img class="slot-sprite" src={pikachuSpriteUrl} alt="" width="96" height="96" />
								{:else}
									<span class="slot-sprite empty-sprite" aria-hidden="true"></span>
								{/if}
								<span class="slot-label">
									{#if slot.kind === 'pokemon' && slot.level !== null}<em>L{slot.level}</em>{/if}
									<span>{slot.label}</span>
								</span>
								{#if slot.detail}
									<span class="slot-detail">{slot.detail}</span>
								{/if}
							</button>
							{#if navigation.actionSurfaceOpen && isFocused('box', slot.slot)}
								<div
									class={[
										'slot-context',
										position.column <= 1 && 'align-start',
										position.column >= BOX_COLUMNS - 2 && 'align-end'
									]}
									role="dialog"
									aria-label="Slot actions"
								>
									<p class="slot-context-location">
										Box {navigation.activeBox + 1}, slot {slot.slot + 1}
									</p>
									<button type="button" disabled>View</button>
									<button type="button" disabled>Move</button>
									<button type="button" disabled>Export</button>
								</div>
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

		<aside
			class="detail-rail"
			aria-live="polite"
			style={`--slot-hue: ${slotHue(navigation.activeBox, navigation.focus.slot, focusedSlot.speciesId)}`}
		>
			<div class="portrait-card">
				<small>
					PORTRAIT · {navigation.focus.zone === 'party'
						? `PARTY ${navigation.focus.slot + 1}`
						: `SLOT ${navigation.focus.slot + 1}`}
				</small>
				{#if focusedSlot.kind === 'pokemon'}
					<img src={pikachuSpriteUrl} alt="" width="180" height="180" />
				{:else}
					<span class="portrait-empty" aria-hidden="true"></span>
				{/if}
			</div>
			<div class="detail-heading">
				<div>
					<h2>{focusedSlot.kind === 'pokemon' ? focusedSlot.label : '—'}</h2>
					<span>
						{#if focusedSlot.kind === 'pokemon' && focusedSlot.speciesId}
							#{String(focusedSlot.speciesId).padStart(4, '0')} · Modest · Updraft
						{:else}
							No creature in this slot
						{/if}
					</span>
				</div>
				<div class="detail-level">
					<span>LEVEL</span>
					<strong>{focusedSlot.level ?? '—'}</strong>
				</div>
			</div>
			<div class="stat-grid" aria-label="Stats">
				{#each [{ key: 'HP', iv: 31, ev: 252 }, { key: 'ATK', iv: 29, ev: 4 }, { key: 'DEF', iv: 25, ev: null }, { key: 'SPA', iv: 31, ev: 252 }, { key: 'SPD', iv: 18, ev: null }, { key: 'SPE', iv: 31, ev: null }] as stat (stat.key)}
					<div class="stat-row">
						<span class="stat-key">{stat.key}</span>
						<span class="stat-bar" aria-hidden="true">
							<i style={`width: ${focusedSlot.kind === 'pokemon' ? (stat.iv / 31) * 100 : 0}%`}
							></i>
						</span>
						<span class="stat-iv">{focusedSlot.kind === 'pokemon' ? stat.iv : '—'}</span>
						<span class="stat-ev"
							>{focusedSlot.kind === 'pokemon' && stat.ev ? `+${stat.ev}` : '—'}</span
						>
					</div>
				{/each}
			</div>
			<div class="moveset" aria-label="Moves">
				<span class="moveset-label">MOVE SET</span>
				<div class="moveset-grid">
					{#each ['Ember', 'Gust', 'Flora', 'Roost'] as move, index (move)}
						<div class="move-chip" style={`--slot-hue: ${slotPalette[(index * 4) % slotPalette.length]}`}>
							<strong>{focusedSlot.kind === 'pokemon' ? move.toUpperCase() : '—'}</strong>
							<small>{focusedSlot.kind === 'pokemon' ? 'PP 25/25' : ''}</small>
						</div>
					{/each}
				</div>
			</div>
			<div class="detail-footer">
				<div>
					<span>OT</span>
					<strong>{saveSummary?.trainerName ?? 'CASS · 41203'}</strong>
				</div>
				<div>
					<span>ITEM</span>
					<strong>{focusedSlot.kind === 'pokemon' ? 'Charcoal Ember' : '—'}</strong>
				</div>
				<div>
					<span>MET</span>
					<strong
						>{focusedSlot.kind === 'pokemon'
							? `${boxNameFor(navigation.activeBox)} · Lv. ${focusedSlot.level}`
							: '—'}</strong
					>
				</div>
			</div>
		</aside>
	</section>

	<nav class="mobile-tabbar" aria-label="Sections (mobile)">
		{#each mobileTabs as tab (tab.key)}
			<button type="button" class:active={tab.key === 'boxes'}>
				<span aria-hidden="true">{tab.glyph}</span>
				<small>{tab.label}</small>
			</button>
		{/each}
	</nav>
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: #dff4ea;
		color: #17302a;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
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

	.app-shell {
		min-height: 100vh;
		padding: 18px 18px 104px;
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		gap: 14px;
	}

	.save-chip,
	.controller-status,
	.status-strip,
	.error-strip,
	.storage-workspace {
		border: 2px solid rgba(17, 72, 48, 0.18);
		box-shadow: 0 10px 0 rgba(33, 89, 57, 0.12);
	}

	.status-rail {
		display: grid;
		grid-template-columns: minmax(180px, 1fr) auto auto auto auto;
		align-items: stretch;
		gap: 12px;
		color: #f4fff8;
	}

	.eyebrow,
	h1,
	h2,
	p {
		margin: 0;
	}

	.eyebrow,
	.save-chip span,
	.controller-status,
	.zone-header span,
	.slot-detail,
	.slot-context-location {
		font-size: 0.76rem;
		font-weight: 650;
		letter-spacing: 0;
	}

	.eyebrow {
		color: #d7f5e8;
	}

	h1 {
		margin-top: 4px;
		font-size: clamp(1.2rem, 2.5vw, 2rem);
		line-height: 1.05;
	}

	h2 {
		font-size: 1.15rem;
		line-height: 1.1;
	}

	.save-chip {
		display: grid;
		align-content: center;
		min-width: 150px;
		gap: 2px;
		padding: 12px 14px;
		background: #f7f3e8;
		color: #17302a;
	}

	.save-summary {
		min-width: 220px;
	}

	.save-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.save-actions button {
		min-height: 38px;
		padding: 0 14px;
		border-radius: 6px;
		background: #f5f0dd;
		color: #1c3c31;
		font-weight: 650;
		box-shadow: inset 0 -3px 0 rgba(35, 77, 55, 0.16);
	}

	.controller-status {
		max-width: 260px;
		align-content: center;
		padding: 12px 14px;
		background: #f7f3e8;
		color: #17302a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.save-actions button:not(:disabled):hover,
	.box-switcher button:hover,
	.party-toggle:hover,
	.slot-context button:hover,
	.slot-context button:focus-visible {
		background: #fff8dc;
	}

	.save-actions button:disabled,
	.slot-context button:disabled {
		cursor: not-allowed;
		opacity: 0.62;
	}

	.status-strip,
	.error-strip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-color: rgba(37, 153, 125, 0.2);
		background: rgba(246, 251, 243, 0.82);
		color: #17302a;
	}

	.error-strip {
		border-color: rgba(176, 61, 61, 0.36);
		background: rgba(255, 236, 232, 0.92);
		color: #6f2020;
	}

	.storage-workspace {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 12px;
		padding: 14px;
		border: 0;
		border-radius: 14px;
		background: #f6fbf3;
		box-shadow: 0 22px 70px rgba(31, 102, 75, 0.24);
	}

	.grid-shell {
		display: grid;
		grid-template-areas:
			'box'
			'focus'
			'party';
		gap: 10px;
		min-width: 0;
	}

	.party-zone,
	.box-zone {
		min-width: 0;
		padding: 10px;
		border: 2px solid rgba(37, 153, 125, 0.24);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.32);
	}

	.box-zone {
		grid-area: box;
	}

	.box-zone {
		outline: none;
	}

	.party-zone {
		grid-area: party;
		outline: none;
	}

	.party-zone:focus-visible,
	.box-zone:focus-visible {
		box-shadow: 0 0 0 3px rgba(35, 167, 200, 0.24);
	}

	.zone-header {
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 10px;
	}

	.box-header {
		display: block;
	}

	.box-switcher {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr) 48px;
		gap: 10px;
		align-items: center;
	}

	.box-switcher button,
	.party-toggle,
	.slot-context button {
		min-height: 38px;
		border-radius: 6px;
		background: #f5f0dd;
		color: #1c3c31;
		font-weight: 650;
		box-shadow: inset 0 -3px 0 rgba(35, 77, 55, 0.16);
	}

	.box-switcher button {
		font-size: 1.4rem;
	}

	.box-title {
		display: grid;
		justify-items: center;
		padding: 8px 12px;
		border-radius: 8px;
		background: linear-gradient(180deg, #fffbf0, #d9d1bc);
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(52px, 1fr));
		grid-template-rows: repeat(5, minmax(64px, 1fr));
		gap: 7px;
	}

	.party-toggle {
		min-height: 30px;
		padding: 0 11px;
		background: rgba(32, 100, 68, 0.1);
		box-shadow: none;
	}

	.party-list {
		display: grid;
		grid-template-columns: repeat(6, minmax(96px, 1fr));
		gap: 7px;
	}

	.party-zone.collapsed .party-list {
		display: none;
	}

	.slot-cell {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 100%;
		min-height: 0;
	}

	.slot-cell.selected {
		z-index: 12;
	}

	.slot {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		grid-template-rows: auto 1fr auto;
		gap: 4px 7px;
		align-items: center;
		padding: 7px;
		border: 2px solid rgba(28, 84, 57, 0.22);
		border-radius: 7px;
		background: rgba(236, 255, 225, 0.58);
		color: #17302a;
		text-align: left;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			transform 120ms ease;
	}

	.box-slot {
		grid-template-columns: 1fr;
		justify-items: center;
		text-align: center;
	}

	.slot:hover {
		border-color: rgba(35, 167, 200, 0.42);
		background: rgba(246, 255, 238, 0.82);
	}

	.slot.focused {
		transform: translateY(-1px);
	}

	.slot.empty {
		border-style: dashed;
		background: rgba(248, 255, 242, 0.26);
		color: rgba(24, 58, 49, 0.58);
	}

	.slot-number {
		position: absolute;
		top: 4px;
		left: 5px;
		color: rgba(24, 58, 49, 0.62);
		font-size: 0.62rem;
		font-weight: 900;
	}

	.slot-sprite {
		width: 29px;
		aspect-ratio: 1;
		border-radius: 45% 55% 48% 52%;
		background:
			radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.9) 0 14%, transparent 15%), #9aa5a0;
		box-shadow:
			inset -4px -5px 0 rgba(0, 0, 0, 0.16),
			0 2px 0 rgba(23, 68, 42, 0.2);
	}

	.slot.empty .slot-sprite {
		background: transparent;
		box-shadow: inset 0 0 0 2px rgba(34, 88, 64, 0.18);
	}

	.slot-label,
	.slot-detail {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slot-label {
		font-weight: 650;
	}

	.slot-detail {
		font-size: 0.76rem;
	}

	.box-slot .slot-label,
	.box-slot .slot-detail {
		max-width: 100%;
	}

	.slot-context {
		position: absolute;
		top: calc(100% + 6px);
		left: 50%;
		z-index: 20;
		width: min(156px, calc(100vw - 24px));
		display: grid;
		gap: 4px;
		padding: 6px;
		border: 1px solid rgba(12, 47, 35, 0.42);
		border-radius: 8px;
		background: rgba(18, 52, 42, 0.98);
		box-shadow: 0 14px 28px rgba(18, 52, 42, 0.28);
		transform: translateX(-50%);
	}

	.slot-context.align-start {
		left: 0;
		transform: none;
	}

	.slot-context.align-end {
		right: 0;
		left: auto;
		transform: none;
	}

	.slot-context-location {
		margin: 0 0 2px;
		color: #f6fbf3;
	}

	.slot-context button {
		width: 100%;
		min-height: 34px;
		padding: 0 12px;
		text-align: left;
		box-shadow: none;
	}

	.focus-readout {
		grid-area: focus;
		justify-self: center;
		z-index: 3;
		display: grid;
		place-items: center;
		width: min(340px, calc(100vw - 24px));
		padding: 8px 12px;
		border: 2px solid rgba(12, 47, 35, 0.28);
		border-radius: 12px;
		background: rgba(11, 43, 34, 0.84);
		backdrop-filter: blur(8px);
		color: #f6fbf3;
		box-shadow: 0 14px 40px rgba(12, 47, 35, 0.24);
	}

	@media (max-width: 920px) {
		.app-shell {
			padding: 10px;
		}

		.status-rail {
			grid-template-columns: 1fr;
		}

		.save-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.save-chip,
		.controller-status {
			min-width: 0;
		}

		.box-grid {
			grid-template-columns: repeat(6, minmax(44px, 1fr));
			grid-auto-rows: minmax(58px, 1fr);
			gap: 5px;
		}

		.party-list {
			grid-template-columns: 1fr;
		}

		.slot {
			padding: 5px;
		}

		.box-slot .slot-label,
		.box-slot .slot-detail {
			display: none;
		}

		.focus-readout {
			width: min(300px, calc(100vw - 20px));
			padding: 7px 10px;
		}
	}
	/* Atelier design layer */
	:global(body) {
		background: #f4ecdf;
		color: #2a241c;
		font-family:
			Inter,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			system-ui,
			sans-serif;
	}

	.app-shell,
	.app-shell * {
		box-sizing: border-box;
	}

	.app-shell {
		--paper: #f4ecdf;
		--paper-hi: #fbf6ec;
		--paper-deep: #ebe2d2;
		--ink: #2a241c;
		--ink-soft: #6b5d4a;
		--ink-mute: #9b8d76;
		--rule: rgba(42, 36, 28, 0.08);
		--rule-hi: rgba(42, 36, 28, 0.14);
		--rust: #b85838;
		--rust-wash: rgba(184, 88, 56, 0.1);
		--rust-ring: rgba(184, 88, 56, 0.35);
		--gold: #c89a3e;
		--ok: #7aa86a;
		--err: #c93d3d;
		--shadow:
			0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 4px 12px -6px rgba(70, 50, 30, 0.18),
			0 2px 4px -2px rgba(70, 50, 30, 0.14);
		--shadow-sm: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 2px 6px -3px rgba(70, 50, 30, 0.16);
		--shadow-deep:
			0 1px 0 rgba(255, 255, 255, 0.8) inset, 0 14px 36px -16px rgba(70, 50, 30, 0.26),
			0 4px 10px -6px rgba(70, 50, 30, 0.18);
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
		--paper: #0e0f12;
		--paper-hi: #181a1e;
		--paper-deep: #08090b;
		--ink: #f4f5f7;
		--ink-soft: #b8bcc4;
		--ink-mute: #7a8090;
		--rule: rgba(255, 255, 255, 0.08);
		--rule-hi: rgba(255, 255, 255, 0.18);
		--rust: #ff8a5c;
		--rust-wash: rgba(255, 138, 92, 0.14);
		--rust-ring: rgba(255, 138, 92, 0.55);
		--gold: #f0c060;
		--ok: #7ed99a;
		--err: #ff6f6a;
		--shadow:
			0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 4px 12px -6px rgba(0, 0, 0, 0.7),
			0 2px 4px -2px rgba(0, 0, 0, 0.6);
		--shadow-sm: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 6px -3px rgba(0, 0, 0, 0.6);
		--shadow-deep:
			0 1px 0 rgba(255, 255, 255, 0.07) inset, 0 14px 36px -16px rgba(0, 0, 0, 0.85),
			0 4px 10px -6px rgba(0, 0, 0, 0.7);
		background:
			radial-gradient(circle at 20% 10%, rgba(255, 138, 92, 0.04), transparent 50%),
			radial-gradient(circle at 80% 90%, rgba(120, 140, 180, 0.04), transparent 55%), var(--paper);
	}

	.top-bar,
	.storage-workspace,
	.box-sidebar,
	.party-zone,
	.box-zone,
	.detail-rail,
	.status-strip,
	.error-strip {
		border: 0;
		border-radius: 18px;
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		color: var(--ink);
	}

	.top-bar {
		display: grid;
		grid-template-columns: auto auto minmax(180px, 1fr) auto auto auto auto;
		align-items: center;
		gap: 10px;
		padding: 10px;
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.brand-mark {
		width: 36px;
		height: 36px;
		border-radius: 11px;
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--paper-hi);
		font-size: 17px;
		font-weight: 800;
		box-shadow: var(--shadow);
	}

	.brand-lockup h1,
	.zone-header h2,
	.detail-heading h2 {
		margin: 0;
		color: var(--ink);
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
	}

	.brand-lockup p,
	.zone-header span,
	.detail-heading span,
	.box-list small,
	.status-strip,
	.error-strip {
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

	.section-pills span {
		padding: 7px 12px;
		border-radius: 8px;
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 650;
	}

	.section-pills .active {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.search-shell,
	.save-chip,
	.save-actions button,
	.theme-toggle,
	.box-switcher button,
	.party-toggle,
	.slot-context button {
		border: 0;
		border-radius: 11px;
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
		border-radius: 4px;
		background: var(--paper-deep);
		color: var(--ink-soft);
		font:
			600 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	.save-actions {
		display: flex;
		gap: 6px;
	}

	.save-actions button,
	.theme-toggle,
	.box-switcher button,
	.slot-context button {
		min-height: 32px;
		padding: 0 12px;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.save-actions button:not(:disabled):hover,
	.theme-toggle:hover,
	.box-switcher button:hover,
	.party-toggle:hover {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.save-actions button:disabled,
	.slot-context button:disabled {
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
			600 0.65rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	.theme-toggle {
		width: 34px;
		padding: 0;
		font-size: 0.95rem;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.status-strip,
	.error-strip {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 9px 12px;
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
	}

	.error-strip {
		color: var(--err);
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

	.box-sidebar,
	.party-zone,
	.box-zone,
	.detail-rail {
		min-width: 0;
		min-height: 0;
		padding: 12px;
		overflow: hidden;
	}

	.box-sidebar {
		display: flex;
		flex-direction: column;
	}

	.workspace-column {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: hidden;
	}

	.detail-rail {
		overflow-y: auto;
	}

	.sidebar-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 8px 8px;
		color: var(--ink-mute);
		font:
			700 0.61rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.box-list {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.box-list button {
		--box-hue: 48;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--ink);
		text-align: left;
	}

	.box-list button:hover {
		background: color-mix(in srgb, oklch(0.92 0.06 var(--box-hue)), transparent 60%);
	}

	.box-list button.active {
		border-color: var(--rust-ring);
		background: var(--rust-wash);
	}

	.box-list i {
		width: 5px;
		height: 26px;
		border-radius: 3px;
		background: oklch(0.78 0.12 var(--box-hue));
	}

	.box-list span {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.box-list strong {
		font-size: 0.74rem;
		line-height: 1.15;
	}

	.box-list small {
		display: flex;
		justify-content: space-between;
		gap: 4px;
		color: var(--ink-mute);
		font:
			650 0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.04em;
	}

	.box-list small em {
		font-style: normal;
	}

	.box-list small b {
		color: var(--ink-soft);
		font-weight: 700;
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

	.box-zone {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.box-zone:focus-visible,
	.party-zone:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--rust), transparent 65%);
		outline-offset: 3px;
	}

	.box-switcher {
		display: flex;
		gap: 6px;
	}

	.box-switcher button {
		width: 30px;
		padding: 0;
		font-size: 1.1rem;
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
			600 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
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

	.slot {
		--slot-hue: 48;
		--slot-hue-2: var(--slot-hue);
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 10px;
		background: oklch(0.9 0.09 var(--slot-hue));
		box-shadow: var(--shadow-sm);
		color: var(--ink);
		overflow: visible;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.slot.dual-type {
		background: linear-gradient(
			135deg,
			oklch(0.9 0.09 var(--slot-hue)) 0%,
			oklch(0.9 0.09 var(--slot-hue)) 55%,
			oklch(0.9 0.09 var(--slot-hue-2)) 55%,
			oklch(0.9 0.09 var(--slot-hue-2)) 100%
		);
	}

	.app-shell.dark .slot {
		background: oklch(0.46 0.11 var(--slot-hue));
	}

	.app-shell.dark .slot.dual-type {
		background: linear-gradient(
			135deg,
			oklch(0.46 0.11 var(--slot-hue)) 0%,
			oklch(0.46 0.11 var(--slot-hue)) 55%,
			oklch(0.46 0.11 var(--slot-hue-2)) 55%,
			oklch(0.46 0.11 var(--slot-hue-2)) 100%
		);
	}

	.slot.pokemon:hover,
	.slot.focused {
		transform: translateY(-1px);
		box-shadow:
			0 0 0 2.5px var(--rust),
			var(--shadow);
	}

	.slot.empty {
		border: 1.5px dashed var(--rule-hi);
		background: color-mix(in srgb, var(--paper-deep), transparent 35%);
		box-shadow: none;
	}

	.slot.empty.focused {
		border-style: solid;
		border-color: var(--rust);
		box-shadow:
			0 0 0 2.5px var(--rust),
			var(--shadow);
	}

	.box-slot {
		aspect-ratio: 1;
	}

	.party-slot {
		aspect-ratio: 1;
	}

	.slot-number {
		position: absolute;
		top: 4px;
		left: 5px;
		color: color-mix(in srgb, var(--ink), transparent 30%);
		font:
			700 0.48rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.04em;
	}

	.slot-sprite {
		width: 76%;
		height: 76%;
		aspect-ratio: auto;
		border-radius: 0;
		background: none;
		box-shadow: none;
		object-fit: contain;
		image-rendering: auto;
		pointer-events: none;
	}

	.empty-sprite {
		width: 34%;
		height: 34%;
		border: 1px solid var(--rule-hi);
		border-radius: 8px;
	}

	.slot-label,
	.slot-detail {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.box-slot .slot-label,
	.party-slot .slot-label {
		position: absolute;
		left: 4px;
		right: 4px;
		bottom: 3px;
		color: color-mix(in srgb, var(--ink), transparent 22%);
		font-size: 0.53rem;
		font-weight: 750;
		text-align: center;
	}

	.box-slot .slot-detail,
	.party-slot .slot-detail {
		display: none;
	}

	.slot-context {
		position: absolute;
		z-index: 40;
		top: calc(100% + 8px);
		left: 50%;
		width: 150px;
		display: grid;
		gap: 6px;
		padding: 8px;
		border-radius: 10px;
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
		transform: translateX(-50%);
	}

	.slot-context.align-start {
		left: 0;
		transform: none;
	}

	.slot-context.align-end {
		right: 0;
		left: auto;
		transform: none;
	}

	.slot-context-location {
		margin: 0 0 2px;
		color: var(--ink-mute);
		font:
			650 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
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
			650 0.65rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	.detail-rail {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.portrait-card {
		position: relative;
		height: 174px;
		display: grid;
		place-items: center;
		border-radius: 14px;
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(0, 0, 0, 0.025) 24px 25px
			),
			radial-gradient(circle at 30% 35%, #fff0a4, #e8c347);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
	}

	.dark .portrait-card {
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(255, 255, 255, 0.04) 24px 25px
			),
			radial-gradient(circle at 30% 35%, #685d2e, #312809);
	}

	.portrait-card img {
		width: 138px;
		height: 138px;
		object-fit: contain;
	}

	.portrait-card > span {
		width: 76px;
		height: 76px;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 16px;
	}

	.portrait-card small {
		position: absolute;
		top: 10px;
		left: 12px;
		color: color-mix(in srgb, var(--ink), transparent 45%);
		font:
			650 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	.detail-heading h2 {
		font-size: 1.45rem;
	}

	.online-indicator {
		padding: 6px 10px;
		border-radius: 10px;
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--ok);
		font:
			700 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.06em;
		white-space: nowrap;
	}

	.save-chip-status {
		margin-left: auto;
		color: var(--ink-mute);
		font-size: 0.7rem;
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
			650 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.04em;
	}

	.box-title em {
		font-style: normal;
	}

	.box-slot .slot-label em,
	.party-slot .slot-label em {
		display: block;
		margin-bottom: 1px;
		color: color-mix(in srgb, var(--ink), transparent 45%);
		font:
			700 0.5rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		font-style: normal;
		letter-spacing: 0.04em;
	}

	.box-slot .slot-label span,
	.party-slot .slot-label span {
		display: block;
	}

	.portrait-card {
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(0, 0, 0, 0.025) 24px 25px
			),
			radial-gradient(
				circle at 30% 35%,
				oklch(0.94 0.07 var(--slot-hue, 48)),
				oklch(0.78 0.13 var(--slot-hue, 48))
			);
	}

	.app-shell.dark .portrait-card {
		background:
			repeating-radial-gradient(
				circle at 30% 35%,
				transparent 0 24px,
				rgba(255, 255, 255, 0.04) 24px 25px
			),
			radial-gradient(
				circle at 30% 35%,
				oklch(0.5 0.08 var(--slot-hue, 48)),
				oklch(0.28 0.08 var(--slot-hue, 48))
			);
	}

	.portrait-empty {
		width: 64px;
		height: 64px;
		border: 1px dashed var(--rule-hi);
		border-radius: 16px;
	}

	.detail-level {
		display: grid;
		justify-items: end;
		gap: 0;
	}

	.detail-level span {
		color: var(--ink-mute);
		font:
			700 0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.06em;
	}

	.detail-level strong {
		color: var(--ink);
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
	}

	.stat-grid {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--paper);
		box-shadow: var(--shadow-sm);
	}

	.stat-row {
		display: grid;
		grid-template-columns: 32px 1fr 28px 36px;
		align-items: center;
		gap: 8px;
		font:
			700 0.62rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.05em;
	}

	.stat-row .stat-key {
		color: var(--ink-soft);
	}

	.stat-row .stat-bar {
		position: relative;
		display: block;
		height: 7px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--paper-deep), transparent 25%);
		overflow: hidden;
	}

	.stat-row .stat-bar i {
		position: absolute;
		inset: 0 auto 0 0;
		display: block;
		border-radius: 5px;
		background: linear-gradient(90deg, var(--rust), oklch(0.7 0.18 32));
	}

	.stat-row .stat-iv {
		color: var(--ink);
		text-align: right;
	}

	.stat-row .stat-ev {
		color: var(--ink-mute);
		text-align: right;
	}

	.moveset {
		display: grid;
		gap: 6px;
	}

	.moveset-label {
		color: var(--ink-mute);
		font:
			700 0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.08em;
	}

	.moveset-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.move-chip {
		--slot-hue: 48;
		display: grid;
		gap: 2px;
		padding: 8px 10px;
		border-radius: 9px;
		background: linear-gradient(
			135deg,
			oklch(0.92 0.07 var(--slot-hue)),
			oklch(0.86 0.1 var(--slot-hue))
		);
		color: var(--ink);
	}

	.app-shell.dark .move-chip {
		background: linear-gradient(
			135deg,
			oklch(0.42 0.08 var(--slot-hue)),
			oklch(0.34 0.09 var(--slot-hue))
		);
	}

	.move-chip strong {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.move-chip small {
		color: color-mix(in srgb, var(--ink), transparent 35%);
		font:
			700 0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}

	.detail-footer {
		display: grid;
		gap: 4px;
		padding: 8px 10px;
		border-top: 1px solid var(--rule);
	}

	.detail-footer div {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.7rem;
	}

	.detail-footer span {
		color: var(--ink-mute);
		font:
			700 0.58rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.06em;
	}

	.detail-footer strong {
		color: var(--ink);
		font-weight: 700;
	}

	.mobile-tabbar {
		display: none;
	}

	@media (max-width: 1120px) {
		.top-bar {
			grid-template-columns: 1fr auto auto;
		}

		.section-pills,
		.search-shell {
			display: none;
		}

		.storage-workspace {
			grid-template-columns: minmax(0, 1fr) 280px;
		}

		.box-sidebar {
			display: none;
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
		.box-sidebar,
		.party-zone,
		.box-zone,
		.detail-rail,
		.box-list,
		.box-grid {
			overflow: visible;
			min-height: 0;
		}

		.top-bar {
			grid-template-columns: auto 1fr auto auto auto;
			border-radius: 14px;
			gap: 8px;
			padding: 8px;
		}

		.save-chip,
		.online-indicator,
		.status-strip span:last-child {
			display: none;
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

		.box-sidebar,
		.workspace-column,
		.detail-rail {
			position: static;
			max-height: none;
		}

		.storage-workspace {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.workspace-column {
			order: 1;
		}

		.detail-rail {
			order: 2;
		}

		.party-zone,
		.box-zone,
		.detail-rail {
			border-radius: 14px;
			padding: 10px;
		}

		.party-list {
			grid-template-columns: repeat(6, minmax(44px, 1fr));
			gap: 6px;
		}

		.party-slot {
			min-height: 56px;
			aspect-ratio: 1;
			padding: 4px;
		}

		.party-slot .slot-sprite {
			width: 42px;
			height: 42px;
		}

		.party-slot .slot-label,
		.party-slot .slot-detail {
			display: none;
		}

		.box-grid {
			grid-template-columns: repeat(5, minmax(50px, 1fr));
			grid-auto-rows: minmax(50px, 1fr);
			align-content: start;
		}

		.box-slot {
			min-height: 62px;
		}

		.detail-rail {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}

		.portrait-card {
			height: 168px;
		}

		.detail-heading {
			align-items: flex-start;
			justify-content: space-between;
			gap: 8px;
		}

		.mobile-tabbar {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 60;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0;
			padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
			background: var(--paper-hi);
			border-top: 1px solid var(--rule);
			box-shadow: 0 -8px 24px -12px rgba(70, 50, 30, 0.18);
		}

		.mobile-tabbar button {
			display: grid;
			justify-items: center;
			gap: 2px;
			padding: 6px 4px;
			background: transparent;
			color: var(--ink-mute);
		}

		.mobile-tabbar button.active {
			color: var(--rust);
		}

		.mobile-tabbar button span {
			font-size: 1.05rem;
			line-height: 1;
		}

		.mobile-tabbar button small {
			font:
				700 0.58rem ui-monospace,
				SFMono-Regular,
				Menlo,
				monospace;
			letter-spacing: 0.05em;
		}
	}

	@media (max-width: 520px) {
		.brand-lockup p,
		.save-actions button:nth-of-type(2),
		.filter-row,
		.box-footer span:nth-child(2) {
			display: none;
		}

		.brand-lockup h1 {
			font-size: 1.1rem;
		}

		.save-actions button {
			padding: 0 10px;
		}

		.box-grid {
			gap: 6px;
		}
	}
</style>
