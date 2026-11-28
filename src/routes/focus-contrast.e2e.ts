import { expectBoxesReady } from './boxes-ready.e2e-helper';
import { loadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

const destinations = [
	{ key: 'saves', path: '/' },
	{ key: 'boxes', path: '/boxes' },
	{ key: 'trainer', path: '/trainer' },
	{ key: 'bag', path: '/bag' },
	{ key: 'pokedex', path: '/pokedex' },
	{ key: 'settings', path: '/settings' }
];

const heightBands = [
	{ name: 'short', viewport: { width: 960, height: 544 } },
	{ name: 'tall', viewport: { width: 1280, height: 800 } }
];

// Runs in the page. Focuses every stop in the controller scope and checks the DESIGN.md Focus rules.
async function auditFocusStops() {
	const problems: string[] = [];
	const visibleDialogs = Array.from(
		document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')
	).filter((dialog) => dialog.checkVisibility() && !dialog.closest('[inert]'));
	const scope: ParentNode = visibleDialogs.at(-1) ?? document;
	const scopeRoot = scope instanceof HTMLElement ? scope : document.body;

	const name = (element: Element) => {
		const label =
			element.getAttribute('aria-label') ?? element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
		const id = element.id ? `#${element.id}` : '';
		const className = typeof element.className === 'string' ? element.className.trim() : '';
		const classes = className ? `.${className.split(/\s+/).join('.')}` : '';
		return `<${element.tagName.toLowerCase()}${id}${classes}> "${label.slice(0, 40)}"`;
	};
	const report = (problem: string) => {
		if (!problems.includes(problem)) problems.push(problem);
	};

	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const context = canvas.getContext('2d', { willReadFrequently: true })!;
	const alphaOf = (color: string) => {
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = color;
		context.fillRect(0, 0, 1, 1);
		return context.getImageData(0, 0, 1, 1).data[3] / 255;
	};
	const luminance = ([red, green, blue]: number[]) => {
		const [r, g, b] = [red, green, blue].map((channel) => {
			const value = channel / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	// Paints the backgrounds up to the first opaque one, then the text color, and compares the two.
	const contrastOf = (element: Element) => {
		const layers: string[] = [];
		for (let node: Element | null = element; node; node = node.parentElement) {
			const style = getComputedStyle(node);
			if (style.backgroundImage !== 'none') return null;
			layers.unshift(style.backgroundColor);
			if (alphaOf(style.backgroundColor) === 1) break;
		}
		context.fillStyle = '#fff';
		context.fillRect(0, 0, 1, 1);
		for (const layer of layers) {
			context.fillStyle = layer;
			context.fillRect(0, 0, 1, 1);
		}
		const background = Array.from(context.getImageData(0, 0, 1, 1).data);
		let opacity = 1;
		for (let node: Element | null = element; node; node = node.parentElement)
			opacity *= Number(getComputedStyle(node).opacity);
		context.globalAlpha = opacity;
		context.fillStyle = getComputedStyle(element).color;
		context.fillRect(0, 0, 1, 1);
		context.globalAlpha = 1;
		const text = Array.from(context.getImageData(0, 0, 1, 1).data);
		const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a);
		return (light + 0.05) / (dark + 0.05);
	};
	const isFormField = (element: Element) =>
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement ||
		(element instanceof HTMLInputElement &&
			!['checkbox', 'radio', 'range', 'file', 'color'].includes(element.type));
	const checkContrast = (element: Element, state: string) => {
		if (element.closest(':disabled, [aria-disabled="true"]')) return;
		const style = getComputedStyle(element);
		const ratio = contrastOf(element);
		if (ratio === null) return;
		const size = parseFloat(style.fontSize);
		const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
		if (ratio < (large ? 3 : 4.5))
			report(`contrast ${ratio.toFixed(2)}:1 is below WCAG AA${state}: ${name(element)}`);
	};
	const renderedTextNodes = (root: Element) => {
		const nodes: Text[] = [];
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const node = walker.currentNode as Text;
			const parent = node.parentElement;
			if (!node.data.trim() || !parent) continue;
			if (
				!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ||
				parent.closest('[inert]')
			)
				continue;
			nodes.push(node);
		}
		return nodes;
	};
	const isRendered = (node: Text) => {
		const range = document.createRange();
		range.selectNodeContents(node);
		return Array.from(range.getClientRects()).some((rect) => rect.width > 1 && rect.height > 1);
	};
	const textRects = (node: Text, clipRoot: Element) => {
		const range = document.createRange();
		range.selectNodeContents(node);
		const rects: { left: number; top: number; right: number; bottom: number }[] = [];
		for (const rect of range.getClientRects()) {
			let { left, top, right, bottom } = rect;
			// Clip to each scrolling or hidden-overflow ancestor inside the control.
			for (
				let ancestor = node.parentElement;
				ancestor && ancestor !== clipRoot;
				ancestor = ancestor.parentElement
			) {
				if (getComputedStyle(ancestor).overflow === 'visible') continue;
				const clip = ancestor.getBoundingClientRect();
				left = Math.max(left, clip.left);
				top = Math.max(top, clip.top);
				right = Math.min(right, clip.right);
				bottom = Math.min(bottom, clip.bottom);
			}
			// Visually hidden labels collapse to a 1px box.
			if (right - left > 1 && bottom - top > 1) rects.push({ left, top, right, bottom });
		}
		return rects;
	};
	const checkAllText = (state: string) => {
		const seen = new Set<Element>();
		for (const node of renderedTextNodes(scopeRoot)) {
			const parent = node.parentElement!;
			if (seen.has(parent) || !isRendered(node)) continue;
			seen.add(parent);
			checkContrast(parent, state);
		}
		for (const field of scopeRoot.querySelectorAll('input, select, textarea'))
			if (isFormField(field) && field.checkVisibility()) checkContrast(field, state);
	};

	const ringOf = (element: Element) => {
		const style = getComputedStyle(element);
		const width = parseFloat(style.outlineWidth);
		if (style.outlineStyle === 'none' || width === 0 || alphaOf(style.outlineColor) === 0)
			return null;
		return { width, offset: parseFloat(style.outlineOffset) };
	};
	const checkRingClearance = (target: HTMLElement) => {
		const ring = ringOf(target);
		if (!ring) return;
		const box = target.getBoundingClientRect();
		const reach = ring.offset + ring.width;
		const outer = {
			left: box.left - reach,
			top: box.top - reach,
			right: box.right + reach,
			bottom: box.bottom + reach
		};
		let gap = Infinity;
		if (isFormField(target)) {
			const style = getComputedStyle(target);
			gap =
				reach +
				Math.min(
					parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
					parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)
				);
		} else {
			// A scrollport's own ring crosses its content on the axis that scrolls.
			const scrollsInline = target.scrollWidth > target.clientWidth;
			const scrollsBlock = target.scrollHeight > target.clientHeight;
			const clips = getComputedStyle(target).overflow !== 'visible';
			for (const node of renderedTextNodes(target)) {
				for (const rect of textRects(node, target)) {
					if (
						clips &&
						(rect.right <= box.left ||
							rect.left >= box.right ||
							rect.bottom <= box.top ||
							rect.top >= box.bottom)
					)
						continue;
					if (!scrollsInline) gap = Math.min(gap, rect.left - outer.left, outer.right - rect.right);
					if (!scrollsBlock) gap = Math.min(gap, rect.top - outer.top, outer.bottom - rect.bottom);
				}
			}
		}
		if (gap < 4.75)
			report(`focus ring is ${gap.toFixed(1)}px from its text, less than 5px: ${name(target)}`);
	};

	const indicatorSnapshot = (elements: Element[]) =>
		elements.flatMap((element) =>
			['', '::before', '::after'].map((pseudo) => {
				const style = getComputedStyle(element, pseudo || undefined);
				const ringVisible =
					style.outlineStyle !== 'none' &&
					parseFloat(style.outlineWidth) > 0 &&
					alphaOf(style.outlineColor) > 0;
				const borderVisible =
					style.borderStyle !== 'none' &&
					parseFloat(style.borderWidth) > 0 &&
					alphaOf(style.borderColor) > 0;
				return {
					outline: ringVisible
						? `${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset}`
						: '',
					border: borderVisible
						? `${style.borderStyle} ${style.borderWidth} ${style.borderColor}`
						: '',
					shadow: style.boxShadow,
					underline: style.textDecorationLine
				};
			})
		);
	const indicatorElements = (control: HTMLElement) => {
		const activeId = control.getAttribute('aria-activedescendant');
		const target = (activeId && document.getElementById(activeId)) || control;
		return {
			target,
			elements: [
				...new Set([control, target, ...Array.from(target.querySelectorAll('*')).slice(0, 80)])
			]
		};
	};
	const settle = () => new Promise((resolve) => setTimeout(resolve));

	const motion = document.createElement('style');
	motion.textContent = '*, *::before, *::after { transition: none !important; }';
	document.head.append(motion);
	document.documentElement.dataset.inputModality = 'controller';
	if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	await settle();
	checkAllText('');

	// Destinations also focus tabindex="-1" targets. DESIGN.md gives Slots and grids their own focus.
	const controls = Array.from(
		scope.querySelectorAll<HTMLElement>(
			'button:not([disabled]), a[href], summary, input:not([disabled]):not([type="hidden"]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
		)
	);
	let stops = 0;
	for (const control of controls) {
		if (
			!control.isConnected ||
			!control.checkVisibility({ visibilityProperty: true }) ||
			control.closest('[inert]') ||
			control.getAttribute('aria-disabled') === 'true' ||
			control.matches('[data-pksx-control-category="slot"], [role="grid"]')
		)
			continue;
		const before = indicatorElements(control);
		const beforeSnapshot = indicatorSnapshot(before.elements);
		control.focus();
		await settle();
		if (document.activeElement !== control) continue;
		document.documentElement.dataset.inputModality = 'controller';
		stops += 1;
		const { target, elements } = indicatorElements(control);
		if (target === before.target && elements.length === before.elements.length) {
			const afterSnapshot = indicatorSnapshot(elements);
			const indicators = (['outline', 'border', 'shadow', 'underline'] as const).filter((kind) =>
				afterSnapshot.some((after, index) => after[kind] !== beforeSnapshot[index][kind])
			);
			if (indicators.length !== 1)
				report(
					`focus shows ${indicators.length} indicators (${indicators.join(', ') || 'none'}), not exactly one: ${name(control)}`
				);
		}
		checkRingClearance(target);
		for (const node of renderedTextNodes(target))
			if (textRects(node, target).length > 0) checkContrast(node.parentElement!, ' while focused');
		if (isFormField(target)) checkContrast(target, ' while focused');
		control.blur();
		await settle();
	}
	motion.remove();
	return { stops, problems };
}

async function audit(page: Page, surface: string, problems: string[]) {
	const result = await page.evaluate(auditFocusStops);
	expect(result.stops, `${surface} has focus stops`).toBeGreaterThan(0);
	problems.push(...result.problems.map((problem) => `${surface}: ${problem}`));
}

for (const theme of ['light', 'dark'] as const) {
	for (const band of heightBands) {
		test(`focus rings and contrast hold on every destination: ${theme}, ${band.name}`, async ({
			page
		}) => {
			test.setTimeout(300_000);
			await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
			await page.setViewportSize(band.viewport);
			await loadRoute(page, '/');
			await importSaveThroughSaves(page, emeraldFixturePath);
			await expect(page.locator('html')).toHaveAttribute('data-pksx-theme', theme);
			expect(await page.evaluate(() => matchMedia('(min-height: 560px)').matches)).toBe(
				band.name === 'tall'
			);

			const problems: string[] = [];
			for (const destination of destinations) {
				await loadRoute(page, destination.path);
				await expect(page.locator(`[data-destination-root="${destination.key}"]`)).toBeVisible();
				if (destination.key === 'boxes') {
					await expectBoxesReady(page);
					await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15_000 });
				}
				await audit(page, destination.key, problems);
			}

			// The Pokemon Editor is where the Move Set chips and the focusable content region live.
			await loadRoute(page, '/boxes');
			await expectBoxesReady(page);
			const slot = page.locator('#box-0-slot-0');
			await expect(slot).toContainText('ARON', { timeout: 15_000 });
			await slot.focus();
			await page.keyboard.press('Enter');
			await page.getByRole('button', { name: 'Edit' }).click();
			const editor = page.getByRole('dialog', { name: 'ARON' });
			await expect(editor.locator('#pokemon-editor-species')).toBeEnabled({ timeout: 15_000 });
			await editor.locator('#pokemon-editor-section-move-set').click();
			await expect(editor.getByText('Current Moves')).toBeVisible();
			// The check covers focus and resting text, so the pointer must not leave a hover state.
			await page.mouse.move(0, 0);
			await audit(page, 'pokemon editor', problems);

			expect(problems).toEqual([]);
		});
	}
}
