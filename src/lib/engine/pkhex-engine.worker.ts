import {
	createPkhexEngineWorkerRuntime,
	type DotnetPkhexEngineExports
} from './pkhex-engine-worker-runtime';

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

const runtime = createPkhexEngineWorkerRuntime({
	loadEngine,
	postMessage: (message, transfer = []) => {
		(
			self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void }
		).postMessage(message, transfer);
	}
});

self.addEventListener('message', (event: MessageEvent<unknown>) => {
	runtime.handleMessage(event.data);
});

async function loadEngine(basePath: string): Promise<DotnetPkhexEngineExports> {
	const module = (await import(
		/* @vite-ignore */ `${basePath}/_framework/dotnet.js`
	)) as RawDotnetModule;
	const runtime = await module.dotnet.create();
	const config = runtime.getConfig();
	const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
	await runtime.runMain();

	return exports.Pksx.Pkhex.Engine.PkhexEngineExports;
}

export {};
