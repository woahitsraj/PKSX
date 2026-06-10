import type {
	BoxSlotSummary,
	EngineApi,
	EngineResult,
	EngineVersion,
	LegalityReport,
	PokemonEditOperationResult,
	SaveSlotRef,
	PartySlotSummary,
	SaveSummary,
	SaveWorkspace,
	SlotOperation,
	SlotOperationResult,
	SerializedSave
} from './types';

const mockVersion: EngineVersion = {
	pkhexCoreVersion: 'mock',
	facadeVersion: 'mock'
};

const mockSaveSummary: SaveSummary = {
	fileName: 'mock.sav',
	saveType: 'MockSaveFile',
	gameVersion: 'SV',
	gameVersionId: 45,
	generation: 9,
	trainerName: 'PKSX',
	trainerId: 41203,
	playTime: '47:12',
	playedHours: 47,
	playedMinutes: 12,
	partyCount: 1,
	boxCount: 1,
	boxSlotCount: 30
};

const mockPikachuDetails = {
	experience: 125,
	experienceProjection: {
		minLevel: 1,
		maxLevel: 100,
		minExperience: 0,
		maxExperience: 1_000_000,
		currentLevelMinExperience: 125,
		nextLevelMinExperience: 216,
		currentLevelProgress: 0
	},
	gender: '♂',
	nature: 'Hardy',
	ability: 'Static',
	heldItem: 'Light Ball',
	types: [{ name: 'Electric', hue: 94, chroma: 0.16 }],
	stats: [
		{ key: 'HP', label: 'HP', value: 20, ev: null, iv: 31, max: 255 },
		{ key: 'ATK', label: 'ATK', value: 12, ev: null, iv: 31, max: 255 },
		{ key: 'DEF', label: 'DEF', value: 10, ev: null, iv: 31, max: 255 },
		{ key: 'SPA', label: 'SPA', value: 11, ev: null, iv: 31, max: 255 },
		{ key: 'SPD', label: 'SPD', value: 12, ev: null, iv: 31, max: 255 },
		{ key: 'SPE', label: 'SPE', value: 18, ev: null, iv: 31, max: 255 }
	],
	moves: [
		{
			slot: 0,
			id: 84,
			name: 'Thunder Shock',
			type: 'Electric',
			hue: 94,
			chroma: 0.16,
			pp: 30,
			maxPp: 30,
			ppUps: 0
		},
		{
			slot: 1,
			id: 45,
			name: 'Growl',
			type: 'Normal',
			hue: 107,
			chroma: 0.06,
			pp: 40,
			maxPp: 40,
			ppUps: 0
		}
	],
	statEditConstraints: {
		supported: true,
		minIv: 0,
		maxIv: 31,
		minEv: 0,
		maxEv: 255,
		maxTotalEv: 510
	},
	moveSetEditConstraints: {
		supported: true,
		maxMoveSlots: 4,
		availableMoves: [
			{ id: 0, name: 'Empty', type: 'None', hue: 48, chroma: 0.04, maxPp: 0 },
			{ id: 84, name: 'Thunder Shock', type: 'Electric', hue: 94, chroma: 0.16, maxPp: 30 },
			{ id: 45, name: 'Growl', type: 'Normal', hue: 107, chroma: 0.06, maxPp: 40 },
			{ id: 98, name: 'Quick Attack', type: 'Normal', hue: 107, chroma: 0.06, maxPp: 30 }
		]
	},
	originalTrainer: 'PKSX',
	metLabel: 'Lv. 5',
	spriteIdentity: {
		speciesId: 25,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'male' as const
	}
};

