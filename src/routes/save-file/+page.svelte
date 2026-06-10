<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { updateAppChrome } from '$lib/pksx/app-chrome.svelte';

	type SaveEditorSection = 'trainer' | 'money' | 'bag';

	type SectionNavItem = {
		key: SaveEditorSection;
		label: string;
		detail: string;
		icon: string;
		staged: number;
	};

	type Pocket = {
		key: string;
		label: string;
		icon: string;
		count: number;
		staged?: boolean;
		locked?: boolean;
	};

	type BagItem = {
		name: string;
		detail: string;
		quantity: number;
		staged?: boolean;
		newItem?: boolean;
	};

	const fileName = 'tempest.sav';
	const gameName = 'Tempest';
	const stagedCount = 6;

	const sections: SectionNavItem[] = [
		{ key: 'trainer', label: 'Trainer profile', detail: 'Identity & badges', icon: '◎', staged: 3 },
		{ key: 'money', label: 'Money & BP', detail: 'Wallet currencies', icon: '¤', staged: 1 },
		{ key: 'bag', label: 'Bag', detail: 'Inventory pockets', icon: '▤', staged: 2 }
	];

	const pockets: Pocket[] = [
		{ key: 'items', label: 'Items', icon: '◴', count: 38 },
		{ key: 'medicine', label: 'Medicine', icon: '+', count: 21, staged: true },
		{ key: 'balls', label: 'Balls', icon: '−', count: 14 },
		{ key: 'berries', label: 'Berries', icon: '✺', count: 27 },
		{ key: 'tms', label: 'TMs', icon: '▤', count: 64 },
		{ key: 'key-items', label: 'Key Items', icon: '✦', count: 9, locked: true }
	];

	const bagItems: BagItem[] = [
		{ name: 'Mend Spray', detail: 'Restores 20 HP', quantity: 12 },
		{ name: 'Field Tonic', detail: 'Restores 60 HP', quantity: 40, staged: true },
		{ name: 'Full Mend', detail: 'Fully restores one ally', quantity: 3 },
		{ name: 'Revive Charm', detail: 'Revives a fainted ally', quantity: 5 },
		{ name: 'Antidote Leaf', detail: 'Cures poison', quantity: 9 },
		{ name: 'Wake Bell', detail: 'Cures sleep', quantity: 999, staged: true },
		{ name: 'Ether Vial', detail: 'Restores 10 PP to a move', quantity: 20, newItem: true }
	];

	const badges = [
		{ name: 'Cinder', earned: true },
		{ name: 'Tide', earned: true },
		{ name: 'Verdant', earned: true },
		{ name: 'Gale', earned: true },
		{ name: 'Quartz', earned: true },
		{ name: 'Hex', earned: false, staged: true },
		{ name: 'Frost', earned: false },
		{ name: 'Aurora', earned: false }
	];

	let activeSection = $state<SaveEditorSection>('trainer');
	let activePocket = $state('medicine');

	const activePocketLabel = $derived(
		pockets.find((pocket) => pocket.key === activePocket)?.label ?? 'Medicine'
	);

	$effect(() => {
		updateAppChrome({
			route: 'save-file',
			saveSummary: {
				fileName,
				saveType: 'MockSaveFile',
				gameVersion: gameName,
				gameVersionId: 0,
				generation: 9,
				trainerName: 'CASS',
				trainerId: 41203,
				playTime: '47:12',
				playedHours: 47,
				playedMinutes: 12,
				partyCount: 0,
				boxCount: 14,
				boxSlotCount: 30
			},
			boxCount: 14,
			activeBox: 0,
			fileName,
			busy: false,
			hasLoadedSave: true,
			controllerInputActive: false,
			importSave: null,
			exportSave: null
		});
	});

	function openBoxes() {
		void goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>Save File Editor · PKSX</title>
</svelte:head>

<section class="save-file-route" aria-label="Save File Editor mock">
	<div class="mobile-heading">
		<button type="button" aria-label="Back to boxes" onclick={openBoxes}>‹</button>
		<div>
			<h1>Save File editor</h1>
			<p>{fileName} · {gameName}</p>
		</div>
		<span><i aria-hidden="true"></i>{stagedCount} staged</span>
	</div>

	<aside class="field-sidebar" aria-label="Save File fields">
		<p>Save File Fields</p>
		<nav>
			{#each sections as section (section.key)}
				<button
					type="button"
					class:active={activeSection === section.key}
					onclick={() => (activeSection = section.key)}
				>
					<span class="nav-icon">{section.icon}</span>
					<strong>{section.label}</strong>
					<small>{section.detail}</small>
					{#if section.staged > 0}<em>{section.staged}</em>{/if}
				</button>
			{/each}
		</nav>
		<div class="backup-ready">
			<span>♢</span>
			<strong>Backup ready</strong>
			<small>auto before first write</small>
		</div>
	</aside>

	<main class="editor-panel" aria-live="polite">
		<div class="section-tabs" aria-label="Save File sections">
			{#each sections as section (section.key)}
				<button
					type="button"
					class:active={activeSection === section.key}
					onclick={() => (activeSection = section.key)}
				>
					{section.label.replace(' profile', '').replace(' & BP', '')}
					{#if section.staged > 0}<span>{section.staged}</span>{/if}
				</button>
			{/each}
		</div>

		{#if activeSection === 'trainer'}
			<section class="mock-section" aria-label="Trainer profile">
				<div class="section-copy">
					<p>Save File · Trainer Profile</p>
					<h2>Trainer profile</h2>
					<span>
						Every field is an editable projection of {fileName}. Editing stages a change; it does
						not touch Save File bytes until Apply.
					</span>
				</div>

				<div class="trainer-card">
					<div class="avatar">CA</div>
					<div>
						<strong>CASS</strong>
						<span>ID 41203 · SID 08891 · {gameName} · Gen 9</span>
					</div>
					<div class="playtime">
						<small>Play Time</small>
						<b>47:12</b>
					</div>
				</div>

				<div class="trainer-grid">
					<label class="mock-field staged">
						<span>OT Name <em>● staged</em></span>
						<input value="CASSIA" readonly aria-label="Mock OT name" />
						<small>was <s>CASS</s> · revert</small>
					</label>
					<label class="mock-field">
						<span>Trainer ID <small>0-65535</small></span>
						<input value="41203" readonly aria-label="Mock trainer ID" />
					</label>
					<label class="mock-field">
						<span>Secret ID <small>0-65535</small></span>
						<input value="08891" readonly aria-label="Mock secret ID" />
					</label>
					<div class="mock-field staged">
						<span>Gender <em>● staged</em></span>
						<div class="segmented">
							<button type="button" class="chosen">Boy</button>
							<button type="button">Girl</button>
						</div>
					</div>
					<label class="mock-field">
						<span>Language</span>
						<select aria-label="Mock language">
							<option>English</option>
						</select>
					</label>
					<label class="mock-field">
						<span>Play Time <small>HH:MM</small></span>
						<input value="47:12" readonly aria-label="Mock play time" />
					</label>
				</div>

				<div class="badges">
					<header>
						<span>Gym Badges · 6 / 8</span>
						<small>Tap to toggle earned</small>
					</header>
					<div>
						{#each badges as badge (badge.name)}
							<button
								type="button"
								class:earned={badge.earned}
								class:staged={badge.staged}
								aria-pressed={badge.earned || badge.staged}
							>
								<i aria-hidden="true">✦</i>
								<strong>{badge.name}</strong>
								<small>{badge.earned ? 'Earned' : badge.staged ? 'Staged' : '—'}</small>
							</button>
						{/each}
					</div>
				</div>
			</section>
		{:else if activeSection === 'money'}
			<section class="mock-section" aria-label="Money and Battle Points">
				<div class="section-copy">
					<p>Save File · Wallet</p>
					<h2>Money & Battle Points</h2>
					<span>
						Currencies are staged like any other field. Out-of-range entries are clamped to the
						engine maximum before Apply.
					</span>
				</div>

				<div class="wallet-grid">
					<div class="currency-card staged">
						<header><span>Money</span><em>● staged</em></header>
						<div class="currency-control">
							<button type="button">−</button>
							<strong>¤ 999,999</strong>
							<button type="button">+</button>
							<button type="button">MAX</button>
						</div>
						<p>was <s>184,320</s> · clamps to engine max</p>
					</div>
					<div class="currency-card">
						<header><span>Battle Points</span><small>max 9,999</small></header>
						<div class="currency-control">
							<button type="button">−</button>
							<strong><small>BP</small> 312</strong>
							<button type="button">+</button>
							<button type="button">MAX</button>
						</div>
					</div>
				</div>

				<div class="notice staged-notice">
					<span>●</span>
					<div>
						<strong>Money staged at the engine maximum (¤9,999,999)</strong>
						<p>Validation accepted the value. It will only be written when you Apply.</p>
					</div>
				</div>

				<div class="notice unsupported">
					<span>×</span>
					<div>
						<strong>Coins — unsupported</strong>
						<p>
							{gameName} has no game corner. Unsupported currencies are shown, not hidden, and never written.
						</p>
					</div>
				</div>
			</section>
		{:else}
			<section class="mock-section" aria-label="Bag inventory">
				<div class="section-copy">
					<p>Save File · Bag</p>
					<h2>Inventory</h2>
					<span>
						Quantity changes and added items stage per-pocket. Key Items are locked from quantity
						edits.
					</span>
				</div>

				<div class="pocket-row" aria-label="Bag pockets">
					{#each pockets as pocket (pocket.key)}
						<button
							type="button"
							class:active={activePocket === pocket.key}
							class:staged={pocket.staged}
							onclick={() => (activePocket = pocket.key)}
						>
							<span>{pocket.icon}</span>
							<strong>{pocket.label}</strong>
							<small>{pocket.count}</small>
							{#if pocket.locked}<em>▴</em>{/if}
						</button>
					{/each}
				</div>

				<div class="add-item">
					<span>⌕ Add an item to {activePocketLabel}...</span>
					<small>231 known</small>
					<button type="button">+ Add</button>
				</div>

				<div class="item-list">
					{#each bagItems as item (item.name)}
						<article class:staged={item.staged} class:new-item={item.newItem}>
							<div class="item-icon">✚</div>
							<div>
								<strong>{item.name}</strong>
								<p>{item.detail}</p>
								{#if item.staged}<small>● × {item.quantity}</small>{/if}
								{#if item.newItem}<small>NEW</small>{/if}
							</div>
							<div class="quantity">
								<button type="button">−</button>
								<b class:gold={item.staged || item.newItem}>×{item.quantity}</b>
								<button type="button">+</button>
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	</main>

	<footer class="apply-bar">
		<div class="stage-badge">{stagedCount}</div>
		<div>
			<strong>{stagedCount} staged edits</strong>
			<span>Trainer · Money · Bag — not yet written. Save File bytes untouched.</span>
		</div>
		<button type="button">Cancel all</button>
		<button type="button" class="apply">Apply edits <kbd>A</kbd></button>
	</footer>
</section>

<style>
	.save-file-route {
		--mock-rust: #c45a37;
		--mock-gold: #d2a23a;
		--mock-ink: #2b241c;
		--mock-muted: #9d8d76;
		--mock-panel: #fbf5e9;
		--mock-card: #f4ead9;
		--mock-rule: #eadcc4;
		min-height: calc(100dvh - 112px);
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 14px;
		color: var(--mock-ink);
	}

	.mobile-heading {
		display: none;
	}

	.field-sidebar,
	.editor-panel,
	.apply-bar {
		border: 1px solid color-mix(in srgb, var(--mock-rule), white 18%);
		border-radius: var(--pksx-radius-xl);
		background: color-mix(in srgb, var(--mock-panel), white 14%);
		box-shadow: var(--shadow-deep);
	}

	.field-sidebar {
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 18px;
	}

	.field-sidebar > p,
	.section-copy p,
	.mock-field > span,
	.currency-card header,
	.badges header,
	.apply-bar span {
		margin: 0;
		color: var(--mock-muted);
		font:
			750 0.74rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.field-sidebar nav {
		display: grid;
		gap: 10px;
	}

	.field-sidebar nav button {
		position: relative;
		min-height: 58px;
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) auto;
		gap: 3px 10px;
		align-items: center;
		padding: 10px;
		border: 1px solid transparent;
		border-radius: var(--pksx-radius-md);
		background: transparent;
		color: var(--mock-ink);
		text-align: left;
	}

	.field-sidebar nav button.active {
		border-color: color-mix(in srgb, var(--mock-rust), transparent 48%);
		background: color-mix(in srgb, var(--mock-rust), transparent 88%);
		color: var(--mock-rust);
	}

	.nav-icon {
		width: 34px;
		height: 34px;
		display: grid;
		grid-row: span 2;
		place-items: center;
		border-radius: 10px;
		background: var(--mock-card);
		color: var(--mock-muted);
		box-shadow: var(--shadow-sm);
	}

	.field-sidebar nav button.active .nav-icon {
		background: var(--mock-rust);
		color: white;
	}

	.field-sidebar strong,
	.editor-panel strong,
	.apply-bar strong {
		font-weight: 850;
	}

	.field-sidebar small {
		color: var(--mock-muted);
		font-size: 0.78rem;
	}

	.field-sidebar em,
	.section-tabs span,
	.pocket-row button.staged::after {
		min-width: 26px;
		display: inline-grid;
		place-items: center;
		border-radius: 999px;
		background: var(--mock-gold);
		color: white;
		font-style: normal;
		font-weight: 850;
	}

	.backup-ready {
		margin-top: auto;
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr);
		gap: 2px 8px;
		padding: 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--mock-card);
	}

	.backup-ready span {
		grid-row: span 2;
	}

	.backup-ready small {
		font-family: var(--pksx-font-mono);
	}

	.editor-panel {
		min-width: 0;
		min-height: 0;
		padding: 22px;
		overflow: auto;
	}

	.section-tabs {
		display: none;
	}

	.mock-section {
		display: grid;
		gap: 18px;
	}

	.section-copy h2 {
		margin: 3px 0 4px;
		font-size: clamp(1.9rem, 3vw, 2.4rem);
		line-height: 1;
	}

	.section-copy span {
		max-width: 760px;
		display: block;
		color: #726552;
		font-size: 1rem;
		font-weight: 650;
		line-height: 1.35;
	}

	.trainer-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 14px;
		padding: 14px;
		border-radius: var(--pksx-radius-lg);
		background: var(--mock-card);
		box-shadow: var(--shadow-sm);
	}

	.avatar {
		width: 60px;
		height: 60px;
		display: grid;
		place-items: center;
		border-radius: 16px;
		background: linear-gradient(135deg, #ffb0b0, #ffd1b4);
		color: #7d3d28;
		font-size: 1.4rem;
		font-weight: 900;
	}

	.trainer-card strong {
		display: block;
		font-size: 1.35rem;
	}

	.trainer-card span,
	.mock-field small,
	.currency-card p,
	.notice p,
	.item-list p,
	.apply-bar span {
		color: var(--mock-muted);
		font-weight: 650;
	}

	.playtime {
		text-align: right;
	}

	.playtime small {
		display: block;
		color: var(--mock-muted);
		font:
			750 0.7rem var(--pksx-font-mono),
			monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.playtime b {
		font-size: 1.5rem;
	}

	.trainer-grid,
	.wallet-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.mock-field,
	.currency-card {
		display: grid;
		gap: 10px;
		padding: 14px;
		border: 1px solid color-mix(in srgb, var(--mock-rule), white 8%);
		border-radius: var(--pksx-radius-lg);
		background: var(--mock-card);
	}

	.mock-field.staged,
	.currency-card.staged {
		border-color: color-mix(in srgb, var(--mock-gold), white 20%);
		background: color-mix(in srgb, var(--mock-gold), transparent 91%);
	}

	.mock-field > span,
	.currency-card header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.mock-field em,
	.currency-card em {
		padding: 3px 8px;
		border: 1px solid color-mix(in srgb, var(--mock-gold), white 14%);
		border-radius: 8px;
		color: var(--mock-gold);
		font-style: normal;
	}

	.mock-field input,
	.mock-field select {
		width: 100%;
		box-sizing: border-box;
		border: 0;
		border-radius: 10px;
		background: color-mix(in srgb, white, var(--mock-panel) 32%);
		color: var(--mock-ink);
		font: 850 1.05rem var(--pksx-font-sans);
		padding: 12px;
	}

	.segmented {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.segmented button {
		min-height: 42px;
		border-radius: 10px;
		background: color-mix(in srgb, white, var(--mock-panel) 32%);
		font-weight: 850;
	}

	.segmented button.chosen {
		background: var(--mock-gold);
		color: white;
	}

	.badges {
		display: grid;
		gap: 10px;
	}

	.badges header {
		display: flex;
		justify-content: space-between;
	}

	.badges div {
		display: grid;
		grid-template-columns: repeat(8, minmax(76px, 1fr));
		gap: 10px;
	}

	.badges button {
		min-height: 80px;
		display: grid;
		place-items: center;
		gap: 4px;
		border-radius: var(--pksx-radius-md);
		background: var(--mock-card);
	}

	.badges i {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--mock-rust), transparent 8%);
		color: white;
		font-style: normal;
	}

	.badges button:not(.earned):not(.staged) {
		opacity: 0.42;
	}

	.badges button.staged {
		outline: 2px solid color-mix(in srgb, var(--mock-gold), white 20%);
	}

	.currency-control {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) 44px 64px;
		gap: 10px;
		align-items: center;
	}

	.currency-control button {
		min-height: 44px;
		border-radius: 10px;
		background: color-mix(in srgb, white, var(--mock-panel) 26%);
		font-size: 1.2rem;
		font-weight: 900;
	}

	.currency-control button:last-child {
		color: var(--mock-gold);
		font-size: 0.8rem;
	}

	.currency-control strong {
		min-height: 54px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		padding: 0 18px;
		border: 1px solid color-mix(in srgb, var(--mock-gold), white 20%);
		border-radius: 12px;
		background: color-mix(in srgb, white, var(--mock-panel) 42%);
		color: var(--mock-gold);
		font-size: clamp(1.6rem, 3.8vw, 2.4rem);
	}

	.currency-card:not(.staged) .currency-control strong {
		border-color: color-mix(in srgb, var(--mock-rule), white 18%);
		color: var(--mock-ink);
	}

	.currency-control small {
		color: var(--mock-muted);
		font-size: 0.8rem;
	}

	.notice {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr);
		gap: 12px;
		align-items: center;
		padding: 14px;
		border-radius: var(--pksx-radius-lg);
	}

	.notice > span {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		background: var(--mock-gold);
		color: white;
		font-weight: 900;
	}

	.notice p {
		margin: 2px 0 0;
	}

	.staged-notice {
		border: 1px solid color-mix(in srgb, var(--mock-gold), white 24%);
		background: color-mix(in srgb, var(--mock-gold), transparent 92%);
	}

	.unsupported {
		border: 1px solid color-mix(in srgb, #db3a3a, white 44%);
		background: color-mix(in srgb, #db3a3a, transparent 93%);
	}

	.unsupported > span {
		background: #db3a3a;
	}

	.pocket-row {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.pocket-row button {
		position: relative;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px;
		border-radius: 12px;
		background: var(--mock-card);
		white-space: nowrap;
	}

	.pocket-row button.active {
		background: var(--mock-rust);
		color: white;
	}

	.pocket-row button.staged::after {
		content: '';
		position: absolute;
		top: -5px;
		right: -5px;
		width: 11px;
		height: 11px;
		min-width: 11px;
		border: 2px solid var(--mock-panel);
	}

	.add-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 10px;
		align-items: center;
		min-height: 48px;
		padding: 0 12px;
		border-radius: var(--pksx-radius-md);
		background: var(--mock-card);
		color: #726552;
	}

	.add-item button {
		min-height: 34px;
		padding: 0 14px;
		border-radius: 10px;
		background: var(--mock-rust);
		color: white;
		font-weight: 850;
	}

	.add-item small {
		padding: 4px 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--mock-rule), white 20%);
		color: var(--mock-muted);
	}

	.item-list {
		display: grid;
		gap: 8px;
	}

	.item-list article {
		display: grid;
		grid-template-columns: 42px minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
		min-height: 62px;
		padding: 10px;
		border: 1px solid color-mix(in srgb, var(--mock-rule), white 10%);
		border-radius: var(--pksx-radius-md);
		background: var(--mock-card);
	}

	.item-list article.staged {
		border-color: color-mix(in srgb, var(--mock-gold), white 20%);
		background: color-mix(in srgb, var(--mock-gold), transparent 92%);
	}

	.item-list article.new-item {
		border-color: color-mix(in srgb, #72a965, white 30%);
		background: color-mix(in srgb, #72a965, transparent 92%);
	}

	.item-icon {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		background: color-mix(in srgb, white, var(--mock-panel) 26%);
		font-weight: 900;
	}

	.item-list p {
		margin: 2px 0 0;
	}

	.item-list small {
		display: inline-block;
		margin-top: 3px;
		padding: 2px 8px;
		border: 1px solid currentColor;
		border-radius: 7px;
		color: var(--mock-gold);
		font:
			750 0.72rem var(--pksx-font-mono),
			monospace;
	}

	.quantity {
		display: grid;
		grid-template-columns: 32px 58px 32px;
		gap: 8px;
		align-items: center;
		text-align: center;
	}

	.quantity button {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: color-mix(in srgb, white, var(--mock-panel) 26%);
		font-weight: 900;
	}

	.quantity b.gold {
		color: var(--mock-gold);
	}

	.apply-bar {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-color: color-mix(in srgb, var(--mock-gold), white 30%);
	}

	.stage-badge {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--mock-gold);
		color: white;
		font-weight: 900;
	}

	.apply-bar button {
		min-height: 40px;
		padding: 0 18px;
		border-radius: 12px;
		background: var(--mock-card);
		font-weight: 850;
	}

	.apply-bar button.apply {
		background: var(--mock-rust);
		color: white;
	}

	.apply-bar kbd {
		margin-left: 8px;
		background: color-mix(in srgb, white, var(--mock-rust) 14%);
		color: var(--mock-rust);
	}

	@media (max-width: 980px) {
		.save-file-route {
			grid-template-columns: 1fr;
			grid-template-rows: auto minmax(0, 1fr) auto;
			gap: 12px;
			padding-bottom: 72px;
		}

		.mobile-heading {
			display: grid;
			grid-template-columns: 56px minmax(0, 1fr) auto;
			gap: 12px;
			align-items: center;
		}

		.mobile-heading button {
			width: 56px;
			height: 56px;
			border-radius: 16px;
			background: var(--mock-panel);
			box-shadow: var(--shadow-sm);
			font-size: 2rem;
			font-weight: 900;
		}

		.mobile-heading h1,
		.mobile-heading p {
			margin: 0;
		}

		.mobile-heading h1 {
			font-size: 1.7rem;
			line-height: 1;
		}

		.mobile-heading p {
			color: var(--mock-muted);
			font-weight: 750;
		}

		.mobile-heading > span {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px 14px;
			border-radius: 14px;
			background: var(--mock-panel);
			box-shadow: var(--shadow-sm);
			color: var(--mock-gold);
			font-weight: 900;
		}

		.mobile-heading i {
			width: 10px;
			height: 10px;
			border-radius: 999px;
			background: var(--mock-gold);
		}

		.field-sidebar {
			display: none;
		}

		.editor-panel {
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
			padding: 0;
			overflow: visible;
		}

		.section-copy {
			display: none;
		}

		.section-tabs {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
			margin-bottom: 14px;
		}

		.section-tabs button {
			position: relative;
			min-height: 56px;
			border-radius: 16px;
			background: var(--mock-panel);
			box-shadow: var(--shadow-sm);
			color: #705f4a;
			font-size: 1.05rem;
			font-weight: 900;
		}

		.section-tabs button.active {
			background: var(--mock-rust);
			color: white;
		}

		.section-tabs span {
			position: absolute;
			top: 8px;
			right: 10px;
			min-width: 25px;
			background: color-mix(in srgb, var(--mock-gold), white 8%);
		}

		.section-tabs button.active span {
			background: color-mix(in srgb, white, var(--mock-rust) 34%);
		}

		.trainer-card,
		.playtime {
			display: none;
		}

		.trainer-grid,
		.wallet-grid {
			grid-template-columns: 1fr;
		}

		.badges div {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.wallet-grid {
			gap: 14px;
		}

		.currency-control {
			grid-template-columns: 44px minmax(0, 1fr) 44px;
		}

		.currency-control button:last-child {
			display: none;
		}

		.item-list article {
			grid-template-columns: 54px minmax(0, 1fr) auto;
			min-height: 74px;
			border-radius: 18px;
		}

		.item-icon {
			width: 50px;
			height: 50px;
			border-radius: 14px;
		}

		.apply-bar {
			position: fixed;
			z-index: 70;
			right: 0;
			bottom: 0;
			left: 0;
			grid-template-columns: auto minmax(0, 1fr) auto;
			border-right: 0;
			border-bottom: 0;
			border-left: 0;
			border-radius: 0;
			padding: 12px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom))
				max(16px, env(safe-area-inset-left));
		}

		.apply-bar button:not(.apply) {
			display: none;
		}
	}

	@media (max-width: 620px) {
		.save-file-route {
			margin: -4px -4px 0;
		}

		.mobile-heading {
			grid-template-columns: 50px minmax(0, 1fr) auto;
		}

		.mobile-heading button {
			width: 50px;
			height: 50px;
		}

		.mobile-heading > span {
			padding: 8px 11px;
			font-size: 0.86rem;
		}

		.mock-field,
		.currency-card,
		.notice {
			border-radius: 18px;
			padding: 16px;
		}

		.badges div {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.quantity {
			grid-template-columns: 32px 48px 32px;
		}

		.add-item {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.add-item small {
			display: none;
		}

		.apply-bar {
			gap: 10px;
		}

		.apply-bar span {
			letter-spacing: 0;
			text-transform: none;
		}

		.apply-bar button.apply {
			min-width: 112px;
			padding: 0 14px;
		}

		.apply-bar kbd {
			display: none;
		}
	}
</style>
