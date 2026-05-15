import { dotnet } from './_framework/dotnet.js';

const { getAssemblyExports, getConfig, runMain } = await dotnet.create();
const config = getConfig();
const exports = await getAssemblyExports(config.mainAssemblyName);

await runMain();

export const pkhexEngine = exports.Pksx.Pkhex.Engine.PkhexEngineExports;
