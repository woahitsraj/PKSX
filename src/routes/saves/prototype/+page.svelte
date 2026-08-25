<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import SavesLayoutPrototype from '../SavesLayoutPrototype.svelte';

	const requestedVariant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const variant = $derived(['A', 'B', 'C'].includes(requestedVariant) ? requestedVariant : 'A');
</script>

<svelte:head>
	<title>Saves layout prototype · PKSX</title>
</svelte:head>

{#if dev}
	<SavesLayoutPrototype {variant} />
{:else}
	<p>This prototype is available only in development.</p>
{/if}
