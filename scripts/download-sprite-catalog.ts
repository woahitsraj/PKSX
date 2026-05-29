import { constants } from 'node:fs';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkhexFormNames from './data/pkhex-form-names.generated.json' with { type: 'json' };

type Mode = 'download' | 'validate';

type Options = {
	mode: Mode;
	force: boolean;
	limit: number | null;
	report: boolean;
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
	isShiny: boolean;
	displaySex: DisplaySex;
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

type DisplaySex = 'default' | 'male' | 'female';
type SpriteSource = {
	url: string;
	family: string;
	isShiny: boolean;
	fileSlug: string;
};
type SpriteIdentity = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: DisplaySex;
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
	'home',
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
	'red-blue'
];
const sourceFamily = 'home';
const formNamesBySpecies = pkhexFormNames as Record<string, string[]>;
const formSlugAliases: Record<string, string[]> = {
	original: ['original-cap'],
	hoenn: ['hoenn-cap'],
	sinnoh: ['sinnoh-cap'],
	unova: ['unova-cap'],
	kalos: ['kalos-cap'],
	'alola': ['alolan', 'alola-cap'],
	partner: ['partner-cap'],
	world: ['world-cap'],
	paldea: ['paldean'],
	hisui: ['hisuian'],
	male: ['m'],
	female: ['f'],
	'!': ['em'],
	'?': ['qm'],
	'paldea-combat': ['paldean-combat'],
	'paldea-blaze': ['paldean-blaze'],
	'paldea-aqua': ['paldean-aqua'],
	'standard': ['standard-mode'],
	'galar': ['galarian', 'galarian-standard'],
	'galar-zen': ['galarian-zen'],
	'land': ['land-forme'],
	'sky': ['sky-forme'],
	'ordinary': ['ordinary-form'],
	'resolute': ['resolute-form'],
	'aria': ['aria-forme'],
	'pirouette': ['pirouette-forme'],
	'50': ['50-percent'],
	'10': ['10-percent'],
	'10-c': ['10-complete'],
	'50-c': ['50-complete'],
	'complete': ['complete-forme'],
	'pa-u': ['pau'],
	red: ['red-striped'],
	blue: ['blue-striped'],
	white: ['white-striped'],
	water: ['douse'],
	electric: ['shock'],
	fire: ['burn'],
	ice: ['chill', 'ice-rider'],
	shadow: ['shadow-rider'],
	medium: ['average'],
	jumbo: ['super'],
	dusk: ['dusk-mane'],
	dawn: ['dawn-wings'],
	'amped-form': ['amped'],
	'ice-face': ['ice'],
	'noice-face': ['noice'],
	'full-belly': ['full-belly-mode'],
	'single-strike': ['single-strike-style'],
	'rapid-strike': ['rapid-strike-style'],
	'family-of-three': ['family3'],
	'family-of-four': ['family4'],
	'two-segment': ['two-segment-form'],
	'three-segment': ['three-segment-form']
};
const unsupportedHomeFormSuffixes = new Set([
	'active',
	'eternamax',
	'gigantamax',
	'mega',
	'mega-x',
	'mega-y',
	'primal',
	'ultra'
]);
const alcremieDecorationSuffixes = new Set([
	'berry',
	'clover',
	'flower',
	'love',
	'ribbon',
	'star',
	'strawberry'
]);

const options = parseArgs(process.argv.slice(2));

if (options.help) {
	printHelp();
	process.exit(0);
}

