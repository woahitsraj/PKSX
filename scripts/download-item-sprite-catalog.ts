import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import {
	buildIdentityMap,
	type AmbiguousIdentity,
	type GameIndex,
	type Item,
	type ItemSpriteIdentityOverride
} from './item-sprite-catalog.ts';

const spriteRevision = '2ecb4eeacd5a1718621fc30f12772e3f60d830b9';
const dataRevision = '8fe210b21c9abbe73de93670f3d5a346c80a3625';
const pkhexRevision = '0b0e7e3e9d724fdbd704a7f6d4848d009b52acf7';
const spriteRepository = 'https://github.com/PokeAPI/sprites';
const dataRepository = 'https://github.com/PokeAPI/pokeapi';
const pkhexRepository = 'https://github.com/kwsch/PKHeX';
const spriteFamilies = ['', 'gen9', 'gen8'] as const;

const identityOverrides: ItemSpriteIdentityOverride[] = [
	{
		key: 'generation-2-item-116',
		pokeApiItemId: 472,
		evidencePaths: [
			'PKHeX.Core/Items/ItemStorage2.cs',
			'PKHeX.Core/Resources/text/items/gen2/text_ItemsG2_en.txt'
		],
		reason: 'PKHeX 26.5.5 stores index 116 as the Crystal-only Blue Card.'
	},
	{
		key: 'generation-5-item-227',
		pokeApiItemId: 204,
		evidencePaths: [
			'PKHeX.Core/Items/ItemStorage5.cs',
			'PKHeX.Core/Resources/text/items/text_Items_en.txt'
		],
		reason: 'PKHeX 26.5.5 identifies modern item index 227 as Deep Sea Scale.'
	},
	{
		key: 'generation-9-item-2',
		pokeApiItemId: 2,
		evidencePaths: [
			'PKHeX.Core/Items/ItemStorage9SV.cs',
			'PKHeX.Core/Resources/text/items/text_Items_en.txt'
		],
		reason: 'PKHeX 26.5.5 includes index 2 in the Scarlet and Violet Ball pouch as Ultra Ball.'
	}
];

