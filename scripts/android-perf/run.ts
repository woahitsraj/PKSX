// Repeatable Android performance scenarios. See docs/testing/android-performance.md.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { connect, sleep, stats, type Cdp } from './cdp.ts';

type Window = {
	worker?: { m: string; box?: number; wait: number | null }[];
	longtasks?: { ms: number }[];
	maxGap?: number;
};
type Result = Window & { ms: number | null; note?: string };

const runs = Number(process.env.RUNS ?? 5);
const saves = (process.env.SAVES ?? 'scarlet,sword,heartgold').split(',');
const outDir = process.env.OUT ?? '/tmp/pksx-android-perf';
const pkg = process.env.PKSX_ANDROID_PACKAGE ?? 'com.pksx.app.profile';
const adb = resolve(
	process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`,
	'platform-tools/adb'
);
const results: Record<string, Result[]> = {};

let cdp!: Cdp;
let probedFromStart = false;
try {
	cdp = await connectToApp(!process.env.NO_RELOAD);
} catch {
	await coldStart();
}

async function connectToApp(reload: boolean) {
	const client = await connect();
	await client.installProbe(reload);
	probedFromStart = reload;
	return client;
}

// Engine requests are only visible when the probe wrapped Worker before the app created it.
async function probeFromStart() {
	if (probedFromStart) return;
	cdp.close();
	cdp = await connectToApp(true);
}

function record(name: string, result: Result) {
	(results[name] ??= []).push(result);
	const engine = (result.worker ?? []).filter((call) => !call.m.includes(':'));
	console.log(
		name,
		result.ms,
		`engine=${engine.map((call) => `${call.m}${call.box ?? ''}:${call.wait}`).join(',')}`,
		`long=${(result.longtasks ?? []).map((task) => task.ms).join(',')}`,
		`maxGap=${result.maxGap ?? ''}`,
		result.note ?? ''
	);
}

// Force-stops the profile app, launches it, and forwards its DevTools socket to :9222.
async function coldStart() {
	cdp?.close();
	execFileSync(adb, ['shell', 'am', 'force-stop', pkg]);
	execFileSync(adb, ['forward', '--remove-all']);
	const launch = execFileSync(adb, [
		'shell',
		'am',
		'start',
		'-W',
		'-n',
		`${pkg}/com.pksx.app.MainActivity`
	]);
	const pid = execFileSync(adb, ['shell', 'pidof', pkg]).toString().trim();
	execFileSync(adb, ['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
	for (;;) {
		const page = await fetch('http://localhost:9222/json')
			.then((response) => response.text())
			.catch(() => '');
		if (page.includes('"page"')) break;
		await sleep(50);
	}
	cdp = await connectToApp(false);
	return Number(/TotalTime: (\d+)/.exec(launch.toString())?.[1]);
}

async function poll<T>(expression: string, timeout = 300000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = await cdp.evaluate<T>(expression).catch(() => null);
		if (value) return value;
		await sleep(30);
	}
	return null;
}

const card = (label: string) =>
	`[...document.querySelectorAll('button[aria-label$=" in Boxes"]')].find((b) => b.getAttribute('aria-label').includes(${JSON.stringify(label)}))`;
const activeLocation = `document.querySelector('section.box-pane.active-pane')?.dataset.location`;
const measure = (action: string, condition: string, timeout = 120000) =>
	cdp.run<Result>(
		`return P.measure(async () => { ${action} }, () => { ${condition} }, { timeout: ${timeout} })`
	);

async function closeDialogs() {
	for (let i = 0; i < 4 && (await cdp.evaluate('!!document.querySelector("[role=dialog]")')); i++) {
		await cdp.run(`P.tap('Escape')`);
		await sleep(900);
	}
}

async function chooseDestination(label: string) {
	await cdp.run(`P.tap('Menu')`);
	await measure('', `return document.querySelector('[role=dialog][aria-label="Main Menu"]')`);
	const root = label === 'Saves' ? 'saves' : label.toLowerCase();
	return measure(
		`[...document.querySelectorAll('[role=dialog][aria-label="Main Menu"] button')].find((b) => b.innerText.trim().startsWith(${JSON.stringify(label)})).click()`,
		`const route = document.querySelector('[data-destination-root="${root}"][data-initial-state="ready"]');
		if (!route || document.querySelector('[role=dialog][aria-label="Main Menu"]')) return false;
		if ('${root}' === 'boxes') return P.boxesSettled();
		if ('${root}' === 'saves') return P.cardsSettled();
		return !route.querySelector('[aria-busy="true"]');`
	);
}

async function goSaves() {
	await probeFromStart();
	await closeDialogs();
	if ((await cdp.evaluate('location.pathname')) !== '/') await chooseDestination('Saves');
	// Stored card details can be ready before the engine is, so wait for both.
	await measure(
		'',
		`return P.cardsSettled() && P.worker.some((call) => call.method === 'msg:status:ready') && P.worker.every((call) => call.received)`,
		300000
	);
}

const openSave = (label: string) =>
	measure(`${card(label)}.click()`, `return location.pathname === '/boxes' && P.boxesSettled()`);

async function focusMoves(name: string) {
	for (let i = 0; i < runs; i++) {
		for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
			const result = await cdp.run<Result>(
				`const before = document.activeElement;
				return P.measure(() => P.press('${key}'), () => document.activeElement !== before, { timeout: 5000 })
					.finally(() => P.press('${key}', false));`
			);
			record(name, result);
			await sleep(250);
		}
	}
}

const scenarios: Record<string, () => Promise<void>> = {
	// Process-cold launch; times are from the WebView time origin.
	async coldCards() {
		for (let i = 0; i < runs; i++) {
			record('cold:activity-start', { ms: await coldStart() });
			// Element Timing gives the paint time even when DevTools connects after the cards appear.
			await cdp.evaluate(
				`window.__cardPaint = 0; new PerformanceObserver((list) => { window.__cardPaint ||= Math.round(list.getEntries()[0].renderTime || list.getEntries()[0].loadTime); }).observe({ type: 'element', buffered: true })`
			);
			record('cold:cards-visible', { ms: await poll<number>(`window.__cardPaint`) });
			record('cold:cards-all-ready', {
				ms: await poll<number>(`window.__perf.cardsSettled() && Math.round(performance.now())`)
			});
		}
	},
	// Process-cold launch, then open the active save as soon as its card exists.
	async coldOpen() {
		for (let i = 0; i < runs; i++) {
			await coldStart();
			const tap = await poll<number>(
				`(() => { const b = document.querySelector('button[aria-label$=" in Boxes"]'); if (!b) return 0; b.click(); return Math.round(performance.now()); })()`
			);
			const done = await poll<number>(
				`location.pathname === '/boxes' && window.__perf.boxesSettled() && Math.round(performance.now())`
			);
			record('cold:open-active-from-tap', { ms: done && tap ? done - tap : null });
		}
	},
	// Engine booted and cards ready: open each save in turn, then return to Saves.
	async warmOpen() {
		for (let i = 0; i < runs * saves.length; i++) {
			await goSaves();
			const save = saves[i % saves.length];
			record(`warm:open-${save}`, await openSave(save));
			record('nav:boxes->saves', await chooseDestination('Saves'));
		}
	},
	async boxSwitch() {
		for (const save of saves) {
			await goSaves();
			await openSave(save);
			for (let i = 0; i < runs; i++) {
				record(
					`box:next-${save}`,
					await measure(
						`window.__before = ${activeLocation}; await P.tap('PageDown');`,
						`return ${activeLocation} !== window.__before && P.boxesSettled()`
					)
				);
				await sleep(800);
			}
			// Five presses 90 ms apart; expect one settled final box and few engine loads.
			record(
				`box:rapid5-${save}`,
				await measure(
					`window.__before = ${activeLocation}; window.__after = 0;
					for (let i = 0; i < 5; i++) { await P.tap('PageDown'); await new Promise((r) => setTimeout(r, 90)); }
					window.__after = performance.now();`,
					`return window.__after && P.worker.every((call) => call.received) && P.boxesSettled()`
				)
			);
			await sleep(800);
		}
	},
	async focus() {
		for (const save of saves) {
			await goSaves();
			await openSave(save);
			await focusMoves(`focus:${save}`);
		}
	},
	// Hold Right from the first slot; the expected cadence is 0/280/390/500/610 ms.
	async held() {
		await goSaves();
		await openSave(saves[0]);
		for (let i = 0; i < runs; i++) {
			await cdp.run(
				`document.querySelector('section.box-pane.active-pane [id$="-slot-0"]').focus()`
			);
			await sleep(400);
			record(
				'focus:held-right-5',
				await cdp.run<Result>(`
					const times = []; const onFocus = () => times.push(performance.now());
					document.addEventListener('focusin', onFocus);
					const t0 = performance.now(); P.press('ArrowRight');
					await new Promise((r) => setTimeout(r, 1500)); P.press('ArrowRight', false);
					document.removeEventListener('focusin', onFocus);
					return { ms: Math.round((times[4] ?? NaN) - t0), note: 'at=' + times.map((t) => Math.round(t - t0)).join('/'), ...P.window(t0, performance.now()) };`)
			);
		}
	},
	async destinations() {
		await goSaves();
		await openSave(saves[0]);
		for (let i = 0; i < runs; i++) {
			for (const label of ['Bag', 'Trainer', 'Boxes', 'Settings', 'Saves', 'Boxes']) {
				record(`nav:->${label}`, await chooseDestination(label));
			}
		}
	},
	async menus() {
		await goSaves();
		await openSave(saves[0]);
		for (let i = 0; i < runs; i++) {
			await closeDialogs();
			record(
				'menu:main-open',
				await measure(
					`P.tap('Menu')`,
					`const d = document.querySelector('[role=dialog][aria-label="Main Menu"]'); return d && d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');`
				)
			);
			await closeDialogs();
			await cdp.run(`document.querySelector('section.box-pane.active-pane .slot.pokemon').focus()`);
			await sleep(300);
			record(
				'menu:slot-open',
				await measure(
					`P.tap('Enter')`,
					`const d = document.querySelector('[role=dialog][aria-label="Slot actions"]'); return d && d.querySelector('#slot-action-0') && !d.querySelector('.delayed-spinner.visible') && d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');`
				)
			);
			record(
				'menu:editor-open',
				await measure(
					`[...document.querySelectorAll('[role=dialog][aria-label="Slot actions"] button')].find((b) => /^Edit/.test(b.innerText.trim())).click()`,
					`const d = document.getElementById('pokemon-editor-title')?.closest('[role=dialog]'); return d && !d.querySelector('[aria-busy="true"], .delayed-spinner.visible') && d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running');`
				)
			);
		}
		await closeDialogs();
	},
	// Opens a second Box Pane with the second save, then switches boxes and moves focus in each pane.
	async twoPane() {
		await goSaves();
		await openSave(saves[0]);
		record(
			'pane:open-second',
			await cdp.run<Result>(`
				document.querySelector('button[aria-label^="Open Box Menu for"]').click();
				await new Promise((r) => setTimeout(r, 900));
				[...document.querySelectorAll('[role=dialog][aria-label="Box Menu"] button')].find((b) => b.innerText.includes('Open another')).click();
				await new Promise((r) => setTimeout(r, 900));
				const choice = [...document.querySelectorAll('[role=dialog][aria-label="Open another collection"] button')].find((b) => b.innerText.includes(${JSON.stringify(saves[1])}));
				return P.measure(() => choice.click(), () => document.querySelectorAll('section.box-pane').length === 2 && P.boxesSettled());`)
		);
		for (const index of [0, 1]) {
			const pane = `document.querySelectorAll('section.box-pane')[${index}]`;
			await cdp.run(`${pane}.querySelector('[id$="-slot-7"]').focus()`);
			await sleep(500);
			for (let i = 0; i < runs; i++) {
				record(
					`pane:box-next-pane${index}`,
					await measure(
						`window.__before = ${pane}.dataset.location; await P.tap('PageDown');`,
						`return ${pane}.dataset.location !== window.__before && P.boxesSettled()`
					)
				);
				await sleep(600);
			}
			await focusMoves(`pane:focus-pane${index}`);
		}
	},
	// Splits single engine calls in a fresh worker: .NET, JSON.parse, validation, postMessage, delivery.
	async engine() {
		const files = (process.env.ENGINE_FILES ?? '').split(',').filter(Boolean);
		const workers: string[] = [];
		cdp.on<{ sessionId: string; targetInfo: { type: string } }>(
			'Target.attachedToTarget',
			(event) => {
				void cdp.send('Runtime.runIfWaitingForDebugger', {}, event.sessionId).catch(() => {});
				if (event.targetInfo.type === 'worker') workers.push(event.sessionId);
			}
		);
		await cdp.send('Target.setAutoAttach', {
			autoAttach: true,
			waitForDebuggerOnStart: false,
			flatten: true
		});
		await sleep(500);
		const existing = workers.length;
		await cdp.run(`
			window.__bench = new Worker(P.workerUrl, P.workerOptions);
			const ready = new Promise((r) => __bench.addEventListener('message', (e) => e.data?.status === 'ready' && r()));
			__bench.postMessage({ type: 'init', basePath: '/pkhex-engine' });
			await ready;`);
		await sleep(300);
		const session = workers[existing];
		await cdp.evaluate(
			`(() => {
				self.__t = [];
				const parse = JSON.parse;
				JSON.parse = function (s, ...a) { const t = performance.now(); const r = parse.call(this, s, ...a); __t.push({ k: 'parse', t, e: performance.now(), n: s.length }); return r; };
				const post = self.postMessage;
				self.postMessage = function (m, ...a) { const t = performance.now(); const r = post.call(self, m, ...a); __t.push({ k: 'post', t, e: performance.now() }); return r; };
			})()`,
			session
		);
		try {
			for (const file of files) {
				const name = basename(file);
				await cdp.evaluate(
					`(window.__fx ??= {})[${JSON.stringify(name)}] = Uint8Array.from(atob(${JSON.stringify(readFileSync(file).toString('base64'))}), (c) => c.charCodeAt(0)), 0`
				);
				for (const [method, box] of [
					['summarizeSave', 0],
					['loadSaveWorkspace', 0],
					['listBoxSlots', 1]
				] as const) {
					const rows: Record<string, number>[] = [];
					for (let i = 0; i <= runs; i++) {
						await cdp.evaluate('__t.length = 0', session);
						const origin = await cdp.evaluate<number>('performance.timeOrigin', session);
						const [total, sent, received, ok] = await cdp.run<[number, number, number, boolean]>(`
							const t = performance.now();
							const response = await new Promise((r) => {
								const id = 'bench' + Math.random();
								const onMessage = (e) => { if (e.data?.id === id) { __bench.removeEventListener('message', onMessage); r({ at: performance.now(), ok: e.data.result?.ok }); } };
								__bench.addEventListener('message', onMessage);
								const bytes = __fx[${JSON.stringify(name)}].slice().buffer;
								__bench.postMessage({ type: 'request', id, method: '${method}', payload: { bytes, fileName: ${JSON.stringify(name)}, box: ${box} } }, [bytes]);
							});
							return [response.at - t, performance.timeOrigin + t, performance.timeOrigin + response.at, response.ok];`);
						const marks = JSON.parse(
							await cdp.evaluate<string>('JSON.stringify(__t)', session)
						) as {
							k: string;
							t: number;
							e: number;
							n?: number;
						}[];
						const parse = marks.filter((mark) => mark.k === 'parse').at(-1);
						const post = marks.filter((mark) => mark.k === 'post').at(-1);
						if (!ok || !parse || !post) throw new Error(`${name} ${method} failed in the engine`);
						if (i === 0) continue;
						rows.push({
							total,
							dotnet: origin + parse.t - sent,
							jsonParse: parse.e - parse.t,
							validate: post.t - parse.e,
							postMessage: post.e - post.t,
							deliver: received - (origin + post.e),
							jsonMB: (parse.n ?? 0) / 1e6
						});
					}
					const p50 = (key: string) => stats(rows.map((row) => Math.round(row[key] * 10) / 10)).p50;
					console.log(
						`engine ${name} ${method}(${box}) p50 ms: total=${p50('total')} dotnet=${p50('dotnet')} JSON.parse=${p50('jsonParse')} validate=${p50('validate')} postMessage=${p50('postMessage')} deliver=${p50('deliver')} json=${p50('jsonMB')}MB`
					);
					record(`engine:${method}-${name}`, { ms: p50('total') ?? null });
				}
			}
		} finally {
			await cdp.evaluate('window.__bench?.terminate()');
		}
	}
};

try {
	for (const name of process.argv.slice(2)) {
		const scenario = scenarios[name];
		if (!scenario)
			throw new Error(`Unknown scenario ${name}. Known: ${Object.keys(scenarios).join(', ')}`);
		await scenario();
	}
} finally {
	const summary = Object.fromEntries(
		Object.entries(results).map(([name, values]) => [name, stats(values.map((value) => value.ms))])
	);
	console.table(summary);
	mkdirSync(outDir, { recursive: true });
	const file = `${outDir}/${process.argv.slice(2).join('+')}-${Date.now()}.json`;
	writeFileSync(file, JSON.stringify({ package: pkg, runs, saves, summary, results }, null, 1));
	console.log(`Wrote ${file}`);
	cdp.close();
}
