import { readFileSync } from 'node:fs';

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type Message = {
	id?: number;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: unknown;
};

export type Cdp = Awaited<ReturnType<typeof connect>>;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const probe = readFileSync(new URL('./probe.js', import.meta.url), 'utf8');

// Minimal Chrome DevTools Protocol client for the forwarded profile WebView page.
export async function connect(port = 9222) {
	const targets = (await (await fetch(`http://localhost:${port}/json`)).json()) as {
		type: string;
		webSocketDebuggerUrl: string;
	}[];
	const page = targets.find((target) => target.type === 'page');
	if (!page) throw new Error('No WebView page. Is the profile app running and forwarded?');
	const socket = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		socket.onopen = resolve;
		socket.onerror = reject;
	});
	let nextId = 0;
	const pending = new Map<number, Pending>();
	const listeners = new Map<string, ((params: never) => void)[]>();
	socket.onmessage = (event) => {
		const message = JSON.parse(String(event.data)) as Message;
		const request = message.id === undefined ? undefined : pending.get(message.id);
		if (request && message.id !== undefined) {
			pending.delete(message.id);
			if (message.error) request.reject(new Error(JSON.stringify(message.error)));
			else request.resolve(message.result);
		} else if (message.method) {
			for (const listener of listeners.get(message.method) ?? []) listener(message.params as never);
		}
	};
	socket.onclose = () => {
		for (const request of pending.values()) request.reject(new Error('WebView connection closed'));
		pending.clear();
	};
	const send = <T = unknown>(method: string, params = {}, sessionId?: string) =>
		new Promise<T>((resolve, reject) => {
			const id = ++nextId;
			pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
			socket.send(JSON.stringify({ id, method, params, sessionId }));
		});
	const on = <T>(method: string, listener: (params: T) => void) =>
		listeners.set(method, [...(listeners.get(method) ?? []), listener as (params: never) => void]);
	const evaluate = async <T = unknown>(expression: string, sessionId?: string) => {
		const response = await send<{
			result: { value: T };
			exceptionDetails?: { text: string; exception?: { description?: string } };
		}>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
		if (response.exceptionDetails) {
			const { exception, text } = response.exceptionDetails;
			throw new Error(exception?.description ?? text);
		}
		return response.result.value;
	};
	// Runs an async function body in the page with `P` bound to the probe.
	const run = <T = unknown>(body: string) =>
		evaluate<T>(`(async () => { const P = window.__perf; ${body} })()`);
	const installProbe = async (reload: boolean) => {
		await send('Page.enable');
		await send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
		if (reload) {
			const loaded = new Promise((resolve) => on('Page.loadEventFired', resolve));
			await send('Page.reload');
			await loaded;
		} else if (!(await evaluate('!!window.__perf'))) {
			await evaluate(probe);
		}
	};
	return { send, on, evaluate, run, installProbe, close: () => socket.close() };
}

export function stats(values: (number | null | undefined)[]) {
	const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b);
	const at = (p: number) =>
		sorted[Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))];
	return sorted.length
		? { n: sorted.length, min: sorted[0], p50: at(0.5), p90: at(0.9), max: sorted.at(-1) }
		: { n: 0 };
}
