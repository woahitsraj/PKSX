import { z } from 'zod/v4';

/** Bump on any incompatible change to the commands, responses or events below. */
export const TRADE_WORKER_CONTRACT_VERSION = 1;

/** The same names as the Engine's `LinkTradeDestinationGame`. */
export const linkTradeGameSchema = z.enum(['sword', 'shield']);
export type LinkTradeGame = z.infer<typeof linkTradeGameSchema>;

/** Stable, caller-chosen; every event of a session carries it. */
export const tradeSessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const requestIdSchema = z.string().min(1);
const bytesSchema = z.custom<ArrayBuffer>((value) => value instanceof ArrayBuffer);

export const tradeErrorCodeSchema = z.enum([
	'invalid-message',
	'unsupported-game',
	'keys-missing',
	'keys-incomplete',
	'web-serial-unavailable',
	'port-not-found',
	'port-busy',
	'fake-port-unavailable',
	'unsupported-board',
	'protocol-mismatch',
	'firmware-mismatch',
	'radio-not-connected',
	'radio-lost',
	'session-active',
	'session-not-found',
	'invalid-outgoing-pokemon',
	'console-not-ready',
	'session-full',
	'join-failed',
	'connection-lost',
	'timed-out',
	'confirmation-not-supported',
	'internal-error'
]);
export type TradeErrorCode = z.infer<typeof tradeErrorCodeSchema>;

export const tradeErrorSchema = z.object({ code: tradeErrorCodeSchema, message: z.string() });
export type TradeError = z.infer<typeof tradeErrorSchema>;

export const radioPortSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('web-serial'),
		usbVendorId: z.number().int().optional(),
		usbProductId: z.number().int().optional()
	}),
	/** Dev builds and tests only: a scripted console behind a simulated board. */
	z.object({
		kind: z.literal('fake'),
		script: z.enum(['trade', 'cancel', 'not-ready', 'drop-after-ladder'])
	})
]);
export type RadioPort = z.infer<typeof radioPortSchema>;

export const tradeWorkerCommandSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('get-capabilities'), requestId: requestIdSchema }),
	/** The text of a `prod.keys` file; only the four values LDN needs are kept. */
	z.object({ type: z.literal('import-keys'), requestId: requestIdSchema, prodKeys: z.string() }),
	z.object({ type: z.literal('forget-keys'), requestId: requestIdSchema }),
	z.object({ type: z.literal('connect-radio'), requestId: requestIdSchema, port: radioPortSchema }),
	z.object({ type: z.literal('disconnect-radio'), requestId: requestIdSchema }),
	z.object({
		type: z.literal('start-session'),
		requestId: requestIdSchema,
		sessionId: tradeSessionIdSchema,
		game: linkTradeGameSchema,
		/** The encrypted 0x158-byte party PK8 (the wire form) prepared and reviewed in #366; sent unchanged. */
		outgoingPokemon: bytesSchema
	}),
	z.object({
		type: z.literal('confirm-offer'),
		requestId: requestIdSchema,
		sessionId: tradeSessionIdSchema
	}),
	z.object({
		type: z.literal('cancel-session'),
		requestId: requestIdSchema,
		sessionId: tradeSessionIdSchema
	}),
	z.object({ type: z.literal('get-status'), requestId: requestIdSchema }),
	z.object({
		type: z.literal('recover-session'),
		requestId: requestIdSchema,
		sessionId: tradeSessionIdSchema
	})
]);
export type TradeWorkerCommand = z.infer<typeof tradeWorkerCommandSchema>;

export const boardSchema = z.object({
	protocolVersion: z.number().int(),
	firmwareVersion: z.string(),
	target: z.string(),
	chipRevision: z.number().int(),
	baudRate: z.number().int(),
	/** True only for the scripted fake port; never a supported board. */
	simulated: z.boolean()
});
export type Board = z.infer<typeof boardSchema>;

export const capabilitiesSchema = z.object({
	contractVersion: z.literal(TRADE_WORKER_CONTRACT_VERSION),
	webSerial: z.boolean(),
	/** Dev builds only. */
	fakePort: z.boolean(),
	keysPresent: z.boolean(),
	firmware: z.object({
		protocolVersion: z.number().int(),
		version: z.string(),
		targets: z.array(z.string())
	}),
	games: z.array(
		z.object({
			game: linkTradeGameSchema,
			role: z.literal('joiner'),
			/** True once a real exchange with this game has completed through the worker. */
			hardwareVerified: z.boolean(),
			/** False: the player confirms on the Switch and PKSX follows; there is no PKSX pause. */
			hostConfirmation: z.boolean(),
			outgoingByteLength: z.number().int()
		})
	)
});
export type TradeWorkerCapabilities = z.infer<typeof capabilitiesSchema>;

export const sessionPhaseSchema = z.enum([
	'scanning',
	'joining',
	'waiting-for-console',
	'in-trade-room',
	'offer-received',
	'confirming',
	'finishing'
]);
export type TradeSessionPhase = z.infer<typeof sessionPhaseSchema>;

