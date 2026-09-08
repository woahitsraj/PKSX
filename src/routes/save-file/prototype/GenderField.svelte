<script lang="ts">
	import type { PrototypeEditor } from './editor-state.svelte';

	let { editor, compact = false }: { editor: PrototypeEditor; compact?: boolean } = $props();
	const pending = $derived(editor.pending.has('trainer-gender'));
</script>

<div class="sf-field gender" data-state={pending ? 'pending' : 'idle'}>
	<span class="sf-caption" id="sf-gender-label">Gender</span>
	<div
		class={['sf-segment', compact && 'sm']}
		role="radiogroup"
		aria-labelledby="sf-gender-label"
		aria-busy={pending}
	>
		{#each ['male', 'female'] as const as gender (gender)}
			<button
				type="button"
				role="radio"
				aria-checked={editor.profile.gender === gender}
				disabled={pending}
				onclick={() => void editor.commitGender(gender)}
			>
				{gender === 'male' ? 'Male' : 'Female'}
			</button>
		{/each}
	</div>
	<p class={['sf-status', pending && 'pending']} aria-live="polite">
		{pending ? 'Saving...' : 'Saves on select'}
	</p>
</div>

<style>
	.gender {
		display: grid;
		justify-items: start;
		gap: var(--sf-s1);
	}

	.gender[data-state='pending'] .sf-segment {
		border-color: var(--sf-pending-edge);
		background: var(--sf-pending);
	}
</style>
