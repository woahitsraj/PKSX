// Injected into the profile WebView. Records engine requests, Capacitor bridge calls, long tasks and frames.
(() => {
	const P = (window.__perf = {
		worker: [],
		bridge: [],
		longtasks: [],
		frames: new Float64Array(20000),
		frameCount: 0
	});
	const NativeWorker = window.Worker;
	window.Worker = class extends NativeWorker {
		constructor(...args) {
			super(...args);
			P.workerUrl = String(args[0]);
			P.workerOptions = args[1];
			const open = new Map();
			const post = this.postMessage.bind(this);
			this.postMessage = (message, transfer) => {
				if (message?.type === 'request') {
					const bytes = message.payload?.bytes?.byteLength ?? 0;
					const entry = {
						id: message.id,
						method: message.method,
						box: message.payload?.box,
						bytes,
						sent: performance.now(),
						received: 0
					};
					open.set(message.id, entry);
					P.worker.push(entry);
				} else
					P.worker.push({
						method: `post:${message?.type}`,
						sent: performance.now(),
						received: performance.now()
					});
				return post(message, transfer);
			};
			this.addEventListener('message', (event) => {
				const entry = open.get(event.data?.id);
				if (entry) {
					entry.received = performance.now();
					entry.ok = event.data?.result?.ok;
					open.delete(event.data.id);
				} else
					P.worker.push({
						method: `msg:${event.data?.type}:${event.data?.status ?? ''}`,
						sent: performance.now(),
						received: performance.now()
					});
			});
		}
	};
	const wrapBridge = () => {
		const cap = window.Capacitor;
		if (!cap?.nativePromise || cap.__perfWrapped) return false;
		const original = cap.nativePromise.bind(cap);
		cap.nativePromise = (plugin, method, options) => {
			const entry = {
				plugin,
				method,
				path: options?.path,
				sent: performance.now(),
				received: 0,
				chars: 0
			};
			P.bridge.push(entry);
			return original(plugin, method, options).then(
				(result) => {
					entry.received = performance.now();
					entry.chars = typeof result?.data === 'string' ? result.data.length : 0;
					return result;
				},
				(error) => {
					entry.received = performance.now();
					entry.error = true;
					throw error;
				}
			);
		};
		cap.__perfWrapped = true;
		return true;
	};
	const poll = setInterval(() => wrapBridge() && clearInterval(poll), 1);
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries())
				P.longtasks.push({ start: e.startTime, duration: e.duration });
		}).observe({ type: 'longtask', buffered: true });
	} catch {
		// Long tasks are optional.
	}
	const frame = (t) => {
		P.frames[P.frameCount++ % P.frames.length] = t;
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
})();
(() => {
	const P = window.__perf;
	P.workerUrl ??= performance
		.getEntriesByType('resource')
		.find((r) => r.name.includes('pkhex-engine.worker'))?.name;
	P.workerOptions ??= { type: 'module' };
	const raf = () => new Promise((r) => requestAnimationFrame(r));
	P.press = (key, pressed = true) =>
		window.dispatchEvent(
			new CustomEvent('pksxcontroller', {
				detail: { key, pressed, discrete: !key.startsWith('Arrow'), id: 'perf' }
			})
		);
	P.tap = async (key) => {
		P.press(key, true);
		await raf();
		P.press(key, false);
	};
	P.boxesSettled = () => {
		const route = document.querySelector('.boxes-route[data-initial-state="ready"]');
		if (!route) return false;
		const panes = [...route.querySelectorAll('section.box-pane')];
		if (!panes.length || panes.some((p) => p.getAttribute('aria-busy') === 'true')) return false;
		return [...route.querySelectorAll('img.slot-sprite')].every((img) => img.complete);
	};
	P.cardsSettled = () => {
		const cards = [...document.querySelectorAll('button[aria-label$=" in Boxes"]')];
		return (
			cards.length > 0 &&
			cards.every(
				(b) =>
					b.querySelector('.card-stats') ||
					b.querySelector('.detail-state:not(:has([role=status]))')
			)
		);
	};
	P.window = (t0, t1) => {
		const frames = [];
		const n = Math.min(P.frameCount, P.frames.length);
		for (let i = 0; i < n; i++) {
			const t = P.frames[i];
			if (t >= t0 && t <= t1) frames.push(t);
		}
		frames.sort((a, b) => a - b);
		const gaps = frames.slice(1).map((t, i) => t - frames[i]);
		const r = (x) => Math.round(x);
		return {
			worker: P.worker
				.filter((w) => w.sent >= t0 - 1 && w.sent <= t1)
				.map((w) => ({
					m: w.method,
					box: w.box,
					kb: r(w.bytes / 1024),
					wait: w.received ? r(w.received - w.sent) : null,
					at: r(w.sent - t0)
				})),
			bridge: P.bridge
				.filter((b) => b.sent >= t0 - 1 && b.sent <= t1)
				.map((b) => ({
					m: `${b.plugin}.${b.method}`,
					path: b.path,
					kchars: r(b.chars / 1024),
					ms: b.received ? r(b.received - b.sent) : null,
					at: r(b.sent - t0)
				})),
			longtasks: P.longtasks
				.filter((l) => l.start + l.duration >= t0 && l.start <= t1)
				.map((l) => ({ at: r(l.start - t0), ms: r(l.duration) })),
			frames: frames.length,
			maxGap: r(Math.max(0, ...gaps)),
			jank: gaps.filter((g) => g > 50).length
		};
	};
	// Run action, then wait until condition holds and one more frame is produced.
	P.measure = async (action, condition, { timeout = 120000 } = {}) => {
		const t0 = performance.now();
		await action();
		const deadline = t0 + timeout;
		while (!condition()) {
			if (performance.now() > deadline)
				return { ms: null, timeout: true, ...P.window(t0, performance.now()) };
			await raf();
		}
		await raf();
		const t1 = performance.now();
		return { ms: Math.round(t1 - t0), ...P.window(t0, t1) };
	};
})();
