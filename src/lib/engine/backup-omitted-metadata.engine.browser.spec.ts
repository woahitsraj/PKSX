import { expect, test } from 'vitest';
import { createPkhexWorkerEngine } from './pkhex-worker-engine';
import boxFixtureUrl from '../../../test-fixtures/save-files/pkmds-blazor/pokemon-box-ruby-sapphire.gci?url';
import emeraldFixtureUrl from '../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';

test(
	'real worker preserves available metadata and marks Pokemon Box metadata unavailable',
	{ timeout: 60_000 },
	async () => {
		const worker = new Worker(new URL('./pkhex-engine.worker.ts', import.meta.url), {
			type: 'module'
		});
		const engine = createPkhexWorkerEngine('/pkhex-engine', { createWorker: () => worker });
		try {
			for (const fixture of [
				{
					url: boxFixtureUrl,
					fileName: 'pokemon-box-ruby-sapphire.gci',
					saveType: 'SAV3RSBox',
					trainerName: '',
					playTime: ''
				},
				{
					url: emeraldFixtureUrl,
					fileName: 'emerald.sav',
					saveType: 'SAV3E',
					trainerName: 'DIXIE',
					playTime: '5ː45ː26'
				}
			]) {
				const bytes = new Uint8Array(await (await fetch(fixture.url)).arrayBuffer());
				const before = bytes.slice();
				const result = await engine.summarizeSaveCard(bytes, fixture.fileName);
				if (!result.ok) throw new Error(result.error.message);
				expect(result.value.summary).toMatchObject({
					saveType: fixture.saveType,
					trainerName: fixture.trainerName,
					playTime: fixture.playTime
				});
				expect(result.value.pokemonCount).toBeGreaterThan(0);
				expect(bytes).toEqual(before);
			}
		} finally {
			worker.terminate();
		}
	}
);
