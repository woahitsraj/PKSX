import { afterEach, expect, test } from 'vitest';
import { layerReplacement } from './motion';

afterEach(() => document.querySelectorAll('.test-layer').forEach((layer) => layer.remove()));

test('shares a replacement decision while the outgoing layer is removed', async () => {
	const outgoing = document.body.appendChild(document.createElement('div'));
	outgoing.className = 'test-layer';
	const incoming = document.body.appendChild(document.createElement('div'));
	incoming.className = 'test-layer';

	expect(layerReplacement('.test-layer')).toBe(true);
	outgoing.remove();
	expect(layerReplacement('.test-layer')).toBe(true);

	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(layerReplacement('.test-layer')).toBe(false);
});
