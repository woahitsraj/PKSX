<script lang="ts">
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

	type SlotFixture = {
		slot: number;
		label: string;
		detail: string;
		kind: 'pokemon' | 'empty';
	};

	const boxCount = 3;
	const partySlots: SlotFixture[] = Array.from({ length: PARTY_SLOT_COUNT }, (_, slot) => ({
		slot,
		label: slot === 0 ? 'Lead Slot' : 'Empty',
		detail: slot === 0 ? 'Fixture party position' : 'Available party position',
		kind: slot === 0 ? 'pokemon' : 'empty'
	}));

	const boxSlotsByBox: SlotFixture[][] = Array.from({ length: boxCount }, (_, box) =>
		Array.from({ length: BOX_SLOT_COUNT }, (_, slot) => {
			const featured = box === 0 && slot === 0;
			return {
				slot,
				label: featured ? 'Pikachu' : 'Empty',
				detail: featured ? 'Lv. 5 - fixture data' : `Box ${box + 1} slot ${slot + 1}`,
				kind: featured ? 'pokemon' : 'empty'
			};
		})
	);

	let navigation = $state<BoxNavigationState>(createInitialNavigationState(boxCount));
	let gamepadStatus = $state('No controller detected');

	const activeBoxSlots = $derived(boxSlotsByBox[navigation.activeBox]);
	const activeFocusId = $derived(getFocusId(navigation.focus, navigation.activeBox));
	const focusedSlot = $derived(
		navigation.focus.zone === 'party'
			? partySlots[navigation.focus.slot]
			: activeBoxSlots[navigation.focus.slot]
	);

	function dispatch(action: NavigationAction) {
		navigation = applyNavigationAction(navigation, action);
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
</script>

<svelte:head>
	<title>PKSX Box</title>
</svelte:head>

<main class="app-shell" aria-labelledby="screen-title" {@attach gamepadNavigation}>
	<section class="status-rail" aria-label="Current save summary">
		<div>
			<p class="eyebrow">PKSX</p>
			<h1 id="screen-title">Box Storage</h1>
		</div>
		<div class="save-chip">
			<span>Fixture save</span>
			<strong>Box {navigation.activeBox + 1}/{boxCount}</strong>
		</div>
		<p class="controller-status">{gamepadStatus}</p>
	</section>

	<section class="storage-workspace" aria-label="Party and box storage">
		<div class="grid-shell">
			<div
				id="party-grid"
				class="party-zone"
				role="grid"
				tabindex="0"
				aria-label="Party"
				aria-activedescendant={navigation.focus.zone === 'party' ? activeFocusId : undefined}
				aria-rowcount={PARTY_SLOT_COUNT}
				aria-colcount="1"
				onkeydown={handleGridKeydown}
			>
				<div class="zone-header">
					<h2>Party</h2>
					<span>6 slots</span>
				</div>
				<div class="party-list">
					{#each partySlots as slot (slot.slot)}
						<div role="row">
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
								<span class="slot-label">{slot.label}</span>
								<span class="slot-detail">{slot.detail}</span>
							</button>
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
					<div>
						<h2>Box {navigation.activeBox + 1}</h2>
						<span>30 slots</span>
					</div>
					<div class="box-switcher" aria-label="Box switcher">
						<button
							type="button"
							aria-label="Previous box"
							disabled={navigation.activeBox === 0}
							onclick={() => dispatch('previousBox')}>L</button
						>
						<button
							type="button"
							aria-label="Next box"
							disabled={navigation.activeBox === boxCount - 1}
							onclick={() => dispatch('nextBox')}>R</button
						>
					</div>
				</div>
				<div class="box-grid">
					{#each activeBoxSlots as slot (slot.slot)}
						{@const position = getBoxSlotPosition(slot.slot)}
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
							<span class="slot-label">{slot.label}</span>
							<span class="slot-detail">{slot.detail}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<aside class="focus-readout" aria-live="polite">
			<p class="eyebrow">Controller Focus</p>
			<strong>
				{navigation.focus.zone === 'party'
					? `Party slot ${navigation.focus.slot + 1}`
					: `Box ${navigation.activeBox + 1}, slot ${navigation.focus.slot + 1}`}
			</strong>
			<span>{focusedSlot.label} - {focusedSlot.detail}</span>
		</aside>
	</section>

	{#if navigation.actionSurfaceOpen}
		<div class="action-surface" role="dialog" aria-label="Slot actions">
			<div>
				<p class="eyebrow">Slot Actions</p>
				<h2>{focusedSlot.label}</h2>
				<p>
					{navigation.focus.zone === 'party'
						? `Party slot ${navigation.focus.slot + 1}`
						: `Box ${navigation.activeBox + 1}, slot ${navigation.focus.slot + 1}`}
				</p>
			</div>
			<div class="action-buttons">
				<button type="button" disabled>Summary</button>
				<button type="button" disabled>Move</button>
				<button type="button" onclick={closeActionSurface}>Close</button>
			</div>
		</div>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background:
			linear-gradient(90deg, rgba(46, 125, 112, 0.08) 1px, transparent 1px),
			linear-gradient(180deg, rgba(46, 125, 112, 0.08) 1px, transparent 1px), #111615;
		background-size: 34px 34px;
		color: #ecf5ef;
		font-family: 'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif;
	}

	button {
		font: inherit;
	}

	.app-shell {
		min-height: 100vh;
		padding: 24px;
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 18px;
	}

	.status-rail,
	.storage-workspace,
	.action-surface {
		border: 1px solid rgba(184, 213, 197, 0.18);
		background: rgba(16, 24, 22, 0.9);
		box-shadow: 0 18px 60px rgba(0, 0, 0, 0.25);
	}

	.status-rail {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 18px;
		padding: 18px 20px;
	}

	.eyebrow {
		margin: 0 0 4px;
		color: #8fd0b5;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: 1.65rem;
		line-height: 1.1;
	}

	h2 {
		font-size: 1rem;
		line-height: 1.2;
	}

	.save-chip,
	.controller-status,
	.focus-readout {
		border: 1px solid rgba(184, 213, 197, 0.16);
		background: rgba(232, 241, 235, 0.06);
	}

	.save-chip {
		display: grid;
		gap: 2px;
		padding: 10px 12px;
		min-width: 150px;
	}

	.save-chip span,
	.controller-status,
	.zone-header span,
	.slot-detail,
	.focus-readout span,
	.action-surface p {
		color: #9fb3aa;
		font-size: 0.82rem;
	}

	.controller-status {
		padding: 10px 12px;
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.storage-workspace {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 14px;
		padding: 18px;
	}

	.grid-shell {
		display: grid;
		grid-template-columns: minmax(150px, 0.34fr) minmax(480px, 1fr);
		gap: 16px;
		outline: none;
	}

	.party-zone,
	.box-zone {
		outline: none;
	}

	.party-zone:focus-visible,
	.box-zone:focus-visible {
		box-shadow: 0 0 0 3px rgba(143, 208, 181, 0.45);
	}

	.party-zone,
	.box-zone {
		min-width: 0;
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
		align-items: flex-start;
	}

	.party-list {
		display: grid;
		grid-template-rows: repeat(6, minmax(70px, 1fr));
		gap: 8px;
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(76px, 1fr));
		grid-template-rows: repeat(5, minmax(82px, 1fr));
		gap: 8px;
		min-width: 520px;
	}

	.slot {
		width: 100%;
		height: 100%;
		min-width: 0;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 4px;
		padding: 10px;
		border: 1px solid rgba(184, 213, 197, 0.16);
		border-radius: 8px;
		color: #ecf5ef;
		text-align: left;
		background: rgba(232, 241, 235, 0.055);
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			transform 120ms ease;
	}

	.slot:hover {
		border-color: rgba(143, 208, 181, 0.5);
		background: rgba(232, 241, 235, 0.09);
	}

	.slot.focused {
		border-color: #c9f56a;
		background:
			linear-gradient(135deg, rgba(201, 245, 106, 0.2), rgba(143, 208, 181, 0.08)),
			rgba(232, 241, 235, 0.08);
		box-shadow:
			0 0 0 2px rgba(201, 245, 106, 0.24),
			inset 0 0 0 1px rgba(255, 255, 255, 0.08);
		transform: translateY(-1px);
	}

	.slot-number {
		color: #8fd0b5;
		font-size: 0.72rem;
		font-weight: 800;
	}

	.slot-label {
		align-self: center;
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: 800;
	}

	.slot.empty .slot-label {
		color: #aebcb5;
		font-weight: 650;
	}

	.box-switcher,
	.action-buttons {
		display: flex;
		gap: 8px;
	}

	.box-switcher button,
	.action-buttons button {
		min-height: 36px;
		border: 1px solid rgba(184, 213, 197, 0.18);
		border-radius: 8px;
		background: rgba(232, 241, 235, 0.08);
		color: #ecf5ef;
		cursor: pointer;
		font-weight: 800;
	}

	.box-switcher button {
		aspect-ratio: 1;
		width: 40px;
	}

	.box-switcher button:disabled,
	.action-buttons button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.focus-readout {
		display: grid;
		gap: 4px;
		padding: 12px;
	}

	.action-surface {
		position: fixed;
		right: 24px;
		bottom: 24px;
		width: min(360px, calc(100vw - 48px));
		display: grid;
		gap: 16px;
		padding: 18px;
		z-index: 10;
	}

	.action-surface h2 {
		font-size: 1.25rem;
	}

	.action-buttons button {
		padding: 0 14px;
	}

	@media (max-width: 860px) {
		.app-shell {
			padding: 12px;
		}

		.status-rail {
			grid-template-columns: 1fr;
		}

		.grid-shell {
			grid-template-columns: 1fr;
		}

		.box-zone {
			overflow-x: auto;
		}
	}
</style>
