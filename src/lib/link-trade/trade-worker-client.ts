import {
	boardSchema,
	sessionStatusSchema,
	capabilitiesSchema,
	tradeWorkerMessageSchema,
	type Board,
	type RadioPort,
	type TradeError,
	type TradeWorkerCapabilities,
	type TradeWorkerCommand,
	type TradeWorkerEvent
} from './contract';
import {
	installFirmware,
	type FirmwareInstallProgress,
	type FirmwareInstallResult
} from './install-firmware';

export type TradeWorkerResult<T> = { ok: true; value: T } | { ok: false; error: TradeError };

/** Commands used by the Takeover, with session dispatch owned by the journal. */
export type TradeWorkerClient = {
	startSession(
		sessionId: string,
		game: import('./contract').LinkTradeGame,
		bytes: Uint8Array
	): Promise<TradeWorkerResult<import('./contract').TradeSessionStatus>>;
	cancelSession(sessionId: string): Promise<TradeWorkerResult<unknown>>;
	capabilities(): Promise<TradeWorkerResult<TradeWorkerCapabilities>>;
	importKeys(prodKeys: string): Promise<TradeWorkerResult<unknown>>;
	forgetKeys(): Promise<TradeWorkerResult<unknown>>;
	connectRadio(port: RadioPort): Promise<TradeWorkerResult<Board>>;
	installFirmware(
		port: RadioPort,
		onProgress: (progress: FirmwareInstallProgress) => void
	): Promise<FirmwareInstallResult>;
	onStopped?(listener: () => void): () => void;
	onEvent(listener: (event: TradeWorkerEvent) => void): () => void;
	terminate(): void;
};

type Command = TradeWorkerCommand extends infer C
	? C extends TradeWorkerCommand
		? Omit<C, 'requestId'>
		: never
	: never;

export function createTradeWorkerClient(
	worker: Worker = new Worker(new URL('./trade-worker/trade.worker.ts', import.meta.url), {
		type: 'module'
	})
): TradeWorkerClient {
	const stopped = new Set<() => void>();
	const pending = new Map<string, (result: TradeWorkerResult<unknown>) => void>();

	worker.addEventListener('message', ({ data }) => {
		const message = tradeWorkerMessageSchema.safeParse(data);
		if (!message.success || message.data.type !== 'response') return;
		const { requestId } = message.data;
		pending.get(requestId)?.(
			message.data.ok
				? { ok: true, value: message.data.result }
				: { ok: false, error: message.data.error }
		);
		pending.delete(requestId);
	});
	worker.addEventListener('error', () => {
		for (const listener of stopped) listener();
		for (const resolve of pending.values())
			resolve({
				ok: false,
				error: { code: 'internal-error', message: 'the trade worker stopped' }
			});
		pending.clear();
	});

	function request(command: Command): Promise<TradeWorkerResult<unknown>> {
		const requestId = crypto.randomUUID();
		return new Promise((resolve) => {
			pending.set(requestId, resolve);
			worker.postMessage({ ...command, requestId });
		});
	}

	return {
		startSession: async (sessionId, game, bytes) => {
			const result = await request({
				type: 'start-session',
				sessionId,
				game,
				outgoingPokemon: new Uint8Array(bytes).buffer
			});
			return result.ok ? { ok: true, value: sessionStatusSchema.parse(result.value) } : result;
		},
		cancelSession: (sessionId) => request({ type: 'cancel-session', sessionId }),
		capabilities: async () => {
			const result = await request({ type: 'get-capabilities' });
			return result.ok ? { ok: true, value: capabilitiesSchema.parse(result.value) } : result;
		},
		importKeys: (prodKeys) => request({ type: 'import-keys', prodKeys }),
		forgetKeys: () => request({ type: 'forget-keys' }),
		connectRadio: async (port) => {
			const result = await request({ type: 'connect-radio', port });
			return result.ok
				? { ok: true, value: boardSchema.parse((result.value as { board: unknown }).board) }
				: result;
		},
		installFirmware: (port, onProgress) => installFirmware(worker, port, onProgress),
		onStopped: (listener) => {
			stopped.add(listener);
			return () => {
				stopped.delete(listener);
			};
		},
		onEvent: (listener) => {
			const listen = ({ data }: MessageEvent) => {
				const message = tradeWorkerMessageSchema.safeParse(data);
				if (message.success && message.data.type === 'event') listener(message.data.event);
			};
			worker.addEventListener('message', listen);
			return () => worker.removeEventListener('message', listen);
		},
		terminate: () => worker.terminate()
	};
}

/** Shows the browser's port prompt. Returns null when the user closes it without a choice. */
export async function requestRadioPort(): Promise<RadioPort | null> {
	const { serial } = navigator as unknown as {
		serial: {
			requestPort(): Promise<{ getInfo(): { usbVendorId?: number; usbProductId?: number } }>;
		};
	};
	try {
		return { kind: 'web-serial', ...(await serial.requestPort()).getInfo() };
	} catch (error) {
		if (error instanceof DOMException && error.name === 'NotFoundError') return null;
		throw error;
	}
}
