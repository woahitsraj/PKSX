// SPDX-License-Identifier: AGPL-3.0-only
// The esptool-js bootloader, after pokeldn v0.4.0 `gui/board.py` (`flash`). See ./NOTICE.md.

import { ESPLoader, Transport } from 'esptool-js';
import SparkMD5 from 'spark-md5';
import { FirmwareError, type Bootloader } from './firmware';
import { PortBusyError } from './serial-port';
import type { WebSerialPortLike } from './web-serial-port';

const FLASH_BAUD = 460800;

export async function openEsptoolBootloader(port: WebSerialPortLike): Promise<Bootloader> {
	const transport = new Transport(port as unknown as ConstructorParameters<typeof Transport>[0]);
	const loader = new ESPLoader({ transport, baudrate: FLASH_BAUD });
	try {
		// Resets into the ROM bootloader, detects the chip and starts the flasher stub.
		await loader.main();
	} catch (error) {
		await transport.disconnect().catch(() => undefined);
		const name = (error as { name?: string }).name;
		if (name === 'InvalidStateError' || name === 'NetworkError') {
			throw new PortBusyError(
				'the Trade Radio port did not open; it may be unplugged or in use by another tab or app'
			);
		}
		throw new FirmwareError(
			'bootloader-not-entered',
			'the board did not enter its bootloader; hold the BOOT button and try again'
		);
	}
	return {
		chip: loader.chip.CHIP_NAME,
		write: (image, progress) =>
			loader.writeFlash({
				fileArray: [{ data: image, address: 0 }],
				flashMode: 'keep',
				flashFreq: 'keep',
				flashSize: 'keep',
				eraseAll: false,
				compress: true,
				reportProgress: (_file, written, total) => progress(written, total),
				// esptool compares this with the MD5 the chip computes over the written flash.
				calculateMD5Hash: (data) => SparkMD5.ArrayBuffer.hash(new Uint8Array(data).buffer)
			}),
		close: async () => {
			await loader.after('hard_reset').catch(() => undefined);
			await transport.disconnect().catch(() => undefined);
		}
	};
}
