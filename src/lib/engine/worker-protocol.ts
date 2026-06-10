import { z } from 'zod/v4';

export const engineWorkerRequestIdSchema = z.string().min(1);

export const engineWorkerMethodSchema = z.enum([
	'getVersion',
	'summarizeSave',
	'listBoxSlots',
	'loadSaveWorkspace',
	'serializeSave',
	'applySlotOperation',
	'applyPokemonEditOperation',
	'checkSlotLegality'
]);

export const engineWorkerStatusSchema = z.enum(['idle', 'loading', 'ready', 'failed']);

export const engineErrorCodeSchema = z.enum([
	'unsupported-save',
	'invalid-box',
	'invalid-slot',
	'empty-source-slot',
	'occupied-destination-slot',
	'unsupported-slot-operation',
	'invalid-pokemon-edit',
	'unsupported-pokemon-edit',
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
	trainerId: z.number().default(0),
	playTime: z.string().default(''),
	playedHours: z.number().default(0),
	playedMinutes: z.number().default(0),
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
	iv: z.number().nullable().optional(),
	max: z.number()
});

export const slotMoveSummarySchema = z.object({
	slot: z.number().int().default(0),
	id: z.number().default(0),
	name: z.string(),
	type: z.string(),
	hue: z.number(),
	chroma: z.number().default(0.09),
	pp: z.number().nullable().optional(),
	maxPp: z.number().nullable().optional(),
	ppUps: z.number().nullable().optional()
});

export const pokemonStatEditConstraintsSchema = z.object({
	supported: z.boolean().default(false),
	minIv: z.number().default(0),
	maxIv: z.number().default(31),
	minEv: z.number().default(0),
	maxEv: z.number().default(255),
	maxTotalEv: z.number().default(510),
	unsupportedReason: z.string().nullable().optional()
});

export const pokemonMoveOptionSchema = z.object({
	id: z.number(),
	name: z.string(),
	type: z.string(),
	hue: z.number(),
	chroma: z.number().default(0.09),
	maxPp: z.number()
});

export const pokemonMoveSetEditConstraintsSchema = z.object({
	supported: z.boolean().default(false),
	maxMoveSlots: z.number().default(4),
	availableMoves: z.array(pokemonMoveOptionSchema).default([]),
	unsupportedReason: z.string().nullable().optional()
});

export const displaySexSchema = z.enum(['default', 'male', 'female']);

export const spriteIdentitySchema = z.object({
	speciesId: z.number(),
	form: z.number(),
	isEgg: z.boolean(),
	isShiny: z.boolean(),
	displaySex: displaySexSchema
});

const slotSummaryFields = {
	slot: z.number(),
	speciesId: z.number(),
	form: z.number(),
	format: z.number(),
	level: z.number(),
	experience: z.number().default(0),
	experienceProjection: z
		.object({
			minLevel: z.number(),
			maxLevel: z.number(),
			minExperience: z.number(),
			maxExperience: z.number(),
			currentLevelMinExperience: z.number(),
			nextLevelMinExperience: z.number(),
			currentLevelProgress: z.number()
		})
		.nullable()
		.default(null),
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
	statEditConstraints: pokemonStatEditConstraintsSchema.default({
		supported: false,
		minIv: 0,
		maxIv: 31,
		minEv: 0,
		maxEv: 255,
		maxTotalEv: 510,
		unsupportedReason: 'IV and EV Editing is not available for this Pokemon projection.'
	}),
	moveSetEditConstraints: pokemonMoveSetEditConstraintsSchema.default({
		supported: false,
		maxMoveSlots: 4,
		availableMoves: [],
		unsupportedReason: 'Move Set Editing is not available for this Pokemon projection.'
	}),
	originalTrainer: z.string().nullable().optional(),
	metLabel: z.string().nullable().optional(),
	spriteIdentity: spriteIdentitySchema.optional()
};

const slotSummaryBaseSchema = z.object(slotSummaryFields);

function fillSpriteIdentity<T extends z.infer<typeof slotSummaryBaseSchema>>(slot: T) {
	return {
		...slot,
		spriteIdentity: slot.spriteIdentity ?? {
			speciesId: slot.speciesId,
			form: slot.form,
			isEgg: slot.isEgg,
			isShiny: false,
			displaySex: 'default' as const
		}
	};
}

export const boxSlotSummarySchema = z
	.object({
		box: z.number(),
		...slotSummaryFields
	})
	.transform(fillSpriteIdentity);

export const partySlotSummarySchema = slotSummaryBaseSchema.transform(fillSpriteIdentity);

export const saveWorkspaceSchema = z.object({
	summary: saveSummarySchema,
	partySlots: z.array(partySlotSummarySchema),
	boxSlots: z.array(boxSlotSummarySchema)
});

export const serializedSaveSchema = z.object({
	bytesBase64: z.string(),
	byteLength: z.number()
});

export const saveSlotRefSchema = z.discriminatedUnion('zone', [
	z.object({
		zone: z.literal('party'),
		slot: z.number().int()
	}),
	z.object({
		zone: z.literal('box'),
		box: z.number().int(),
		slot: z.number().int()
	})
]);

