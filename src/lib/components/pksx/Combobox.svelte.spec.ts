import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { dispatchControllerKey } from '$lib/pksx/controller-input';
import Combobox from './Combobox.svelte';

let component: ReturnType<typeof mount> | null = null;

afterEach(async () => {
	if (component) await unmount(component);
	component = null;
	document.body.replaceChildren();
});

function render(value = '') {
	const selected = vi.fn();
	component = mount(Combobox, {
		target: document.body,
		props: {
			id: 'test-picker',
			ariaLabel: 'Test choices',
			value,
			options: [
				{ value: 'poke-ball', label: 'Poké Ball' },
				{ value: 'naive', label: 'Naïve', disabled: true },
				{ value: 'potion', label: 'Potion' }
			],
			placeholder: 'Choose',
			searchLabel: 'Search choices',
			onSelect: selected
		}
	});
	return selected;
}

test('searches accent-insensitively, skips disabled choices, and restores trigger focus on Back', async () => {
	const selected = render();
	const trigger = document.querySelector<HTMLButtonElement>('#test-picker')!;
	await tick();
	trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	const search = document.querySelector<HTMLInputElement>('[data-combobox-search]')!;
	search.value = ' naive ';
	search.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
	expect(document.querySelectorAll('[data-combobox-option]')).toHaveLength(1);
	expect(document.querySelector<HTMLButtonElement>('[data-combobox-option]')?.disabled).toBe(true);
	search.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	);
	await tick();
	expect(document.activeElement).toBe(trigger);
	expect(selected).not.toHaveBeenCalled();
});

test('reports no matches and selects an enabled filtered option', async () => {
	const selected = render();
	await tick();
	document
		.querySelector<HTMLButtonElement>('#test-picker')!
		.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	const search = document.querySelector<HTMLInputElement>('[data-combobox-search]')!;
	search.value = 'missing';
	search.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
	expect(document.body).toHaveTextContent('No matches found.');
	search.value = 'poke';
	search.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
	document.querySelector<HTMLButtonElement>('[data-combobox-option]')!.click();
	expect(selected).toHaveBeenCalledWith('poke-ball');
});

test('closing a current choice does not emit a selection', async () => {
	const selected = render('poke-ball');
	await tick();
	const trigger = document.querySelector<HTMLButtonElement>('#test-picker')!;
	trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	document.querySelector<HTMLButtonElement>('[data-combobox-option-value="poke-ball"]')!.click();
	expect(selected).not.toHaveBeenCalled();
});

test('arrow, Home, and End navigation skip disabled choices and wrap', async () => {
	render();
	await tick();
	const trigger = document.querySelector<HTMLButtonElement>('#test-picker')!;
	trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	const search = document.querySelector<HTMLInputElement>('[data-combobox-search]')!;
	search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'poke-ball');
	document.activeElement?.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
	);
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'potion');
	document.activeElement?.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
	);
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'poke-ball');
	document.activeElement?.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'End', bubbles: true })
	);
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'potion');
	document.activeElement?.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
	);
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'poke-ball');
});

test('owns controller directions and selection while open', async () => {
	const selected = render();
	await tick();
	document.querySelector<HTMLButtonElement>('#test-picker')!.click();
	await tick();
	const search = document.querySelector<HTMLInputElement>('[data-combobox-search]')!;
	search.value = 'po';
	search.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();

	dispatchControllerKey('ArrowRight');
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'poke-ball');
	dispatchControllerKey('ArrowLeft');
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'potion');
	dispatchControllerKey('ArrowRight');
	await tick();
	expect(document.activeElement).toHaveAttribute('data-combobox-option-value', 'poke-ball');
	dispatchControllerKey('Enter');
	await tick();
	expect(selected).toHaveBeenCalledWith('poke-ball');
	expect(document.querySelector('[data-combobox-open="true"]')).toBeNull();
	expect(document.activeElement).toBe(document.querySelector('#test-picker'));
});

test('flips the picker into the available scroll space at both viewport floors', async () => {
	for (const height of [360, 640]) {
		render();
		await tick();
		const trigger = document.querySelector<HTMLButtonElement>('#test-picker')!;
		vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
			top: height - 48,
			bottom: height - 16,
			left: 0,
			right: 240,
			width: 240,
			height: 32,
			x: 0,
			y: height - 48,
			toJSON: () => ({})
		});
		vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue({
			top: 0,
			bottom: height,
			left: 0,
			right: 360,
			width: 360,
			height,
			x: 0,
			y: 0,
			toJSON: () => ({})
		});
		trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		expect(document.querySelector('.pksx-combobox-popover')).toHaveClass('above');
		await unmount(component!);
		component = null;
		document.body.replaceChildren();
	}
});

test('remeasures an open picker when the viewport changes', async () => {
	render();
	await tick();
	const trigger = document.querySelector<HTMLButtonElement>('#test-picker')!;
	const triggerRect = vi.spyOn(trigger, 'getBoundingClientRect');
	const viewportRect = vi.spyOn(document.body, 'getBoundingClientRect');
	triggerRect.mockReturnValue({
		top: 100,
		bottom: 132,
		left: 0,
		right: 240,
		width: 240,
		height: 32,
		x: 0,
		y: 100,
		toJSON: () => ({})
	});
	viewportRect.mockReturnValue({
		top: 0,
		bottom: 640,
		left: 0,
		right: 360,
		width: 360,
		height: 640,
		x: 0,
		y: 0,
		toJSON: () => ({})
	});
	trigger.click();
	await tick();
	expect(document.querySelector('.pksx-combobox-popover')).not.toHaveClass('above');

	triggerRect.mockReturnValue({
		top: 300,
		bottom: 332,
		left: 0,
		right: 240,
		width: 240,
		height: 32,
		x: 0,
		y: 300,
		toJSON: () => ({})
	});
	viewportRect.mockReturnValue({
		top: 0,
		bottom: 360,
		left: 0,
		right: 640,
		width: 640,
		height: 360,
		x: 0,
		y: 0,
		toJSON: () => ({})
	});
	window.dispatchEvent(new Event('resize'));
	await new Promise(requestAnimationFrame);
	await tick();
	expect(document.querySelector('.pksx-combobox-popover')).toHaveClass('above');
});
