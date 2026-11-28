// Compares held Next Box on the working tree with a base ref. See docs/testing/box-switch-benchmark.md.
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cpus, loadavg, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { assertPkhexEngineCurrent } from '../pkhex-engine-path.ts';
import { compare, summarize } from './stats.ts';

const CPU_SLOWDOWN = 4;
const REPEATS = 12;
const REPEAT_MS = 33;
// The probe samples once per animation frame, so a smaller time gap is below its resolution.
const FRAME_MS = 17;
const runs = Math.max(5, Number(process.env.RUNS ?? 5));
const baseRef = process.argv[2] ?? 'origin/main';
const fixtures = {
	Emerald: 'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav',
	Scarlet:
		'test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav'
};

type Bench = {
	calls: { method: string; sent: number; ok: boolean | null }[];
	boxes: { title: string; location: string; at: number }[];
	down: number;
	up: number;
	settled: number;
	start: () => void;
};
type Sample = {
	settleMs: number;
	frozenMs: number;
	boxesShown: number;
	holdMs: number;
	boxLoads: number;
	engineCalls: number;
};
type Run = { sample?: Sample; errors: string[] };

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sh = (cwd: string, command: string, ...args: string[]) =>
	execFileSync(command, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });

// Runs in the page before the app. Records engine requests, Boxes shown, and the settle time.
function probe() {
	const bench: Bench = {
		calls: [],
		boxes: [],
		down: 0,
		up: 0,
		settled: 0,
		start() {
			addEventListener('keydown', (event) => {
				if (event.key === ']') bench.down ||= performance.now();
			});
			addEventListener('keyup', (event) => {
				if (event.key === ']') bench.up = performance.now();
			});
			const tick = () => {
				const now = performance.now();
				const pane = document.querySelector<HTMLElement>('section.box-pane.active-pane');
				const title = pane?.querySelector('h2')?.textContent?.trim() ?? '';
				if (title !== bench.boxes.at(-1)?.title)
					bench.boxes.push({ title, location: pane?.dataset.location ?? '', at: now });
				const loading =
					!pane ||
					pane.getAttribute('aria-busy') === 'true' ||
					pane.hasAttribute('data-box-load-pending');
				if (!bench.up || loading) bench.settled = 0;
				else bench.settled ||= now;
				requestAnimationFrame(tick);
			};
			tick();
		}
	};
	(window as unknown as { __bench: Bench }).__bench = bench;
	const NativeWorker = window.Worker;
	window.Worker = class extends NativeWorker {
		constructor(url: string | URL, options?: WorkerOptions) {
			super(url, options);
			const open = new Map<unknown, Bench['calls'][number]>();
			const post = this.postMessage.bind(this) as (message: unknown, transfer?: unknown) => void;
			this.postMessage = (message: { type?: string; id?: unknown; method: string }, transfer) => {
				if (message?.type === 'request') {
					const call = { method: message.method, sent: performance.now(), ok: null };
					open.set(message.id, call);
					bench.calls.push(call);
				}
				post(message, transfer);
			};
			this.addEventListener('message', (event) => {
				const call = open.get(event.data?.id);
				if (call) call.ok = event.data?.result?.ok !== false;
			});
		}
	};
}

