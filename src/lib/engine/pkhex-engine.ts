type RawDotnetModule = {
	dotnet: {
		create(): Promise<{
			getAssemblyExports(assemblyName: string): Promise<{
				Pksx: {
					Pkhex: {
						Engine: {
							PkhexEngineExports: DotnetPkhexEngineExports;
						};
					};
				};
			}>;
			getConfig(): { mainAssemblyName: string };
			runMain(): Promise<void>;
		}>;
	};
};

type DotnetPkhexEngineExports = {
	GetVersionJson(): string;
	ParseSaveSmoke(bytes: Uint8Array, fileName?: string): string;
	ListBoxSmoke(bytes: Uint8Array, fileName: string | undefined, box: number): string;
};

export type EngineResult<T> =
	| { ok: true; value: T; error: null }
	| { ok: false; value: null; error: { code: string; message: string } };

export type EngineVersion = {
	pkhexCoreVersion: string;
	facadeVersion: string;
};

export type SaveSummary = {
	fileName?: string;
	saveType: string;
	gameVersion: string;
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

export type PkhexEngine = {
	getVersion(): EngineResult<EngineVersion>;
	parseSaveSmoke(bytes: Uint8Array, fileName?: string): EngineResult<SaveSummary>;
	listBoxSmoke(
		bytes: Uint8Array,
		fileName: string | undefined,
		box: number
	): EngineResult<BoxSlotSummary[]>;
};

export async function createPkhexEngine(basePath = '/pkhex-engine'): Promise<PkhexEngine> {
	const module = (await import(
		/* @vite-ignore */ `${basePath}/_framework/dotnet.js`
	)) as RawDotnetModule;
	const runtime = await module.dotnet.create();
	const config = runtime.getConfig();
	const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
	await runtime.runMain();

	const engine = exports.Pksx.Pkhex.Engine.PkhexEngineExports;

	return {
		getVersion: () => parseEngineResult<EngineVersion>(engine.GetVersionJson()),
		parseSaveSmoke: (bytes, fileName) =>
			parseEngineResult<SaveSummary>(engine.ParseSaveSmoke(bytes, fileName)),
		listBoxSmoke: (bytes, fileName, box) =>
			parseEngineResult<BoxSlotSummary[]>(engine.ListBoxSmoke(bytes, fileName, box))
	};
}

function parseEngineResult<T>(json: string): EngineResult<T> {
	return JSON.parse(json) as EngineResult<T>;
}
