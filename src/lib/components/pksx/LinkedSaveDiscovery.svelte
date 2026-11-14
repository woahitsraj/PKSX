<script lang="ts">
	import { onMount } from 'svelte';
	import { App } from '@capacitor/app';
	import { supportsSaveFolders } from '$lib/pksx/linked-save-folders';
	import { linkedSaveDiscovery } from '$lib/pksx/linked-save-folders/runtime.svelte';

	onMount(() => {
		if (!supportsSaveFolders()) return;
		void linkedSaveDiscovery.initialize();
		const listener = App.addListener('appStateChange', ({ isActive }) => {
			if (isActive && !linkedSaveDiscovery.picking) void linkedSaveDiscovery.initialize();
		});
		return () => {
			linkedSaveDiscovery.cancel();
			void listener.then((handle) => handle.remove());
		};
	});
</script>
