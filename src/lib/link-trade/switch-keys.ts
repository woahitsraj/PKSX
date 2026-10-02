import { SWITCH_KEY_NAMES, type SwitchKeys } from './trade-worker/crypto';

export type { SwitchKeys };

export class IncompleteKeysError extends Error {
	constructor(readonly missing: string[]) {
		super(`prod.keys is missing ${missing.join(', ')}`);
	}
}

/** -> the four values LDN needs from a `prod.keys` text; every other line is ignored. */
export function parseProdKeys(text: string): SwitchKeys {
	const found = new Map<string, Uint8Array<ArrayBuffer>>();
	for (const line of text.split(/\r?\n/)) {
		const at = line.indexOf('=');
		if (at < 0) continue;
		const name = line.slice(0, at).trim().toLowerCase();
		const value = line.slice(at + 1).trim();
		if (!(SWITCH_KEY_NAMES as readonly string[]).includes(name) || !/^[0-9a-f]{32}$/i.test(value))
			continue;
		found.set(
			name,
			Uint8Array.from(value.match(/../g)!, (b) => parseInt(b, 16))
		);
	}
	const missing = SWITCH_KEY_NAMES.filter((name) => !found.has(name));
	if (missing.length) throw new IncompleteKeysError(missing);
	return Object.fromEntries(
		SWITCH_KEY_NAMES.map((name) => [name, found.get(name)!])
	) as unknown as SwitchKeys;
}

/** Device-local and separate from Saves, Backups, Export and any future Cloud Sync store. */
export interface SwitchKeyStore {
	load(): Promise<SwitchKeys | null>;
	save(keys: SwitchKeys): Promise<void>;
	forget(): Promise<void>;
}

const DATABASE = 'pksx-switch-keys';
const STORE = 'keys';
const RECORD = 'ldn';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = action(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}

export function indexedDbKeyStore(): SwitchKeyStore {
	return {
		async load() {
			const record = await run<Record<string, Uint8Array<ArrayBuffer>> | undefined>(
				'readonly',
				(s) => s.get(RECORD)
			);
			if (!record || SWITCH_KEY_NAMES.some((name) => !(record[name] instanceof Uint8Array)))
				return null;
			return record as unknown as SwitchKeys;
		},
		async save(keys) {
			await run('readwrite', (s) => s.put({ ...keys }, RECORD));
		},
		async forget() {
			await run('readwrite', (s) => s.delete(RECORD));
		}
	};
}

export function memoryKeyStore(initial: SwitchKeys | null = null): SwitchKeyStore {
	let keys = initial;
	return {
		load: async () => keys,
		save: async (value) => {
			keys = value;
		},
		forget: async () => {
			keys = null;
		}
	};
}
