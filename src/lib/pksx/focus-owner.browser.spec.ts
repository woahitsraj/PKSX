import { mount, unmount } from 'svelte';
import { afterEach, expect, test } from 'vitest';
import BoxMenu from '$lib/components/pksx/BoxMenu.svelte';
import { requestFocus } from './focus-owner';

let component: ReturnType<typeof mount> | null = null;

afterEach(async () => {
	if (component) await unmount(component);
	component = null;
	document.body.replaceChildren();
});

const settle = () => new Promise((resolve) => setTimeout(resolve));

function render(html: string) {
	document.body.innerHTML = html;
	return (id: string) => document.getElementById(id)!;
}

test('two queued requests focus once, on the latest target', async () => {
	const byId = render('<button id="first"></button><button id="second"></button>');
	const focused: string[] = [];
	document.body.addEventListener('focusin', (event) => focused.push((event.target as Element).id));

	requestFocus('first');
	requestFocus(byId('second'));
	await settle();

	expect(focused).toEqual(['second']);
});

test('a disabled target gives focus to the nearest enabled control in its region', async () => {
	const byId = render(`
		<button id="outside"></button>
		<div role="list">
			<button id="before"></button>
			<button id="target" disabled></button>
			<button id="hidden" hidden></button>
			<button id="after"></button>
		</div>`);

	requestFocus('target');
	await settle();
	expect(document.activeElement).toBe(byId('after'));

	byId('after').remove();
	requestFocus('target');
	await settle();
	expect(document.activeElement).toBe(byId('before'));
});

test('an inert target gives focus to the nearest enabled control outside the inert region', async () => {
	const byId = render(`
		<div role="dialog">
			<button id="launcher"></button>
			<div role="menu" inert><button id="target"></button></div>
		</div>`);
	let missed = false;

	requestFocus('target', { orElse: () => (missed = true) });
	await settle();

	expect(document.activeElement).toBe(byId('launcher'));
	expect(missed).toBe(false);
});

test('a missing target runs orElse', async () => {
	let missed = false;
	requestFocus('absent', { orElse: () => (missed = true) });
	await settle();
	expect(missed).toBe(true);
});

// Replays the Export confirmation Cancel freeze: Cancel queued focus on row 0 while the click
// had queued row 1, and each row's focus handler queued its own row again.
async function replayQueuedBoxMenuFocus(focusCommand: (index: number) => void) {
	let focusRequests = 0;
	const onFocusCommand = (index: number) => {
		if (++focusRequests <= 50) focusCommand(index);
	};
	component = mount(BoxMenu, {
		target: document.body,
		props: {
			collection: 'Save File',
			commands: [
				{ key: 'export', label: 'Overwrite', availability: 'available', reason: null },
				{ key: 'select', label: 'Cancel', availability: 'available', reason: null }
			],
			activeIndex: 0,
			onFocusCommand,
			onSelectCommand: () => {},
			onClose: () => {}
		}
	});

	onFocusCommand(0);
	onFocusCommand(1);
	await settle();
	return focusRequests;
}

test('queued Box Menu focus requests settle on the latest command', async () => {
	const focusRequests = await replayQueuedBoxMenuFocus((index) =>
		requestFocus(`box-menu-command-${index}`)
	);

	expect(document.activeElement?.id).toBe('box-menu-command-1');
	expect(focusRequests).toBe(3);
});

test('the same replay with direct focus calls never settles', async () => {
	const focusRequests = await replayQueuedBoxMenuFocus((index) =>
		queueMicrotask(() => document.getElementById(`box-menu-command-${index}`)?.focus())
	);

	expect(focusRequests).toBeGreaterThan(50);
});
