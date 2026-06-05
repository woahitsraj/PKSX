export type EngineErrorCode =
	| 'unsupported-save'
	| 'invalid-box'
	| 'invalid-slot'
	| 'empty-source-slot'
	| 'occupied-destination-slot'
	| 'unsupported-slot-operation'
	| 'invalid-pokemon-edit'
	| 'unsupported-pokemon-edit'
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
	trainerId: number;
	playTime: string;
	playedHours: number;
	playedMinutes: number;
	partyCount: number;
	boxCount: number;
	boxSlotCount: number;
};

export type SpriteIdentity = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: 'default' | 'male' | 'female';
};

export type BoxSlotSummary = {
	box: number;
	slot: number;
	speciesId: number;
	form: number;
	format: number;
	level: number;
	experience: number;
	experienceProjection: PokemonExperienceProjection | null;
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
	spriteIdentity: SpriteIdentity;
};

export type PartySlotSummary = Omit<BoxSlotSummary, 'box'>;

export type SlotTypeSummary = {
	name: string;
	hue: number;
	chroma: number;
};

export type PokemonExperienceProjection = {
	minLevel: number;
	maxLevel: number;
	minExperience: number;
	maxExperience: number;
	currentLevelMinExperience: number;
	nextLevelMinExperience: number;
	currentLevelProgress: number;
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

export type SaveSlotRef =
	| {
			zone: 'party';
			slot: number;
	  }
	| {
			zone: 'box';
			box: number;
			slot: number;
	  };

export type SlotOperation =
	| {
			kind: 'move';
			source: SaveSlotRef;
			destination: SaveSlotRef;
	  }
	| {
			kind: 'copy';
			source: SaveSlotRef;
			destination: SaveSlotRef;
	  }
	| {
			kind: 'clear';
			source: SaveSlotRef;
	  };

export type SlotOperationResult = {
	bytes: Uint8Array;
	mutated: boolean;
	workspace: SaveWorkspace;
};

export type PokemonEditOperation = {
	source: SaveSlotRef;
	level?: number;
	experience?: number;
};

export type PokemonEditOperationResult = {
	bytes: Uint8Array;
	mutated: boolean;
	workspace: SaveWorkspace;
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
	applySlotOperation(
		bytes: Uint8Array,
		fileName: string | undefined,
		operation: SlotOperation,
		activeBox: number
	): Promise<EngineResult<SlotOperationResult>>;
	applyPokemonEditOperation(
		bytes: Uint8Array,
		fileName: string | undefined,
		operation: PokemonEditOperation,
		activeBox: number
	): Promise<EngineResult<PokemonEditOperationResult>>;
};
