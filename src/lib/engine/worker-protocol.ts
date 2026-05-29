import { z } from 'zod/v4';

export const engineWorkerRequestIdSchema = z.string().min(1);

export const engineWorkerMethodSchema = z.enum([
	'getVersion',
	'summarizeSave',
	'listBoxSlots',
	'loadSaveWorkspace',
	'serializeSave'
]);

export const engineWorkerStatusSchema = z.enum(['idle', 'loading', 'ready', 'failed']);

export const engineErrorCodeSchema = z.enum([
	'unsupported-save',
	'invalid-box',
	'engine-unavailable',
	'invalid-engine-response',
	'invalid-worker-message',
	'unknown-engine-error'
]);

export const engineErrorSchema = z.object({
	code: z
		.string()
		.min(1)
		.transform((code) => {
			const parsed = engineErrorCodeSchema.safeParse(code);

			return parsed.success ? parsed.data : 'unknown-engine-error';
		}),
	message: z.string().min(1)
});

export const engineVersionSchema = z.object({
	pkhexCoreVersion: z.string(),
	facadeVersion: z.string()
});

export const saveSummarySchema = z.object({
	fileName: z.string().optional(),
	saveType: z.string(),
	gameVersion: z.string(),
	gameVersionId: z.number(),
	generation: z.number(),
	trainerName: z.string().optional(),
	trainerId: z.number(),
	playTime: z.string(),
	playedHours: z.number(),
	playedMinutes: z.number(),
	partyCount: z.number(),
	boxCount: z.number(),
	boxSlotCount: z.number()
});

export const slotTypeSummarySchema = z.object({
	name: z.string(),
	hue: z.number(),
	chroma: z.number().default(0.09)
});

export const slotStatSummarySchema = z.object({
	key: z.string(),
	label: z.string(),
	value: z.number(),
	ev: z.number().nullable().optional(),
	max: z.number()
});

export const slotMoveSummarySchema = z.object({
	name: z.string(),
	type: z.string(),
	hue: z.number(),
	chroma: z.number().default(0.09),
	pp: z.number().nullable().optional()
});

export const boxSlotSummarySchema = z.object({
	box: z.number(),
	slot: z.number(),
	speciesId: z.number(),
	form: z.number(),
	format: z.number(),
	level: z.number(),
	nickname: z.string(),
	isEgg: z.boolean(),
	isEmpty: z.boolean(),
	gender: z.string().nullable().optional(),
	nature: z.string().nullable().optional(),
	ability: z.string().nullable().optional(),
	heldItem: z.string().nullable().optional(),
	types: z.array(slotTypeSummarySchema).default([]),
	stats: z.array(slotStatSummarySchema).default([]),
	moves: z.array(slotMoveSummarySchema).default([]),
	originalTrainer: z.string().nullable().optional(),
	metLabel: z.string().nullable().optional()
});

export const partySlotSummarySchema = boxSlotSummarySchema.omit({ box: true });

export const saveWorkspaceSchema = z.object({
	summary: saveSummarySchema,
	partySlots: z.array(partySlotSummarySchema),
	boxSlots: z.array(boxSlotSummarySchema)
});

export const serializedSaveSchema = z.object({
	bytesBase64: z.string(),
	byteLength: z.number()
});

const engineResultSchema = <T extends z.ZodType>(valueSchema: T) =>
	z.discriminatedUnion('ok', [
		z.object({
			ok: z.literal(true),
			value: valueSchema,
			error: z.null()
		}),
		z.object({
			ok: z.literal(false),
			value: z.null(),
			error: engineErrorSchema
		})
	]);

export const engineVersionResultSchema = engineResultSchema(engineVersionSchema);

export const saveSummaryResultSchema = engineResultSchema(saveSummarySchema);

export const boxSlotSummaryListResultSchema = engineResultSchema(z.array(boxSlotSummarySchema));

export const saveWorkspaceResultSchema = engineResultSchema(saveWorkspaceSchema);

