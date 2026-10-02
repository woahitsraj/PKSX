<script lang="ts">
	import { onMount } from 'svelte';
	import InstallFirmware from '$lib/components/pksx/InstallFirmware.svelte';
	import {
		fakeFlashSchema,
		radioPortSchema,
		type Board,
		type RadioPort
	} from '$lib/link-trade/contract';
	import { installFirmware } from '$lib/link-trade/install-firmware';

	const fakeFlashes = fakeFlashSchema.options;

	let worker: Worker | null = null;
	let port = $state.raw<RadioPort | null>(null);
	let overwrite = $state(false);
	let result = $state('');
	let lastPort = $state.raw<RadioPort | null>(null);

	onMount(() => {
		worker = new Worker(
			new URL('../../../lib/link-trade/trade-worker/trade.worker.ts', import.meta.url),
			{
				type: 'module'
			}
		);
		return () => worker?.terminate();
	});

	async function chooseBoard() {
		const serial = (
			navigator as unknown as {
				serial?: {
					requestPort(): Promise<{ getInfo(): { usbVendorId?: number; usbProductId?: number } }>;
				};
			}
		).serial;
		if (!serial) return void (result = 'This browser has no Web Serial.');
		port = { kind: 'web-serial', ...(await serial.requestPort()).getInfo() };
		lastPort = port;
	}

	/** Runs the connect-radio checks alone and shows the raw response. */
	function checkBoard() {
		const requestId = `check-${Date.now()}`;
		result = 'Checking...';
		const listen = (event: MessageEvent) => {
			if (event.data?.requestId !== requestId) return;
			worker!.removeEventListener('message', listen);
			result = JSON.stringify(event.data.ok ? event.data.result : event.data.error);
			worker!.postMessage({ type: 'disconnect-radio', requestId: `${requestId}-off` });
		};
		worker!.addEventListener('message', listen);
		worker!.postMessage({ type: 'connect-radio', requestId, port: lastPort });
	}

	function done(board: Board) {
		result = `Installed: ${JSON.stringify(board)}`;
		port = null;
	}
</script>

<main class="rig">
	<h1>Install firmware (dev)</h1>
	{#if port}
		<InstallFirmware
			{overwrite}
			install={async (onProgress) => {
				const outcome = await installFirmware(worker!, port!, onProgress);
				result = JSON.stringify(outcome.ok ? outcome.board : outcome.error);
				return outcome;
			}}
			onDone={done}
			onCancel={() => (port = null)}
		/>
	{:else}
		<label><input type="checkbox" bind:checked={overwrite} /> The board has firmware</label>
		<button type="button" onclick={chooseBoard}>Choose a real board</button>
		{#if lastPort}
			<button type="button" onclick={checkBoard}>Check the board again</button>
		{/if}
		{#each fakeFlashes as flash (flash)}
			<button
				type="button"
				onclick={() => (port = radioPortSchema.parse({ kind: 'fake', script: 'trade', flash }))}
				>Simulated board: {flash}</button
			>
		{/each}
	{/if}
	<p>{result}</p>
</main>

<style>
	.rig {
		display: grid;
		gap: var(--pksx-space-2);
		max-width: 28rem;
		padding: var(--pksx-space-3);
	}

	.rig button,
	.rig input {
		min-height: var(--pksx-control-height);
	}
</style>
