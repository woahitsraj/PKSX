import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { pulse } from '../haptics';

const toastHostContextKey = Symbol('pksx-toast-host');
const maxVisibleToasts = 3;
const successLifetime = 3_400;
const errorLifetime = 5_200;

export type ToastTone = 'success' | 'error';

/** Set haptic to false for outcomes the user did not trigger, such as a background rescan. */
export type ToastOptions = { haptic?: boolean };

export type ToastView = {
	id: string;
	tone: ToastTone;
	message: string;
};

export type ToastHost = {
	readonly toasts: readonly ToastView[];
	success(message: string, options?: ToastOptions): void;
	error(message: string, options?: ToastOptions): void;
	dispose(): void;
};

export function createToastHost(): ToastHost {
	const toasts = $state<ToastView[]>([]);
	const timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	let nextId = 1;

	function dismiss(id: string) {
		const index = toasts.findIndex((toast) => toast.id === id);
		if (index >= 0) toasts.splice(index, 1);
		const timer = timers.get(id);
		if (timer) clearTimeout(timer);
		timers.delete(id);
	}

	function deliver(tone: ToastTone, message: string, { haptic = true }: ToastOptions = {}) {
		if (haptic) pulse(tone === 'error' ? 'failure' : 'success');
		while (toasts.length >= maxVisibleToasts) dismiss(toasts[0].id);
		const toast = { id: `toast-${nextId++}`, tone, message };
		toasts.push(toast);
		timers.set(
			toast.id,
			setTimeout(() => dismiss(toast.id), tone === 'error' ? errorLifetime : successLifetime)
		);
	}

	return {
		get toasts() {
			return toasts;
		},
		success(message, options) {
			deliver('success', message, options);
		},
		error(message, options) {
			deliver('error', message, options);
		},
		dispose() {
			for (const id of [...timers.keys()]) dismiss(id);
		}
	};
}

export function setToastHost(host: ToastHost) {
	return setContext(toastHostContextKey, host);
}

export function getToastHost() {
	const host = getContext<ToastHost | undefined>(toastHostContextKey);
	if (!host) throw new Error('Toast host is unavailable.');
	return host;
}