export const tradeOutcomeSchema = z.enum(['completed', 'cancelled', 'failed', 'outcome-unknown']);
export type TradeOutcome = z.infer<typeof tradeOutcomeSchema>;

/** Box sync commands 1, 4, 5 and 3 as #365 observed them. */
export const consoleActionSchema = z.enum(['offer-shown', 'confirmed', 'withdrew', 'left']);
export type ConsoleAction = z.infer<typeof consoleActionSchema>;

/** Evidence that a Link Trade completed: never inferred from a received Trade Offer alone. */
export const tradeReceiptSchema = z.object({
	sessionId: tradeSessionIdSchema,
	game: linkTradeGameSchema,
	receivedPokemon: bytesSchema,
	sentDigest: z.string(),
	receivedDigest: z.string(),
	completion: z.object({
		consoleConfirmed: z.literal(true),
		ladderPhase: z.literal(4),
		endedBy: z.enum(['console-left', 'console-offered-again'])
	})
});
export type TradeReceipt = z.infer<typeof tradeReceiptSchema>;

/** How a session stopped, before PKSX decides what that means for the trade. */
export const sessionEndSchema = z.enum([
	'console-left',
	'console-offered-again',
	'cancelled',
	'connection-lost',
	'radio-lost',
	'ladder-stalled',
	'timed-out',
	'console-not-ready'
]);
export type SessionEnd = z.infer<typeof sessionEndSchema>;

/** What an interrupted session keeps for recovery; the received offer is evidence, not a receipt. */
export const unknownOutcomeSchema = z.object({
	sessionId: tradeSessionIdSchema,
	game: linkTradeGameSchema,
	sentDigest: z.string(),
	offeredPokemon: bytesSchema.nullable(),
	consoleConfirmed: z.boolean(),
	ladderPhase: z.number().int().nullable(),
	reason: sessionEndSchema
});
export type UnknownOutcome = z.infer<typeof unknownOutcomeSchema>;

const sessionEventBase = {
	sessionId: tradeSessionIdSchema,
	sequence: z.number().int().nonnegative()
};

export const tradeWorkerEventSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('radio-connected'), board: boardSchema }),
	z.object({ type: z.literal('radio-disconnected'), error: tradeErrorSchema.nullable() }),
	z.object({ type: z.literal('session-phase'), ...sessionEventBase, phase: sessionPhaseSchema }),
	/** The partner's Trade Offer. Not a Trade Receipt. */
	z.object({ type: z.literal('trade-offer'), ...sessionEventBase, pokemon: bytesSchema }),
	z.object({ type: z.literal('console-action'), ...sessionEventBase, action: consoleActionSchema }),
	/** The confirmation ladder's phase, 0 to 4. */
	z.object({
		type: z.literal('confirmation-progress'),
		...sessionEventBase,
		phase: z.number().int().min(0).max(4)
	}),
	z.object({
		type: z.literal('session-ended'),
		...sessionEventBase,
		outcome: tradeOutcomeSchema,
		receipt: tradeReceiptSchema.nullable(),
		unknown: unknownOutcomeSchema.nullable(),
		error: tradeErrorSchema.nullable()
	})
]);
export type TradeWorkerEvent = z.infer<typeof tradeWorkerEventSchema>;

export const sessionStatusSchema = z.object({
	sessionId: tradeSessionIdSchema,
	game: linkTradeGameSchema,
	phase: sessionPhaseSchema.nullable(),
	outcome: tradeOutcomeSchema.nullable(),
	lastSequence: z.number().int()
});
export type TradeSessionStatus = z.infer<typeof sessionStatusSchema>;

export const tradeWorkerStatusSchema = z.object({
	contractVersion: z.literal(TRADE_WORKER_CONTRACT_VERSION),
	keysPresent: z.boolean(),
	board: boardSchema.nullable(),
	session: sessionStatusSchema.nullable()
});
export type TradeWorkerStatus = z.infer<typeof tradeWorkerStatusSchema>;

export const recoveredSessionSchema = z.object({
	status: sessionStatusSchema,
	receipt: tradeReceiptSchema.nullable(),
	unknown: unknownOutcomeSchema.nullable()
});
export type RecoveredSession = z.infer<typeof recoveredSessionSchema>;

const responseBase = {
	type: z.literal('response'),
	contractVersion: z.literal(TRADE_WORKER_CONTRACT_VERSION),
	requestId: requestIdSchema
};

export const tradeWorkerMessageSchema = z.union([
	z.object({ ...responseBase, ok: z.literal(true), result: z.unknown() }),
	z.object({ ...responseBase, ok: z.literal(false), error: tradeErrorSchema }),
	z.object({
		type: z.literal('event'),
		contractVersion: z.literal(TRADE_WORKER_CONTRACT_VERSION),
		event: tradeWorkerEventSchema
	})
]);
export type TradeWorkerMessage = z.infer<typeof tradeWorkerMessageSchema>;
