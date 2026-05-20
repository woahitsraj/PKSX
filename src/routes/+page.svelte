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
		kind: 'pokemon' | 'empty';
	};

	type LoadedSave = {
		file: StoredSaveFile;
		bytes: Uint8Array;
		workspace: SaveWorkspace;
	};

	const placeholderBoxCount = 3;
	const storage = new IndexedDbLocalLibraryStorage();

	const placeholderPartySlots: SlotView[] = Array.from({ length: PARTY_SLOT_COUNT }, (_, slot) => ({
		slot,
		label: slot === 0 ? 'Pikachu' : 'Empty',
		detail: slot === 0 ? 'Lv. 5' : '',
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
					kind: featured ? 'pokemon' : 'empty'
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
	let engine: EngineApi | null = null;
	let workspaceLoadRequest = 0;

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
	<title>PKSX Box</title>
</svelte:head>

<main
	class="app-shell"
	aria-labelledby="screen-title"
	onpointerdown={closeActionSurfaceFromOutside}
	{@attach gamepadNavigation}
>
	<header class="status-rail" aria-label="Current save summary">
		<div>
			<p class="eyebrow">PKSX</p>
			<h1 id="screen-title">Box Storage</h1>
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
		<div class="save-chip">
			<span>{loadedSave?.file.originalFileName ?? 'No Save File'}</span>
			<strong>Box {navigation.activeBox + 1}/{boxCount}</strong>
		</div>
		{#if saveSummary}
			<div class="save-chip save-summary">
				<span>{saveSummary.trainerName ?? 'Unknown trainer'}</span>
				<strong>
					Gen {saveSummary.generation} &middot; {saveSummary.partyCount} party &middot; {saveSummary.boxCount}
					boxes
				</strong>
			</div>
		{/if}
		<p class="controller-status">{gamepadStatus}</p>
	</header>

	{#if importError}
		<section class="error-strip" role="alert">
			<strong>Import error</strong>
			<span>{importError}</span>
		</section>
	{/if}

	<section class="status-strip" aria-live="polite">
		<span>{busy ? 'Working...' : statusMessage}</span>
	</section>

	<section class="storage-workspace" aria-label="Party and box storage">
		<div class="grid-shell">
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
					<div class="box-switcher" aria-label="Box switcher">
						<button type="button" aria-label="Previous box" onclick={() => dispatch('previousBox')}
							>&lt;</button
						>
						<div class="box-title">
							<h2>Box {navigation.activeBox + 1}</h2>
						</div>
						<button type="button" aria-label="Next box" onclick={() => dispatch('nextBox')}
							>&gt;</button
						>
					</div>
				</div>
				<div class="box-grid">
					{#each activeBoxSlots as slot (slot.slot)}
						{@const position = getBoxSlotPosition(slot.slot)}
						<div class={['slot-cell', isFocused('box', slot.slot) && 'selected']}>
							<button
								id={`box-${navigation.activeBox}-slot-${slot.slot}`}
								class={['slot', 'box-slot', slot.kind, isFocused('box', slot.slot) && 'focused']}
								type="button"
								role="gridcell"
								tabindex="-1"
								aria-selected={isFocused('box', slot.slot)}
								aria-rowindex={position.row + 1}
								aria-colindex={position.column + 1}
								onclick={() => focusBox(slot.slot)}
								ondblclick={openFocusedSlot}
							>
								<span class="slot-number">{slot.slot + 1}</span>
								<span class="slot-sprite" aria-hidden="true"></span>
								<span class="slot-label">{slot.label}</span>
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
									<p class="slot-context-location">Box {navigation.activeBox + 1}, slot {slot.slot + 1}</p>
									<button type="button" disabled>View</button>
									<button type="button" disabled>Move</button>
									<button type="button" disabled>Export</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<aside class="focus-readout" aria-live="polite">
				<strong>{focusedSlotSummary}</strong>
			</aside>

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
					<div>
						<h2>Party</h2>
						<span>6 slots</span>
					</div>
					<button
						class="party-toggle"
						type="button"
						aria-expanded={!partyCollapsed}
						aria-controls="party-list"
						onclick={() => (partyCollapsed = !partyCollapsed)}
					>
						{partyCollapsed ? 'Show' : 'Hide'}
					</button>
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
									isFocused('party', slot.slot) && 'focused'
								]}
								type="button"
								role="gridcell"
								tabindex="-1"
								aria-selected={isFocused('party', slot.slot)}
								aria-rowindex={slot.slot + 1}
								aria-colindex="1"
								onclick={() => focusParty(slot.slot)}
								ondblclick={openFocusedSlot}
							>
								<span class="slot-number">P{slot.slot + 1}</span>
								<span class="slot-sprite" aria-hidden="true"></span>
								<span class="slot-label">{slot.label}</span>
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
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #dff4ea;
		color: #17302a;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			system-ui,
			sans-serif;
		font-weight: 500;
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

	.status-rail > div:first-child,
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

	.status-rail > div:first-child {
		padding: 14px 16px;
		background: rgba(20, 74, 54, 0.88);
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

	.party-header > div {
		display: flex;
		align-items: baseline;
		gap: 10px;
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
		border-color: #fff3a4;
		background: #fff8c5;
		box-shadow:
			0 0 0 3px #23a7c8,
			inset 0 0 0 2px #fff;
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
			radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.9) 0 14%, transparent 15%),
			#9aa5a0;
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

	.focus-readout strong {
		font-size: 1rem;
		line-height: 1.2;
		text-align: center;
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
</style>
