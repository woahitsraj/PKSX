<script module lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	const searches = new SvelteMap<string, string>();
	const openValues = new SvelteSet<number>();
	let fieldsOpenMemory = false;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import DelayedSpinner from '$lib/components/pksx/DelayedSpinner.svelte';
	import type { PokedexEdit, PokedexProjection } from '$lib/engine/types';
	import type { WorkspaceState } from '$lib/pksx/backup-workflow';
	import { updateAppChrome } from '$lib/pksx/app-chrome.svelte';
	import { isControllerKeyboardEvent } from '$lib/pksx/controller-input';
	import {
		getActiveWorkspaceService,
		getCachedActiveWorkspaceBox,
		getSaveFileEditCoordinator,
		loadActiveWorkspaceFromSaves
	} from '$lib/pksx/saves-cache';
	import { resolveSpriteCatalogEntry } from '$lib/pksx/sprite-catalog';
	import { getToastHost } from '$lib/pksx/toast/host.svelte';
	import { pulse } from '$lib/pksx/haptics';

	type PokedexField = PokedexProjection['fields'][number];

	const toast = getToastHost();
	let workspace = $state.raw<WorkspaceState | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let pendingKey = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let fieldsOpen = $state(fieldsOpenMemory);
	let query = $state('');
	let mounted = false;
	let railReturn: { row: HTMLButtonElement; control: HTMLElement } | null = null;
	const pokedex = $derived(workspace?.workspace.saveFile?.pokedex);
	const all = $derived(pokedex?.species ?? []);
	const fields = $derived(pokedex?.fields ?? []);
	const railFields = $derived(fields.filter((f) => f.species === null));
	const fieldsOf = (id: number) => fields.filter((f) => f.species === id);
	const flagsOf = (entry: PokedexProjection['species'][number]) =>
		typeof entry.flagSet === 'number' ? (pokedex?.flagSets?.[entry.flagSet] ?? []) : [];
	const species = $derived(
		all.filter((s) =>
			[s.id, s.name, ...fieldsOf(s.id).map((f) => f.label)]
				.join(' ')
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
	const totals = $derived(
		(
			[
				['Seen', 'all-seen', all.filter((s) => s.seen).length],
				['Caught', 'all-caught', all.filter((s) => s.caught).length]
			] as const
		).map(([label, kind, count]) => ({ label, kind, count }))
	);

	onMount(() => {
		mounted = true;
		const unsubscribe = getActiveWorkspaceService().subscribe(acceptWorkspace);
		void load();
		return () => {
			mounted = false;
			unsubscribe();
		};
	});

	function acceptWorkspace(next: WorkspaceState | null) {
		if (next?.file.id !== workspace?.file.id)
			query = next ? (searches.get(next.file.id) ?? '') : '';
		workspace = next;
		updateAppChrome({ hasLoadedSave: Boolean(next), carryActive: false });
	}

	async function load() {
		loading = true;
		loadError = '';
		try {
			const next = await loadActiveWorkspaceFromSaves();
			if (mounted) acceptWorkspace(next);
		} catch (error) {
			if (mounted) loadError = error instanceof Error ? error.message : String(error);
		} finally {
			if (mounted) loading = false;
		}
	}

	const searchInput = () =>
		document.querySelector<HTMLInputElement>('[data-destination-focus="search"]');

	function openFields(open: boolean) {
		fieldsOpen = fieldsOpenMemory = open;
	}

	function search(value: string) {
		query = value;
		if (workspace) searches.set(workspace.file.id, value);
	}

	function spriteUrl(speciesId: number) {
		const entry = resolveSpriteCatalogEntry({
			speciesId,
			form: 0,
			isEgg: false,
			isShiny: false,
			displaySex: 'default'
		});
		return entry ? asset(entry.path) : null;
	}

	// Nearest rail control, only when the rail sits left of the list.
	function railControl(row: Element) {
		const { left, top, height } = row.getBoundingClientRect();
		const gap = (control: HTMLElement) => {
			const rect = control.getBoundingClientRect();
			return Math.round(Math.abs(rect.top + rect.height / 2 - top - height / 2));
		};
		return Array.from(
			document.querySelectorAll<HTMLElement>('.mark-all, .fields-body :is(input, button)')
		)
			.filter((control) => {
				const rect = control.getBoundingClientRect();
				return rect.width && rect.right <= left && control.ariaDisabled !== 'true';
			})
			.sort(
				(a, b) => gap(a) - gap(b) || b.getBoundingClientRect().left - a.getBoundingClientRect().left
			)[0];
	}

	function navigateSpecies(event: KeyboardEvent) {
		if (event.key === 'Tab') railReturn = null;
		if (event.altKey || event.ctrlKey || event.metaKey || !event.key.startsWith('Arrow')) return;
		const active = isControllerKeyboardEvent(event) ? document.activeElement : event.target;
		let target: HTMLElement | null | undefined;
		const returnRow = railReturn?.row.closest('.species-row');
		if (
			event.key === 'ArrowRight' &&
			active instanceof HTMLButtonElement &&
			active === railReturn?.control &&
			returnRow &&
			railControl(returnRow)
		) {
			target = railReturn.row;
			railReturn = null;
		} else if (active === searchInput()) {
			if (event.key !== 'ArrowDown') return;
			target = document.querySelector<HTMLElement>('.species-row .flag');
			if (!target) return;
		} else {
			if (!(active instanceof HTMLButtonElement)) return;
			const row = active.closest('.species-row');
			// Controls inside a species editor move by the shell's own rules.
			if (!row || active.closest('.species-values')) return;
			const controls = Array.from(row.querySelectorAll<HTMLButtonElement>('.values-toggle, .flag'));
			const index = controls.indexOf(active);
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				const left = event.key === 'ArrowLeft';
				target = controls[index + (left ? -1 : 1)] ?? (left ? railControl(row) : undefined);
				if (left && index === 0 && target) railReturn = { row: active, control: target };
			} else {
				const flags = (of: Element) => Array.from(of.querySelectorAll<HTMLButtonElement>('.flag'));
				const column = Math.max(0, flags(row).indexOf(active));
				const next = event.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
				const editor =
					event.key === 'ArrowDown' && active.matches('.values-toggle')
						? row.querySelector<HTMLElement>('.species-values :is(input, .species-flag)')
						: null;
				target =
					editor ??
					(next?.matches('.species-row')
						? flags(next)[column]
						: event.key === 'ArrowUp'
							? searchInput()
							: undefined);
			}
		}
		event.preventDefault();
		event.stopPropagation();
		target?.focus();
		target?.scrollIntoView({ block: 'nearest' });
	}

	async function apply(key: string, edit: PokedexEdit) {
		if (!workspace || pendingKey) return;
		const coordinator = getSaveFileEditCoordinator();
		const origin = coordinator.openWorkspace(workspace, getCachedActiveWorkspaceBox());
		pendingKey = key;
		fieldErrors = {};
		let failure = '';
		try {
			const result = await coordinator.enqueueEdit(origin, {
				key: 'pokedex',
				operation: { pokedex: edit }
			});
			if (!mounted) return;
			if (result.workspace) acceptWorkspace(result.workspace);
			if (!result.ok) failure = result.message;
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			if (mounted) pendingKey = null;
		}
		if (mounted && !failure) pulse('success');
		if (!mounted || !failure) return;
		if (edit.kind === 'field') fieldErrors = { [edit.field]: failure };
		else toast.error(failure);
	}
</script>

<svelte:window
	onkeydown={navigateSpecies}
	onfocusin={(event) => {
		if (event.target !== railReturn?.control) railReturn = null;
	}}
	onpointerdown={() => (railReturn = null)}
/>

{#snippet mark(label: string, on: boolean)}
	<svg class={['mark', on && 'on']} viewBox="0 0 12 12" aria-hidden="true">
		{#if label === 'Seen'}
			<path
				class="shape"
				d="M1 6c1.4-2.4 3-3.6 5-3.6S9.6 3.6 11 6c-1.4 2.4-3 3.6-5 3.6S2.4 8.4 1 6Z"
			/>
			{#if on}<circle class="detail" cx="6" cy="6" r="1.25" />{/if}
		{:else}
			<rect class="shape" x="1" y="1" width="10" height="10" rx="2.5" />
			{#if on}<path class="detail" d="M3.4 6.3 5.3 8l3.4-4" />{/if}
		{/if}
	</svg>
{/snippet}

{#snippet flag(name: string, id: number, label: 'Seen' | 'Caught', on: boolean, edit: PokedexEdit)}
	{@const key = `species-${id}-${label.toLowerCase()}`}
	<button
		type="button"
		class="flag"
		aria-label={`${name} ${label}`}
		aria-pressed={on}
		aria-disabled={pendingKey !== null}
		aria-busy={pendingKey === key}
		data-destination-focus={key}
		data-destination-fallbacks={JSON.stringify(['search'])}
		onclick={() => apply(key, edit)}
	>
		{@render mark(label, on)}
		{label}
	</button>
{/snippet}

{#snippet fieldForm(field: PokedexField, fallbacks?: string)}
	{@const error = fieldErrors[field.key]}
	<!-- The shell names focus targets pksx-pokedex-<identity>; match it so the label holds. -->
	{@const inputId = `pksx-pokedex-field-${field.key}`}
	<form
		class="field"
		onsubmit={(event) => {
			event.preventDefault();
			const value = new FormData(event.currentTarget).get('value');
			if (typeof value === 'string')
				void apply(`field-${field.key}`, {
					kind: 'field',
					field: field.key,
					value: Number(value)
				});
		}}
	>
		<label for={inputId}>{field.label}</label>
		<input
			id={inputId}
			name="value"
			type="number"
			inputmode="numeric"
			enterkeyhint="done"
			min={field.min}
			max={field.max}
			step="1"
			value={field.value}
			required
			style:--field-ch={String(field.max).length}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${inputId}-error` : undefined}
			data-destination-focus={`field-${field.key}`}
			data-destination-fallbacks={fallbacks}
		/>
		<button
			aria-disabled={pendingKey !== null}
			aria-busy={pendingKey === `field-${field.key}`}
			data-destination-focus={`apply-${field.key}`}
			data-destination-fallbacks={fallbacks}>Apply</button
		>
		{#if error}<small id={`${inputId}-error`} class="field-error" role="alert">{error}</small>{/if}
	</form>
{/snippet}

{#snippet routeState(heading: string, body: string, retry: boolean)}
	<div class="route-state" role={retry ? 'alert' : undefined}>
		<h1 id="pokedex-title">Pokedex</h1>
		<strong>{heading}</strong>
		<p>{body}</p>
		<div class="state-actions">
			{#if retry}
				<button type="button" data-destination-initial data-destination-focus="retry" onclick={load}
					>Retry</button
				>
			{/if}
			<button
				type="button"
				data-destination-initial={retry ? undefined : ''}
				data-destination-focus="back-boxes"
				onclick={() => goto(resolve('/boxes'), { keepFocus: true })}>Back to Boxes</button
			>
		</div>
	</div>
{/snippet}

<section
	class="pokedex pksx-density-container"
	data-destination-root="pokedex"
	data-initial-state={loading ? 'loading' : 'ready'}
	aria-labelledby="pokedex-title"
	aria-busy={loading}
>
	<div class="pokedex-density pksx-density">
		<div class="pokedex-container">
			{#if loading}
				<div class="route-state" aria-live="polite">
					<h1 id="pokedex-title">Pokedex</h1>
					<DelayedSpinner active label="Loading Pokedex" />
				</div>
			{:else if loadError}
				{@render routeState('Could not load this Save File', loadError, true)}
			{:else if !workspace}
				{@render routeState('No active Save File', 'Import or choose one in Saves.', false)}
			{:else if !pokedex || pokedex.status === 'unavailable'}
				{@render routeState(
					'Pokedex not available',
					pokedex?.reason ??
						'Pokedex capabilities are unavailable. Reload the Save File to try again.',
					false
				)}
			{:else}
				<div class="screen">
					<header class="identity">
						<h1 id="pokedex-title">Pokedex</h1>
						<p class="file">
							<span class="filename" title={workspace.file.originalFileName}
								>{workspace.file.originalFileName ?? 'Untitled Save File'}</span
							>
						</p>
					</header>

					<dl class="totals">
						{#each totals as total (total.label)}
							{@const key = `mark-${total.kind}`}
							<div class={['total', total.label.toLowerCase()]}>
								<dt>{@render mark(total.label, true)}{total.label}</dt>
								<dd><strong>{total.count}</strong> of <span class="num">{all.length}</span></dd>
								<dd class="meter" aria-hidden="true">
									<span style:inline-size={`${(total.count / all.length) * 100}%`}></span>
								</dd>
								<dd class="bulk">
									<button
										type="button"
										class="mark-all"
										aria-disabled={pendingKey !== null}
										aria-busy={pendingKey === key}
										data-destination-focus={key}
										onclick={() => apply(key, { kind: total.kind })}>Mark all {total.label}</button
									>
								</dd>
							</div>
						{/each}
					</dl>

					{#if railFields.length}
						<section class="fields" aria-label="Game-specific Pokedex values">
							<h2>Game-specific values</h2>
							<button
								type="button"
								class="fields-toggle"
								aria-expanded={fieldsOpen}
								aria-controls="pokedex-fields"
								data-destination-focus="game-fields"
								onclick={() => openFields(!fieldsOpen)}
							>
								Game-specific values
								<span class="fields-count">{railFields.length}</span>
								<svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"
									><path d="m3 4.5 3 3 3-3" /></svg
								>
							</button>
							<div
								id="pokedex-fields"
								class={['fields-body', fieldsOpen && 'open']}
								onfocusin={() => openFields(true)}
							>
								{#each railFields as field (field.key)}
									{@render fieldForm(field)}
								{/each}
							</div>
						</section>
					{/if}

					<section class="species" aria-label="Species">
						<div class="search-row">
							<label class="search">
								<svg viewBox="0 0 16 16" aria-hidden="true"
									><circle cx="7" cy="7" r="4.25" /><path d="m10.2 10.2 3.3 3.3" /></svg
								>
								<input
									type="search"
									aria-label="Search species"
									placeholder="Name or number"
									autocomplete="off"
									enterkeyhint="search"
									value={query}
									oninput={(event) => search(event.currentTarget.value)}
									data-destination-focus="search"
									data-destination-initial
								/>
							</label>
							<p class="count" aria-live="polite">
								{#if species.length === all.length}
									<span class="num">{all.length}</span> species
								{:else}
									<span class="num">{species.length}</span> of
									<span class="num">{all.length}</span>
								{/if}
							</p>
						</div>
						<div class="species-list">
							{#each species as entry (entry.id)}
								{@const sprite = spriteUrl(entry.id)}
								{@const own = fieldsOf(entry.id)}
								{@const flags = flagsOf(entry)}
								{@const valuesKey = `species-${entry.id}-values`}
								{@const valuesId = `pokedex-values-${entry.id}`}
								{@const open = openValues.has(entry.id)}
								<div class={['species-row', !entry.seen && !entry.caught && 'unseen']}>
									<span class="number">{String(entry.id).padStart(3, '0')}</span>
									{#if sprite}
										<img
											class="sprite"
											src={sprite}
											alt=""
											width="256"
											height="256"
											loading="lazy"
											decoding="async"
										/>
									{:else}<span class="sprite"></span>{/if}
									{#if own.length || flags.length}
										<span class="who">
											<strong class="name">{entry.name}</strong>
											<button
												type="button"
												class="values-toggle"
												aria-label={`${entry.name} values`}
												aria-expanded={open}
												aria-controls={open ? valuesId : undefined}
												data-destination-focus={valuesKey}
												data-destination-fallbacks={JSON.stringify(['search'])}
												onclick={() => openValues.delete(entry.id) || openValues.add(entry.id)}
											>
												Values
												<svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"
													><path d="m3 4.5 3 3 3-3" /></svg
												>
											</button>
										</span>
									{:else}
										<strong class="name">{entry.name}</strong>
									{/if}
									{@render flag(entry.name, entry.id, 'Seen', entry.seen, {
										kind: 'seen',
										species: entry.id,
										seen: !entry.seen
									})}
									{@render flag(entry.name, entry.id, 'Caught', entry.caught, {
										kind: 'caught',
										species: entry.id,
										caught: !entry.caught
									})}
									{#if open && (own.length || flags.length)}
										<div
											id={valuesId}
											class="species-values"
											role="group"
											aria-label={`${entry.name} values`}
										>
											{#each own as field (field.key)}
												{@render fieldForm(field, JSON.stringify([valuesKey, 'search']))}
											{/each}
											{#if flags.length}
												<div class="details">
													{#each flags as label, index (index)}
														{@const on = entry.flags?.[index] === '1'}
														{@const key = `flag-${entry.id}-${index}`}
														<button
															type="button"
															class="species-flag"
															aria-label={`${entry.name} ${label}`}
															aria-pressed={on}
															aria-disabled={pendingKey !== null}
															aria-busy={pendingKey === key}
															data-destination-focus={key}
															data-destination-fallbacks={JSON.stringify([valuesKey, 'search'])}
															onclick={() =>
																apply(key, {
																	kind: 'flag',
																	species: entry.id,
																	flag: index,
																	on: !on
																})}
														>
															{@render mark('Caught', on)}
															{label}
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{:else}
								<div class="empty">
									<p>No matching species.</p>
									<button
										type="button"
										data-destination-focus="clear-search"
										onclick={() => {
											search('');
											searchInput()?.focus();
										}}>Clear search</button
									>
								</div>
							{/each}
						</div>
					</section>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	:global(.app-shell:has(.pokedex)) {
		height: 100dvh;
		min-height: 100dvh;
		overflow: hidden;
	}

	.pokedex {
		flex: 1 1 0;
		overflow: hidden;
	}

	.pokedex,
	.pokedex-density,
	.pokedex-container,
	.screen {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}

	.pokedex-container {
		container: pokedex / size;
		font-size: var(--pksx-type-body);
		color: var(--pksx-color-text-primary);
	}

	.pokedex ::selection {
		background: var(--pksx-color-accent-ring);
	}

	.screen {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto auto minmax(0, 1fr);
		gap: var(--pksx-space-2);
	}

	h1,
	h2,
	p,
	dl,
	dd {
		margin: 0;
	}

	h1 {
		font-size: var(--pksx-type-display);
		line-height: 1.05;
	}

	.identity {
		display: grid;
		gap: var(--pksx-space-1);
		min-width: 0;
		padding-inline: var(--pksx-space-1) calc(var(--pksx-control-height) + var(--pksx-space-3));
	}

	.file {
		min-width: 0;
		color: var(--pksx-color-text-secondary);
	}

	.filename {
		display: block;
		font-family: var(--pksx-font-mono);
		font-size: var(--pksx-type-label);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.totals {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--pksx-space-3);
		padding-inline: var(--pksx-space-1);
	}

	.total {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		gap: var(--pksx-space-1) var(--pksx-space-2);
	}

	.total dt {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-1);
		font-size: var(--pksx-type-label);
		font-weight: 700;
	}

	.total dd {
		justify-self: end;
		font-size: var(--pksx-type-label);
		color: var(--pksx-color-text-secondary);
	}

	.num,
	.total strong {
		font-family: var(--pksx-font-mono);
		font-variant-numeric: tabular-nums;
	}

	.total strong {
		font-size: var(--pksx-type-title);
		color: var(--pksx-color-text-primary);
	}

	.total .meter {
		justify-self: stretch;
		grid-column: 1 / -1;
		block-size: 4px;
		border-radius: 2px;
		background: var(--pksx-color-border-strong);
		overflow: hidden;
	}

	.meter span {
		display: block;
		block-size: 100%;
		border-radius: inherit;
		background: var(--pksx-color-text-muted);
		transition: inline-size 200ms var(--pksx-ease-out);
	}

	.caught .meter span {
		background: var(--pksx-color-text-primary);
	}

	.total .bulk {
		justify-self: stretch;
		grid-column: 1 / -1;
	}

	.mark-all {
		inline-size: 100%;
	}

	.fields,
	.species,
	.route-state {
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-large);
		background: var(--pksx-color-surface-panel);
		box-shadow: var(--pksx-shadow-subtle);
	}

	.fields {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
	}

	.fields h2 {
		display: none;
		padding: var(--pksx-space-2) var(--pksx-space-2) 0;
		font-size: var(--pksx-type-title);
		line-height: 1.05;
	}

	.fields-toggle {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-2);
		padding-inline: max(8px, var(--pksx-space-2));
		border: 0;
		border-radius: 0;
		background: none;
		text-align: start;
	}

	.fields-count {
		font-family: var(--pksx-font-mono);
		color: var(--pksx-color-text-secondary);
	}

	.chevron {
		margin-inline-start: auto;
		transition: rotate 160ms var(--pksx-ease-out);
	}

	[aria-expanded='true'] > .chevron {
		rotate: 180deg;
	}

	.fields-body {
		display: none;
		align-content: start;
		gap: var(--pksx-space-2);
		min-height: 0;
		max-block-size: 40cqh;
		padding: var(--pksx-space-2);
		overflow-y: auto;
		overscroll-behavior-block: contain;
	}

	.fields-body.open {
		display: grid;
	}

	.field {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--pksx-space-1);
		min-width: 0;
	}

	.field label,
	.field-error {
		flex-basis: 100%;
	}

	.field label {
		font-size: var(--pksx-type-label);
		font-weight: 650;
		line-height: 1.25;
		color: var(--pksx-color-text-secondary);
	}

	.field input {
		inline-size: min(100%, calc(var(--field-ch) * 1ch + 2rem));
		font-family: var(--pksx-font-mono);
		font-variant-numeric: tabular-nums;
		appearance: textfield;
	}

	.field input::-webkit-inner-spin-button,
	.field input::-webkit-outer-spin-button {
		margin: 0;
		-webkit-appearance: none;
	}

	.field-error {
		font-size: var(--pksx-type-label);
		font-weight: 650;
		line-height: 1.25;
		color: var(--pksx-color-feedback-danger);
	}

	.species {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-3);
		padding: var(--pksx-space-2);
		border-bottom: var(--pksx-border-width) solid var(--pksx-color-border-strong);
	}

	.search {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
	}

	.search svg {
		position: absolute;
		inset-block: 0;
		inset-inline-start: var(--pksx-space-2);
		margin-block: auto;
		color: var(--pksx-color-text-secondary);
		pointer-events: none;
	}

	.search input {
		inline-size: 100%;
		padding-inline: calc(var(--pksx-icon-size) + var(--pksx-space-2) * 2) var(--pksx-space-2);
		background: var(--pksx-color-surface-canvas);
	}

	.search input::-webkit-search-cancel-button {
		filter: grayscale(1);
		cursor: pointer;
	}

	.search input::placeholder {
		color: var(--pksx-color-text-secondary);
	}

	.count {
		font-size: var(--pksx-type-label);
		color: var(--pksx-color-text-secondary);
		white-space: nowrap;
	}

	.species-list,
	.fields-body {
		scrollbar-width: thin;
		scrollbar-color: var(--pksx-color-border-strong) transparent;
	}

	.species-list {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior-block: contain;
		scroll-padding-block: var(--pksx-space-2);
	}

	.species-row {
		display: grid;
		grid-template-columns: 3ch var(--pksx-control-height) minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-1) var(--pksx-space-2);
		border-bottom: var(--pksx-border-width) solid var(--pksx-color-border-subtle);
	}

	.number {
		font-family: var(--pksx-font-mono);
		font-size: var(--pksx-type-label);
		font-variant-numeric: tabular-nums;
		color: var(--pksx-color-text-secondary);
	}

	.sprite {
		inline-size: var(--pksx-control-height);
		block-size: var(--pksx-control-height);
		object-fit: contain;
		image-rendering: pixelated;
		transition:
			filter 200ms var(--pksx-ease-out),
			opacity 200ms var(--pksx-ease-out);
	}

	.unseen .sprite {
		filter: brightness(0);
		opacity: 0.3;
	}

	:global(:is(.app-shell.dark, :root[data-pksx-theme='dark'] .app-shell)) .unseen .sprite {
		filter: brightness(0) invert(1);
	}

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--pksx-space-2);
		min-width: 0;
	}

	.values-toggle {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--pksx-space-1);
		border-color: var(--pksx-color-border-subtle);
		background: none;
		color: var(--pksx-color-text-secondary);
	}

	.values-toggle[aria-expanded='true'] {
		border-color: var(--pksx-color-border-strong);
		color: var(--pksx-color-text-primary);
	}

	.species-values {
		display: grid;
		grid-column: 3 / -1;
		gap: var(--pksx-space-2);
		min-width: 0;
		padding-block-end: var(--pksx-space-1);
	}

	.details {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-1);
	}

	.unseen .name {
		font-weight: 500;
		color: var(--pksx-color-text-secondary);
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: var(--pksx-space-2);
		padding: var(--pksx-space-3) var(--pksx-space-2);
		color: var(--pksx-color-text-secondary);
	}

	.route-state {
		display: grid;
		place-content: center;
		justify-items: start;
		gap: var(--pksx-space-2);
		height: 100%;
		padding: var(--pksx-space-4);
	}

	.state-actions {
		display: flex;
		gap: var(--pksx-space-1);
	}

	button,
	input {
		min-height: var(--pksx-control-height);
		border: var(--pksx-border-width) solid var(--pksx-color-border-strong);
		border-radius: var(--pksx-radius-small);
		background: var(--pksx-color-surface-panel);
		color: inherit;
		font: inherit;
		caret-color: var(--pksx-color-accent-primary);
	}

	button {
		padding-inline: var(--pksx-space-2);
		font-size: var(--pksx-type-label);
		font-weight: 700;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--pksx-color-accent-primary);
		background: var(--pksx-color-accent-wash);
	}

	input {
		padding: 0 var(--pksx-space-2);
	}

	/* Cancel the forms-plugin focus border and ring; the outline is the one indicator. */
	input:focus {
		border-color: var(--pksx-color-border-strong);
		box-shadow: none;
	}

	.field input[aria-invalid='true'] {
		border-color: var(--pksx-color-feedback-danger);
	}

	.flag,
	.species-flag {
		display: inline-flex;
		align-items: center;
		gap: var(--pksx-space-1);
		border-color: var(--pksx-color-border-subtle);
		background: none;
		color: var(--pksx-color-text-secondary);
	}

	:is(.flag, .species-flag)[aria-pressed='true'] {
		border-color: var(--pksx-color-border-strong);
		color: var(--pksx-color-text-primary);
	}

	svg {
		inline-size: var(--pksx-icon-size);
		block-size: var(--pksx-icon-size);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.mark {
		inline-size: var(--pksx-small-icon-size);
		block-size: var(--pksx-small-icon-size);
		stroke-width: 1.5;
	}

	.mark.on .shape {
		fill: currentColor;
	}

	.mark.on .detail {
		stroke: var(--pksx-color-surface-panel);
	}

	button[aria-busy='true'] {
		animation: busy 700ms 250ms ease-in-out infinite alternate;
	}

	@keyframes busy {
		to {
			opacity: 0.45;
		}
	}

	:is(button, input):focus-visible {
		outline: var(--pksx-focus-ring) solid var(--pksx-color-accent-ring);
		outline-offset: calc(-1 * var(--pksx-focus-ring));
	}

	@container pokedex (min-width: 540px) {
		.screen {
			--rail: clamp(200px, 32cqw, 300px);
			grid-template-columns: var(--rail) minmax(0, 1fr);
			grid-template-rows: auto auto minmax(0, 1fr);
			column-gap: var(--pksx-space-3);
			max-inline-size: calc(var(--rail) + var(--pksx-space-3) + 44rem);
			margin-inline: auto;
		}

		.identity {
			padding-inline-end: 0;
		}

		.totals {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--pksx-space-2);
		}

		.species {
			grid-column: 2;
			grid-row: 1 / -1;
		}

		.search-row {
			padding-inline-end: calc(var(--pksx-control-height) + var(--pksx-space-3));
		}

		.fields {
			align-self: start;
			max-block-size: 100%;
		}

		.fields h2 {
			display: block;
		}

		.fields-toggle {
			display: none;
		}

		.fields-body {
			display: grid;
			max-block-size: none;
		}
	}

	@container pokedex (max-width: 430px) {
		.species-row {
			grid-template-columns: 3ch var(--pksx-small-control-height) minmax(0, 1fr) auto auto;
			column-gap: var(--pksx-space-1);
		}

		.sprite {
			inline-size: var(--pksx-small-control-height);
			block-size: var(--pksx-small-control-height);
		}

		.flag,
		.species-flag,
		.values-toggle {
			padding-inline: max(5px, var(--pksx-space-1));
		}

		.who {
			flex-direction: column;
			align-items: start;
			gap: var(--pksx-space-1);
		}

		.who .name {
			max-inline-size: 100%;
		}

		.species-values {
			grid-column: 1 / -1;
		}
	}

	/* The centered species panel clears the Main Menu opener from here. */
	@container pokedex (min-width: 1160px) {
		.search-row {
			padding-inline-end: var(--pksx-space-2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.meter span,
		.sprite,
		.chevron,
		button[aria-busy='true'] {
			transition: none;
			animation: none;
		}
	}
</style>
