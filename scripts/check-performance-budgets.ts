import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';

const root = path.resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'build');
const reportOnly = process.argv.includes('--report-only');
const groups = ['application', 'workers', 'engine', 'sprites', 'other', 'total'] as const;
const sizeSchema = z.object({
	raw: z.number().int().positive(),
	gzip: z.number().int().positive()
});
const budgets = z
	.object({
		groups: z.record(z.enum(groups), sizeSchema),
		largestApplicationScriptGzip: z.number().int().positive()
	})
	.parse(JSON.parse(await readFile('scripts/performance-budgets.json', 'utf8')));
const totals = Object.fromEntries(groups.map((group) => [group, { raw: 0, gzip: 0, files: 0 }]));
const assets = [];
const files = (await readdir(root, { recursive: true, withFileTypes: true }))
	.filter((file) => file.isFile())
	.map((file) => path.join(file.parentPath, file.name))
	.sort();
const paths = new Set(files);
for (const absolute of files) {
	const name = path.relative(root, absolute).split(path.sep).join('/');
	// Sidecars encode the same resource; source maps and symbols still count as shipped bytes.
	if (/\.(gz|br)$/.test(name) && paths.has(absolute.replace(/\.(gz|br)$/, ''))) continue;
	const bytes = await readFile(absolute);
	const group = name.startsWith('pkhex-engine/')
		? 'engine'
		: name.startsWith('sprites/')
			? 'sprites'
			: name.startsWith('_app/immutable/workers/')
				? 'workers'
				: /\.(js|css)$/.test(name)
					? 'application'
					: 'other';
	const asset = {
		path: name,
		group,
		raw: bytes.length,
		gzip: gzipSync(bytes, { level: 9 }).length
	};
	assets.push(asset);
	for (const key of [group, 'total']) {
		totals[key].raw += asset.raw;
		totals[key].gzip += asset.gzip;
		totals[key].files += 1;
	}
}
for (const required of [
	'index.html',
	'native.html',
	'service-worker.js',
	'pkhex-engine/main.js',
	'pkhex-engine/_framework/dotnet.js'
]) {
	if (!assets.some((asset) => asset.path === required))
		throw new Error(`Missing ${required}. Run pnpm engine:sync && pnpm build first.`);
}
for (const group of groups) {
	if (totals[group].files === 0) throw new Error(`No ${group} assets found in ${root}.`);
}
const largestScript = assets
	.filter((asset) => asset.group === 'application' && asset.path.endsWith('.js'))
	.sort((a, b) => b.gzip - a.gzip)[0];
if (!largestScript) throw new Error('No application JavaScript found.');
const failures: string[] = [];
for (const group of groups) {
	for (const metric of ['raw', 'gzip'] as const) {
		const actual = totals[group][metric];
		const limit = budgets.groups[group][metric];
		const passed = actual <= limit;
		console.log(
			`${passed ? 'PASS' : 'FAIL'} ${group} ${metric}: ${actual.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')} bytes (${totals[group].files} files)`
		);
		if (!passed) failures.push(`${group} ${metric} exceeds budget by ${actual - limit} bytes`);
	}
}
console.log(
	`Largest application script: ${largestScript.path}, ${largestScript.gzip} / ${budgets.largestApplicationScriptGzip} gzip bytes`
);
if (largestScript.gzip > budgets.largestApplicationScriptGzip)
	failures.push('Largest application script exceeds gzip budget');
await mkdir('artifacts/performance', { recursive: true });
await writeFile(
	'artifacts/performance/bundle-report.json',
	JSON.stringify({ node: process.version, totals, largestScript, failures, assets }, null, 2) + '\n'
);
if (failures.length && !reportOnly) {
	console.error(
		`${failures.join('\n')}\nSee artifacts/performance/bundle-report.json and docs/testing/performance-budgets.md. Review the change before updating scripts/performance-budgets.json.`
	);
	process.exitCode = 1;
}
