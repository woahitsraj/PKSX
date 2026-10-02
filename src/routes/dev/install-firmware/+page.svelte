<script lang="ts">
	import { onMount } from 'svelte';
	import InstallFirmware from '$lib/components/pksx/InstallFirmware.svelte';
	import { radioPortSchema, type Board, type RadioPort } from '$lib/link-trade/contract';
	import { installFirmware } from '$lib/link-trade/install-firmware';

	const fakeFlashes = ['installs', 'needs-boot-button', 'esp32-s3', 'esp32-c6', 'write-fails'];

	let worker: Worker | null = null;
	let port = $state.raw<RadioPort | null>(null);
	let overwrite = $state(false);
	let result = $state('');

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
			install={(onProgress) => installFirmware(worker!, port!, onProgress)}
			onDone={done}
			onCancel={() => (port = null)}
		/>
	{:else}
		<label><input type="checkbox" bind:checked={overwrite} /> The board has firmware</label>
		<button type="button" onclick={chooseBoard}>Choose a real board</button>
		{#each fakeFlashes as flash (flash)}
			<button
				type="button"
				onclick={() => (port = radioPortSchema.parse({ kind: 'fake', script: 'trade', flash }))}
				>Simulated board: {flash}</button
			>
		{/each}
		<p>{result}</p>
	{/if}
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
