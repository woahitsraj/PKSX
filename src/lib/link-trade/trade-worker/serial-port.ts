// SPDX-License-Identifier: AGPL-3.0-only
// The serial seam of the PKSX trade worker. See ./NOTICE.md.

/** An open byte stream to the Trade Radio. */
export interface SerialConnection {
	write(data: Uint8Array): Promise<void>;
	close(): Promise<void>;
}

/** A Trade Radio port; `open` may be called again after a close, at another baud rate. */
export interface TradeSerialPort {
	readonly simulated: boolean;
	open(
		baudRate: number,
		onData: (chunk: Uint8Array) => void,
		onClose: (error: Error | null) => void
	): Promise<SerialConnection>;
}

export class PortBusyError extends Error {}

export interface Clock {
	now(): number;
	/** Resolves after `ms`, or early when `signal` aborts. */
	sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const realClock: Clock = {
	now: () => performance.now(),
	sleep: (ms, signal) =>
		new Promise((resolve) => {
			if (signal?.aborted) return resolve();
			const timer = setTimeout(done, ms);
			signal?.addEventListener('abort', done, { once: true });
			function done() {
				clearTimeout(timer);
				signal?.removeEventListener('abort', done);
				resolve();
			}
		})
};
