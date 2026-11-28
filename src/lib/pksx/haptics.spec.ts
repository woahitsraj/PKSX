import { beforeEach, describe, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({ value: true }));
const calls = vi.hoisted(() => [] as string[]);

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/haptics', () => ({
	ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
	NotificationType: { Warning: 'WARNING' },
	Haptics: {
		impact: async ({ style }: { style: string }) => void calls.push(style),
		notification: async ({ type }: { type: string }) => void calls.push(type)
	}
}));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value)
});

const { pulse, setHapticsEnabled } = await import('./haptics');

let clock = 0;
const at = (step: number) => (clock += step);

beforeEach(() => {
	calls.length = 0;
	store.clear();
	native.value = true;
	at(10_000);
});

describe('haptics', () => {
	test('gives one pulse per action and lets a failure through after an open', () => {
		pulse('open', at(0));
		pulse('open', at(50));
		pulse('success', at(50));
		pulse('failure', at(50));
		pulse('failure', at(50));
		pulse('success', at(400));

		expect(calls).toEqual(['LIGHT', 'WARNING', 'MEDIUM']);
	});

	test('stays silent when turned off or on an unsupported platform', () => {
		setHapticsEnabled(false);
		pulse('success', at(0));
		setHapticsEnabled(true);
		native.value = false;
		pulse('success', at(1_000));

		expect(calls).toEqual([]);
	});
});
