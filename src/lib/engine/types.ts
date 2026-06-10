export type EngineErrorCode =
	| 'unsupported-save'
	| 'invalid-box'
	| 'invalid-slot'
	| 'empty-source-slot'
	| 'occupied-destination-slot'
	| 'unsupported-slot-operation'
	| 'invalid-pokemon-edit'
	| 'unsupported-pokemon-edit'
	| 'invalid-pokemon-import'
	| 'invalid-stored-pokemon'
	| 'incompatible-stored-pokemon'
	| 'invalid-save-file-edit'
	| 'unsupported-save-file-edit'
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
	statEditConstraints: PokemonStatEditConstraints;
	moveSetEditConstraints: PokemonMoveSetEditConstraints;
	originalTrainer?: string | null;
	metLabel?: string | null;
	spriteIdentity: SpriteIdentity;
	entityBytesBase64?: string | null;
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
	iv?: number | null;
	max: number;
};

export type SlotMoveSummary = {
	slot: number;
	id: number;
	name: string;
	type: string;
	hue: number;
	chroma: number;
	pp?: number | null;
	maxPp?: number | null;
	ppUps?: number | null;
};

export type PokemonStatEditConstraints = {
	supported: boolean;
	minIv: number;
	maxIv: number;
	minEv: number;
	maxEv: number;
	maxTotalEv: number;
	unsupportedReason?: string | null;
};

export type PokemonMoveOption = {
	id: number;
	name: string;
	type: string;
	hue: number;
	chroma: number;
	maxPp: number;
};

export type PokemonMoveSetEditConstraints = {
	supported: boolean;
	maxMoveSlots: number;
	availableMoves: PokemonMoveOption[];
	unsupportedReason?: string | null;
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

export type StoredPokemonImportOperation = {
	entityBytesBase64: string;
	destination: SaveSlotRef;
};

export type StoredPokemonImportResult = {
	bytes: Uint8Array;
	mutated: boolean;
	workspace: SaveWorkspace;
};

export type PokemonEditOperation = {
	source: SaveSlotRef;
	nickname?: string;
	level?: number;
	experience?: number;
	ivs?: PokemonStatEditSet;
	evs?: PokemonStatEditSet;
	moves?: PokemonMoveSlotEdit[];
};

export type PokemonStatEditSet = {
	HP: number;
	ATK: number;
	DEF: number;
	SPA: number;
	SPD: number;
	SPE: number;
};

export type PokemonMoveSlotEdit = {
	slot: number;
	move: number;
	pp?: number;
	ppUps?: number;
};

export type PokemonEditOperationResult = {
	bytes: Uint8Array;
	mutated: boolean;
	workspace: SaveWorkspace;
};

export type SaveFileEditOperation = {
	trainerProfile?: {
		trainerName?: string;
	};
	money?: number;
};

export type SaveFileEditOperationResult = {
	bytes: Uint8Array;
	mutated: boolean;
	workspace: SaveWorkspace;
};

export type LegalityReportLine = {
	severity: string;
	identifier: string;
	message: string;
};

export type LegalityReport = {
	legal: boolean;
	judgement: string;
	summary: string;
	warnings: LegalityReportLine[];
	messages: LegalityReportLine[];
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
	applySaveFileEditOperation(
		bytes: Uint8Array,
		fileName: string | undefined,
		operation: SaveFileEditOperation,
		activeBox: number
	): Promise<EngineResult<SaveFileEditOperationResult>>;
	importStoredPokemon(
		bytes: Uint8Array,
		fileName: string | undefined,
		operation: StoredPokemonImportOperation,
		activeBox: number
	): Promise<EngineResult<StoredPokemonImportResult>>;
	checkSlotLegality(
		bytes: Uint8Array,
		fileName: string | undefined,
		source: SaveSlotRef
	): Promise<EngineResult<LegalityReport>>;
};
