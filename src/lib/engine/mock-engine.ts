import type {
	BoxSlotSummary,
	EngineApi,
	EngineResult,
	EngineVersion,
	PartySlotSummary,
	SaveSummary,
	SaveWorkspace,
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
	gender: '♂',
	nature: 'Hardy',
	ability: 'Static',
	heldItem: 'Light Ball',
	types: [{ name: 'Electric', hue: 94, chroma: 0.16 }],
	stats: [
		{ key: 'HP', label: 'HP', value: 20, ev: null, max: 255 },
		{ key: 'ATK', label: 'ATK', value: 12, ev: null, max: 255 },
		{ key: 'DEF', label: 'DEF', value: 10, ev: null, max: 255 },
		{ key: 'SPA', label: 'SPA', value: 11, ev: null, max: 255 },
		{ key: 'SPD', label: 'SPD', value: 12, ev: null, max: 255 },
		{ key: 'SPE', label: 'SPE', value: 18, ev: null, max: 255 }
	],
	moves: [
		{ name: 'Thunder Shock', type: 'Electric', hue: 94, chroma: 0.16, pp: 30 },
		{ name: 'Growl', type: 'Normal', hue: 107, chroma: 0.06, pp: 40 }
	],
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
		moves: []
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