export const slotOperationSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('move'),
		source: saveSlotRefSchema,
		destination: saveSlotRefSchema
	}),
	z.object({
		kind: z.literal('copy'),
		source: saveSlotRefSchema,
		destination: saveSlotRefSchema
	}),
	z.object({
		kind: z.literal('clear'),
		source: saveSlotRefSchema
	})
]);

export const slotOperationResultSchema = z.object({
	bytes: z.instanceof(ArrayBuffer),
	mutated: z.boolean(),
	workspace: saveWorkspaceSchema
});

export const pokemonEditOperationSchema = z.object({
	source: saveSlotRefSchema,
	nickname: z.string().optional(),
	level: z.number().int().optional(),
	experience: z.number().int().optional(),
	ivs: z
		.object({
			HP: z.number().int(),
			ATK: z.number().int(),
			DEF: z.number().int(),
			SPA: z.number().int(),
			SPD: z.number().int(),
			SPE: z.number().int()
		})
		.optional(),
	evs: z
		.object({
			HP: z.number().int(),
			ATK: z.number().int(),
			DEF: z.number().int(),
			SPA: z.number().int(),
			SPD: z.number().int(),
			SPE: z.number().int()
		})
		.optional(),
	moves: z
		.array(
			z.object({
				slot: z.number().int(),
				move: z.number().int(),
				pp: z.number().int().optional(),
				ppUps: z.number().int().optional()
			})
		)
		.optional()
});

export const pokemonEditOperationResultSchema = z.object({
	bytes: z.instanceof(ArrayBuffer),
	mutated: z.boolean(),
	workspace: saveWorkspaceSchema
});

export const legalityReportLineSchema = z.object({
	severity: z.string(),
	identifier: z.string(),
	message: z.string()
});

export const legalityReportSchema = z.object({
	legal: z.boolean(),
	judgement: z.string(),
	summary: z.string(),
	warnings: z.array(legalityReportLineSchema),
	messages: z.array(legalityReportLineSchema)
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

export const slotOperationResultResultSchema = engineResultSchema(slotOperationResultSchema);

export const pokemonEditOperationResultResultSchema = engineResultSchema(
	pokemonEditOperationResultSchema
);

export const legalityReportResultSchema = engineResultSchema(legalityReportSchema);

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

export const engineWorkerApplySlotOperationRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('applySlotOperation'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional(),
		operation: slotOperationSchema,
		activeBox: z.number().int()
	})
});

export const engineWorkerApplyPokemonEditOperationRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('applyPokemonEditOperation'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional(),
		operation: pokemonEditOperationSchema,
		activeBox: z.number().int()
	})
});

export const engineWorkerCheckSlotLegalityRequestSchema = z.object({
	type: z.literal('request'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('checkSlotLegality'),
	payload: z.object({
		bytes: z.instanceof(ArrayBuffer),
		fileName: z.string().optional(),
		source: saveSlotRefSchema
	})
});

export const engineWorkerRequestSchema = z.discriminatedUnion('method', [
	engineWorkerGetVersionRequestSchema,
	engineWorkerSummarizeSaveRequestSchema,
	engineWorkerListBoxSlotsRequestSchema,
	engineWorkerLoadSaveWorkspaceRequestSchema,
	engineWorkerSerializeSaveRequestSchema,
	engineWorkerApplySlotOperationRequestSchema,
	engineWorkerApplyPokemonEditOperationRequestSchema,
	engineWorkerCheckSlotLegalityRequestSchema
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

export const engineWorkerApplySlotOperationResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('applySlotOperation'),
	result: slotOperationResultResultSchema
});

export const engineWorkerApplyPokemonEditOperationResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('applyPokemonEditOperation'),
	result: pokemonEditOperationResultResultSchema
});

export const engineWorkerCheckSlotLegalityResponseSchema = z.object({
	type: z.literal('response'),
	id: engineWorkerRequestIdSchema,
	method: z.literal('checkSlotLegality'),
	result: legalityReportResultSchema
});

export const engineWorkerResponseSchema = z.discriminatedUnion('method', [
	engineWorkerGetVersionResponseSchema,
	engineWorkerSummarizeSaveResponseSchema,
	engineWorkerListBoxSlotsResponseSchema,
	engineWorkerLoadSaveWorkspaceResponseSchema,
	engineWorkerSerializeSaveResponseSchema,
	engineWorkerApplySlotOperationResponseSchema,
	engineWorkerApplyPokemonEditOperationResponseSchema,
	engineWorkerCheckSlotLegalityResponseSchema
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

export type EngineWorkerApplySlotOperationRequest = z.infer<
	typeof engineWorkerApplySlotOperationRequestSchema
>;

export type EngineWorkerApplyPokemonEditOperationRequest = z.infer<
	typeof engineWorkerApplyPokemonEditOperationRequestSchema
>;

export type EngineWorkerCheckSlotLegalityRequest = z.infer<
	typeof engineWorkerCheckSlotLegalityRequestSchema
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
