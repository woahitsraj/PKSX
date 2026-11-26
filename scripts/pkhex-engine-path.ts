import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineSource = path.join(repoRoot, 'engine/Pksx.Pkhex.Engine');
const buildInputs = ['Directory.Build.targets', 'Directory.Packages.props', 'global.json'];

export const pkhexEngineStampName = 'source-hash';

// engine:sync publishes into one content-hashed folder, so no deployment reuses an Engine URL.
export function pkhexEngineBasePath(publicRoot: string): string {
	const root = path.join(publicRoot, 'pkhex-engine');
	const version = existsSync(root)
		? readdirSync(root).find((name) => existsSync(path.join(root, name, 'main.js')))
		: undefined;
	return version ? `/pkhex-engine/${version}` : '/pkhex-engine';
}

// File times do not survive a checkout or a CI artifact, so the bundle records a hash of its source.
export function pkhexEngineSourceHash(): string {
	const sources = readdirSync(engineSource, { recursive: true, withFileTypes: true })
		.filter((file) => file.isFile())
		.map((file) => path.relative(repoRoot, path.join(file.parentPath, file.name)))
		.filter((file) => !/[\\/](bin|obj)[\\/]/.test(file));
	const hash = createHash('sha256');
	for (const file of [...buildInputs, ...sources].sort()) {
		hash.update(file.split(path.sep).join('/')).update(readFileSync(path.join(repoRoot, file)));
	}
	return hash.digest('hex');
}

// A prebuilt run serves the build output, so the check reads the bundle there.
export function assertPkhexEngineCurrent(): void {
	const publicRoot = process.env.PKSX_E2E_PREBUILT === '1' ? '.svelte-kit/output/client' : 'static';
	const stamp = path.join(publicRoot, 'pkhex-engine', pkhexEngineStampName);
	const synced =
		pkhexEngineBasePath(publicRoot) !== '/pkhex-engine' &&
		existsSync(stamp) &&
		readFileSync(stamp, 'utf8').trim() === pkhexEngineSourceHash();
	if (!synced) {
		throw new Error(
			`The PKHeX Engine bundle in ${publicRoot}/pkhex-engine is missing or does not match the engine source. Run \`pnpm engine:sync\`, then run the tests again.`
		);
	}
}
