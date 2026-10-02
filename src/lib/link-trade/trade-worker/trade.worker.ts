// SPDX-License-Identifier: AGPL-3.0-only
// The PKSX trade worker entry. See ./NOTICE.md.

import type { RadioPort } from '../contract';
import { indexedDbKeyStore } from '../switch-keys';
import { FirmwareError, PINNED_FIRMWARE_IMAGE } from './firmware';
import { PortError, TradeWorkerRuntime } from './runtime';
import { realClock } from './serial-port';
import { findWebSerialPort, webSerial, WebSerialTradePort } from './web-serial-port';

const keyStore = indexedDbKeyStore();
// Vite replaces `import.meta.env.DEV` with false in production builds, which drops the fake.
const loadFake = import.meta.env.DEV ? () => import('./fake-radio') : null;
const loadFakeBootloader = import.meta.env.DEV ? () => import('./fake-bootloader') : null;

async function openPort(port: RadioPort) {
	if (port.kind === 'fake') {
		if (!loadFake)
			throw new PortError('fake-port-unavailable', 'the simulated radio is for dev builds');
		const { FakeTradeRadio } = await loadFake();
		return new FakeTradeRadio({
			script: port.script,
			keys: () => keyStore.load(),
			clock: realClock
		});
	}
	return new WebSerialTradePort(await grantedPort(port));
}

async function grantedPort(port: Extract<RadioPort, { kind: 'web-serial' }>) {
	const serial = webSerial();
	if (!serial)
		throw new PortError(
			'web-serial-unavailable',
			'Link Trade needs Web Serial in desktop Chrome or Edge'
		);
	const found = await findWebSerialPort(serial, port);
	if (!found)
		throw new PortError('port-not-found', 'choose the Trade Radio in the browser prompt first');
	return found;
}

async function openBootloader(port: RadioPort) {
	if (port.kind === 'fake') {
		if (!loadFakeBootloader)
			throw new PortError('fake-port-unavailable', 'the simulated radio is for dev builds');
		const { fakeBootloader } = await loadFakeBootloader();
		return fakeBootloader(port.flash ?? 'installs', realClock);
	}
	const found = await grantedPort(port);
	const { openEsptoolBootloader } = await import('./esptool-bootloader');
	return openEsptoolBootloader(found);
}

async function loadFirmware() {
	const response = await fetch(PINNED_FIRMWARE_IMAGE.url);
	if (!response.ok)
		throw new FirmwareError('internal-error', 'the firmware image did not download');
	return new Uint8Array(await response.arrayBuffer());
}

const runtime = new TradeWorkerRuntime({
	post: (message) => self.postMessage(message),
	keyStore,
	openPort,
	openBootloader,
	loadFirmware,
	webSerial: webSerial() !== null,
	fakePort: loadFake !== null,
	clock: realClock
});

self.addEventListener('message', (event: MessageEvent) => void runtime.handle(event.data));
