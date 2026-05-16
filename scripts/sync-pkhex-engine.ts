import { cp, mkdir, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Options = {
	configuration: string;
	properties: string[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineProject = path.join(repoRoot, 'engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj');
const staticEnginePath = path.join(repoRoot, 'static/pkhex-engine');

const options = parseArgs(process.argv.slice(2));

if (options.help) {
	printHelp();
	process.exit(0);
}

await ensureDotnet();
await ensureWasmTools();
publishEngine(options);
await syncAppBundle(options.configuration);

console.log(`Synced PKHeX Engine assets to ${path.relative(repoRoot, staticEnginePath)}`);

function parseArgs(args: string[]): Options & { help: boolean } {
	const parsed: Options & { help: boolean } = {
		configuration: 'Release',
		properties: [],
		help: false
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === '--') {
			continue;
		}

		if (arg === '--help' || arg === '-h') {
			parsed.help = true;
			continue;
		}

		if (arg === '--configuration' || arg === '-c') {
			parsed.configuration = readValue(args, (index += 1), arg);
			continue;
		}

		if (arg.startsWith('--configuration=')) {
			parsed.configuration = readInlineValue(arg, '--configuration');
			continue;
		}

		if (arg === '--property' || arg === '-p') {
			parsed.properties.push(readMsBuildProperty(args, (index += 1), arg));
			continue;
		}

		if (arg.startsWith('--property=')) {
			parsed.properties.push(readMsBuildPropertyValue(readInlineValue(arg, '--property')));
			continue;
		}

		if (arg.startsWith('-p:')) {
			parsed.properties.push(readMsBuildPropertyValue(arg.slice('-p:'.length)));
			continue;
		}

		fail(`Unknown argument: ${arg}`);
	}

	if (parsed.configuration.length === 0) {
		fail('Configuration cannot be empty.');
	}

	return parsed;
}

function readValue(args: string[], index: number, flag: string): string {
	const value = args[index];

	if (value === undefined || value.startsWith('-')) {
		fail(`Missing value for ${flag}.`);
	}

	return value;
}

function readInlineValue(arg: string, flag: string): string {
	const value = arg.slice(`${flag}=`.length);

	if (value.length === 0) {
		fail(`Missing value for ${flag}.`);
	}

	return value;
}

function readMsBuildProperty(args: string[], index: number, flag: string): string {
	return readMsBuildPropertyValue(readValue(args, index, flag));
}

function readMsBuildPropertyValue(value: string): string {
	if (!value.includes('=') || value.startsWith('=')) {
		fail(`MSBuild properties must use Name=Value syntax. Received: ${value}`);
	}

	return value;
}

async function ensureDotnet(): Promise<void> {
	const result = spawnSync('dotnet', ['--version'], { encoding: 'utf8' });

	if (result.error) {
		fail(
			'The .NET SDK is required to publish the PKHeX Engine. Install .NET 10 SDK, then rerun this command.'
		);
	}

	if (result.status !== 0) {
		fail('Unable to run `dotnet --version`. Check that the .NET SDK is installed correctly.');
	}
}

async function ensureWasmTools(): Promise<void> {
	const result = spawnSync('dotnet', ['workload', 'list'], { encoding: 'utf8' });

	if (result.status !== 0) {
		fail('Unable to list .NET workloads. Check your .NET SDK installation.');
	}

	if (!result.stdout.includes('wasm-tools')) {
		fail('Missing .NET wasm-tools workload. Install it with `dotnet workload install wasm-tools`.');
	}
}

function publishEngine(options: Options): void {
	const args = [
		'publish',
		engineProject,
		'-c',
		options.configuration,
		...options.properties.map((property) => `-p:${property}`)
	];

	const result = spawnSync('dotnet', args, { cwd: repoRoot, stdio: 'inherit' });

	if (result.status !== 0) {
		fail('PKHeX Engine publish failed.');
	}
}

async function syncAppBundle(configuration: string): Promise<void> {
	const sourceAppBundle = path.join(
		repoRoot,
		'engine/Pksx.Pkhex.Engine/bin',
		configuration,
		'net10.0',
		'browser-wasm',
		'AppBundle'
	);

	await ensureFile(
		path.join(sourceAppBundle, 'main.js'),
		'Published AppBundle is missing main.js.'
	);
	await ensureFile(
		path.join(sourceAppBundle, '_framework/dotnet.js'),
		'Published AppBundle is missing _framework/dotnet.js.'
	);

	await rm(staticEnginePath, { recursive: true, force: true });
	await mkdir(path.dirname(staticEnginePath), { recursive: true });
	await cp(sourceAppBundle, staticEnginePath, { recursive: true });
}

async function ensureFile(filePath: string, message: string): Promise<void> {
	try {
		await access(filePath, constants.R_OK);
	} catch {
		fail(message);
	}
}

function printHelp(): void {
	console.log(`Publish the PKHeX Engine and sync its browser WebAssembly assets.

Usage:
  pnpm engine:sync
  pnpm engine:sync -- --configuration Debug
  pnpm engine:sync -- --property UseLocalPKHeX=true --property PKHeXSourcePath=/path/to/PKHeX/PKHeX.Core/PKHeX.Core.csproj

Options:
  -c, --configuration <name>  MSBuild configuration to publish. Defaults to Release.
  -p, --property <Name=Value> MSBuild property passed to dotnet publish. May be repeated.
  -h, --help                 Show this help.
`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}
