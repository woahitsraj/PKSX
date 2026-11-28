import { Linter } from 'eslint';
import { expect, it } from 'vitest';
import rule from './no-direct-focus.js';

function messages(source, baseline = {}) {
	return new Linter({ configType: 'flat', cwd: '/repo' })
		.verify(
			source,
			{
				files: ['**/*.js'],
				plugins: { pksx: { rules: { 'no-direct-focus': rule } } },
				rules: { 'pksx/no-direct-focus': ['error', { baseline }] }
			},
			{ filename: '/repo/src/menu.js' }
		)
		.map(({ message }) => message);
}

// The call that froze the Box Menu before the focus owner existed.
const queuedFocus =
	'queueMicrotask(() => document.getElementById(`box-menu-command-${clamped}`)?.focus());';

it('rejects a new direct focus call and names the owner', () => {
	expect(messages(queuedFocus)).toEqual([
		expect.stringContaining('requestFocus from $lib/pksx/focus-owner')
	]);
	expect(messages(`target.focus();\n${queuedFocus}`, { 'src/menu.js': 1 })).toHaveLength(1);
});

it('permits baseline calls and the owner', () => {
	expect(messages(queuedFocus, { 'src/menu.js': 1 })).toEqual([]);
	expect(messages('requestFocus(`box-menu-command-${clamped}`);')).toEqual([]);
});

it('requires the baseline to drop when a call is removed', () => {
	expect(messages('requestFocus(target);', { 'src/menu.js': 1 })).toEqual([
		expect.stringContaining('Lower its entry')
	]);
});
