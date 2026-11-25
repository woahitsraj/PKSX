import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// engine:sync publishes into one content-hashed folder, so no deployment reuses an Engine URL.
export function pkhexEngineBasePath(publicRoot: string): string {
	const root = path.join(publicRoot, 'pkhex-engine');
	const version = existsSync(root)
		? readdirSync(root).find((name) => existsSync(path.join(root, name, 'main.js')))
		: undefined;
	return version ? `/pkhex-engine/${version}` : '/pkhex-engine';
}
