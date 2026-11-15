<script lang="ts">
	import { onMount } from 'svelte';
	import { getSavesStorage } from '$lib/pksx/saves-cache';
	import { seedTestSaves, testSaves, testSavesAllowed } from '$lib/pksx/test-saves';

	let status = $state('Loading test Save Files…');

	onMount(async () => {
		if (!testSavesAllowed(location.hostname)) {
			status = 'Test Save Files are only available on local, preview, and staging builds.';
			return;
		}
		try {
			await seedTestSaves(getSavesStorage());
			location.replace('/');
		} catch (error) {
			status = error instanceof Error ? error.message : String(error);
		}
	});
</script>

<svelte:head>
	<title>Test Save Files</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="grid min-h-dvh place-content-center gap-2 p-6 text-center">
	<h1>Test Save Files</h1>
	<p role="status">{status}</p>
	<p>{testSaves.length} Save Files, one for each generation.</p>
</main>
