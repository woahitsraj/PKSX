<script lang="ts">
	import { onMount } from 'svelte';
	import type { TradeJournal, TradeEntry } from '$lib/link-trade/trade-journal';
	import { tradeProgress, tradeOutcomeMessage } from '$lib/link-trade/trade-display';
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
		createJournal?: () => Promise<TradeJournal>;
		createClient?: () => TradeWorkerClient;
		onClose: () => void;
	}

	let {
		pokemonLabel,
		location,
		source,
		prepare,
		createClient = createTradeWorkerClient,
		createJournal,
		onClose
	}: Props = $props();

	const ACTIVATION_MESSAGE = 'The browser needs a mouse or keyboard for this step. Try again.';

	type Step =
		| 'loading'
		| 'unsupported'
		| 'keys'
		| 'radio'
		| 'install'
		| 'game'
		| 'review'
		| 'exchange'
		| 'recovery';

	let client: TradeWorkerClient | null = null;
	let journal: TradeJournal | null = null;
	let entry = $state.raw<TradeEntry | null>(null);
	let recoveries = $state.raw<TradeEntry[]>([]);
	let exchangeMessage = $state<string | null>(null);
	let journalReady = $state(false);
	let partnerLabel = $state<string | null>(null);
	let pendingEvents = $state.raw<import('$lib/link-trade/contract').TradeWorkerEvent[]>([]);
	let savingEvents = false;

	async function loadJournal() {
		if (!createJournal) return;
		try {
			journal = await createJournal();
			recoveries = (await journal.recover()).filter(
				(item) =>
					item.outcome === 'outcome-unknown' || (item.outcome === 'completed' && !item.imported)
			);
			journalReady = true;
			if (recoveries.length) step = 'recovery';
		} catch {
			exchangeMessage = 'PKSX cannot open trade recovery on this device. Trading is unavailable.';
		}
	}

	async function saveEvents() {
		if (savingEvents || !journal) return;
		savingEvents = true;
		try {
			while (pendingEvents.length) {
				const event = pendingEvents[0];
				const saved = await journal.event(event);
				pendingEvents = pendingEvents.slice(1);
				if (saved) entry = saved;
				if (saved && event.type === 'trade-offer') {
					const offer = await journal.readOffer(saved.id);
					partnerLabel = offer?.projection?.nickname || offer?.projection?.speciesName || null;
				}
				if (saved?.outcome === 'completed') entry = await journal.retryImport(saved.id);
			}
			exchangeMessage = null;
		} catch {
			exchangeMessage =
				'PKSX could not save trade evidence. Keep this window open and retry saving. The console outcome has not changed.';
		} finally {
			savingEvents = false;
		}
	}

	async function startTrade() {
		if (!journal || !client || review?.status !== 'ready' || working || running) return;
		if (!board) {
			reviewRequest += 1;
			review = null;
			step = 'radio';
			radioMessage = 'Connect the Trade Radio again, then review the Pokemon before retrying.';
			return;
		}
		working = true;
		exchangeMessage = null;
		try {
			entry = await journal.prepare(review.reviewed, async () => {
				const result = await prepare(review!.status === 'ready' ? review!.reviewed.game : 'sword');
				return result.ok ? reviewedLinkTrade(source, result.value) : null;
			});
			step = 'exchange';
			partnerLabel = null;
			await journal.dispatch(entry.id, async (saved) => {
				const result = await client!.startSession(
					saved.id,
					saved.review.game,
					saved.review.outgoingBytes
				);
				if (!result.ok) {
					journal!.close();
					entry = (await journal!.recover()).find((item) => item.id === saved.id) ?? entry;
					exchangeMessage =
						'PKSX could not start the trade. Check the Switch and Trade Radio. Review again before trying a new trade.';
				}
			});
		} catch {
			exchangeMessage =
				'PKSX could not prepare this trade. The Pokemon may have changed, or local storage is unavailable. Review it again.';
		} finally {
			working = false;
		}
	}

	async function cancelTrade() {
		if (!client || !entry || !running || working) return;
		working = true;
		try {
			await client.cancelSession(entry.id);
		} finally {
			working = false;
		}
	}

	async function retryImport(choice?: 'link' | 'separate') {
		if (!journal || !entry || working) return;
		working = true;
		try {
			entry = await journal.retryImport(entry.id, choice);
		} catch {
			exchangeMessage =
				'PKSX could not save the local import. Keep this window open and try again.';
		} finally {
			working = false;
		}
	}

	let root: HTMLElement | undefined;
	let body: HTMLElement | undefined;
	let keyFile: HTMLInputElement | undefined;
	let step = $state<Step>('loading');
	const running = $derived(step === 'exchange' && entry !== null && entry.outcome === null);

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
		const stopErrors = active.onStopped?.(() => {
			journal?.close();
			void journal?.recover().then((entries) => {
				entry = entries.find((item) => item.id === entry?.id) ?? entry;
			});
		});
		const stopEvents = active.onEvent((event) => {
			if ('sessionId' in event && event.sessionId === entry?.id) {
				pendingEvents = [...pendingEvents, event];
				void saveEvents();
			}

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
		void loadCapabilities(active).then(loadJournal);
		return () => {
			stopEvents();
			stopErrors?.();
			journal?.close();
			active.terminate();
			client = null;
		};
	});

	function focusScope(target: HTMLElement) {
		root = target;
		const keepFocus = () => {
			if (target.contains(document.activeElement)) return;
			(
				target.querySelector<HTMLElement>('button.primary:not(:disabled)') ?? controls()[0]
			)?.focus();
		};
		const observer = new MutationObserver(keepFocus);
		observer.observe(target, { childList: true, subtree: true });
		keepFocus();
		return () => {
			observer.disconnect();
			root = undefined;
		};
	}

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
		const result = await prepare(game).catch(() => null);
		if (request !== reviewRequest) return;
		if (!result?.ok) return void (review = { status: 'error', game });
		const reviewed = reviewedLinkTrade(source, result.value);
		review = reviewed
			? { status: 'ready', prepared: result.value, reviewed }
			: { status: 'blocked', game, prepared: result.value };
	}

	function retryReview() {
		if (review?.status === 'error') void selectGame(review.game);
	}

	function back() {
		if (installing || working || savingEvents || pendingEvents.length) return;
		if (running) return void cancelTrade();
		if (step === 'exchange' || step === 'recovery') return onClose();
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
	<div class="trade-with-switch" {@attach focusScope}>
		{#if step === 'install' && lastPort}
			{@const port = lastPort}
			<InstallFirmware
				overwrite
				install={async (onProgress) => {
					installing = true;
					try {
						const result = await client!.installFirmware(port, onProgress);
						if (result.ok) {
							board = result.board;
							radioMessage = null;
							offerInstall = false;
						}
						return result;
					} finally {
						installing = false;
					}
				}}
				onDone={() => (step = board ? 'game' : 'radio')}
				onCancel={() => (step = 'radio')}
			/>
		{:else}
			<header>
				<p class="kicker">{location}</p>
				<h2 id="trade-with-switch-title">Trade with Switch</h2>
				<p class="pokemon">{pokemonLabel}</p>
			</header>

			<div
				class="trade-body"
				{@attach (node) => {
					body = node;
					return () => {
						body = undefined;
					};
				}}
			>
				{#if step === 'recovery'}
					<h3>Trade recovery</h3>
					<p>These trades need attention. Recovery never starts another console trade.</p>
					<button
						type="button"
						data-pksx-control-category="small"
						onclick={() => (step = realRadio ? 'keys' : 'unsupported')}>Set up another trade</button
					>
					{#each recoveries as saved (saved.id)}
						<button
							type="button"
							data-pksx-control-category="small"
							onclick={() => {
								entry = saved;
								step = 'exchange';
							}}>Review trade from {new Date(saved.createdAt).toLocaleString()}</button
						>
					{/each}
				{:else if step === 'exchange' && entry}
					<h3>{entry.outcome ? tradeOutcomeMessage(entry) : tradeProgress(entry)}</h3>
					{#if running}
						<p role="status">
							Keep this window open. Select the Pokemon and confirm on the Switch.
						</p>
						{#if entry.events.some((event) => event.type === 'trade-offer')}
							<p>
								The Switch has offered {partnerLabel ?? 'a Pokemon'}. Confirm on the Switch. This is
								not a completed trade.
							</p>
						{/if}
					{:else if entry.outcome === 'completed'}
						<p>The Switch trade completed. Your original Pokemon remains in PKSX.</p>
						{#if entry.imported}
							<p role="status">
								{entry.choice === 'link'
									? 'Linked to the original Pokemon in Pokemon Storage. Its original data is preserved.'
									: 'Received Pokemon saved in Pokemon Storage, Unfiled.'}
							</p>
						{:else if entry.returningSession && !entry.choice}
							<p>
								This may be a returning copy. Link it to the original Storage record and keep its
								original data, or import a separate record.
							</p>
						{:else if entry.importProblem === 'unparseable'}
							<p role="alert">
								PKSX cannot read the received Pokemon. Its received bytes are kept on this device
								for recovery.
							</p>
						{:else}
							<p role="alert">
								The trade completed, but the Pokemon has not been saved to Storage. Retry the local
								import. This never repeats the console trade.
							</p>
						{/if}
						{#if entry.legality}<p>
								{entry.legality.legal
									? 'Legality Check passed.'
									: 'Legality Check found issues. PKSX has not changed the Pokemon.'}
							</p>{/if}
					{:else if entry.outcome === 'cancelled'}
						<p>The console keeps its Pokemon. Your original Pokemon remains in PKSX.</p>
					{:else if entry.outcome === 'outcome-unknown'}
						<p>
							Check the Pokemon on the Switch to find out whether the trade completed. Saved offers
							are evidence only. PKSX will not repeat the trade or import an unconfirmed offer.
						</p>
					{:else if entry.error?.code === 'console-not-ready'}
						<p>Open Link Trade on the Switch and press A on both messages. Then retry.</p>
					{:else}
						<p>No trade happened. Check the Switch and Trade Radio, then retry.</p>
					{/if}
				{:else if step === 'loading'}
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
								class={hardwareVerified ? 'primary' : undefined}
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
						<p>
							Before starting, open Link Trade and press A on both Link Trade messages on the
							Switch.
						</p>
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
							Start only when the Switch is ready. Keep the Trade Radio connected until the outcome
							appears.
						</p>
					{/if}
				{/if}
				{#if exchangeMessage}<p role="alert">{exchangeMessage}</p>{/if}
			</div>

			<!-- A new row on each state moves focus to its main action. -->
			{#key `${step}-${review?.status}-${keysPresent}-${board !== null}-${entry?.outcome}-${entry?.imported}`}
				<div class="actions">
					{#if !running && !(step === 'review' && review?.status === 'ready')}
						<button type="button" data-pksx-control-category="small" onclick={back}>
							{firstStepBack || step === 'exchange' || step === 'recovery' ? 'Close' : 'Back'}
						</button>
					{/if}
					{#if step === 'exchange' && entry}
						{#if running}<button
								type="button"
								data-pksx-control-category="small"
								onclick={cancelTrade}>Cancel trade</button
							>{/if}
						{#if entry.choice === 'link' && !entry.imported}<button
								type="button"
								data-pksx-control-category="small"
								onclick={() => retryImport('separate')}>Import separately</button
							>{/if}
						{#if pendingEvents.length}<button
								type="button"
								data-pksx-control-category="small"
								onclick={saveEvents}>Retry saving evidence</button
							>{/if}
						{#if entry.outcome === 'failed'}<button
								type="button"
								data-pksx-control-category="small"
								class="primary"
								onclick={startTrade}>Retry</button
							>{/if}
						{#if entry.outcome === 'completed' && !entry.imported}
							{#if entry.returningSession && !entry.choice}<button
									type="button"
									data-pksx-control-category="small"
									onclick={() => retryImport('link')}>Link to original</button
								><button
									type="button"
									data-pksx-control-category="small"
									onclick={() => retryImport('separate')}>Import separately</button
								>
							{:else}<button
									type="button"
									data-pksx-control-category="small"
									onclick={() => retryImport()}>Retry local import</button
								>{/if}
						{/if}
					{:else if step === 'unsupported' && capabilities?.fakePort}
						<button type="button" data-pksx-control-category="small" onclick={() => (step = 'keys')}
							>Continue with simulated radio</button
						>
					{:else if step === 'keys'}
						<input
							{@attach (node) => {
								keyFile = node;
								return () => {
									keyFile = undefined;
								};
							}}
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
							disabled={!journalReady || working}
							onclick={startTrade}>Start trade</button
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
