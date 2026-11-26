import type { SavesStorage } from './types';

const readMethod = /^(get|list|export)/;

/** Calls `onWrite` after each storage write settles, before the caller continues. */
export function notifyOnWrite<T extends SavesStorage>(storage: T, onWrite: () => void): T {
	return new Proxy(storage, {
		get(target, property) {
			const value = Reflect.get(target, property, target);
			if (typeof value !== 'function') return value;
			if (typeof property !== 'string' || readMethod.test(property)) return value.bind(target);
			return (...args: unknown[]) => Promise.resolve(value.apply(target, args)).finally(onWrite);
		}
	});
}
