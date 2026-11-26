import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const storageKey = 'pksx-haptics';
const coalesceWindow = 300;

export type HapticPulse = 'open' | 'success' | 'failure';

const pulses: Record<HapticPulse, () => Promise<void>> = {
	open: () => Haptics.impact({ style: ImpactStyle.Light }),
	success: () => Haptics.impact({ style: ImpactStyle.Medium }),
	failure: () => Haptics.notification({ type: NotificationType.Warning })
};

let last = { kind: 'open' as HapticPulse, at: -Infinity };

export function hapticsEnabled() {
	try {
		return localStorage.getItem(storageKey) !== 'off';
	} catch {
		return true;
	}
}

export function setHapticsEnabled(enabled: boolean) {
	try {
		localStorage.setItem(storageKey, enabled ? 'on' : 'off');
	} catch {
		// Keep the default when storage is unavailable.
	}
}

/** One pulse per action: drops a pulse close behind another, unless a failure follows a non-failure. */
export function pulse(kind: HapticPulse, now = performance.now()) {
	if (!Capacitor.isNativePlatform() || !hapticsEnabled()) return;
	const failureFirst = kind === 'failure' && last.kind !== 'failure';
	if (now - last.at < coalesceWindow && !failureFirst) return;
	last = { kind, at: now };
	void pulses[kind]().catch(() => undefined);
}
