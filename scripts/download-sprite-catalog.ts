import { constants } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Mode = 'download' | 'validate';

type Options = {
	mode: Mode;
	force: boolean;
	limit: number | null;
	help: boolean;
};

type Species = {
	id: number;
	name: string;
	slug: string;
};

type CatalogEntry = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	name: string;
	slug: string;
	path: string;
	sourceUrl: string;
	sourceFamily: string;
	retrievedAt: string;
	width: number;
	height: number;
	byteSize: number;
};

type CatalogManifest = {
	generatedAt: string;
	source: {
		name: string;
		page: string;
		imageHost: string;
		selfHostingNote: string;
	};
	entries: Record<string, CatalogEntry>;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(repoRoot, 'static/sprites/pokemon');
const speciesRoot = path.join(assetRoot, 'species');
const manifestPath = path.join(assetRoot, 'catalog.json');
const generatedManifestPath = path.join(
	repoRoot,
	'src/lib/pksx/sprite-catalog/catalog.generated.json'
);
const pokemonDbBaseUrl = 'https://pokemondb.net';
const pokemonDbImageBaseUrl = 'https://img.pokemondb.net';
const preferredSourceFamilies = [
	'scarlet-violet',
	'brilliant-diamond-shining-pearl',
	'sword-shield',
	'lets-go-pikachu-eevee',
	'ultra-sun-ultra-moon',
	'sun-moon',
	'x-y',
	'black-white',
	'heartgold-soulsilver',
	'platinum',
	'diamond-pearl',
	'emerald',
	'firered-leafgreen',
	'ruby-sapphire',
	'crystal',
	'gold',
	'silver',
	'yellow',
	'red-blue',
	'home'
];

const options = parseArgs(process.argv.slice(2));

if (options.help) {
	printHelp();
	process.exit(0);
}

if (options.mode === 'validate') {
	await validateManifest();
} else {
	await downloadCatalog(options);
}

async function downloadCatalog(options: Options): Promise<void> {
	const retrievedAt = new Date().toISOString();
	const species = await fetchSpeciesList();
	const selectedSpecies = options.limit === null ? species : species.slice(0, options.limit);

	await mkdir(speciesRoot, { recursive: true });

	const entries: Record<string, CatalogEntry> = {};
	const failures: string[] = [];

	for (let index = 0; index < selectedSpecies.length; index += 1) {
		const item = selectedSpecies[index];
		const prefix = `[${String(index + 1).padStart(4, '0')}/${selectedSpecies.length}]`;

		try {
			const source = await resolveSpriteSource(item);
			const fileName = `${String(item.id).padStart(4, '0')}.png`;
			const filePath = path.join(speciesRoot, fileName);
			const publicPath = `/sprites/pokemon/species/${fileName}`;

			if (options.force || !(await fileExists(filePath))) {
				const image = await fetchBinary(source.url);
				await writeFile(filePath, image);
			}

			const image = await readFile(filePath);
			const dimensions = readImageDimensions(image);
			const fileStats = await stat(filePath);
			const key = createCatalogKey({ speciesId: item.id, form: 0, isEgg: false });

			entries[key] = {
				speciesId: item.id,
				form: 0,
				isEgg: false,
				name: item.name,
				slug: item.slug,
				path: publicPath,
				sourceUrl: source.url,
				sourceFamily: source.family,
				retrievedAt,
				width: dimensions.width,
				height: dimensions.height,
				byteSize: fileStats.size
			};

			console.log(`${prefix} ${item.name}: ${source.family}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${item.id} ${item.name}: ${message}`);
			console.error(`${prefix} ${item.name}: ${message}`);
		}
	}

	if (failures.length > 0) {
		fail(`Sprite download failed for ${failures.length} species:\n${failures.join('\n')}`);
	}

	const manifest: CatalogManifest = {
		generatedAt: retrievedAt,
		source: {
			name: 'PokemonDB sprite gallery',
			page: `${pokemonDbBaseUrl}/sprites`,
			imageHost: pokemonDbImageBaseUrl,
			selfHostingNote:
				'PokemonDB permits saving sprite images and uploading them to your own hosting as an alternative to hotlinking. PKSX packages these files locally and does not hotlink PokemonDB at runtime.'
		},
		entries
	};

	await writeJson(manifestPath, manifest);
	await writeJson(generatedManifestPath, manifest);
	await validateManifest();

	console.log(
		`Downloaded ${Object.keys(entries).length} Sprite Catalog entries to ${path.relative(
			repoRoot,
			assetRoot
		)}`
	);
}

async function validateManifest(): Promise<void> {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CatalogManifest;
	const generatedManifest = JSON.parse(
		await readFile(generatedManifestPath, 'utf8')
	) as CatalogManifest;
	const errors: string[] = [];

	if (JSON.stringify(generatedManifest) !== JSON.stringify(manifest)) {
		errors.push(`${path.relative(repoRoot, generatedManifestPath)} does not match catalog.json`);
	}

	for (const [key, entry] of Object.entries(manifest.entries)) {
		const expectedKey = createCatalogKey(entry);
		if (key !== expectedKey) {
			errors.push(`${key} should be ${expectedKey}`);
		}

		if (!entry.path.startsWith('/sprites/pokemon/')) {
			errors.push(`${key} has non-local path ${entry.path}`);
		}

		if (entry.sourceUrl.includes('/shiny/') || entry.sourceUrl.includes('/back-')) {
			errors.push(`${key} uses out-of-scope sprite URL ${entry.sourceUrl}`);
		}

		const filePath = path.join(repoRoot, 'static', entry.path);
		if (!(await fileExists(filePath))) {
			errors.push(`${key} missing ${entry.path}`);
			continue;
		}

		const fileStats = await stat(filePath);
		if (fileStats.size !== entry.byteSize) {
			errors.push(`${key} byte size ${entry.byteSize} does not match ${fileStats.size}`);
		}
	}

	if (errors.length > 0) {
		fail(`Sprite Catalog validation failed:\n${errors.join('\n')}`);
	}

	console.log(`Validated ${Object.keys(manifest.entries).length} Sprite Catalog entries.`);
}

async function fetchSpeciesList(): Promise<Species[]> {
	const html = await fetchText(`${pokemonDbBaseUrl}/pokedex/national`);
	const species: Species[] = [];
	const seen = new Set<number>();
	const pattern =
		/<small>#(?<id>\d{4})<\/small>[\s\S]*?<a class="ent-name" href="\/pokedex\/(?<slug>[^"]+)">(?<name>[^<]+)<\/a>/g;

	for (const match of html.matchAll(pattern)) {
		const id = Number(match.groups?.id);
		const slug = decodeHtml(match.groups?.slug ?? '');
		const name = decodeHtml(match.groups?.name ?? '');

		if (!Number.isInteger(id) || id < 1 || slug.length === 0 || name.length === 0 || seen.has(id)) {
			continue;
		}

		seen.add(id);
		species.push({ id, name, slug });
	}

	if (species.length < 1_000) {
		fail(`Expected at least 1000 Pokemon species from PokemonDB, found ${species.length}.`);
	}

	return species.sort((left, right) => left.id - right.id);
}

async function resolveSpriteSource(species: Species): Promise<{ url: string; family: string }> {
	const [preferredFamily] = preferredSourceFamilies;
	const directUrl = `${pokemonDbImageBaseUrl}/sprites/${preferredFamily}/normal/${species.slug}.png`;
	if (await remoteFileExists(directUrl)) {
		return { url: directUrl, family: preferredFamily };
	}

	const pageHtml = await fetchText(`${pokemonDbBaseUrl}/sprites/${species.slug}`);
	const normalSpriteUrls = [
		...pageHtml.matchAll(
			/https:\/\/img\.pokemondb\.net\/sprites\/(?<family>[^/]+)\/(?:dex\/)?normal\/(?:1x\/|2x\/)?(?<file>[^"]+\.(?:png|jpg))/g
		)
	]
		.map((match) => ({
			url: match[0].replace('/1x/', '/').replace('/2x/', '/'),
			family: match.groups?.family ?? ''
		}))
		.filter((source) => source.url.endsWith('.png'));

	for (const family of preferredSourceFamilies) {
		const source =
			normalSpriteUrls.find(
				(candidate) => candidate.family === family && candidate.url.endsWith(`/${species.slug}.png`)
			) ?? normalSpriteUrls.find((candidate) => candidate.family === family);
		if (source) {
			return source;
		}
	}

	throw new Error(`No normal front sprite found for ${species.slug}.`);
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'PKSX Sprite Catalog maintainer script (https://github.com/woahitsraj/pksx)'
		}
	});

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return response.text();
}

