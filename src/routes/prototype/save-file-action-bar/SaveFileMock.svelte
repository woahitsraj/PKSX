<script lang="ts">
	interface Props {
		viewport: 'mobile' | 'desktop';
		draftName: string;
		draftMoney: string;
		onNameInput: (value: string) => void;
		onMoneyInput: (value: string) => void;
	}

	let { viewport, draftName, draftMoney, onNameInput, onMoneyInput }: Props = $props();
</script>

<div class={['save-file-mock', viewport]}>
	<header class="topbar">
		<div class="brand"><span>PK</span><strong>PKSX</strong></div>
		<nav aria-label="App sections">
			<button type="button">Boxes</button>
			<button type="button" class="active">Save File</button>
			<button type="button">Saves</button>
		</nav>
		<div class="file-context"><span>POKEMON EMER</span><strong>Emerald.sav</strong></div>
	</header>

	<div class="screen">
		<aside>
			<p>Save File</p>
			<button type="button" class="active"
				><span>◎</span><strong>Trainer</strong><small>Name &amp; gender</small></button
			>
			<button type="button"
				><span>¤</span><strong>Money</strong><small>Wallet balance</small></button
			>
			<button type="button"
				><span>▤</span><strong>Bag</strong><small>Inventory pockets</small></button
			>
		</aside>

		<main>
			<div class="mobile-sections" aria-label="Save File sections">
				<button type="button" class="active">Trainer</button>
				<button type="button">Money</button>
				<button type="button">Bag</button>
			</div>

			<header class="section-heading">
				<div>
					<p>TRAINER PROFILE</p>
					<h1>Who owns this Save File?</h1>
				</div>
				<span>Emerald.sav</span>
			</header>

			<section class="editor-card">
				<label>
					<span>Trainer name</span>
					<input
						value={draftName}
						maxlength="10"
						oninput={(event) => onNameInput(event.currentTarget.value)}
					/>
					<small>Edit this value to stage a change.</small>
				</label>
				<div class="gender-field">
					<span>Trainer gender</span>
					<div>
						<button type="button" class="active">Boy</button><button type="button">Girl</button>
					</div>
				</div>
			</section>

			<section class="money-card">
				<div>
					<p>WALLET</p>
					<strong>Money</strong>
				</div>
				<label>
					<span>Current balance</span>
					<input
						type="number"
						value={draftMoney}
						oninput={(event) => onMoneyInput(event.currentTarget.value)}
					/>
				</label>
			</section>
		</main>
	</div>
</div>

<style>
	.save-file-mock {
		height: 100%;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		padding-bottom: var(--mock-bottom-inset, 0);
		overflow: hidden;
		background: var(--paper);
		color: var(--ink);
	}

	.topbar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 18px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--rule-hi);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	.brand,
	.file-context,
	.section-heading,
	.money-card,
	.gender-field > div {
		display: flex;
		align-items: center;
	}

	.brand {
		gap: 8px;
		font-size: 0.8rem;
	}

	.brand > span {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border-radius: var(--pksx-radius-md);
		background: var(--rust);
		color: white;
		font-weight: 900;
	}

	.topbar nav {
		justify-self: center;
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.topbar button,
	.mobile-sections button,
	aside button,
	.gender-field button {
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		font: inherit;
	}

	.topbar nav button {
		padding: 7px 12px;
		border-radius: var(--pksx-radius-sm);
		font-size: 0.72rem;
		font-weight: 750;
	}

	.topbar nav button.active {
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--rust);
	}

	.file-context {
		align-items: flex-end;
		flex-direction: column;
		font-size: 0.68rem;
	}

	.file-context span,
	.section-heading p,
	.money-card p,
	.editor-card label > span,
	.gender-field > span,
	.money-card label > span {
		margin: 0;
		color: var(--ink-mute);
		font: 750 0.58rem var(--pksx-font-mono);
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.screen {
		min-height: 0;
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr);
		gap: 12px;
		padding: 12px;
		overflow: hidden;
	}

	aside,
	main,
	.editor-card,
	.money-card {
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-xl);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
	}

	aside {
		display: grid;
		align-content: start;
		gap: 8px;
		padding: 14px;
	}

	aside > p {
		margin: 0 4px 4px;
		color: var(--ink-mute);
		font: 750 0.62rem var(--pksx-font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	aside button {
		display: grid;
		grid-template-columns: 26px minmax(0, 1fr);
		grid-template-areas: 'icon label' 'icon detail';
		gap: 1px 8px;
		padding: 10px;
		border-radius: var(--pksx-radius-md);
		text-align: left;
	}

	aside button.active {
		background: var(--rust-wash);
		color: var(--rust);
	}

	aside button span {
		grid-area: icon;
		font-size: 1.2rem;
	}

	aside button strong {
		grid-area: label;
		font-size: 0.76rem;
	}

	aside button small {
		grid-area: detail;
		font-size: 0.6rem;
	}

	main {
		min-width: 0;
		min-height: 0;
		display: grid;
		align-content: start;
		gap: 12px;
		padding: 18px;
		overflow: auto;
	}

	.mobile-sections {
		display: none;
	}

	.section-heading {
		justify-content: space-between;
		gap: 16px;
	}

	.section-heading h1 {
		margin: 3px 0 0;
		font-size: clamp(1.25rem, 3vw, 2rem);
		line-height: 1;
	}

	.section-heading > span {
		padding: 7px 10px;
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font: 700 0.62rem var(--pksx-font-mono);
	}

	.editor-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr);
		gap: 16px;
		padding: 16px;
	}

	.editor-card label,
	.gender-field,
	.money-card label {
		display: grid;
		gap: 7px;
	}

	input {
		min-width: 0;
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
		color: var(--ink);
		font: 750 0.9rem var(--pksx-font-mono);
	}

	.editor-card small {
		color: var(--ink-mute);
		font-size: 0.66rem;
	}

	.gender-field > div {
		gap: 5px;
		padding: 4px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-deep);
	}

	.gender-field button {
		flex: 1;
		padding: 8px;
		border-radius: var(--pksx-radius-sm);
		font-size: 0.76rem;
		font-weight: 750;
	}

	.gender-field button.active {
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--rust);
	}

	.money-card {
		justify-content: space-between;
		gap: 24px;
		padding: 16px;
	}

	.money-card > div {
		display: grid;
		align-content: center;
		gap: 3px;
	}

	.money-card label {
		width: min(260px, 55%);
	}

	.mobile .topbar {
		grid-template-columns: auto minmax(0, 1fr);
		padding: 8px 10px;
	}

	.mobile .topbar nav {
		display: none;
	}

	.mobile .file-context {
		justify-self: end;
	}

	.mobile .screen {
		grid-template-columns: 1fr;
		padding: 10px;
	}

	.mobile aside {
		display: none;
	}

	.mobile main {
		gap: 10px;
		padding: 0;
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.mobile .mobile-sections {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}

	.mobile .mobile-sections button {
		padding: 10px 4px;
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		font-size: 0.68rem;
		font-weight: 800;
	}

	.mobile .mobile-sections button.active {
		background: var(--rust);
		color: white;
	}

	.mobile .section-heading {
		align-items: flex-start;
	}

	.mobile .section-heading > span {
		display: none;
	}

	.mobile .section-heading h1 {
		font-size: 1.35rem;
	}

	.mobile .editor-card {
		grid-template-columns: 1fr;
		gap: 12px;
		padding: 14px;
	}

	.mobile .money-card {
		align-items: flex-end;
		gap: 12px;
		padding: 14px;
	}

	.mobile .money-card label {
		width: min(180px, 58%);
	}
</style>