export const serializedSaveResultSchema = engineResultSchema(serializedSaveSchema);

export const engineWorkerInitMessageSchema = z.object({
	type: z.literal('init'),
	basePath: z.string().min(1)
});

export const engineWorkerGetVersionRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('getVersion')
});

export const engineWorkerSummarizeSaveRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('summarizeSave'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional()
	})
});

export const engineWorkerListBoxSlotsRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('listBoxSlots'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional(),
		box: z.number().int()
	})
});

export const engineWorkerLoadSaveWorkspaceRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('loadSaveWorkspace'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional(),
		box: z.number().int()
	})
});

export const engineWorkerSerializeSaveRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('serializeSave'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional()
	})
});

export const engineWorkerRequestSchema = z.discriminatedUnion('method', [
	engineWorkerGetVersionRequestSchema,
	engineWorkerSummarizeSaveRequestSchema,
	engineWorkerListBoxSlotsRequestSchema,
	engineWorkerLoadSaveWorkspaceRequestSchema,
	engineWorkerSerializeSaveRequestSchema
]);

export const engineWorkerGetVersionResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('getVersion'),
	result: engineVersionResultSchema
});

export const engineWorkerSummarizeSaveResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('summarizeSave'),
	result: saveSummaryResultSchema
});

export const engineWorkerListBoxSlotsResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('listBoxSlots'),
	result: boxSlotSummaryListResultSchema
});

export const engineWorkerLoadSaveWorkspaceResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('loadSaveWorkspace'),
	result: saveWorkspaceResultSchema
});

export const engineWorkerSerializeSaveResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('serializeSave'),
	result: serializedSaveResultSchema
});

export const engineWorkerResponseSchema = z.discriminatedUnion('method', [
	engineWorkerGetVersionResponseSchema,
	engineWorkerSummarizeSaveResponseSchema,
	engineWorkerListBoxSlotsResponseSchema,
	engineWorkerLoadSaveWorkspaceResponseSchema,
	engineWorkerSerializeSaveResponseSchema
]);

export const engineWorkerProtocolErrorSchema = z.object({
	type: z.literal('protocol-error'),
	id: engineWorkerRequestIdSchema.optional(),
	error: engineErrorSchema
});

export const engineWorkerStatusMessageSchema = z.discriminatedUnion('status', [
	z.object({
		type: z.literal('status'),
		status: z.enum(['idle', 'loading', 'ready'])
	}),
	z.object({
		type: z.literal('status'),
		status: z.literal('failed'),
		error: engineErrorSchema
	})
]);

export const engineWorkerMessageSchema = z.union([
	engineWorkerInitMessageSchema,
	engineWorkerRequestSchema,
	engineWorkerResponseSchema,
	engineWorkerProtocolErrorSchema,
	engineWorkerStatusMessageSchema
]);

export type EngineWorkerRequestId = z.infer<typeof engineWorkerRequestIdSchema>;

export type EngineWorkerMethod = z.infer<typeof engineWorkerMethodSchema>;

export type EngineWorkerStatus = z.infer<typeof engineWorkerStatusSchema>;

export type EngineWorkerInitMessage = z.infer<typeof engineWorkerInitMessageSchema>;

export type EngineWorkerGetVersionRequest = z.infer<typeof engineWorkerGetVersionRequestSchema>;

export type EngineWorkerSummarizeSaveRequest = z.infer<
	typeof engineWorkerSummarizeSaveRequestSchema
>;

export type EngineWorkerListBoxSlotsRequest = z.infer<typeof engineWorkerListBoxSlotsRequestSchema>;

export type EngineWorkerLoadSaveWorkspaceRequest = z.infer<
	typeof engineWorkerLoadSaveWorkspaceRequestSchema
>;

export type EngineWorkerSerializeSaveRequest = z.infer<
	typeof engineWorkerSerializeSaveRequestSchema
>;

export type EngineWorkerRequest = z.infer<typeof engineWorkerRequestSchema>;

