<script lang="ts">
	interface Props {
		onNavigate?: (destination: string) => void;
	}

	let { onNavigate = () => undefined }: Props = $props();
</script>

<nav class="mobile-tabs" aria-label="App sections">
	<button type="button" onclick={() => onNavigate('Boxes')}
		><span>▦</span><small>Boxes</small></button
	>
	<button type="button" class="active" onclick={() => onNavigate('Save File')}
		><span>▣</span><small>Save</small></button
	>
	<button type="button" onclick={() => onNavigate('Saves')}
		><span>☁</span><small>Saves</small></button
	>
</nav>

<style>
	.mobile-tabs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		padding: 5px 8px max(5px, env(safe-area-inset-bottom));
		border-top: 1px solid var(--rule-hi);
		background: var(--paper-hi);
		box-shadow: 0 -8px 24px -12px rgba(70, 50, 30, 0.18);
	}

	button {
		display: grid;
		justify-items: center;
		gap: 1px;
		padding: 4px;
		border: 0;
		background: transparent;
		color: var(--ink-mute);
		font: inherit;
	}

	button.active {
		color: var(--rust);
	}

	button span {
		font-size: 0.9rem;
	}

	button small {
		font: 700 0.52rem var(--pksx-font-mono);
		letter-spacing: 0.04em;
	}
</style>
