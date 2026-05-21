<script lang="ts">
	interface Props {
		variant?: 'status' | 'error';
		label?: string;
		message: string;
		secondary?: string | null;
	}

	let { variant = 'status', label, message, secondary = null }: Props = $props();
</script>

<section
	class={[variant === 'error' ? 'error-strip' : 'status-strip']}
	role={variant === 'error' ? 'alert' : undefined}
	aria-live={variant === 'status' ? 'polite' : undefined}
>
	{#if label}
		<strong>{label}</strong>
	{/if}
	<span>{message}</span>
	{#if secondary}
		<span>{secondary}</span>
	{/if}
</section>

<style>
	.status-strip,
	.error-strip {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 9px 12px;
		border: 0;
		border-radius: var(--pksx-radius-lg);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		color: var(--ink-soft);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.error-strip {
		color: var(--err);
	}

	@media (max-width: 820px) {
		.status-strip span:last-child {
			display: none;
		}
	}
</style>
