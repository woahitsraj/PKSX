<script lang="ts">
	import { onMount } from 'svelte';
	import type { EngineResult, OutgoingLinkTrade } from '$lib/engine';
	import type {
		Board,
		LinkTradeGame,
		RadioPort,
		TradeWorkerCapabilities
	} from '$lib/link-trade/contract';
	import {
		canConnectRadio,
		radioFailure,
		reviewChanges,
		reviewedLinkTrade,
		tradeBlockingMessage,
		TRADE_GAME_NAMES,
		type ReviewedLinkTrade,
		type TradeSource
	} from '$lib/link-trade/trade-setup';
	import {
		createTradeWorkerClient,
		requestRadioPort,
		type TradeWorkerClient
	} from '$lib/link-trade/trade-worker-client';
	import type { NavigationAction } from '$lib/pksx/box-navigation';
	import InstallFirmware from './InstallFirmware.svelte';
	import TakeoverFrame from './TakeoverFrame.svelte';

	interface Props {
		pokemonLabel: string;
		location: string;
		source: TradeSource;
		prepare: (game: LinkTradeGame) => Promise<EngineResult<OutgoingLinkTrade>>;
		createClient?: () => TradeWorkerClient;
		onClose: () => void;
	}

	let {
		pokemonLabel,
		location,
		source,
		prepare,
		createClient = createTradeWorkerClient,
		onClose
	}: Props = $props();

	const ACTIVATION_MESSAGE = 'The browser needs a mouse or keyboard for this step. Try again.';

	type Step = 'loading' | 'unsupported' | 'keys' | 'radio' | 'install' | 'game' | 'review';

	let client: TradeWorkerClient | null = null;
	let root = $state<HTMLElement>();
	let body = $state<HTMLElement>();
	let keyFile = $state<HTMLInputElement>();
	let step = $state<Step>('loading');
	let capabilities = $state.raw<TradeWorkerCapabilities | null>(null);
	let keysPresent = $state(false);
	let keyMessage = $state<string | null>(null);
	let board = $state.raw<Board | null>(null);
	let radioMessage = $state<string | null>(null);
	let offerInstall = $state(false);
	let lastPort = $state.raw<RadioPort | null>(null);
	let working = $state(false);
	let installing = false;
	let review = $state.raw<
		| { status: 'loading'; game: LinkTradeGame }
		| { status: 'error'; game: LinkTradeGame }
		| { status: 'blocked'; game: LinkTradeGame; prepared: OutgoingLinkTrade }
		| { status: 'ready'; prepared: OutgoingLinkTrade; reviewed: ReviewedLinkTrade }
		| null
	>(null);
	let reviewRequest = 0;

	const realRadio = $derived(
		capabilities !== null && canConnectRadio(capabilities, navigator.userAgent)
	);
	const reviewGame = $derived(
		review ? TRADE_GAME_NAMES[review.status === 'ready' ? review.reviewed.game : review.game] : ''
	);
	const firstStepBack = $derived(step === 'loading' || step === 'unsupported' || step === 'keys');

	onMount(() => {
		const active = createClient();
		client = active;
		const stopEvents = active.onEvent((event) => {
			if (event.type === 'radio-connected') board = event.board;
			if (event.type !== 'radio-disconnected') return;
			board = null;
			if (event.error?.code !== 'radio-lost') return;
			radioMessage = 'The connection to the Trade Radio was lost. Connect it again.';
			offerInstall = false;
			if (step === 'game' || step === 'review') {
				reviewRequest += 1;
				review = null;
				step = 'radio';
			}
		});
		void loadCapabilities(active);
		return () => {
			stopEvents();
			active.terminate();
			client = null;
		};
	});

	// Steps replace their controls, so keep focus inside the Takeover when a control disappears.
	$effect(() => {
		if (!root) return;
		const target = root;
		const keepFocus = () => {
			if (target.contains(document.activeElement)) return;
			(
				target.querySelector<HTMLElement>('button.primary:not(:disabled)') ?? controls()[0]
			)?.focus();
		};
		const observer = new MutationObserver(keepFocus);
		observer.observe(target, { childList: true, subtree: true });
		keepFocus();
		return () => observer.disconnect();
	});

	async function loadCapabilities(active: TradeWorkerClient) {
		const result = await active.capabilities();
		if (client !== active) return;
		if (!result.ok) return void (step = 'unsupported');
		capabilities = result.value;
		keysPresent = result.value.keysPresent;
		step = realRadio ? 'keys' : 'unsupported';
	}

	async function importKeys(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !client) return;
		working = true;
		keyMessage = null;
		const result = await client.importKeys(await file.text());
		working = false;
		if (result.ok) keysPresent = true;
		else
			keyMessage =
				result.error.code === 'keys-incomplete'
					? `This file cannot be used. ${result.error.message}.`
					: 'PKSX could not save the Switch keys.';
	}

	function chooseKeyFile() {
		keyMessage = navigator.userActivation?.isActive === false ? ACTIVATION_MESSAGE : null;
		if (!keyMessage) keyFile?.click();
	}

	async function forgetKeys() {
		if (!client) return;
		working = true;
		keyMessage = null;
		const result = await client.forgetKeys();
		working = false;
		if (result.ok) keysPresent = false;
		else keyMessage = 'PKSX could not remove the Switch keys.';
	}

	async function chooseRadio() {
		radioMessage = null;
		offerInstall = false;
		try {
			const port = await requestRadioPort();
			if (port) await connect(port);
		} catch {
			radioMessage = ACTIVATION_MESSAGE;
		}
	}

	async function connect(port: RadioPort) {
		if (!client) return;
		lastPort = port;
		working = true;
		radioMessage = null;
		offerInstall = false;
		const result = await client.connectRadio(port);
		working = false;
		if (result.ok) {
			board = result.value;
			step = 'game';
		} else {
			({ message: radioMessage, offerInstall } = radioFailure(result.error));
		}
	}

	function openInstall(port: RadioPort) {
		lastPort = port;
		step = 'install';
	}

	async function selectGame(game: LinkTradeGame) {
		const request = (reviewRequest += 1);
		review = { status: 'loading', game };
		step = 'review';
		const result = await prepare(game);
		if (request !== reviewRequest) return;
		if (!result.ok) return void (review = { status: 'error', game });
		const reviewed = reviewedLinkTrade(source, result.value);
		review = reviewed
			? { status: 'ready', prepared: result.value, reviewed }
			: { status: 'blocked', game, prepared: result.value };
	}

	function retryReview() {
		if (review?.status === 'error') void selectGame(review.game);
	}

	function back() {
		if (installing || working) return;
		if (firstStepBack) return onClose();
		reviewRequest += 1;
		review = null;
		step = step === 'review' ? 'game' : step === 'game' || step === 'install' ? 'radio' : 'keys';
	}

	function controls() {
		return Array.from(root?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
	}

	export function dispatch(action: NavigationAction) {
		const all = controls();
		const index = all.indexOf(document.activeElement as HTMLButtonElement);
		if (action === 'back') return back();
		if (index < 0) return working ? undefined : all[0]?.focus();
		if (action === 'confirm') return all[index].click();
		if (body && (action === 'up' || action === 'down')) {
			const top = body.scrollTop + (action === 'down' ? 1 : -1) * body.clientHeight * 0.75;
			const next = Math.max(0, Math.min(body.scrollHeight - body.clientHeight, top));
			if (Math.abs(next - body.scrollTop) > 1) return void (body.scrollTop = next);
		}
		if (action === 'left' || action === 'up') all[Math.max(0, index - 1)].focus();
		else if (action === 'right' || action === 'down')
			all[Math.min(all.length - 1, index + 1)].focus();
	}
</script>

<TakeoverFrame
	labelledby={step === 'install' ? 'install-firmware-title' : 'trade-with-switch-title'}
	busy={step === 'loading' || working}
	onBack={back}
>
	<div class="trade-with-switch" bind:this={root}>
		{#if step === 'install' && lastPort}
			{@const port = lastPort}
			<InstallFirmware
				overwrite
				install={async (onProgress) => {
					installing = true;
					try {
						return await client!.installFirmware(port, onProgress);
					} finally {
						installing = false;
					}
				}}
				onDone={(installed) => {
					board = installed;
					radioMessage = null;
					offerInstall = false;
					step = 'game';
				}}
				onCancel={() => (step = 'radio')}
			/>
		{:else}
			<header>
				<p class="kicker">{location}</p>
				<h2 id="trade-with-switch-title">Trade with Switch</h2>
				<p class="pokemon">{pokemonLabel}</p>
			</header>

			<div class="trade-body" bind:this={body}>
				{#if step === 'loading'}
					<p role="status">Checking this browser</p>
				{:else if step === 'unsupported'}
					<h3>This browser cannot trade</h3>
					<p>
						Link Trade needs desktop Chrome or Edge, because the Trade Radio connects over USB.
						Safari, iOS and Android Chrome cannot connect to it.
					</p>
				{:else if step === 'keys'}
					<h3>Switch keys</h3>
					<p>
						A Link Trade needs the keys from your own Switch, in a file named prod.keys. PKSX keeps
						them on this device only. They are not included in Backups, Export or Cloud Sync.
					</p>
					<p role="status">
						{keysPresent ? 'Switch keys are saved on this device.' : 'No Switch keys are saved.'}
					</p>
					{#if keyMessage}<p role="alert">{keyMessage}</p>{/if}
				{:else if step === 'radio'}
					<h3>Trade Radio</h3>
					<p>
						Connect the Trade Radio to this computer with USB, then select Connect. PKSX checks the
						board and its firmware.
					</p>
					{#if board}
						<p role="status">
							{board.simulated ? 'A simulated Trade Radio is connected.' : 'Trade Radio connected.'}
						</p>
					{/if}
					{#if radioMessage}<p role="alert">{radioMessage}</p>{/if}
				{:else if step === 'game'}
					<h3>Destination game</h3>
					<p>Select the game that is open on your Switch.</p>
					{#if board?.simulated}<p role="status">A simulated Trade Radio is connected.</p>{/if}
					<div class="games">
						{#each capabilities?.games ?? [] as { game, hardwareVerified } (game)}
							<button
								type="button"
								data-pksx-control-category="small"
								class:primary={hardwareVerified}
								disabled={!hardwareVerified}
								aria-describedby={hardwareVerified ? undefined : `trade-game-${game}-reason`}
								onclick={() => selectGame(game)}>{TRADE_GAME_NAMES[game]}</button
							>
							{#if !hardwareVerified}
								<p id={`trade-game-${game}-reason`}>
									{TRADE_GAME_NAMES[game]} is not verified with a real Switch yet.
								</p>
							{/if}
						{/each}
					</div>
				{:else if review}
					<h3>Review for {reviewGame}</h3>
					{#if review.status === 'loading'}
						<p role="status">Checking {pokemonLabel}</p>
					{:else if review.status === 'error'}
						<p role="alert">PKSX could not check this Pokemon for {reviewGame}.</p>
					{:else if review.status === 'blocked'}
						<p role="alert">{pokemonLabel} cannot be traded to {reviewGame}.</p>
						<ul>
							{#each review.prepared.blockingReasons as reason (reason.message)}
								<li>{tradeBlockingMessage(reason, reviewGame)}</li>
							{/each}
						</ul>
					{:else}
						<p>
							PKSX sends a copy of {pokemonLabel} and keeps the original. The Switch exchanges the Pokemon
							that its player selects.
						</p>
						<p>You confirm the trade on the Switch. PKSX does not ask you to confirm it again.</p>
						{#if review.prepared.converted}
							<p role="alert">
								PKSX converts this copy for {reviewGame}. The copy has no HOME tracker, and
								{reviewGame} may refuse it.
							</p>
						{/if}
						{#if review.prepared.legality && !review.prepared.legality.legal}
							<p role="alert">
								The Legality Check reports problems with this copy. {reviewGame} may refuse it.
							</p>
						{/if}
						{#if reviewChanges(review.prepared.changes).length}
							<h4>Changes to the copy</h4>
							<ul>
								{#each reviewChanges(review.prepared.changes) as change (change.field)}
									<li>{change.field}: {change.before} to {change.after}</li>
								{/each}
							</ul>
						{/if}
						<p role="status">
							PKSX stops here. This version cannot start the trade, so nothing was sent.
						</p>
					{/if}
				{/if}
			</div>

			<!-- A new row on each state moves focus to its main action. -->
			{#key `${step}-${review?.status}-${keysPresent}-${board !== null}`}
				<div class="actions">
					{#if !(step === 'review' && review?.status === 'ready')}
						<button type="button" data-pksx-control-category="small" onclick={back}>
							{firstStepBack ? 'Close' : 'Back'}
						</button>
					{/if}
					{#if step === 'unsupported' && capabilities?.fakePort}
						<button type="button" data-pksx-control-category="small" onclick={() => (step = 'keys')}
							>Continue with simulated radio</button
						>
					{:else if step === 'keys'}
						<input
							bind:this={keyFile}
							data-pksx-control-category="composition"
							class="key-file"
							type="file"
							accept=".keys,text/plain"
							aria-label="Switch keys file"
							tabindex="-1"
							onchange={importKeys}
						/>
						{#if keysPresent}
							<button
								type="button"
								data-pksx-control-category="small"
								disabled={working}
								onclick={forgetKeys}>Forget keys</button
							>
							<button
								type="button"
								data-pksx-control-category="small"
								class="primary"
								disabled={working}
								onclick={() => (step = 'radio')}>Continue</button
							>
						{:else}
							<button
								type="button"
								data-pksx-control-category="small"
								class="primary"
								disabled={working}
								onclick={chooseKeyFile}>Import keys</button
							>
						{/if}
					{:else if step === 'radio'}
						{#if board}
							<button
								type="button"
								data-pksx-control-category="small"
								class="primary"
								onclick={() => (step = 'game')}>Continue</button
							>
						{:else}
							{#if realRadio}
								<button
									type="button"
									data-pksx-control-category="small"
									class="primary"
									disabled={working}
									onclick={chooseRadio}>Connect</button
								>
							{/if}
							{#if offerInstall && lastPort}
								<button
									type="button"
									data-pksx-control-category="small"
									disabled={working}
									onclick={() => openInstall(lastPort!)}>Install firmware</button
								>
							{/if}
							{#if capabilities?.fakePort}
								<button
									type="button"
									data-pksx-control-category="small"
									disabled={working}
									onclick={() => connect({ kind: 'fake', script: 'trade' })}
									>Use simulated radio</button
								>
								<button
									type="button"
									data-pksx-control-category="small"
									disabled={working}
									onclick={() => openInstall({ kind: 'fake', script: 'trade' })}
									>Install on simulated radio</button
								>
							{/if}
						{/if}
					{:else if step === 'review' && review?.status === 'error'}
						<button
							type="button"
							data-pksx-control-category="small"
							class="primary"
							onclick={retryReview}>Try again</button
						>
					{:else if step === 'review' && review?.status === 'ready'}
						<button type="button" data-pksx-control-category="small" onclick={back}>
							Change game
						</button>
						<button
							type="button"
							data-pksx-control-category="small"
							class="primary"
							onclick={onClose}>Done</button
						>
					{/if}
				</div>
			{/key}
		{/if}
	</div>
</TakeoverFrame>

<style>
	.trade-with-switch {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	header {
		padding: var(--pksx-space-3) var(--pksx-space-3) var(--pksx-space-2);
	}

	h2,
	h3,
	h4,
	p,
	ul {
		margin: 0;
	}

	h2 {
		font-size: var(--pksx-type-title);
		line-height: 1.25;
	}

	h3,
	h4 {
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	.kicker,
	.pokemon,
	.trade-body p,
	.trade-body ul {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 650;
	}

	.trade-body {
		display: grid;
		align-content: start;
		gap: var(--pksx-space-2);
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--pksx-space-3) var(--pksx-space-3);
	}

	.trade-body ul {
		padding-left: var(--pksx-space-3);
	}

	.games {
		display: grid;
		gap: var(--pksx-space-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-2) var(--pksx-space-3);
		border-top: 1px solid var(--pksx-color-border-strong);
	}

	button {
		min-height: var(--pksx-small-control-height);
		padding: 0 var(--pksx-space-3);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink);
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	button.primary {
		background: var(--ink);
		color: var(--paper);
	}

	button:disabled {
		opacity: 0.55;
	}

	.key-file {
		display: none;
	}
</style>