async function measure(browser: Browser, origin: string, fixture: string): Promise<Run> {
	const errors: string[] = [];
	const context = await browser.newContext({ serviceWorkers: 'block' });
	try {
		await context.addInitScript(probe);
		const page = await context.newPage();
		page.setDefaultTimeout(120_000);
		page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
		await page.goto(origin);
		await page.locator('[data-destination-root="saves"][data-initial-state="ready"]').waitFor();
		await page.getByLabel('Import Save File', { exact: true }).setInputFiles(fixture);
		await page.getByText(`${basename(fixture)} imported and made active.`).waitFor();
		await page.goto(`${origin}/boxes`);
		await page
			.locator(
				'.boxes-route[data-initial-state="ready"] section.box-pane.active-pane[data-location="box-0"]:not([aria-busy="true"]):not([data-box-load-pending])'
			)
			.waitFor();
		// The adjacent Box prefetch starts 300 ms after a load. Keep it out of the timed hold.
		await page.waitForTimeout(1000);
		await page.locator('#box-grid').focus();
		const cdp = await context.newCDPSession(page);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
		await page.evaluate(() => (window as unknown as { __bench: Bench }).__bench.start());
		for (let repeat = 0; repeat < REPEATS; repeat += 1) {
			await page.keyboard.down(']');
			await page.waitForTimeout(REPEAT_MS);
		}
		await page.keyboard.up(']');
		await page.waitForFunction(() => {
			const { settled } = (window as unknown as { __bench: Bench }).__bench;
			return settled > 0 && performance.now() - settled > 500;
		});
		const bench = await page.evaluate(() => {
			const { calls, boxes, down, up, settled } = (window as unknown as { __bench: Bench }).__bench;
			return { calls, boxes, down, up, settled };
		});
		const calls = bench.calls.filter((call) => call.sent >= bench.down);
		const changes = bench.boxes.filter((box) => box.at > bench.down).map((box) => box.at);
		const marks = [bench.down, ...changes];
		const sample: Sample = {
			settleMs: bench.settled - bench.up,
			frozenMs: Math.max(0, ...marks.slice(1).map((at, index) => at - marks[index])),
			boxesShown: changes.filter((at) => at <= bench.up).length,
			holdMs: bench.up - bench.down,
			boxLoads: calls.filter((call) => call.method === 'listBoxSlots').length,
			engineCalls: calls.length
		};
		const final = bench.boxes.at(-1)?.location;
		if (final !== `box-${REPEATS}`) errors.push(`ended on ${final}, not box-${REPEATS}`);
		if (!sample.boxLoads) errors.push('no Box load ran during the hold');
		for (const call of calls) if (!call.ok) errors.push(`engine call ${call.method} failed`);
		return { sample, errors };
	} catch (error) {
		return { errors: [...errors, `run failed: ${(error as Error).message.split('\n')[0]}`] };
	} finally {
		await context.close();
	}
}

async function freePort() {
	const server = createServer().listen(0, '127.0.0.1');
	await new Promise((done) => server.once('listening', done));
	const { port } = server.address() as { port: number };
	await new Promise((done) => server.close(done));
	return port;
}

async function preview(cwd: string, servers: ChildProcess[]) {
	const origin = `http://127.0.0.1:${await freePort()}`;
	servers.push(
		spawn(
			join(cwd, 'node_modules/.bin/vite'),
			['preview', '--host', '127.0.0.1', '--port', new URL(origin).port, '--strictPort'],
			{ cwd, stdio: 'ignore' }
		)
	);
	for (let attempt = 0; attempt < 300; attempt += 1) {
		if (
			await fetch(origin).then(
				(response) => response.ok,
				() => false
			)
		)
			return origin;
		await new Promise((done) => setTimeout(done, 100));
	}
	throw new Error(`The preview server in ${cwd} did not start.`);
}

const rows: {
	key: keyof Sample;
	label: string;
	words?: [positive: string, negative: string];
	resolution?: number;
}[] = [
	{
		key: 'settleMs',
		label: 'Settle after release (ms)',
		words: ['slower', 'faster'],
		resolution: FRAME_MS
	},
	{
		key: 'frozenMs',
		label: 'Longest frozen gap (ms)',
		words: ['longer', 'shorter'],
		resolution: FRAME_MS
	},
	{ key: 'boxesShown', label: `Boxes shown during hold (of ${REPEATS})`, words: ['more', 'fewer'] },
	{ key: 'holdMs', label: 'Hold length (ms)' },
	{ key: 'boxLoads', label: 'Work: Box loads' },
	{ key: 'engineCalls', label: 'Work: engine calls' }
];

function report(name: string, base: Run[], branch: Run[]) {
	const cell = (side: Run[], key: keyof Sample) => {
		const values = side.flatMap((run) => (run.sample ? [run.sample[key]] : []));
		if (!values.length) return { text: 'no valid run' };
		const summary = summarize(values);
		const round = (value: number) => Math.round(value);
		return {
			summary,
			text: `${round(summary.median)} (${round(summary.min)} to ${round(summary.max)})`
		};
	};
	console.log(`\n### ${name}\n`);
	console.log(`| Measure | \`${baseRef}\` | Branch | Result |`);
	console.log('|---|---|---|---|');
	for (const { key, label, words, resolution } of rows) {
		const [a, b] = [cell(base, key), cell(branch, key)];
		let result = '';
		if (words && a.summary && b.summary) {
			const { gap, variation, measurable } = compare(a.summary, b.summary, resolution);
			const size =
				`${Math.round(Math.abs(gap))}, run-to-run variation ${Math.round(variation)}` +
				(resolution ? `, probe resolution ${resolution}` : '');
			result = measurable
				? `Branch ${words[gap > 0 ? 0 : 1]} by ${size}`
				: `No measurable difference (gap ${size})`;
		}
		console.log(`| ${label} | ${a.text} | ${b.text} | ${result} |`);
	}
	const errors = (side: Run[]) => side.reduce((count, run) => count + run.errors.length, 0);
	console.log(`| Errors | ${errors(base)} | ${errors(branch)} | |`);
}

