<script lang="ts">
	import { tick } from 'svelte';
	import { isControllerKeyboardEvent } from '$lib/pksx/controller-input';
	import ItemSprite from './ItemSprite.svelte';

	export type ComboboxOption = {
		value: string;
		label: string;
		disabled?: boolean;
		imageSrc?: string | null;
		meta?: string;
		detail?: string;
		hue?: number;
		chroma?: number;
	};

	interface Props {
		id?: string;
		ariaLabel?: string;
		labelledBy?: string;
		value?: string;
		options: ComboboxOption[];
		placeholder: string;
		searchLabel?: string;
		searchPlaceholder?: string;
		searchable?: boolean;
		disabled?: boolean;
		ariaInvalid?: boolean;
		describedBy?: string;
		staged?: boolean;
		controllerFocus?: string;
		controllerFallbacks?: string;
		ledgerControl?: boolean;
		ownsControllerInput?: boolean;
		requireExplicitEntry?: boolean;
		onSelect: (value: string) => void;
		onOpenChange?: (open: boolean) => void;
	}

	let {
		id,
		ariaLabel,
		labelledBy,
		value = '',
		options,
		placeholder,
		searchLabel = 'Search options',
		searchPlaceholder = 'Search',
		searchable,
		disabled = false,
		ariaInvalid = false,
		describedBy,
		staged = false,
		controllerFocus,
		controllerFallbacks,
		ledgerControl = false,
		ownsControllerInput = true,
		requireExplicitEntry = false,
		onSelect,
		onOpenChange
	}: Props = $props();

	const uid = $props.id();
	const triggerId = $derived(id ?? `${uid}-trigger`);
	const listId = $derived(`${triggerId}-list`);
	let root: HTMLDivElement | undefined;
	let trigger: HTMLButtonElement | undefined;
	let popover: HTMLDivElement | undefined = $state();
	let open = $state(false);
	let search = $state('');
	let activeIndex = $state(0);
	let popoverAbove = $state(false);
	let popoverMaxHeight = $state(320);
	let popoverAlignEnd = $state(false);
	let popoverMaxWidth = $state(420);
	const showSearch = $derived(searchable ?? options.length >= 7);
	const selected = $derived(options.find((option) => option.value === value));
	const showImages = $derived(options.some((option) => Object.hasOwn(option, 'imageSrc')));
	const filtered = $derived.by(() => {
		const query = normalize(search.trim());
		if (!query) return options;
		return options.filter((option) =>
			[option.label, option.meta, option.detail, option.value].some((part) =>
				normalize(part).includes(query)
			)
		);
	});
	const enabledFiltered = $derived(filtered.filter((option) => !option.disabled));

	function normalize(value: string | undefined) {
		return (value ?? '')
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase();
	}

	function openPicker(focusSearch = true) {
		if (disabled) return;
		if (open) {
			closePicker(true);
			return;
		}

		open = true;
		onOpenChange?.(true);
		search = '';
		const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
		activeIndex = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(filtered);
		void tick().then(() => {
			measurePopover();
			if (focusSearch && showSearch) document.getElementById(`${triggerId}-search`)?.focus();
			else focusOption(activeIndex);
		});
	}

	function measurePopover() {
		if (!trigger) return;
		const triggerRect = trigger.getBoundingClientRect();
		const bounds = clipBounds(trigger);
		const below = bounds.bottom - triggerRect.bottom - 8;
		const above = triggerRect.top - bounds.top - 8;
		popoverAbove = above > below;
		popoverMaxHeight = Math.max(0, Math.min(320, popoverAbove ? above : below));
		popoverMaxWidth = Math.max(0, Math.min(420, bounds.right - bounds.left - 16));
		popoverAlignEnd = !!popover && triggerRect.left + popover.offsetWidth > bounds.right - 8;
	}

	function clipBounds(node: HTMLElement) {
		const clips: HTMLElement[] = [];
		for (let parent = node.parentElement; parent; parent = parent.parentElement) {
			const style = getComputedStyle(parent);
			if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(parent);
		}
		return (clips.length > 0 ? clips : [document.body])
			.map((element) => element.getBoundingClientRect())
			.reduce(
				(bounds, rect) => ({
					top: Math.max(bounds.top, rect.top),
					left: Math.max(bounds.left, rect.left),
					right: Math.min(bounds.right, rect.right),
					bottom: Math.min(bounds.bottom, rect.bottom)
				}),
				{ top: -Infinity, left: -Infinity, right: Infinity, bottom: Infinity }
			);
	}

	function scrollOwner(node: HTMLElement) {
		let parent = node.parentElement;
		while (parent) {
			const overflowY = getComputedStyle(parent).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') return parent;
			parent = parent.parentElement;
		}
		return null;
	}

	function closePicker(restoreFocus = false) {
		open = false;
		onOpenChange?.(false);
		search = '';
		activeIndex = 0;
		if (restoreFocus) void tick().then(() => trigger?.focus());
	}

	export function handleBack() {
		if (!open) return false;
		closePicker(true);
		return true;
	}

	function choose(option: ComboboxOption) {
		if (option.disabled) return;
		if (option.value !== value) onSelect(option.value);
		closePicker(true);
	}

	function focusOption(index: number, direction: 1 | -1 = 1) {
		if (enabledFiltered.length === 0) return;
		const length = filtered.length;
		const start = ((index % length) + length) % length;
		let next: ComboboxOption | undefined;
		for (let offset = 0; offset < length; offset += 1) {
			const candidate = filtered[(start + direction * offset + length) % length];
			if (!candidate?.disabled) {
				next = candidate;
				break;
			}
		}
		if (!next) return;
		activeIndex = filtered.indexOf(next);
		void tick().then(() => {
			const target = document.getElementById(optionId(next));
			target?.focus();
			target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		});
	}

	function firstEnabledIndex(items: ComboboxOption[]) {
		return Math.max(
			0,
			items.findIndex((option) => !option.disabled)
		);
	}

	function optionId(option: ComboboxOption) {
		return `${triggerId}-option-${option.value}`;
	}

	function activeOptionId() {
		const option = filtered[activeIndex];
		return option ? optionId(option) : undefined;
	}

	function handleWindowClick(event: MouseEvent) {
		if (open && event.target instanceof Node && !root?.contains(event.target)) closePicker();
	}

	function handleRootFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (open && next instanceof Node && !root?.contains(next)) closePicker();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (!isControllerKeyboardEvent(event)) {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			closePicker(true);
			return;
		}
		if (!ownsControllerInput) return;
		if (event.key === 'Escape' || event.key === 'Backspace') {
			event.preventDefault();
			event.stopImmediatePropagation();
			closePicker(true);
			return;
		}

		const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
		const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
		if (!forward && !backward && event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopImmediatePropagation();

		const active = document.activeElement;
		const optionIndex = filtered.findIndex(
			(option) => document.getElementById(optionId(option)) === active
		);
		if (event.key === 'Enter' || event.key === ' ') {
			const option = filtered[optionIndex >= 0 ? optionIndex : activeIndex];
			if (option) choose(option);
			return;
		}
		if (optionIndex < 0) {
			focusOption(forward ? activeIndex : filtered.length - 1, forward ? 1 : -1);
			return;
		}
		focusOption(optionIndex + (forward ? 1 : -1), forward ? 1 : -1);
	}

	function attachRoot(node: HTMLDivElement) {
		root = node;
		return () => (root = undefined);
	}

	function attachTrigger(node: HTMLButtonElement) {
		trigger = node;
		const owner = scrollOwner(node);
		let frame: number | undefined;
		const scheduleMeasure = () => {
			if (!open) return;
			if (frame !== undefined) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				frame = undefined;
				measurePopover();
			});
		};
		const observer =
			typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);

		observer?.observe(node);
		if (owner) {
			observer?.observe(owner);
			owner.addEventListener('scroll', scheduleMeasure, { passive: true });
		}
		window.addEventListener('resize', scheduleMeasure);
		window.visualViewport?.addEventListener('resize', scheduleMeasure);

		return () => {
			trigger = undefined;
			if (frame !== undefined) cancelAnimationFrame(frame);
			observer?.disconnect();
			owner?.removeEventListener('scroll', scheduleMeasure);
			window.removeEventListener('resize', scheduleMeasure);
			window.visualViewport?.removeEventListener('resize', scheduleMeasure);
		};
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (requireExplicitEntry || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		openPicker(false);
	}

	function handleSearchInput(event: Event) {
		const input = event.currentTarget;
		if (input instanceof HTMLInputElement) {
			search = input.value;
			activeIndex = firstEnabledIndex(filtered);
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closePicker(true);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(activeIndex);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(filtered.length - 1, -1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			const option = filtered[activeIndex];
			if (option) choose(option);
		}
	}

	function handleOptionKeydown(event: KeyboardEvent, optionIndex: number) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closePicker(true);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(optionIndex + 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(optionIndex - 1, -1);
		} else if (event.key === 'Home') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(0, 1);
		} else if (event.key === 'End') {
			event.preventDefault();
			event.stopPropagation();
			focusOption(filtered.length - 1, -1);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			const option = filtered[optionIndex];
			if (option) choose(option);
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div
	class="pksx-combobox"
	data-combobox-open={open}
	onfocusout={handleRootFocusOut}
	{@attach attachRoot}
>
	<button
		{@attach attachTrigger}
		id={triggerId}
		type="button"
		class="pksx-combobox-trigger"
		class:staged-field={staged}
		class:with-images={showImages}
		role="combobox"
		aria-label={ariaLabel}
		aria-labelledby={labelledBy}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listId}
		aria-invalid={ariaInvalid || undefined}
		aria-describedby={describedBy}
		aria-activedescendant={open ? activeOptionId() : undefined}
		data-destination-focus={controllerFocus}
		data-destination-fallbacks={controllerFallbacks}
		data-ledger-control={ledgerControl || undefined}
		data-combobox-value={value}
		{disabled}
		onclick={() => openPicker()}
		onkeydown={handleTriggerKeydown}
	>
		{#if showImages}
			<ItemSprite
				resolvedPath={selected?.imageSrc}
				fallback={selected?.imageSrc !== undefined}
				size={24}
			/>
		{/if}
		<span>{selected?.label ?? placeholder}</span>
		{#if selected?.meta}<em>{selected.meta}</em>{/if}
		<i aria-hidden="true">⌄</i>
	</button>

	{#if open}
		<div
			bind:this={popover}
			class="pksx-combobox-popover"
			class:above={popoverAbove}
			class:end={popoverAlignEnd}
			class:searchable={showSearch}
			style={`--combobox-popover-max-height: ${popoverMaxHeight}px; --combobox-popover-max-width: ${popoverMaxWidth}px`}
		>
			{#if showSearch}<input
					id={`${triggerId}-search`}
					type="search"
					data-combobox-search
					data-controller-editing="true"
					aria-label={searchLabel}
					aria-controls={listId}
					aria-activedescendant={activeOptionId()}
					placeholder={searchPlaceholder}
					value={search}
					oninput={handleSearchInput}
					onkeydown={handleSearchKeydown}
				/>{/if}
			<div id={listId} class="pksx-combobox-list" role="listbox" aria-label={ariaLabel}>
				{#each filtered as option, optionIndex (option.value)}
					<button
						id={optionId(option)}
						type="button"
						class="pksx-combobox-option"
						class:active={activeIndex === optionIndex}
						class:tinted={option.hue !== undefined}
						class:with-images={showImages}
						role="option"
						data-combobox-option
						data-combobox-option-value={option.value}
						aria-selected={option.value === value}
						aria-disabled={option.disabled || undefined}
						disabled={option.disabled}
						tabindex={activeIndex === optionIndex ? 0 : -1}
						style={option.hue === undefined
							? undefined
							: `--option-hue: ${option.hue}; --option-chroma: ${option.chroma ?? 0.08}`}
						onclick={() => choose(option)}
						onfocus={() => (activeIndex = optionIndex)}
						onkeydown={(event) => handleOptionKeydown(event, optionIndex)}
					>
						{#if showImages}
							<ItemSprite
								resolvedPath={option.imageSrc}
								fallback={option.imageSrc !== undefined}
								size={24}
							/>
						{/if}
						<strong>{option.label}</strong>
						{#if option.meta}<span>{option.meta}</span>{/if}
						{#if option.detail}<em>{option.detail}</em>{/if}
					</button>
				{:else}
					<p>No matches found.</p>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.pksx-combobox {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.pksx-combobox-trigger,
	.pksx-combobox-popover input {
		width: 100%;
		min-width: 0;
		height: var(--pksx-control-height);
		border: 1px solid var(--rule);
		border-radius: var(--pksx-radius-sm);
		background: var(--paper-hi);
		color: var(--ink);
	}

	.pksx-combobox-trigger {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content max-content;
		align-items: center;
		gap: 8px;
		padding: 0 11px;
		font: 750 var(--pksx-type-editable) var(--pksx-font-sans);
		text-align: left;
	}

	.pksx-combobox-trigger[aria-invalid='true'] {
		border-color: var(--pksx-color-feedback-danger);
	}

	.pksx-combobox-trigger.with-images,
	.pksx-combobox-option.with-images {
		grid-template-columns: 24px minmax(0, 1fr) max-content max-content;
	}

	.pksx-combobox-trigger span,
	.pksx-combobox-option strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pksx-combobox-trigger em,
	.pksx-combobox-trigger i {
		color: var(--ink-soft);
		font: 650 var(--pksx-type-label) var(--pksx-font-sans);
		font-style: normal;
	}

	.pksx-combobox-trigger i {
		font-size: var(--pksx-type-title);
	}

	.pksx-combobox-popover {
		position: absolute;
		z-index: 80;
		top: calc(100% + 6px);
		left: 0;
		min-width: max(100%, 200px);
		width: max-content;
		max-width: max(100%, var(--combobox-popover-max-width, 420px));
		display: grid;
		gap: 7px;
		padding: 8px;
		border: 1px solid var(--rule-hi);
		border-radius: var(--pksx-radius-md);
		background: var(--paper-hi);
		box-shadow: var(--shadow-deep);
	}

	.pksx-combobox-popover.end {
		left: auto;
		right: 0;
	}

	.pksx-combobox-popover.above {
		top: auto;
		bottom: calc(100% + 6px);
	}

	.pksx-combobox-popover input {
		padding: 0 11px;
		font: 750 var(--pksx-type-editable) var(--pksx-font-sans);
	}

	.pksx-combobox-list {
		max-height: max(0px, calc(var(--combobox-popover-max-height) - 18px));
		display: grid;
		gap: 4px;
		overflow-y: auto;
	}

	.pksx-combobox-popover.searchable .pksx-combobox-list {
		max-height: max(
			0px,
			calc(var(--combobox-popover-max-height) - var(--pksx-control-height) - 23px)
		);
	}

	.pksx-combobox-option {
		width: 100%;
		min-width: 0;
		min-height: var(--pksx-control-height);
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content max-content;
		align-items: center;
		gap: 8px;
		padding: 9px 10px;
		border: 0;
		border-radius: var(--pksx-radius-sm);
		background: transparent;
		color: var(--ink);
		text-align: left;
	}

	.pksx-combobox-option.tinted {
		background: color-mix(
			in srgb,
			var(--paper-hi),
			oklch(0.72 var(--option-chroma, 0.08) var(--option-hue, 100)) 24%
		);
	}

	.pksx-combobox-option strong {
		font-size: var(--pksx-type-label);
	}

	.pksx-combobox-option span,
	.pksx-combobox-option em,
	.pksx-combobox-list p {
		margin: 0;
		color: var(--ink-soft);
		font: 650 var(--pksx-type-label) var(--pksx-font-sans);
		font-style: normal;
	}

	.pksx-combobox-option:hover {
		background: var(--rust-wash);
	}

	.pksx-combobox-option[aria-selected='true'] {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.pksx-combobox-option:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.pksx-combobox-trigger:focus,
	.pksx-combobox-trigger:focus-visible,
	.pksx-combobox-option.active,
	.pksx-combobox-option:focus-visible,
	.pksx-combobox-popover input:focus-visible {
		outline: 3px solid var(--pksx-color-accent-ring);
		outline-offset: -3px;
	}

	.pksx-combobox-trigger:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.pksx-combobox-trigger.staged-field {
		border-color: var(--pksx-color-accent-ring);
		background-color: var(--pksx-color-accent-wash);
	}

	.pksx-combobox-trigger.staged-field[aria-invalid='true'] {
		border-color: var(--pksx-color-feedback-danger);
	}

	.pksx-combobox-list p {
		padding: 10px;
	}
</style>
