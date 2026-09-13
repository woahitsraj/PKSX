<script lang="ts">
	let { pathname }: { pathname: string } = $props();
	const pages: Record<string, { title: string; description: string }> = {
		'/': {
			title: 'PKSX | Pokémon save manager for mobile and controllers',
			description:
				'Manage and edit Pokémon saves with PKSX, a free, cross-platform app built for mobile and controllers. Import a save to get started. Your saves stay on your device.'
		},
		'/boxes': {
			title: 'Boxes | PKSX',
			description: 'Browse and manage the Pokémon in your save files and on-device Pokémon Storage.'
		},
		'/trainer': {
			title: 'Trainer | PKSX',
			description: 'View and edit Trainer details in your active Pokémon save file.'
		},
		'/bag': {
			title: 'Bag | PKSX',
			description: 'View and edit the items in your active Pokémon save file.'
		},
		'/settings': {
			title: 'Settings | PKSX',
			description: 'Choose your PKSX theme and controls, and view app and license information.'
		}
	};
	const canonicalPath = $derived(pathname === '/save-file' ? '/trainer' : pathname);
	const metadata = $derived(pages[canonicalPath] ?? pages['/']);
	const canonical = $derived(`https://pksx.app${canonicalPath}`);
</script>

<svelte:head>
	<title>{metadata.title}</title>
	<meta name="description" content={metadata.description} />
	<link rel="canonical" href={canonical} />
	{#if pathname !== '/'}
		<meta name="robots" content="noindex, follow" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="PKSX" />
	<meta property="og:title" content={metadata.title} />
	<meta property="og:description" content={metadata.description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content="https://pksx.app/icons/icon-512.png" />
	<meta property="og:image:width" content="512" />
	<meta property="og:image:height" content="512" />
	<meta property="og:image:alt" content="PKSX app icon" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={metadata.title} />
	<meta name="twitter:description" content={metadata.description} />
	<meta name="twitter:image" content="https://pksx.app/icons/icon-512.png" />
	<meta name="twitter:image:alt" content="PKSX app icon" />
</svelte:head>