export type EngineWorkerResponse = z.infer<typeof engineWorkerResponseSchema>;

export type EngineWorkerProtocolError = z.infer<typeof engineWorkerProtocolErrorSchema>;

export type EngineWorkerStatusMessage = z.infer<typeof engineWorkerStatusMessageSchema>;

export type EngineWorkerMessage = z.infer<typeof engineWorkerMessageSchema>;

export type EngineWorkerResultForMethod<TMethod extends EngineWorkerMethod> = Extract<
	EngineWorkerResponse,
	{ method: TMethod }
>['result'];

export type ProtocolParseResult<T> =
	| { ok: true; value: T }
	| { ok: false; id?: EngineWorkerRequestId; error: z.infer<typeof engineErrorSchema> };

type WorkerParseSchema<T> = z.ZodType<T>;

export function parseEngineWorkerInitMessage(
	value: unknown
): ProtocolParseResult<EngineWorkerInitMessage> {
	return parseEngineWorkerValue(engineWorkerInitMessageSchema, value, 'init message');
}

export function parseEngineWorkerRequest(value: unknown): ProtocolParseResult<EngineWorkerRequest> {
	return parseEngineWorkerValue(engineWorkerRequestSchema, value, 'request');
}

export function parseEngineWorkerResponse(
	value: unknown
): ProtocolParseResult<EngineWorkerResponse> {
	return parseEngineWorkerValue(engineWorkerResponseSchema, value, 'response');
}

export function parseEngineWorkerMessage(value: unknown): ProtocolParseResult<EngineWorkerMessage> {
	return parseEngineWorkerValue(engineWorkerMessageSchema, value, 'message');
}

export function parseEngineWorkerProtocolError(
	value: unknown
): ProtocolParseResult<EngineWorkerProtocolError> {
	return parseEngineWorkerValue(engineWorkerProtocolErrorSchema, value, 'protocol error');
}

export function parseEngineWorkerStatusMessage(
	value: unknown
): ProtocolParseResult<EngineWorkerStatusMessage> {
	return parseEngineWorkerValue(engineWorkerStatusMessageSchema, value, 'status message');
}

export function createEngineWorkerResponse<TRequest extends EngineWorkerRequest>(
	request: TRequest,
	result: EngineWorkerResultForMethod<TRequest['method']>
): EngineWorkerResponse {
	return engineWorkerResponseSchema.parse({
		type: 'response',
		id: request.id,
		method: request.method,
		result
	});
}

export function createEngineWorkerProtocolError(
	error: z.infer<typeof engineErrorSchema>,
	id?: EngineWorkerRequestId
): EngineWorkerProtocolError {
	return engineWorkerProtocolErrorSchema.parse(
		id === undefined ? { type: 'protocol-error', error } : { type: 'protocol-error', id, error }
	);
}

function parseEngineWorkerValue<T>(
	schema: WorkerParseSchema<T>,
	value: unknown,
	messageName: string
): ProtocolParseResult<T> {
	const parsed = schema.safeParse(value);

	if (parsed.success) {
		return { ok: true, value: parsed.data };
	}

	return invalidWorkerMessage(formatZodError(messageName, parsed.error), getMessageId(value));
}

function invalidWorkerMessage(
	message: string,
	id?: EngineWorkerRequestId
): ProtocolParseResult<never> {
	return {
		ok: false,
		...(id === undefined ? {} : { id }),
		error: { code: 'invalid-worker-message', message }
	};
}

function getMessageId(value: unknown): EngineWorkerRequestId | undefined {
	const parsed = z.object({ id: engineWorkerRequestIdSchema }).safeParse(value);

	return parsed.success ? parsed.data.id : undefined;
}

function formatZodError(messageName: string, error: z.ZodError): string {
	const issue = error.issues[0];

	if (issue === undefined) {
		return `Invalid PKHeX Engine worker ${messageName}.`;
	}

	const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';

	return `Invalid PKHeX Engine worker ${messageName}${path}: ${issue.message}`;
}
