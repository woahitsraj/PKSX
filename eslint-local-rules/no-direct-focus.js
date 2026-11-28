import path from 'node:path';

export const focusOwner = 'requestFocus from $lib/pksx/focus-owner';

export default {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: { baseline: { type: 'object', additionalProperties: { type: 'integer' } } },
				additionalProperties: false
			}
		],
		messages: {
			direct: `Direct .focus() call. Use ${focusOwner}. This file may keep {{allowed}} existing direct calls and has {{count}}.`,
			stale:
				'This file has {{count}} direct .focus() calls and the baseline allows {{allowed}}. Lower its entry in eslint-local-rules/direct-focus-baseline.json to {{count}}.'
		}
	},
	create(context) {
		const file = path.relative(context.cwd, context.filename).split(path.sep).join('/');
		const allowed = context.options[0]?.baseline?.[file] ?? 0;
		const calls = [];
		return {
			CallExpression(node) {
				const { callee } = node;
				if (callee.type !== 'MemberExpression' || callee.computed) return;
				if (callee.property.name === 'focus') calls.push(node);
			},
			'Program:exit'(node) {
				const data = { allowed, count: calls.length };
				for (const call of calls.slice(allowed)) {
					context.report({ node: call, messageId: 'direct', data });
				}
				if (calls.length < allowed) context.report({ node, messageId: 'stale', data });
			}
		};
	}
};