async function fetchBinary(url: string): Promise<Buffer> {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'PKSX Sprite Catalog maintainer script (https://github.com/woahitsraj/pksx)'
		}
	});

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return Buffer.from(await response.arrayBuffer());
}

async function remoteFileExists(url: string): Promise<boolean> {
	const response = await fetch(url, {
		method: 'HEAD',
		headers: {
			'user-agent': 'PKSX Sprite Catalog maintainer script (https://github.com/woahitsraj/pksx)'
		}
	});

	return response.ok;
}

function readImageDimensions(image: Buffer): { width: number; height: number } {
	if (image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return {
			width: image.readUInt32BE(16),
			height: image.readUInt32BE(20)
		};
	}

	if (image.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
		return readJpegDimensions(image);
	}

	throw new Error('Unsupported image format.');
}

function readJpegDimensions(image: Buffer): { width: number; height: number } {
	let offset = 2;

	while (offset < image.length) {
		if (image[offset] !== 0xff) {
			throw new Error('Invalid JPEG marker.');
		}

		const marker = image[offset + 1];
		const length = image.readUInt16BE(offset + 2);

		if (marker >= 0xc0 && marker <= 0xc3) {
			return {
				height: image.readUInt16BE(offset + 5),
				width: image.readUInt16BE(offset + 7)
			};
		}

		offset += 2 + length;
	}

	throw new Error('JPEG dimensions not found.');
}

