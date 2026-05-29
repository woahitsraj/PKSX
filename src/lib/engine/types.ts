export type EngineErrorCode =
	| 'unsupported-save'
	| 'invalid-box'
	| 'engine-unavailable'
	| 'invalid-engine-response'
	| 'invalid-worker-message'
	| 'unknown-engine-error';

export type EngineError = {
	code: EngineErrorCode;
	message: string;
};

export type EngineResult<T> =
	| { ok: true; value: T; error: null }
	| { ok: false; value: null; error: EngineError };

export type EngineVersion = {
	pkhexCoreVersion: string;
	facadeVersion: string;
};

export type SaveSummary = {
	fileName?: string;
	saveType: string;
	/** PKHeX.Core GameVersion enum name. */
	gameVersion: string;
	/** PKHeX.Core GameVersion enum value. */
	gameVersionId: number;
	generation: number;
	trainerName?: string;
	partyCount: number;
	boxCount: number;
	boxSlotCount: number;
};

export type BoxSlotSummary = {
	box: number;
	slot: number;
	speciesId: number;
	form: number;
	format: number;
	level: number;
	nickname: string;
	isEgg: boolean;
	isEmpty: boolean;
	gender?: string | null;
	nature?: string | null;
	ability?: string | null;
	heldItem?: string | null;
	types: SlotTypeSummary[];
	stats: SlotStatSummary[];
	moves: SlotMoveSummary[];
	originalTrainer?: string | null;
	metLabel?: string | null;
};

export type PartySlotSummary = Omit<BoxSlotSummary, 'box'>;

export type SlotTypeSummary = {
	name: string;
	hue: number;
	chroma: number;
};

export type SlotStatSummary = {
	key: string;
	label: string;
	value: number;
	ev?: number | null;
	max: number;
};

export type SlotMoveSummary = {
	name: string;
	type: string;
	hue: number;
	chroma: number;
	pp?: number | null;
};

export type SaveWorkspace = {
	summary: SaveSummary;
	partySlots: PartySlotSummary[];
	boxSlots: BoxSlotSummary[];
};

export type SerializedSave = {
	bytesBase64: string;
	byteLength: number;
};

export type EngineApi = {
	getVersion(): Promise<EngineResult<EngineVersion>>;
	summarizeSave(bytes: Uint8Array, fileName?: string): Promise<EngineResult<SaveSummary>>;
	listBoxSlots(
		bytes: Uint8Array,
		fileName: string | undefined,
		box: number
	): Promise<EngineResult<BoxSlotSummary[]>>;
	loadSaveWorkspace(
		bytes: Uint8Array,
		fileName: string | undefined,
		box: number
	): Promise<EngineResult<SaveWorkspace>>;
	serializeSave(bytes: Uint8Array, fileName?: string): Promise<EngineResult<SerializedSave>>;
};
