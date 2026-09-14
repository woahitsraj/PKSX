import { prefersReducedMotion } from 'svelte/motion';

export type TransitionOptions = { direction: 'in' | 'out' | 'both' };

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
	const ax = 1 - 3 * x2 + 3 * x1;
	const bx = 3 * x2 - 6 * x1;
	const cx = 3 * x1;
	const ay = 1 - 3 * y2 + 3 * y1;
	const by = 3 * y2 - 6 * y1;
	const cy = 3 * y1;
	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

	return (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let t = x;
		for (let i = 0; i < 8; i += 1) {
			const dx = sampleX(t) - x;
			if (Math.abs(dx) < 1e-6) return sampleY(t);
			const slope = slopeX(t);
			if (Math.abs(slope) < 1e-6) break;
			t -= dx / slope;
		}
		let low = 0;
		let high = 1;
		for (let i = 0; i < 24; i += 1) {
			t = (low + high) / 2;
			if (sampleX(t) < x) low = t;
			else high = t;
		}
		return sampleY(t);
	};
}

// Same curves as --pksx-ease-out and --pksx-ease-drawer in src/routes/layout.css.
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);
export const easeDrawer = cubicBezier(0.32, 0.72, 0, 1);

export function reducedMotion() {
	return prefersReducedMotion.current;
}

export function layerCount(selector: string) {
	return document.querySelectorAll(selector).length;
}

const replacingLayers = new Set<string>();

export function layerReplacement(selector: string) {
	if (replacingLayers.has(selector)) return true;
	if (layerCount(selector) <= 1) return false;
	replacingLayers.add(selector);
	setTimeout(() => replacingLayers.delete(selector), 0);
	return true;
}

export function layerFade(layerSelector: string) {
	return (node: Element, _params: undefined, { direction }: TransitionOptions) => {
		void node;
		return () =>
			layerReplacement(layerSelector)
				? { duration: 0 }
				: {
						duration: reducedMotion() ? 120 : direction === 'out' ? 150 : 220,
						easing: easeOut,
						css: (t: number) => `opacity: ${t}`
					};
	};
}

export function panelSettle(
	layerSelector: string,
	enabled: (node: Element) => boolean = () => true
) {
	return (node: Element, _params: undefined, { direction }: TransitionOptions) => {
		const active = enabled(node);
		return () =>
			!active || reducedMotion() || layerReplacement(layerSelector)
				? { duration: 0 }
				: {
						duration: direction === 'out' ? 150 : 220,
						easing: easeOut,
						css: (t: number) => `transform: scale(${(0.97 + 0.03 * t).toFixed(4)})`
					};
	};
}
