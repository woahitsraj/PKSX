const noRawPageLoad = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: { exceptions: { type: 'array', items: { type: 'string' } } },
				additionalProperties: false
			}
		],
		messages: {
			raw: 'Raw {{method}}() acts before the route is ready. Use loadRoute() or reloadRoute() from src/routes/route-load.e2e-helper.ts.',
			stale:
				'No raw goto({{target}}) is left in this file. Remove it from the no-raw-page-load exceptions.'
		}
	},
	create(context) {
		const exceptions = context.options[0]?.exceptions ?? [];
		const used = new Set();
		return {
			CallExpression(node) {
				const callee = node.callee;
				if (callee.type !== 'MemberExpression' || callee.computed) return;
				const method = callee.property.name;
				if (method !== 'goto' && method !== 'reload') return;
				const target = node.arguments[0];
				if (method === 'goto' && target?.type === 'Literal' && exceptions.includes(target.value))
					return used.add(target.value);
				context.report({ node, messageId: 'raw', data: { method } });
			},
			'Program:exit'(node) {
				for (const target of exceptions)
					if (!used.has(target))
						context.report({ node, messageId: 'stale', data: { target: JSON.stringify(target) } });
			}
		};
	}
};

export default { rules: { 'no-raw-page-load': noRawPageLoad } };
