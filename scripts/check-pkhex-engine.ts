import { assertPkhexEngineCurrent } from './pkhex-engine-path.ts';

try {
	assertPkhexEngineCurrent();
} catch (error) {
	console.error((error as Error).message);
	process.exit(1);
}
