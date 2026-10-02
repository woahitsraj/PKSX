// SPDX-License-Identifier: AGPL-3.0-only
// The Web Serial Trade Radio port, after pokeldn v0.4.0 `Radio.open_serial`. See ./NOTICE.md.

import { PortBusyError, type SerialConnection, type TradeSerialPort } from './serial-port';

/** The slice of the Web Serial API this port uses; `navigator.serial` in a dedicated worker. */
export interface WebSerialPortLike {
	getInfo(): { usbVendorId?: number; usbProductId?: number };
	open(options: { baudRate: number }): Promise<void>;
	close(): Promise<void>;
	setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
	readable: ReadableStream<Uint8Array> | null;
	writable: WritableStream<Uint8Array> | null;
}

export interface WebSerialLike {
	getPorts(): Promise<WebSerialPortLike[]>;
}

export function webSerial(): WebSerialLike | null {
	const serial = (globalThis.navigator as { serial?: WebSerialLike } | undefined)?.serial;
	return serial ?? null;
}

/** -> the granted port that matches, or null when none or several do. */
export async function findWebSerialPort(
	serial: WebSerialLike,
	filter: { usbVendorId?: number; usbProductId?: number }
): Promise<WebSerialPortLike | null> {
	const ports = (await serial.getPorts()).filter((port) => {
		const info = port.getInfo();
		return (
			(filter.usbVendorId === undefined || info.usbVendorId === filter.usbVendorId) &&
			(filter.usbProductId === undefined || info.usbProductId === filter.usbProductId)
		);
	});
	return ports.length === 1 ? ports[0] : null;
}

export class WebSerialTradePort implements TradeSerialPort {
	readonly simulated = false;

	constructor(private port: WebSerialPortLike) {}

	async open(
		baudRate: number,
		onData: (chunk: Uint8Array) => void,
		onClose: (error: Error | null) => void
	): Promise<SerialConnection> {
		try {
			await this.port.open({ baudRate });
		} catch (error) {
			const name = (error as { name?: string }).name;
			if (name === 'InvalidStateError' || name === 'NetworkError') {
				throw new PortBusyError('the Trade Radio port is in use by another tab or app');
			}
			throw error;
		}
		// Most ESP32 boards reset on a DTR/RTS edge; keep both released.
		await this.port
			.setSignals({ dataTerminalReady: false, requestToSend: false })
			.catch(() => undefined);
		const reader = this.port.readable!.getReader();
		const writer = this.port.writable!.getWriter();
		let closing = false;
		const reading = (async () => {
			try {
				for (;;) {
					const { value, done } = await reader.read();
					if (done) break;
					if (value) onData(value);
				}
				if (!closing) onClose(null);
			} catch (error) {
				if (!closing) onClose(error instanceof Error ? error : new Error(String(error)));
			}
		})();
		return {
			write: (data) => writer.write(new Uint8Array(data)),
			close: async () => {
				closing = true;
				await reader.cancel().catch(() => undefined);
				reader.releaseLock();
				writer.releaseLock();
				await reading;
				await this.port.close().catch(() => undefined);
			}
		};
	}
}
