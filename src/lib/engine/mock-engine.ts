import type { BoxSlotSummary, EngineApi, EngineResult, EngineVersion, SaveSummary } from './types';

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
	partyCount: 1,
	boxCount: 1,
	boxSlotCount: 30
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
		isEmpty: false
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
		isEmpty: true
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
		...overrides
	};
}

function success<T>(value: T): EngineResult<T> {
	return { ok: true, value, error: null };
}