function createCatalogKey(identity: { speciesId: number; form: number; isEgg: boolean }): string {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	const egg = identity.isEgg ? 'egg' : 'normal';

	return `species-${species}-form-${form}-${egg}`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, '\t')}\n`);
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

function parseArgs(args: string[]): Options {
	const parsed: Options = {
		mode: 'download',
		force: false,
		limit: null,
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

		if (arg === '--validate') {
			parsed.mode = 'validate';
			continue;
		}

		if (arg === '--force') {
			parsed.force = true;
			continue;
		}

		if (arg === '--limit') {
			parsed.limit = readPositiveInteger(args, (index += 1), arg);
			continue;
		}

		if (arg.startsWith('--limit=')) {
			parsed.limit = parsePositiveInteger(arg.slice('--limit='.length), '--limit');
			continue;
		}

		fail(`Unknown argument: ${arg}`);
	}

	return parsed;
}

function readPositiveInteger(args: string[], index: number, flag: string): number {
	const value = args[index];

	if (value === undefined || value.startsWith('-')) {
		fail(`Missing value for ${flag}.`);
	}

	return parsePositiveInteger(value, flag);
}

function parsePositiveInteger(value: string, flag: string): number {
	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < 1) {
		fail(`${flag} must be a positive integer.`);
	}

	return parsed;
}

function decodeHtml(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&#039;', "'")
		.replaceAll('&quot;', '"')
		.replaceAll('&female;', '♀')
		.replaceAll('&male;', '♂');
}

function printHelp(): void {
	console.log(`Download the offline Sprite Catalog from PokemonDB.

Usage:
  pnpm sprites:download
  pnpm sprites:download -- --force
  pnpm sprites:download -- --limit 25
  pnpm sprites:validate

Options:
  --force       Redownload images even when local files already exist.
  --limit <n>   Download only the first n species. Useful while testing script changes.
  --validate    Validate the committed manifest and static files without network crawling.
  -h, --help    Show this help.
`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}
