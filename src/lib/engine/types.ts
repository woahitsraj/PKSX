export type EngineErrorCode =
	| 'unsupported-save'
	| 'invalid-box'
	| 'engine-unavailable'
	| 'invalid-engine-response'
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
};

export type EngineApi = {
	getVersion(): Promise<EngineResult<EngineVersion>>;
	summarizeSave(bytes: Uint8Array, fileName?: string): Promise<EngineResult<SaveSummary>>;
	listBoxSlots(
		bytes: Uint8Array,
		fileName: string | undefined,
		box: number
	): Promise<EngineResult<BoxSlotSummary[]>>;
};
