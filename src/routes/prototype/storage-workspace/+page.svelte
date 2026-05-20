<script lang="ts">
	type SlotKind = 'pokemon' | 'empty' | 'placeholder';
	type Slot = {
		id: number;
		label: string;
		detail: string;
		kind: SlotKind;
		tone: string;
	};

	const boxTabs = ['BOX 1', 'BOX 2', 'BOX 3', 'BOX 4', 'BOX 5', 'BOX 6'];
	const partySlots: Slot[] = [
		{ id: 0, label: '1-UP', detail: 'Lv. 36', kind: 'pokemon', tone: 'amber' },
		{ id: 1, label: 'MARILL', detail: 'Lv. 24', kind: 'pokemon', tone: 'aqua' },
		{ id: 2, label: 'SLAKOTH', detail: 'Lv. 12', kind: 'pokemon', tone: 'rose' },
		{ id: 3, label: 'Empty', detail: 'Available', kind: 'empty', tone: 'empty' },
		{ id: 4, label: 'Empty', detail: 'Available', kind: 'empty', tone: 'empty' },
		{ id: 5, label: 'Empty', detail: 'Available', kind: 'empty', tone: 'empty' }
	];
	const boxSlots: Slot[] = Array.from({ length: 30 }, (_, id) => {
		const sample: Slot[] = [
			{ id, label: 'ARON', detail: 'Lv. 14', kind: 'pokemon', tone: 'steel' },
			{ id, label: 'RALTS', detail: 'Lv. 13', kind: 'pokemon', tone: 'mint' },
			{ id, label: 'MAKUHITA', detail: 'Lv. 17', kind: 'pokemon', tone: 'amber' },
			{ id, label: 'WINGULL', detail: 'Lv. 18', kind: 'pokemon', tone: 'aqua' },
			{ id, label: 'POOCHYENA', detail: 'Lv. 8', kind: 'pokemon', tone: 'violet' },
			{ id, label: 'Empty', detail: 'Slot open', kind: 'empty', tone: 'empty' }
		];

		return sample[id % sample.length];
	});

	let focusZone = $state<'party' | 'box'>('box');
	let focusedSlot = $state(0);
	let activeBox = $state(0);
	let partyCollapsed = $state(true);
	let selectedZone = $state<'party' | 'box' | null>(null);
	let selectedSlot = $state<number | null>(null);

	const focusedLabel = $derived(
		focusZone === 'party'
			? `Party slot ${focusedSlot + 1}`
			: `Box ${activeBox + 1}, slot ${focusedSlot + 1}`
	);
	const focusedEntity = $derived(
		focusZone === 'party'
			? partySlots[Math.min(focusedSlot, partySlots.length - 1)]
			: boxSlots[Math.min(focusedSlot, boxSlots.length - 1)]
	);
	const selectedEntity = $derived(
		selectedZone === null || selectedSlot === null
			? null
			: selectedZone === 'party'
				? partySlots[Math.min(selectedSlot, partySlots.length - 1)]
				: boxSlots[Math.min(selectedSlot, boxSlots.length - 1)]
	);
	const displayEntity = $derived(selectedEntity ?? focusedEntity);
	const displayText = $derived(`${displayEntity.label} ${displayEntity.detail}`);

	function focusSlot(zone: 'party' | 'box', slot: number) {
		focusZone = zone;
		focusedSlot = slot;
	}

	function selectSlot(zone: 'party' | 'box', slot: number) {
		focusSlot(zone, slot);
		selectedZone = zone;
		selectedSlot = slot;
	}

	function closeSelectedSlot() {
		selectedZone = null;
		selectedSlot = null;
	}

	function closeSelectedSlotFromOutside(event: PointerEvent) {
		const target = event.target;

		if (!(target instanceof Element)) {
			return;
		}

		if (target.closest('.slot-cell, .slot-context, .selected-strip, .box-panel-title, .panel-title')) {
			return;
		}

		closeSelectedSlot();
	}

	function switchBox(direction: -1 | 1) {
		activeBox = (activeBox + direction + boxTabs.length) % boxTabs.length;
		focusZone = 'box';
		focusedSlot = Math.min(focusedSlot, boxSlots.length - 1);
		selectedZone = null;
		selectedSlot = null;
	}
