import { Linter } from 'eslint';
import { expect, it } from 'vitest';
import plugin from './e2e-page-load.js';

function messages(source, exceptions = []) {
	return new Linter({ configType: 'flat' })
		.verify(source, {
			plugins: { 'pksx-e2e': plugin },
			rules: { 'pksx-e2e/no-raw-page-load': ['error', { exceptions }] }
		})
		.map((message) => message.message);
}

it('rejects raw page loads and names the helper', () => {
	const found = messages("await page.goto('/'); await secondTab.reload();");
	expect(found).toHaveLength(2);
	expect(found[0]).toContain('loadRoute()');
	expect(found[0]).toContain('route-load.e2e-helper.ts');
});

it('accepts the helper and a listed exception', () => {
	expect(messages("await loadRoute(page, '/'); await reloadRoute(page);")).toEqual([]);
	expect(messages("await page.goto('/fixture');", ['/fixture'])).toEqual([]);
});

it('rejects an exception that no call uses', () => {
	expect(messages("await loadRoute(page, '/');", ['/fixture'])[0]).toContain('Remove it');
});
