import type { OutgoingLinkTrade, SaveSlotRef } from '$lib/engine';
import type { LinkTradeGame, TradeError, TradeWorkerCapabilities } from './contract';

export type TradeSource = {
	owner: 'save-file' | 'pokemon-storage';
	slot: SaveSlotRef;
};

/** What the user reviewed. The exchange (#437) sends exactly these bytes, or asks for a new review. */
export type ReviewedLinkTrade = {
	game: LinkTradeGame;
	source: TradeSource;
	sourceSha256: string;
	outgoingSha256: string;
	outgoingBytes: Uint8Array;
};

export const TRADE_GAME_NAMES: Record<LinkTradeGame, string> = {
	sword: 'Sword',
	shield: 'Shield'
};

/** Android Chrome can expose Web Serial, but Link Trade is verified on desktop only. */
export function canConnectRadio(
	capabilities: Pick<TradeWorkerCapabilities, 'webSerial'>,
	userAgent: string
): boolean {
	return capabilities.webSerial && !/Android/i.test(userAgent);
}

export function reviewedLinkTrade(
	source: TradeSource,
	offer: OutgoingLinkTrade
): ReviewedLinkTrade | null {
	if (!offer.ready || !offer.outgoingBytes || !offer.outgoingSha256) return null;
	return {
		game: offer.destinationGame,
		source,
		sourceSha256: offer.sourceSha256,
		outgoingSha256: offer.outgoingSha256,
		outgoingBytes: offer.outgoingBytes
	};
}

export function radioFailure(error: TradeError): { message: string; offerInstall: boolean } {
	switch (error.code) {
		case 'firmware-mismatch':
		case 'protocol-mismatch':
			return { message: 'This board runs another version of the firmware.', offerInstall: true };
		case 'unsupported-board':
			return { message: 'This board did not answer as a Trade Radio.', offerInstall: true };
		case 'port-busy':
			return {
				message: 'The board is unplugged, or another tab or app uses it.',
				offerInstall: false
			};
		case 'port-not-found':
			return { message: 'PKSX cannot find the board. Connect it again.', offerInstall: false };
		case 'web-serial-unavailable':
			return { message: 'Link Trade needs desktop Chrome or Edge.', offerInstall: false };
		default:
			return { message: 'PKSX could not connect to the board.', offerInstall: false };
	}
}