const mockBoxSlots: BoxSlotSummary[] = [
	{
		box: 0,
		slot: 0,
		speciesId: 25,
		form: 0,
		format: 9,
		level: 5,
		nickname: 'Pikachu',
		isEgg: false,
		isEmpty: false,
		...mockPikachuDetails
	},
	{
		box: 0,
		slot: 1,
		speciesId: 0,
		form: 0,
		format: 0,
		level: 0,
		experience: 0,
		experienceProjection: null,
		nickname: '',
		isEgg: false,
		isEmpty: true,
		spriteIdentity: {
			speciesId: 0,
			form: 0,
			isEgg: false,
			isShiny: false,
			displaySex: 'default'
		},
		types: [],
		stats: [],
		moves: [],
		statEditConstraints: {
			supported: false,
			minIv: 0,
			maxIv: 0,
			minEv: 0,
			maxEv: 0,
			maxTotalEv: 0,
			unsupportedReason: 'IV and EV Editing needs an occupied Slot.'
		},
		moveSetEditConstraints: {
			supported: false,
			maxMoveSlots: 0,
			availableMoves: [],
			unsupportedReason: 'Move Set Editing needs an occupied Slot.'
		}
	}
];

const mockPartySlots: PartySlotSummary[] = [
	{
		slot: 0,
		speciesId: 25,
		form: 0,
		format: 9,
		level: 5,
		nickname: 'Pikachu',
		isEgg: false,
		isEmpty: false,
		...mockPikachuDetails
	}
];

export function createMockEngine(overrides: Partial<EngineApi> = {}): EngineApi {
	return {
		getVersion: async () => success(mockVersion),
		summarizeSave: async (_bytes, fileName) => success({ ...mockSaveSummary, fileName }),
		listBoxSlots: async (_bytes, _fileName, box) => {
			if (box !== 0) {
				return {
					ok: false,
					value: null,
					error: {
						code: 'invalid-box',
						message: `Box ${box} is outside the mock save's box range.`
					}
				};
			}

			return success(mockBoxSlots);
		},
		loadSaveWorkspace: async (_bytes, fileName, box) => {
			if (box !== 0) {
				return {
					ok: false,
					value: null,
					error: {
						code: 'invalid-box',
						message: `Box ${box} is outside the mock save's box range.`
					}
				};
			}

			return success<SaveWorkspace>({
				summary: { ...mockSaveSummary, fileName },
				partySlots: mockPartySlots,
				boxSlots: mockBoxSlots
			});
		},
		serializeSave: async (bytes) =>
			success<SerializedSave>({
				bytesBase64: bytesToBase64(bytes),
				byteLength: bytes.byteLength
			}),
		applySlotOperation: async (bytes, fileName, operation, activeBox) =>
			success<SlotOperationResult>({
				bytes: copyBytes(bytes),
				mutated: !isSameSlotOperation(operation),
				workspace: {
					summary: { ...mockSaveSummary, fileName },
					partySlots: mockPartySlots,
					boxSlots: activeBox === 0 ? mockBoxSlots : []
				}
			}),
		applyPokemonEditOperation: async (bytes, fileName, operation, activeBox) =>
			success<PokemonEditOperationResult>({
				bytes: copyBytes(bytes),
				mutated:
					operation.nickname !== undefined ||
					operation.level !== undefined ||
					operation.experience !== undefined ||
					operation.ivs !== undefined ||
					operation.evs !== undefined ||
					operation.moves !== undefined,
				workspace: {
					summary: { ...mockSaveSummary, fileName },
					partySlots: mockPartySlots,
					boxSlots: activeBox === 0 ? mockBoxSlots : []
				}
			}),
		applySaveFileEditOperation: async () => ({
			ok: false,
			value: null,
			error: {
				code: 'unsupported-save-file-edit',
				message: 'Save File field editing is not available for the mock engine.'
			}
		}),
		checkSlotLegality: async () =>
			success<LegalityReport>({
				legal: true,
				judgement: 'Legal',
				summary: 'PKHeX judged this Pokemon legal.',
				warnings: [],
				messages: [{ severity: 'Valid', identifier: 'Encounter', message: 'Encounter is valid.' }]
			}),
		...overrides
	};
}

function success<T>(value: T): EngineResult<T> {
	return { ok: true, value, error: null };
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function isSameSlotOperation(operation: SlotOperation): boolean {
	return (
		operation.kind !== 'clear' && slotRefKey(operation.source) === slotRefKey(operation.destination)
	);
}

function slotRefKey(ref: SaveSlotRef): string {
	return ref.zone === 'party' ? `party:${ref.slot}` : `box:${ref.box}:${ref.slot}`;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy;
}