type SpriteSource = {
	family: 'root' | 'gen8' | 'gen9';
	variant: 'default' | 'bag' | 'held';
	relativePath: string;
};
type ItemSpriteCatalogEntry = {
	pokeApiItemId: number;
	name: string;
	slug: string;
	path: string;
	sourceUrl: string;
	sourceFamily: SpriteSource['family'];
	sourceVariant: SpriteSource['variant'];
	width: number;
	height: number;
	byteSize: number;
	gzipByteSize: number;
};
type ItemSpriteCatalogManifest = {
	source: {
		name: string;
		repository: string;
		revision: string;
		license: string;
		licenseUrl: string;
		imageCopyright: string;
	};
	mappingSource: { name: string; repository: string; revision: string };
	identityOverrideSource: {
		name: string;
		repository: string;
		revision: string;
		packageVersion: string;
	};
	identityOverrides: (ItemSpriteIdentityOverride & { evidenceUrls: string[] })[];
	summary: {
		identityCount: number;
		canonicalIdentityCount: number;
		assetCount: number;
		byteSize: number;
		gzipByteSize: number;
		ambiguousIdentityCount: number;
		ambiguousCanonicalIdentityCount: number;
		generations: Record<
			string,
			{
				sourceIdentityCount: number;
				mappedIdentityCount: number;
				missingIdentityCount: number;
				ambiguousIdentityCount: number;
			}
		>;
	};
	assets: Record<string, ItemSpriteCatalogEntry>;
	identities: Record<string, number>;
	canonicalIdentities: Record<string, number>;
	ambiguousIdentities: AmbiguousIdentity[];
	ambiguousCanonicalIdentities: AmbiguousIdentity[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(repoRoot, 'static/sprites/items');
const staticManifestPath = path.join(staticRoot, 'catalog.json');
const generatedManifestPath = path.join(
	repoRoot,
	'src/lib/pksx/item-sprite-catalog/catalog.generated.json'
);
const args = parseArgs(process.argv.slice(2));

if (args.validate) {
	await validateCatalog();
} else {
	await acquireCatalog(args.spritesRoot, args.dataRoot);
}

function parseArgs(values: string[]) {
	let validate = false;
	let spritesRoot: string | null = null;
	let dataRoot: string | null = null;

	for (let index = 0; index < values.length; index += 1) {
		switch (values[index]) {
			case '--validate':
				validate = true;
				break;
			case '--sprites-root':
				spritesRoot = path.resolve(requiredValue(values, ++index, '--sprites-root'));
				break;
			case '--data-root':
				dataRoot = path.resolve(requiredValue(values, ++index, '--data-root'));
				break;
			default:
				throw new Error(`Unknown argument: ${values[index]}`);
		}
	}

	if ((spritesRoot === null) !== (dataRoot === null)) {
		throw new Error('--sprites-root and --data-root must be provided together.');
	}

	return { validate, spritesRoot, dataRoot };
}

function requiredValue(values: string[], index: number, flag: string): string {
	const value = values[index];
	if (!value) throw new Error(`${flag} needs a path.`);
	return value;
}

async function acquireCatalog(spritesRoot: string | null, dataRoot: string | null) {
	const [itemsCsv, namesCsv, gameIndicesCsv, spriteSources] = await Promise.all([
		readDataFile('items.csv', dataRoot),
		readDataFile('item_names.csv', dataRoot),
		readDataFile('item_game_indices.csv', dataRoot),
		listSpriteSources(spritesRoot)
	]);
	const englishNames = new Map(
		parseCsv(namesCsv)
			.filter(([, languageId]) => Number(languageId) === 9)
			.map(([itemId, , name]) => [Number(itemId), name])
	);
	const items = new Map<number, Item>(
		parseCsv(itemsCsv).map(([id, slug]) => {
			const itemId = Number(id);
			return [itemId, { id: itemId, slug, name: englishNames.get(itemId) ?? slug }];
		})
	);
	const gameIndices = parseCsv(gameIndicesCsv).map<GameIndex>(([itemId, generation, nativeId]) => ({
		itemId: Number(itemId),
		generation: Number(generation),
		nativeId: Number(nativeId)
	}));
	const spriteItems = new Set(
		[...items.values()].filter((item) => spriteSources.has(item.slug)).map((item) => item.id)
	);
	const exact = buildIdentityMap(gameIndices, spriteItems, items, false, identityOverrides);
	const canonical = buildIdentityMap(gameIndices, spriteItems, items, true, []);
	const selectedItemIds = new Set([
		...Object.values(exact.identities),
		...Object.values(canonical.identities)
	]);

	await rm(staticRoot, { recursive: true, force: true });
	await mkdir(staticRoot, { recursive: true });
	await mkdir(path.dirname(generatedManifestPath), { recursive: true });

	const assets: Record<string, ItemSpriteCatalogEntry> = {};
	for (const itemId of [...selectedItemIds].sort((left, right) => left - right)) {
		const item = items.get(itemId);
		if (!item) throw new Error(`Missing PokéAPI item ${itemId}.`);
		const source = spriteSources.get(item.slug);
		if (!source) throw new Error(`Missing sprite for PokéAPI item ${itemId} (${item.slug}).`);
		const bytes = await readSprite(source, spritesRoot);
		const fileName = `${String(item.id).padStart(4, '0')}-${item.slug}.png`;
		const destination = path.join(staticRoot, fileName);
		if (spritesRoot) {
			await copyFile(path.join(spritesRoot, source.relativePath), destination);
		} else {
			await writeFile(destination, bytes);
		}
		const { width, height } = readPngDimensions(bytes);
		assets[String(item.id)] = {
			pokeApiItemId: item.id,
			name: item.name,
			slug: item.slug,
			path: `/sprites/items/${fileName}`,
			sourceUrl: `${spriteRepository}/raw/${spriteRevision}/${source.relativePath}`,
			sourceFamily: source.family,
			sourceVariant: source.variant,
			width,
			height,
			byteSize: bytes.byteLength,
			gzipByteSize: gzipSync(bytes, { level: 9 }).byteLength
		};
	}

	const generations: ItemSpriteCatalogManifest['summary']['generations'] = {};
	for (let generation = 1; generation <= 9; generation += 1) {
		const sourceIdentityCount = new Set(
			gameIndices.filter((entry) => entry.generation === generation).map((entry) => entry.nativeId)
		).size;
		const prefix = `generation-${generation}-item-`;
		const mappedIdentityCount = Object.keys(exact.identities).filter((key) =>
			key.startsWith(prefix)
		).length;
		const ambiguousIdentityCount = exact.ambiguous.filter((entry) =>
			entry.key.startsWith(prefix)
		).length;
		generations[String(generation)] = {
			sourceIdentityCount,
			mappedIdentityCount,
			missingIdentityCount: sourceIdentityCount - mappedIdentityCount - ambiguousIdentityCount,
			ambiguousIdentityCount
		};
	}

	const entries = Object.values(assets);
	const manifest: ItemSpriteCatalogManifest = {
		source: {
			name: 'PokéAPI item sprites',
			repository: spriteRepository,
			revision: spriteRevision,
			license: 'CC0-1.0 repository distribution; image copyrights remain with The Pokémon Company',
			licenseUrl: `${spriteRepository}/blob/${spriteRevision}/LICENCE.txt`,
			imageCopyright: 'The Pokémon Company'
		},
		mappingSource: {
			name: 'PokéAPI item game indices',
			repository: dataRepository,
			revision: dataRevision
		},
		identityOverrideSource: {
			name: 'PKHeX item storage tables',
			repository: pkhexRepository,
			revision: pkhexRevision,
			packageVersion: '26.5.5'
		},
		identityOverrides: identityOverrides.map((override) => ({
			...override,
			evidenceUrls: override.evidencePaths.map(
				(sourcePath) => `${pkhexRepository}/blob/${pkhexRevision}/${sourcePath}`
			)
		})),
		summary: {
			identityCount: Object.keys(exact.identities).length,
			canonicalIdentityCount: Object.keys(canonical.identities).length,
			assetCount: entries.length,
			byteSize: entries.reduce((total, entry) => total + entry.byteSize, 0),
			gzipByteSize: entries.reduce((total, entry) => total + entry.gzipByteSize, 0),
			ambiguousIdentityCount: exact.ambiguous.length,
			ambiguousCanonicalIdentityCount: canonical.ambiguous.length,
			generations
		},
		assets,
		identities: exact.identities,
		canonicalIdentities: canonical.identities,
		ambiguousIdentities: exact.ambiguous,
		ambiguousCanonicalIdentities: canonical.ambiguous
	};

	await writeManifest(staticManifestPath, manifest);
	await writeManifest(generatedManifestPath, manifest);
	await validateCatalog();
}

async function listSpriteSources(localRoot: string | null): Promise<Map<string, SpriteSource>> {
	const paths = localRoot
		? (
				await Promise.all(
					spriteFamilies.map(async (family) => {
						const directory = path.join(localRoot, 'sprites/items', family);
						return (await readdir(directory))
							.filter((file) => file.endsWith('.png'))
							.map((file) => path.posix.join('sprites/items', family, file));
					})
				)
			).flat()
		: await fetchSpritePaths();
	const sources = new Map<string, SpriteSource>();

	for (const family of spriteFamilies) {
		const prefix = path.posix.join('sprites/items', family);
		for (const relativePath of paths.filter(
			(candidate) => path.posix.dirname(candidate) === prefix
		)) {
			const slug = path.posix.basename(relativePath, '.png');
			if (!sources.has(slug)) {
				sources.set(slug, {
					family: family === '' ? 'root' : family,
					variant: slug.endsWith('--bag') ? 'bag' : slug.endsWith('--held') ? 'held' : 'default',
					relativePath
				});
			}
		}
	}
	return sources;
}

async function fetchSpritePaths(): Promise<string[]> {
	const response = await fetch(
		`https://api.github.com/repos/PokeAPI/sprites/git/trees/${spriteRevision}?recursive=1`
	);
	if (!response.ok) throw new Error(`PokéAPI sprite tree request failed: ${response.status}.`);
	const body = (await response.json()) as {
		truncated?: boolean;
		tree: { path: string; type: string }[];
	};
	if (body.truncated) throw new Error('PokéAPI sprite tree response was truncated.');
	return body.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);
}

async function readDataFile(fileName: string, localRoot: string | null): Promise<string> {
	if (localRoot) {
		return readFile(path.join(localRoot, 'data/v2/csv', fileName), 'utf8');
	}
	return fetchText(
		`https://raw.githubusercontent.com/PokeAPI/pokeapi/${dataRevision}/data/v2/csv/${fileName}`
	);
}

async function readSprite(source: SpriteSource, localRoot: string | null): Promise<Buffer> {
	if (localRoot) return readFile(path.join(localRoot, source.relativePath));
	const response = await fetch(
		`https://raw.githubusercontent.com/PokeAPI/sprites/${spriteRevision}/${source.relativePath}`
	);
	if (!response.ok) throw new Error(`Sprite request failed for ${source.relativePath}.`);
	return Buffer.from(await response.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status}.`);
	return response.text();
}

function parseCsv(contents: string): string[][] {
	return contents
		.trim()
		.split('\n')
		.slice(1)
		.map((line) => line.replace(/\r$/, '').split(','));
}

function readPngDimensions(bytes: Buffer): { width: number; height: number } {
	if (bytes.toString('ascii', 1, 4) !== 'PNG' || bytes.toString('ascii', 12, 16) !== 'IHDR') {
		throw new Error('Item sprite is not a PNG with an IHDR header.');
	}
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function writeManifest(filePath: string, manifest: ItemSpriteCatalogManifest) {
	await writeFile(
		filePath,
		await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100, useTabs: true })
	);
}

async function validateCatalog() {
	const [staticContents, generatedContents] = await Promise.all([
		readFile(staticManifestPath, 'utf8'),
		readFile(generatedManifestPath, 'utf8')
	]);
	if (staticContents !== generatedContents) throw new Error('Item sprite manifests differ.');
	const manifest = JSON.parse(staticContents) as ItemSpriteCatalogManifest;
	const referenced = new Set<string>();
	if (
		manifest.source.revision !== spriteRevision ||
		manifest.mappingSource.revision !== dataRevision ||
		manifest.identityOverrideSource.revision !== pkhexRevision
	) {
		throw new Error('Item sprite source revisions do not match the pinned acquisition inputs.');
	}
	for (const override of manifest.identityOverrides) {
		if (manifest.identities[override.key] !== override.pokeApiItemId) {
			throw new Error(`Identity override ${override.key} does not resolve to its reviewed item.`);
		}
	}

	for (const [itemId, entry] of Object.entries(manifest.assets)) {
		if (Number(itemId) !== entry.pokeApiItemId) throw new Error(`Asset key ${itemId} is invalid.`);
		const fileName = path.basename(entry.path);
		const filePath = path.join(staticRoot, fileName);
		const bytes = await readFile(filePath);
		const dimensions = readPngDimensions(bytes);
		if (dimensions.width !== entry.width || dimensions.height !== entry.height) {
			throw new Error(`${fileName} dimensions do not match the manifest.`);
		}
		if (bytes.byteLength !== entry.byteSize) {
			throw new Error(`${fileName} byte size does not match the manifest.`);
		}
		if (gzipSync(bytes, { level: 9 }).byteLength !== entry.gzipByteSize) {
			throw new Error(`${fileName} compressed size does not match the manifest.`);
		}
		referenced.add(fileName);
	}

	for (const map of [manifest.identities, manifest.canonicalIdentities]) {
		for (const [key, itemId] of Object.entries(map)) {
			if (!manifest.assets[String(itemId)])
				throw new Error(`${key} references missing item ${itemId}.`);
		}
	}
	for (const entry of [...manifest.ambiguousIdentities, ...manifest.ambiguousCanonicalIdentities]) {
		if (manifest.identities[entry.key] || manifest.canonicalIdentities[entry.key]) {
			throw new Error(`Ambiguous identity ${entry.key} must not resolve.`);
		}
	}
	if (Object.keys(manifest.identities).length !== manifest.summary.identityCount) {
		throw new Error('Item sprite exact identity count does not match the manifest.');
	}
	if (
		Object.keys(manifest.canonicalIdentities).length !== manifest.summary.canonicalIdentityCount
	) {
		throw new Error('Item sprite canonical identity count does not match the manifest.');
	}
	if (manifest.ambiguousIdentities.length !== manifest.summary.ambiguousIdentityCount) {
		throw new Error('Item sprite exact ambiguity count does not match the manifest.');
	}
	if (
		manifest.ambiguousCanonicalIdentities.length !==
		manifest.summary.ambiguousCanonicalIdentityCount
	) {
		throw new Error('Item sprite canonical ambiguity count does not match the manifest.');
	}

	const files = (await readdir(staticRoot)).filter((file) => file.endsWith('.png'));
	const extra = files.filter((file) => !referenced.has(file));
	if (extra.length > 0) throw new Error(`Unreferenced item sprites: ${extra.join(', ')}`);
	if (files.length !== manifest.summary.assetCount) {
		throw new Error('Item sprite asset count does not match the manifest.');
	}
	const totals = Object.values(manifest.assets).reduce(
		(result, entry) => ({
			byteSize: result.byteSize + entry.byteSize,
			gzipByteSize: result.gzipByteSize + entry.gzipByteSize
		}),
		{ byteSize: 0, gzipByteSize: 0 }
	);
	if (
		totals.byteSize !== manifest.summary.byteSize ||
		totals.gzipByteSize !== manifest.summary.gzipByteSize
	) {
		throw new Error('Item sprite totals do not match the manifest.');
	}

	console.log(JSON.stringify(manifest.summary, null, 2));
}