</script>

<svelte:head>
	<title>Storage Workspace Prototype</title>
</svelte:head>

<main class="prototype" aria-labelledby="prototype-title" onpointerdown={closeSelectedSlotFromOutside}>
	<header class="prototype-banner">
		<div>
			<p>Throwaway prototype</p>
			<h1 id="prototype-title">Transfer Desk</h1>
		</div>
		<div class="banner-meter">
			<span>Issue #40 UI direction</span>
			<strong>Soft green Box-first workspace with collapsible Party dock.</strong>
		</div>
	</header>

	<section class="workspace-frame" aria-label="Prototype storage workspace">
		<div class="storage-grid-region">
			<div class="box-panel" role="grid" aria-label={`${boxTabs[activeBox]} prototype slots`}>
				<div class="box-panel-title">
					<button type="button" aria-label="Previous box" onclick={() => switchBox(-1)}>&lt;</button>
					<div class="box-title">
						<strong>{boxTabs[activeBox]}</strong>
					</div>
					<button type="button" aria-label="Next box" onclick={() => switchBox(1)}>&gt;</button>
				</div>
				<div class="box-grid">
					{#each boxSlots as slot (slot.id)}
						<div class={['slot-cell', selectedZone === 'box' && selectedSlot === slot.id && 'is-selected']}>
							<button
								type="button"
								class={['slot', 'box-slot', slot.kind, slot.tone, focusZone === 'box' && focusedSlot === slot.id && 'is-focused']}
								aria-pressed={selectedZone === 'box' && selectedSlot === slot.id}
								onfocus={() => focusSlot('box', slot.id)}
								onpointerenter={() => focusSlot('box', slot.id)}
								onclick={() => selectSlot('box', slot.id)}
							>
								<span class="slot-index">{slot.id + 1}</span>
								<span class="sprite" aria-hidden="true"></span>
								<span class="slot-copy">
									<strong>{slot.label}</strong>
									<small>{slot.detail}</small>
								</span>
							</button>
							{#if selectedZone === 'box' && selectedSlot === slot.id}
								<div
									class={[
										'slot-context',
										slot.id % 6 <= 1 && 'align-start',
										slot.id % 6 >= 4 && 'align-end'
									]}
									role="menu"
									aria-label={`${slot.label} actions`}
								>
									<button type="button">View</button>
									<button type="button">Move</button>
									<button type="button">Export</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class={['party-panel', partyCollapsed && 'is-collapsed']} role="grid" aria-label="Party prototype slots">
				<div class="panel-title">
					<div>
						<strong>Party</strong>
						<span>6 slots</span>
					</div>
					<button
						type="button"
						aria-expanded={!partyCollapsed}
						aria-controls="prototype-party-slots"
						onclick={() => (partyCollapsed = !partyCollapsed)}
					>
						{partyCollapsed ? 'Show' : 'Hide'}
					</button>
				</div>
				{#if !partyCollapsed}
					<div id="prototype-party-slots" class="party-slots">
						{#each partySlots as slot (slot.id)}
							<div class={['slot-cell', selectedZone === 'party' && selectedSlot === slot.id && 'is-selected']}>
								<button
									type="button"
									class={['slot', slot.kind, slot.tone, focusZone === 'party' && focusedSlot === slot.id && 'is-focused']}
									aria-pressed={selectedZone === 'party' && selectedSlot === slot.id}
									onfocus={() => focusSlot('party', slot.id)}
									onpointerenter={() => focusSlot('party', slot.id)}
									onclick={() => selectSlot('party', slot.id)}
								>
									<span class="sprite" aria-hidden="true"></span>
									<span class="slot-copy">
										<strong>{slot.label}</strong>
										<small>{slot.detail}</small>
									</span>
								</button>
								{#if selectedZone === 'party' && selectedSlot === slot.id}
									<div class="slot-context align-start" role="menu" aria-label={`${slot.label} actions`}>
										<button type="button">View</button>
										<button type="button">Move</button>
										<button type="button">Export</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<footer class="status-readout">
			<span>Emerald fixture restored from Local Library</span>
			<strong>Parsed Save File data</strong>
			<small>Placeholder slots use muted outlines; parsed slots use filled sprite marks.</small>
		</footer>
	</section>

	<aside class="selected-strip" aria-live="polite">
		<strong>{displayText}</strong>
	</aside>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #10251f;
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

	:global(small) {
		font-weight: 500;
	}

	:global(button) {
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			system-ui,
			sans-serif;
	}

	button {
		font: inherit;
	}

	button {
		border: 0;
		cursor: pointer;
	}

	.prototype {
		min-height: 100vh;
		padding: 18px 18px 104px;
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 14px;
		background: #dff4ea;
		color: #17302a;
	}

	.prototype-banner {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 0.45fr);
		gap: 12px;
		align-items: stretch;
		color: #f4fff8;
	}

	.prototype-banner > div,
	.banner-meter,
	.workspace-frame {
		border: 2px solid rgba(17, 72, 48, 0.34);
		box-shadow: 0 10px 0 rgba(33, 89, 57, 0.18);
	}

	.prototype-banner > div {
		padding: 14px 16px;
		background: rgba(20, 74, 54, 0.88);
	}

	.prototype-banner p,
	.prototype-banner h1 {
		margin: 0;
	}

	.prototype-banner p,
	.panel-title span,
	.slot-copy small,
	.status-readout small {
		font-size: 0.76rem;
		font-weight: 650;
		letter-spacing: 0;
	}

	.prototype-banner h1 {
		margin-top: 4px;
		font-size: clamp(1.15rem, 2.6vw, 2rem);
		line-height: 1.05;
	}

	.prototype-banner .banner-meter {
		display: grid;
		gap: 4px;
		padding: 14px;
		background: #f7f3e8;
		color: #17302a;
	}

	.workspace-frame {
		min-width: 0;
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 12px;
		padding: 14px;
		background: rgba(246, 251, 243, 0.86);
	}

	.box-panel-title {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr) 48px;
		gap: 10px;
		align-items: center;
	}

	.box-panel-title button,
	.slot-context button {
		min-height: 38px;
		border-radius: 6px;
		background: #f5f0dd;
		color: #1c3c31;
		font-weight: 650;
		text-decoration: none;
		box-shadow: inset 0 -3px 0 rgba(35, 77, 55, 0.16);
	}

	.box-panel-title button {
		font-size: 1.4rem;
	}

	.box-title {
		display: grid;
		justify-items: center;
		padding: 8px 12px;
		border-radius: 8px;
		background: linear-gradient(180deg, #fffbf0, #d9d1bc);
	}

	.box-title strong {
		font-size: 1.25rem;
		font-weight: 800;
	}

	.storage-grid-region {
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(144px, 0.24fr) minmax(390px, 1fr) minmax(180px, 0.3fr);
		gap: 12px;
		align-items: stretch;
	}

	.party-panel,
	.box-panel,
	.detail-panel,
	.status-readout {
		min-width: 0;
		border: 2px solid rgba(37, 153, 125, 0.24);
		background: rgba(255, 255, 255, 0.32);
	}

	.party-panel,
	.box-panel {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 10px;
		padding: 10px;
	}

	.panel-title,
	.status-readout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.panel-title > div {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.panel-title button {
		min-height: 30px;
		padding: 0 11px;
		border-radius: 6px;
		background: rgba(32, 100, 68, 0.1);
		color: #244d42;
		font-weight: 650;
	}

	.party-slots {
		display: grid;
		grid-template-columns: repeat(6, minmax(96px, 1fr));
		gap: 7px;
	}

	.party-panel.is-collapsed {
		grid-template-rows: auto;
	}

	.box-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(52px, 1fr));
		grid-template-rows: repeat(5, minmax(64px, 1fr));
		gap: 7px;
	}

	.slot-cell {
		position: relative;
		min-width: 0;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.slot-cell.is-selected {
		z-index: 12;
	}

	.slot {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 100%;
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 7px;
		align-items: center;
		padding: 7px;
		border: 2px solid rgba(28, 84, 57, 0.22);
		border-radius: 7px;
		background: rgba(236, 255, 225, 0.58);
		color: #17302a;
		text-align: left;
	}

	.box-slot {
		grid-template-columns: 1fr;
		justify-items: center;
		text-align: center;
	}

	.slot.is-focused {
		border-color: #fff3a4;
		background: #fff8c5;
		box-shadow:
			0 0 0 3px #23a7c8,
			inset 0 0 0 2px #fff;
		transform: translateY(-1px);
	}

	.slot.empty,
	.slot.placeholder {
		background: rgba(248, 255, 242, 0.26);
		border-style: dashed;
		color: rgba(24, 58, 49, 0.58);
	}

	.sprite {
		width: 29px;
		aspect-ratio: 1;
		border-radius: 45% 55% 48% 52%;
		background:
			radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.9) 0 14%, transparent 15%),
			var(--sprite-color, #f0cf5a);
		box-shadow:
			inset -4px -5px 0 rgba(0, 0, 0, 0.16),
			0 2px 0 rgba(23, 68, 42, 0.2);
	}

	.empty .sprite {
		background: transparent;
		box-shadow: inset 0 0 0 2px rgba(34, 88, 64, 0.18);
	}

	.aqua {
		--sprite-color: #43bfc8;
	}

	.amber {
		--sprite-color: #e6b540;
	}

	.rose {
		--sprite-color: #e97f83;
	}

	.mint {
		--sprite-color: #65c980;
	}

	.steel {
		--sprite-color: #9aa5a0;
	}

	.violet {
		--sprite-color: #9d82d8;
	}

	.slot-index {
		position: absolute;
		top: 4px;
		left: 5px;
		font-size: 0.62rem;
		font-weight: 900;
		opacity: 0.62;
	}

	.slot-copy {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	.slot-copy strong,
	.slot-copy small {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slot-copy strong {
		font-size: 0.82rem;
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

	.slot-context button {
		width: 100%;
		min-height: 34px;
		padding: 0 12px;
		border-radius: 6px;
		text-align: left;
		box-shadow: none;
	}

	.slot-context button:hover,
	.slot-context button:focus-visible {
		background: #fff8dc;
		outline: none;
	}

	.status-readout {
		padding: 10px 12px;
		background: rgba(247, 252, 238, 0.8);
	}

	.selected-strip {
		position: fixed;
		right: 18px;
		bottom: 16px;
		left: 18px;
		z-index: 30;
		display: grid;
		place-items: center;
		width: min(340px, calc(100vw - 24px));
		margin: 0 auto;
		padding: 8px 12px;
		border: 2px solid rgba(12, 47, 35, 0.28);
		border-radius: 12px;
		background: rgba(11, 43, 34, 0.84);
		backdrop-filter: blur(8px);
		color: #f6fbf3;
		box-shadow: 0 14px 40px rgba(12, 47, 35, 0.24);
	}

	.selected-strip strong {
		margin: 0;
	}

	.selected-strip strong {
		display: block;
		font-size: 1rem;
		line-height: 1.2;
		text-align: center;
	}

	.workspace-frame {
		border: 0;
		border-radius: 14px;
		background: #f6fbf3;
		box-shadow: 0 22px 70px rgba(31, 102, 75, 0.24);
	}

	.storage-grid-region {
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas:
			'box'
			'party';
	}

	.party-panel {
		grid-area: party;
	}

	.box-panel {
		grid-area: box;
	}

	.party-panel,
	.box-panel,
	.status-readout {
		border-radius: 12px;
		border-color: rgba(37, 153, 125, 0.24);
	}

	@media (max-width: 920px) {
		.prototype {
			padding: 10px 10px 112px;
		}

		.prototype-banner,
		.storage-grid-region {
			grid-template-columns: 1fr;
			grid-template-areas: none;
		}

		.party-panel,
		.box-panel {
			grid-area: auto;
		}

		.box-grid {
			grid-template-columns: repeat(6, minmax(44px, 1fr));
			grid-auto-rows: minmax(58px, 1fr);
			gap: 5px;
		}

		.party-slots {
			grid-template-columns: 1fr;
		}

		.slot {
			padding: 5px;
		}

		.box-slot .slot-copy {
			display: none;
		}

		.status-readout {
			display: grid;
			justify-items: start;
		}

		.selected-strip {
			width: min(300px, calc(100vw - 20px));
			right: 10px;
			bottom: 10px;
			left: 10px;
			padding: 7px 10px;
		}
	}
</style>
