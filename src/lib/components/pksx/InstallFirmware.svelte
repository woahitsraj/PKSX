<script lang="ts">
	import type { Board, TradeError } from '$lib/link-trade/contract';
	import type {
		FirmwareInstallProgress,
		FirmwareInstallResult
	} from '$lib/link-trade/install-firmware';

	interface Props {
		/** The caller sets this when the board answers HELLO, so the user confirms the overwrite. */
		overwrite: boolean;
		install: (
			onProgress: (progress: FirmwareInstallProgress) => void
		) => Promise<FirmwareInstallResult>;
		onDone: (board: Board) => void;
		onCancel: () => void;
	}

	let { overwrite, install, onDone, onCancel }: Props = $props();

	let step = $state<'ready' | 'confirm' | 'installing' | 'done' | 'failed'>('ready');
	let progress = $state<FirmwareInstallProgress | null>(null);
	let board = $state<Board | null>(null);
	let error = $state<TradeError | null>(null);

	const percent = $derived(
		progress?.stage === 'writing' && progress.total
			? Math.round((progress.written / progress.total) * 100)
			: null
	);
	const status = $derived(
		progress?.stage === 'writing'
			? `Installing firmware${percent === null ? '' : `, ${percent}%`}`
			: progress?.stage === 'restarting'
				? 'Restarting the board'
				: 'Checking the board'
	);

	function failureMessage(error: TradeError): string {
		switch (error.code) {
			case 'bootloader-not-entered':
				return 'The board did not start its installer.';
			case 'unsupported-chip':
				return error.message;
			case 'firmware-image-invalid':
				return 'The firmware file is damaged. Nothing was installed.';
			case 'port-busy':
				return 'The board is unplugged, or another tab or app uses it.';
			case 'unsupported-board':
			case 'protocol-mismatch':
			case 'firmware-mismatch':
				return 'The board did not report the expected firmware after the installation.';
			default:
				return 'The installation did not complete.';
		}
	}

	async function start() {
		step = 'installing';
		progress = null;
		const result = await install((next) => (progress = next));
		if (result.ok) {
			board = result.board;
			step = 'done';
		} else {
			error = result.error;
			step = 'failed';
		}
	}
</script>

<section class="install-firmware" aria-labelledby="install-firmware-title">
	{#if step === 'ready'}
		<h2 id="install-firmware-title">Install firmware</h2>
		<p>
			PKSX installs the Trade Radio firmware on your ESP32 board. Keep the board connected until the
			installation is complete.
		</p>
		<div class="actions">
			<button type="button" data-pksx-control-category="small" onclick={onCancel}>Cancel</button>
			<button
				type="button"
				data-pksx-control-category="small"
				class="primary"
				onclick={() => (overwrite ? (step = 'confirm') : start())}>Install firmware</button
			>
		</div>
	{:else if step === 'confirm'}
		<h2 id="install-firmware-title">Replace the firmware on this board?</h2>
		<p>This removes the firmware that is on the board now.</p>
		<div class="actions">
			<button type="button" data-pksx-control-category="small" onclick={() => (step = 'ready')}
				>Cancel</button
			>
			<button type="button" data-pksx-control-category="small" class="primary" onclick={start}
				>Replace firmware</button
			>
		</div>
	{:else if step === 'installing'}
		<h2 id="install-firmware-title">Installing firmware</h2>
		<p role="status">{status}</p>
		<progress max="100" value={percent ?? undefined} aria-label="Firmware installation"></progress>
		<p>Do not disconnect the board.</p>
	{:else if step === 'done' && board}
		<h2 id="install-firmware-title">Firmware installed</h2>
		<p role="status">
			The board runs firmware {board.firmwareVersion} with protocol {board.protocolVersion}.
		</p>
		<div class="actions">
			<button
				type="button"
				data-pksx-control-category="small"
				class="primary"
				onclick={() => onDone(board!)}>Done</button
			>
		</div>
	{:else if error}
		<h2 id="install-firmware-title">Firmware was not installed</h2>
		<p role="alert">{failureMessage(error)}</p>
		{#if error.code === 'bootloader-not-entered'}
			<p>
				Hold the BOOT button on the board and select Try again. Release the button when the
				installation starts.
			</p>
		{/if}
		<div class="actions">
			<button type="button" data-pksx-control-category="small" onclick={onCancel}>Cancel</button>
			<button type="button" data-pksx-control-category="small" class="primary" onclick={start}
				>Try again</button
			>
		</div>
	{/if}
</section>

<style>
	.install-firmware {
		display: grid;
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-3);
	}

	.install-firmware h2,
	.install-firmware p {
		margin: 0;
	}

	.install-firmware h2 {
		font-size: var(--pksx-type-title);
		line-height: 1.2;
	}

	.install-firmware p {
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 650;
	}

	.install-firmware progress {
		width: 100%;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--pksx-space-2);
	}

	.actions button {
		min-height: var(--pksx-small-control-height);
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink);
		font-size: var(--pksx-type-label);
		font-weight: 800;
	}

	.actions button:only-child {
		grid-column: 2;
	}

	.actions button.primary {
		background: var(--ink);
		color: var(--paper);
	}
</style>