if (options.report) {
	await reportCatalogCompatibility(options);
} else if (options.mode === 'validate') {
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
			const sources = await resolveSpriteSources(item);

			for (const source of sources) {
				if (isUnsupportedHomeSource(item, source)) {
					continue;
				}

				const identities = createIdentitiesFromHomeSource(item, source);

				for (const identity of identities) {
					const fileName = createAssetFileName(identity);
					const filePath = path.join(speciesRoot, fileName);
					const publicPath = `/sprites/pokemon/species/${fileName}`;

					if (options.force || !(await fileExists(filePath))) {
						const image = await fetchBinary(source.url);
						await writeFile(filePath, image);
					}

					const image = await readFile(filePath);
					const dimensions = readImageDimensions(image);
					const fileStats = await stat(filePath);
					const key = createCatalogKey(identity);

					if (entries[key]) {
						fail(
							`Duplicate Sprite Catalog identity ${key} from ${entries[key].sourceUrl} and ${source.url}`
						);
					}

					entries[key] = {
						speciesId: item.id,
						form: identity.form,
						isEgg: false,
						isShiny: identity.isShiny,
						displaySex: identity.displaySex,
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
				}
			}

			const variants = sources.length / 2;
			console.log(`${prefix} ${item.name}: ${sources.length} ${sourceFamily} sprites`);
			if (!Number.isInteger(variants)) {
				console.log(`${prefix} ${item.name}: normal/shiny variant count differs`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${item.id} ${item.name}: ${message}`);
			console.error(`${prefix} ${item.name}: ${message}`);
		}
	}

	if (failures.length > 0) {
		fail(`Sprite download failed for ${failures.length} species:\n${failures.join('\n')}`);
	}

	await pruneUnreferencedSpeciesFiles(new Set(Object.values(entries).map((entry) => entry.path)));

	const manifest: CatalogManifest = {
		generatedAt: retrievedAt,
		source: {
			name: 'PokemonDB HOME sprite gallery',
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

function isUnsupportedHomeSource(species: Species, source: SpriteSource): boolean {
	const suffix = source.fileSlug === species.slug ? '' : source.fileSlug.slice(species.slug.length + 1);
	if (species.id === 869 && !suffix.endsWith('-strawberry')) {
		return true;
	}

	return (
		unsupportedHomeFormSuffixes.has(suffix) ||
		suffix.endsWith('-gigantamax') ||
		suffix.endsWith('-mega')
	);
}

async function pruneUnreferencedSpeciesFiles(referencedPaths: Set<string>): Promise<void> {
	const referencedFiles = new Set(
		[...referencedPaths].map((entryPath) => path.join(repoRoot, 'static', entryPath))
	);
	const speciesFiles = await listFiles(speciesRoot);

	for (const filePath of speciesFiles) {
		if (!referencedFiles.has(filePath)) {
			await rm(filePath);
		}
	}
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

		if (entry.sourceUrl.includes('/back-')) {
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

	const referencedSpeciesFiles = new Set(
		Object.values(manifest.entries)
			.map((entry) => entry.path)
			.filter((entryPath) => entryPath.startsWith('/sprites/pokemon/species/'))
			.map((entryPath) => path.join(repoRoot, 'static', entryPath))
	);
	const speciesFiles = await listFiles(speciesRoot);
	for (const filePath of speciesFiles) {
		if (!referencedSpeciesFiles.has(filePath)) {
			errors.push(`${path.relative(repoRoot, filePath)} is not referenced by catalog.json`);
		}
	}

	if (errors.length > 0) {
		fail(`Sprite Catalog validation failed:\n${errors.join('\n')}`);
	}

	console.log(`Validated ${Object.keys(manifest.entries).length} Sprite Catalog entries.`);
}

async function reportCatalogCompatibility(options: Options): Promise<void> {
	const species = await fetchSpeciesList();
	const selectedSpecies = options.limit === null ? species : species.slice(0, options.limit);
	let mappedSprites = 0;
	let unsupportedSprites = 0;
	let mappedSpecies = 0;
	let missingSpecies = 0;
	const failures: string[] = [];

	for (const item of selectedSpecies) {
		const sources = await resolveSpriteSources(item).catch(() => null);
		if (sources) {
			mappedSpecies += 1;
			for (const source of sources) {
				if (isUnsupportedHomeSource(item, source)) {
					unsupportedSprites += 1;
					continue;
				}

				try {
					mappedSprites += createIdentitiesFromHomeSource(item, source).length;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					failures.push(`${item.id} ${item.name}: ${message}`);
				}
			}
		} else {
			missingSpecies += 1;
		}
	}

	console.log(`Sprite Catalog compatibility report`);
	console.log(`Default source family: ${sourceFamily}`);
	console.log(`Fallback-capable source family order: ${preferredSourceFamilies.join(', ')}`);
	console.log(`Species checked: ${selectedSpecies.length}`);
	console.log(`Species with HOME assets: ${mappedSpecies}`);
	console.log(`Species missing HOME assets: ${missingSpecies}`);
	console.log(`HOME sprite URLs mapped: ${mappedSprites}`);
	console.log(`HOME sprite URLs skipped as unsupported: ${unsupportedSprites}`);
	if (failures.length > 0) {
		fail(`Sprite Catalog compatibility failures:\n${failures.join('\n')}`);
	}
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

async function resolveSpriteSources(species: Species): Promise<SpriteSource[]> {
	const pageHtml = await fetchText(`${pokemonDbBaseUrl}/sprites/${species.slug}`);
	const deduped = new Map<string, SpriteSource>();
	const spriteUrls = [
		...pageHtml.matchAll(
			/https:\/\/img\.pokemondb\.net\/sprites\/(?<family>[^/]+)\/(?:dex\/)?(?<variant>normal|shiny)\/(?:1x\/|2x\/)?(?<file>[^"]+\.(?:png|jpg))/g
		)
	]
		.map((match) => ({
			url: match[0].replace('/1x/', '/').replace('/2x/', '/'),
			family: match.groups?.family ?? '',
			isShiny: match.groups?.variant === 'shiny',
			fileSlug: path.basename(match.groups?.file ?? '', '.png')
		}))
		.filter((source) => source.family === sourceFamily && source.url.endsWith('.png'));

	for (const source of spriteUrls) {
		deduped.set(source.url, source);
	}

	const sources = [...deduped.values()].sort((left, right) => {
		if (left.isShiny !== right.isShiny) {
			return left.isShiny ? 1 : -1;
		}

		return left.fileSlug.localeCompare(right.fileSlug);
	});

	if (sources.length === 0) {
		throw new Error(`No ${sourceFamily} front sprites found for ${species.slug}.`);
	}

	if (!sources.some((source) => !source.isShiny)) {
		throw new Error(`No ${sourceFamily} normal front sprites found for ${species.slug}.`);
	}

	return sources;
}

function createIdentitiesFromHomeSource(species: Species, source: SpriteSource): SpriteIdentity[] {
	const suffix = source.fileSlug === species.slug ? '' : source.fileSlug.slice(species.slug.length + 1);
	const canonicalSuffix = stripIgnoredFormArgumentSuffix(species, suffix);

	return resolvePkhexForms(species, canonicalSuffix).map((form) => ({
		speciesId: species.id,
		form,
		isEgg: false,
		isShiny: source.isShiny,
		displaySex: resolveDisplaySex(canonicalSuffix)
	}));
}

function stripIgnoredFormArgumentSuffix(species: Species, suffix: string): string {
	if (species.id !== 869) {
		return suffix;
	}

	const parts = suffix.split('-');
	const decoration = parts.at(-1);
	if (decoration && alcremieDecorationSuffixes.has(decoration)) {
		return parts.slice(0, -1).join('-');
	}

	return suffix;
}

function resolvePkhexForms(species: Species, suffix: string): number[] {
	const names = formNamesBySpecies[String(species.id)] ?? ['Normal'];
	const candidates = createFormSlugCandidates(names);

	if (suffix === '') {
		return [0];
	}

	const matchedForm = candidates.get(suffix);
	if (matchedForm !== undefined) {
		return [matchedForm];
	}

	const sexlessSuffix = stripTrailingSexSuffix(suffix);
	if (sexlessSuffix !== suffix) {
		const matchedSexlessForm = candidates.get(sexlessSuffix);
		if (matchedSexlessForm !== undefined) {
			return [matchedSexlessForm];
		}
	}

	if (species.id === 774) {
		return resolveMiniorForms(suffix);
	}

	if (suffix === 'f' || suffix === 'm') {
		return [0];
	}

	throw new Error(
		`Could not map ${species.slug}-${suffix}.png to a PKHeX form. Known forms: ${names.join(', ')}`
	);
}

function resolveMiniorForms(suffix: string): number[] {
	if (suffix === 'meteor') {
		return [0, 1, 2, 3, 4, 5, 6];
	}

	if (suffix === 'core') {
		return [7, 8, 9, 10, 11, 12, 13];
	}

	const coreColors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];
	const color = suffix.replace(/-core$/, '');
	const colorIndex = coreColors.indexOf(color);
	if (colorIndex >= 0) {
		return [7 + colorIndex];
	}

	throw new Error(`Could not map minior-${suffix}.png to a PKHeX form.`);
}

function stripTrailingSexSuffix(suffix: string): string {
	if (suffix.endsWith('-f')) {
		return suffix.slice(0, -2);
	}

	if (suffix.endsWith('-m')) {
		return suffix.slice(0, -2);
	}

	if (suffix.endsWith('-female')) {
		return suffix.slice(0, -'-female'.length);
	}

	if (suffix.endsWith('-male')) {
		return suffix.slice(0, -'-male'.length);
	}

	return suffix;
}

function createFormSlugCandidates(names: string[]): Map<string, number> {
	const candidates = new Map<string, number>();

	for (const [index, name] of names.entries()) {
		for (const slug of createNameSlugCandidates(name)) {
			candidates.set(slug, index);
		}
	}

	return candidates;
}

function createNameSlugCandidates(name: string): string[] {
	const base = slugifyFormName(name);
	const aliases = formSlugAliases[base] ?? [];

	return [base, ...aliases];
}

function slugifyFormName(name: string): string {
	if (name === '!') {
		return '!';
	}

	if (name === '?') {
		return '?';
	}

	return name
		.replaceAll('*', '')
		.replaceAll('♂', 'male')
		.replaceAll('♀', 'female')
		.normalize('NFKD')
		.replaceAll(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replaceAll('&', 'and')
		.replaceAll('%', '')
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');
}

function resolveDisplaySex(suffix: string): DisplaySex {
	if (suffix === 'f' || suffix === 'female') {
		return 'female';
	}

	if (suffix === 'm' || suffix === 'male') {
		return 'male';
	}

	if (suffix.endsWith('-f') || suffix.endsWith('-female')) {
		return 'female';
	}

	if (suffix.endsWith('-m') || suffix.endsWith('-male')) {
		return 'male';
	}

	return 'default';
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

function createCatalogKey(identity: {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: DisplaySex;
}): string {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	const variant = identity.isShiny ? 'shiny' : 'normal';

	return `species-${species}-form-${form}-sex-${identity.displaySex}-${identity.isEgg ? 'egg' : variant}`;
}

function createAssetFileName(identity: {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: DisplaySex;
}): string {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	const variant = identity.isEgg ? 'egg' : identity.isShiny ? 'shiny' : 'normal';

	return `${species}-form-${form}-sex-${identity.displaySex}-${variant}.png`;
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

async function listFiles(directory: string): Promise<string[]> {
	try {
		const { readdir } = await import('node:fs/promises');
		const entries = await readdir(directory, { withFileTypes: true });

		return entries
			.filter((entry) => entry.isFile())
			.map((entry) => path.join(directory, entry.name))
			.sort();
	} catch {
		return [];
	}
}

function parseArgs(args: string[]): Options {
	const parsed: Options = {
		mode: 'download',
		force: false,
		limit: null,
		report: false,
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

		if (arg === '--report') {
			parsed.report = true;
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
  pnpm sprites:download -- --report

Options:
  --force       Redownload images even when local files already exist.
  --limit <n>   Download only the first n species. Useful while testing script changes.
  --validate    Validate the committed manifest and static files without network crawling.
  --report      Print a source compatibility report without writing files.
  -h, --help    Show this help.
`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}
