// SPDX-License-Identifier: AGPL-3.0-only
// A scripted bootloader for tests and dev builds only. See ./NOTICE.md.

import type { RadioPort } from '../contract';
import { FirmwareError, type Bootloader } from './firmware';
import type { Clock } from './serial-port';

export type FakeFlash = NonNullable<Extract<RadioPort, { kind: 'fake' }>['flash']>;

export async function fakeBootloader(
	flash: FakeFlash,
	clock: Clock,
	written: (image: Uint8Array) => void = () => undefined
): Promise<Bootloader> {
	await clock.sleep(300);
	if (flash === 'needs-boot-button') {
		throw new FirmwareError('bootloader-not-entered', 'the simulated board did not answer');
	}
	return {
		chip: flash === 'esp32-s3' ? 'ESP32-S3' : flash === 'esp32-c6' ? 'ESP32-C6' : 'ESP32',
		async write(image, progress) {
			for (let step = 1; step <= 10; step++) {
				await clock.sleep(200);
				if (flash === 'write-fails' && step === 4) throw new Error('the simulated write failed');
				progress(Math.floor((image.length * step) / 10), image.length);
			}
			written(image);
		},
		close: async () => undefined
	};
}
