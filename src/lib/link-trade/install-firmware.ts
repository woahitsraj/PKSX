import {
	boardSchema,
	tradeWorkerMessageSchema,
	type Board,
	type RadioPort,
	type TradeError,
	type TradeWorkerEvent
} from './contract';

export type FirmwareInstallProgress = Extract<TradeWorkerEvent, { type: 'firmware-install' }>;
export type FirmwareInstallResult = { ok: true; board: Board } | { ok: false; error: TradeError };

/** Sends `install-firmware` to the trade worker and resolves with its response. */
export function installFirmware(
	worker: Pick<Worker, 'postMessage' | 'addEventListener' | 'removeEventListener'>,
	port: RadioPort,
	onProgress: (progress: FirmwareInstallProgress) => void
): Promise<FirmwareInstallResult> {
	const requestId = `install-firmware-${crypto.randomUUID()}`;
	return new Promise((resolve) => {
		const listen = (event: Event) => {
			const parsed = tradeWorkerMessageSchema.safeParse((event as MessageEvent).data);
			if (!parsed.success) return;
			const message = parsed.data;
			if (message.type === 'event') {
				if (message.event.type === 'firmware-install') onProgress(message.event);
				return;
			}
			if (message.requestId !== requestId) return;
			worker.removeEventListener('message', listen);
			resolve(
				message.ok
					? { ok: true, board: boardSchema.parse((message.result as { board: unknown }).board) }
					: { ok: false, error: message.error }
			);
		};
		worker.addEventListener('message', listen);
		worker.postMessage({ type: 'install-firmware', requestId, port });
	});
}
