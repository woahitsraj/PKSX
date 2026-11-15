import type { SavesStorage } from '$lib/pksx/saves';

const fixtureRoot =
	'https://raw.githubusercontent.com/woahitsraj/pksx/main/test-fixtures/save-files';

// One Save File per generation, named so the cards read clearly.
export const testSaves = [
	['pkmds-blazor/pokemon-yellow.sav', 'test-yellow.sav'],
	['pkhex-avalonia/gen2-gold.sav', 'test-gold.sav'],
	['bl1ndbeholder-pokemon-saves/emerald-011020251345.sav', 'test-emerald.sav'],
	['raj-pokemon-save-backups/nds/pokemon-heartgold.sav', 'test-heartgold.sav'],
	['minna-pokemon-saves/pokemon-black-2.sav', 'test-black-2.sav'],
	['bl1ndbeholder-pokemon-saves/x/011020252224.sav', 'test-x.sav'],
	['bl1ndbeholder-pokemon-saves/ultra-sun/011020252224.sav', 'test-ultra-sun.sav'],
	['raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav', 'test-sword.sav'],
	['raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav', 'test-scarlet.sav']
] as const;

export function testSavesAllowed(hostname: string) {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === 'staging.pksx.app' ||
		hostname.endsWith('.localhost') ||
		hostname.endsWith('.workers.dev')
	);
}

/** Imports each missing test Save File and returns how many it added. */
export async function seedTestSaves(storage: SavesStorage, fetcher: typeof fetch = fetch) {
	const existing = new Set((await storage.listSaves()).map((save) => save.originalFileName));
	const missing = testSaves.filter(([, name]) => !existing.has(name));
	const downloads = await Promise.all(
		missing.map(async ([path, name]) => {
			const response = await fetcher(`${fixtureRoot}/${path}`);
			if (!response.ok) throw new Error(`Could not download ${name} (${response.status}).`);
			return { name, bytes: new Uint8Array(await response.arrayBuffer()) };
		})
	);
	for (const { name, bytes } of downloads) {
		await storage.importSave({ bytes, originalFileName: name });
	}
	return downloads.length;
}
