// SPDX-License-Identifier: AGPL-3.0-only
// The Trade Radio firmware checks, after pokeldn v0.4.0 `gui/board.py` (`flash`). See ./NOTICE.md.

import type { TradeErrorCode } from '../contract';
import { readU16le, readU32le, toHex } from './bytes';
import { sha256 } from './crypto';

/** pokeldn v0.4.0 `pokeldn-radio.bin`: the merged classic ESP32 image, served from `static/`. */
export const PINNED_FIRMWARE_IMAGE = {
	url: '/firmware/pokeldn-radio.bin',
	sha256: 'b96e102c01a29b5b7e8cb4a686654fe6d41ce7fb9c81ed1a378629a35a378ff9'
};

const BOOTLOADER_OFFSET = 0x1000;
const IMAGE_MAGIC = 0xe9;
const IMAGE_CHIP_ID = 0;
/** esptool chip names that pokeldn supports but no Link Trade has been verified on. */
const UNVERIFIED_CHIPS = ['ESP32-S3', 'ESP32-C3'];

export class FirmwareError extends Error {
	constructor(
		readonly code: TradeErrorCode,
		message: string
	) {
		super(message);
	}
}

/** A board in its ROM bootloader. */
export interface Bootloader {
	/** esptool's chip name, such as `ESP32` or `ESP32-S3`. */
	readonly chip: string;
	/** Writes the merged image at 0x0 and verifies the written data. */
	write(image: Uint8Array, progress: (written: number, total: number) => void): Promise<void>;
	/** Resets the board into its firmware and releases the port. */
	close(): Promise<void>;
}

export function checkChip(chip: string): void {
	if (chip === 'ESP32') return;
	throw new FirmwareError(
		'unsupported-chip',
		UNVERIFIED_CHIPS.includes(chip)
			? `${chip} boards are not verified for Link Trade yet. Use a classic ESP32 board.`
			: `${chip} boards are not supported. Use a classic ESP32 board.`
	);
}

/** esptool skips its image check on a merged image's 0x1000 padding, so check the bootloader here. */
export async function checkBootloader(image: Uint8Array): Promise<void> {
	const invalid = new FirmwareError(
		'firmware-image-invalid',
		'the firmware image has no valid classic ESP32 bootloader'
	);
	const data = image.subarray(BOOTLOADER_OFFSET);
	if (data.length < 24 || data[0] !== IMAGE_MAGIC || readU16le(data, 12) !== IMAGE_CHIP_ID) {
		throw invalid;
	}
	let at = 24;
	let checksum = 0xef;
	for (let segment = 0; segment < data[1]; segment++) {
		if (at + 8 > data.length) throw invalid;
		const end = at + 8 + readU32le(data, at + 4);
		if (end > data.length) throw invalid;
		for (let i = at + 8; i < end; i++) checksum ^= data[i];
		at = end;
	}
	// The checksum is the last byte of a 16-byte block; a SHA256 of all before it may follow.
	at = (at | 15) + 1;
	if (data[at - 1] !== checksum) throw invalid;
	if (data[23] === 1) {
		const digest = toHex(await sha256(data.subarray(0, at)));
		if (digest !== toHex(data.subarray(at, at + 32))) throw invalid;
	}
}

export async function checkImage(image: Uint8Array): Promise<void> {
	if (toHex(await sha256(image)) !== PINNED_FIRMWARE_IMAGE.sha256) {
		throw new FirmwareError(
			'firmware-image-invalid',
			'the firmware image does not match its recorded SHA256; nothing was written'
		);
	}
	await checkBootloader(image);
}