assertPkhexEngineCurrent();
const baseSha = git('rev-parse', baseRef);
const baseDir = mkdtempSync(join(tmpdir(), 'pksx-box-switch-base-'));
const servers: ChildProcess[] = [];
const startLoad = loadavg()[0];
let browser: Browser | undefined;
let failed = false;
const cleanUp = () => {
	for (const server of servers) server.kill();
	spawnSync('git', ['worktree', 'remove', '--force', baseDir]);
};
for (const signal of ['SIGINT', 'SIGTERM'] as const)
	process.once(signal, () => {
		cleanUp();
		process.exit(130);
	});
try {
	console.error(`Building ${baseRef} (${baseSha.slice(0, 8)}) and the working tree...`);
	git('worktree', 'add', '--detach', baseDir, baseSha);
	sh(baseDir, 'pnpm', 'install', '--frozen-lockfile', '--prefer-offline');
	if (
		spawnSync('git', [
			'diff',
			'--quiet',
			baseSha,
			'--',
			'engine',
			'Directory.Build.targets',
			'Directory.Packages.props',
			'global.json'
		]).status === 0
	)
		cpSync('static/pkhex-engine', join(baseDir, 'static/pkhex-engine'), { recursive: true });
	else sh(baseDir, 'pnpm', 'engine:sync');
	sh(baseDir, 'pnpm', 'build');
	sh('.', 'pnpm', 'build');
	const origins = { base: await preview(baseDir, servers), branch: await preview('.', servers) };
	browser = await chromium.launch();

	const results: Record<string, { base: Run[]; branch: Run[] }> = {};
	for (const [name, fixture] of Object.entries(fixtures)) {
		const result = (results[name] = { base: [] as Run[], branch: [] as Run[] });
		for (let run = 0; run < runs; run += 1)
			for (const side of ['base', 'branch'] as const) {
				console.error(`${name} run ${run + 1} of ${runs}: ${side}`);
				result[side].push(await measure(browser, origins[side], resolve(fixture)));
			}
	}

	const dirty = git('status', '--porcelain') ? ', with uncommitted changes' : '';
	console.log('## Box-switch benchmark\n');
	console.log(
		`Hold Next Box for ${REPEATS} repeats at ${REPEAT_MS} ms, ${CPU_SLOWDOWN}x CPU slowdown, production builds in Chromium. ` +
			`${runs} alternating runs per side. Each cell is the median (range).\n`
	);
	console.log(`- Base: \`${baseRef}\` at ${baseSha.slice(0, 8)}`);
	console.log(`- Branch: ${git('rev-parse', '--short=8', 'HEAD')}${dirty}`);
	console.log(
		`- Machine load (1 minute average): ${startLoad.toFixed(1)} at the start, ${loadavg()[0].toFixed(1)} at the end, on ${cpus().length} cores. Runs alternate, so both sides saw the same load.`
	);
	for (const [name, result] of Object.entries(results)) {
		report(name, result.base, result.branch);
		for (const side of ['base', 'branch'] as const)
			for (const [run, { errors }] of result[side].entries())
				for (const error of errors) {
					failed = true;
					console.log(`\n- Error, ${name} ${side} run ${run + 1}: ${error}`);
				}
	}
	mkdirSync('artifacts/performance', { recursive: true });
	writeFileSync(
		'artifacts/performance/box-switch-benchmark.json',
		JSON.stringify({ baseRef, baseSha, runs, results }, null, '\t')
	);
} finally {
	await browser?.close();
	cleanUp();
}
if (failed) process.exitCode = 1;
