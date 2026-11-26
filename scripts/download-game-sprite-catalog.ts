import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const revision = '2ecb4eeacd5a1718621fc30f12772e3f60d830b9';
const repository = 'https://github.com/PokeAPI/sprites';
const mappingSource =
	'https://github.com/PokeAPI/pokeapi/blob/8fe210b21c9abbe73de93670f3d5a346c80a3625/data/v2/csv/pokemon.csv';

type Family = { id: string; generation: number; maxSpecies: number; directory: string };

// Generation 1 and 2 top-level files are opaque, so their transparent copies are used.
const families: Family[] = [
	{
		id: 'red-blue',
		generation: 1,
		maxSpecies: 151,
		directory: 'generation-i/red-blue/transparent'
	},
	{ id: 'yellow', generation: 1, maxSpecies: 151, directory: 'generation-i/yellow/transparent' },
	{ id: 'gold', generation: 2, maxSpecies: 251, directory: 'generation-ii/gold/transparent' },
	{ id: 'silver', generation: 2, maxSpecies: 251, directory: 'generation-ii/silver/transparent' },
	{ id: 'crystal', generation: 2, maxSpecies: 251, directory: 'generation-ii/crystal/transparent' },
	{
		id: 'ruby-sapphire',
		generation: 3,
		maxSpecies: 386,
		directory: 'generation-iii/ruby-sapphire'
	},
	{ id: 'emerald', generation: 3, maxSpecies: 386, directory: 'generation-iii/emerald' },
	{
		id: 'firered-leafgreen',
		generation: 3,
		maxSpecies: 386,
		directory: 'generation-iii/firered-leafgreen'
	},
	{ id: 'diamond-pearl', generation: 4, maxSpecies: 493, directory: 'generation-iv/diamond-pearl' },
	{ id: 'platinum', generation: 4, maxSpecies: 493, directory: 'generation-iv/platinum' },
	{
		id: 'heartgold-soulsilver',
		generation: 4,
		maxSpecies: 493,
		directory: 'generation-iv/heartgold-soulsilver'
	},
	{ id: 'black-white', generation: 5, maxSpecies: 649, directory: 'generation-v/black-white' }
];

const variants = [
	{ subdirectory: '', isShiny: false, displaySex: 'default' },
	{ subdirectory: 'shiny', isShiny: true, displaySex: 'default' },
	{ subdirectory: 'female', isShiny: false, displaySex: 'female' },
	{ subdirectory: 'shiny/female', isShiny: true, displaySex: 'female' }
] as const;

type FormMapping = { species: number; form: number; minGeneration: number };

// Explicit PKHeX form ids. PokeAPI 10xxx ids come from pokemon.csv at mappingSource.
// Generation 3 stores no Deoxys or Castform form, so those mappings start at Generation 4.
// Arceus is left unmapped because its Generation 4 and 5 form order differs from later games.
const formMappings: Record<string, FormMapping> = {
	...Object.fromEntries(
		'bcdefghijklmnopqrstuvwxyz'
			.split('')
			.map((letter, index) => [
				`201-${letter}`,
				{ species: 201, form: index + 1, minGeneration: 2 }
			])
	),
	'201-exclamation': { species: 201, form: 26, minGeneration: 3 },
	'201-question': { species: 201, form: 27, minGeneration: 3 },
	'172-spiky-eared': { species: 172, form: 1, minGeneration: 4 },
	'412-sandy': { species: 412, form: 1, minGeneration: 4 },
	'412-trash': { species: 412, form: 2, minGeneration: 4 },
	'421-sunshine': { species: 421, form: 1, minGeneration: 4 },
	'422-east': { species: 422, form: 1, minGeneration: 4 },
	'423-east': { species: 423, form: 1, minGeneration: 4 },
	'585-summer': { species: 585, form: 1, minGeneration: 5 },
	'585-autumn': { species: 585, form: 2, minGeneration: 5 },
	'585-winter': { species: 585, form: 3, minGeneration: 5 },
	'586-summer': { species: 586, form: 1, minGeneration: 5 },
	'586-autumn': { species: 586, form: 2, minGeneration: 5 },
	'586-winter': { species: 586, form: 3, minGeneration: 5 },
	'649-douse': { species: 649, form: 1, minGeneration: 5 },
	'649-shock': { species: 649, form: 2, minGeneration: 5 },
	'649-burn': { species: 649, form: 3, minGeneration: 5 },
	'649-chill': { species: 649, form: 4, minGeneration: 5 },
	'10001': { species: 386, form: 1, minGeneration: 4 },
	'10002': { species: 386, form: 2, minGeneration: 4 },
	'10003': { species: 386, form: 3, minGeneration: 4 },
	'10004': { species: 413, form: 1, minGeneration: 4 },
	'10005': { species: 413, form: 2, minGeneration: 4 },
	'10006': { species: 492, form: 1, minGeneration: 4 },
	'10007': { species: 487, form: 1, minGeneration: 4 },
	'10008': { species: 479, form: 1, minGeneration: 4 },
	'10009': { species: 479, form: 2, minGeneration: 4 },
	'10010': { species: 479, form: 3, minGeneration: 4 },
	'10011': { species: 479, form: 4, minGeneration: 4 },
	'10012': { species: 479, form: 5, minGeneration: 4 },
	'10013': { species: 351, form: 1, minGeneration: 4 },
	'10014': { species: 351, form: 2, minGeneration: 4 },
	'10015': { species: 351, form: 3, minGeneration: 4 },
	'10016': { species: 550, form: 1, minGeneration: 5 },
	'10017': { species: 555, form: 1, minGeneration: 5 },
	'10018': { species: 648, form: 1, minGeneration: 5 },
	'10019': { species: 641, form: 1, minGeneration: 5 },
	'10020': { species: 642, form: 1, minGeneration: 5 },
	'10021': { species: 645, form: 1, minGeneration: 5 },
	'10022': { species: 646, form: 2, minGeneration: 5 },
	'10023': { species: 646, form: 1, minGeneration: 5 },
	'10024': { species: 647, form: 1, minGeneration: 5 }
};

type Entry = { sourcePath: string; width: number; height: number; byteSize: number };
type FamilyReport = {
	generation: number;
	sourceDirectory: string;
	assetCount: number;
	rawBytes: number;
	gzipBytes: number;
	unmappedSourceFiles: string[];
	entries: Record<string, Entry>;
};
type Report = {
	source: {
		name: string;
		repository: string;
		revision: string;
		mappingSource: string;
		license: string;
		imageCopyright: string;
	};
	totals: { assetCount: number; rawBytes: number; gzipBytes: number };
	families: Record<string, FamilyReport>;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(repoRoot, 'static/sprites/pokemon/game');
const reportPath = path.join(repoRoot, 'scripts/data/game-sprite-catalog.json');
const runtimePath = path.join(repoRoot, 'src/lib/pksx/sprite-catalog/game-catalog.generated.json');

function valueAfter(flag: string) {
	const index = args.indexOf(flag);
	return index === -1 ? null : path.resolve(args[index + 1] ?? '');
}

function spriteKey(species: number, form: number, displaySex: string, isShiny: boolean) {
	return `${String(species).padStart(4, '0')}-${String(form).padStart(2, '0')}-${displaySex}-${isShiny ? 'shiny' : 'normal'}`;
}

const eggKeys: Record<string, string> = { egg: 'egg', 'egg-manaphy': '0490-egg' };

function mapStem(stem: string, family: Family, variant: (typeof variants)[number]) {
	if (eggKeys[stem]) return variant.subdirectory === '' ? eggKeys[stem] : null;
	const numeric = /^\d+$/.test(stem) ? Number(stem) : null;
	const mapping =
		numeric !== null && numeric >= 1 && numeric <= family.maxSpecies
			? { species: numeric, form: 0, minGeneration: 1 }
			: formMappings[stem];
	if (!mapping || mapping.minGeneration > family.generation || mapping.species > family.maxSpecies)
		return null;
	return spriteKey(mapping.species, mapping.form, variant.displaySex, variant.isShiny);
}

async function acquire(localRoot: string | null) {
	const root = localRoot ?? (await sparseCheckout());
	const report: Report = {
		source: {
			name: 'PokeAPI/sprites',
			repository,
			revision,
			mappingSource,
			license: 'CC0-1.0',
			imageCopyright: 'Pokemon images are copyrighted by The Pokemon Company.'
		},
		totals: { assetCount: 0, rawBytes: 0, gzipBytes: 0 },
		families: {}
	};
	await rm(staticRoot, { recursive: true, force: true });

	for (const family of families) {
		const familyReport: FamilyReport = {
			generation: family.generation,
			sourceDirectory: `sprites/pokemon/versions/${family.directory}`,
			assetCount: 0,
			rawBytes: 0,
			gzipBytes: 0,
			unmappedSourceFiles: [],
			entries: {}
		};
		await mkdir(path.join(staticRoot, family.id), { recursive: true });

		for (const variant of variants) {
			const relative = path.posix.join(familyReport.sourceDirectory, variant.subdirectory);
			const directory = path.join(root, relative);
			if (!existsSync(directory)) continue;
			for (const file of (await readdir(directory))
				.filter((name) => name.endsWith('.png'))
				.sort()) {
				const stem = file.slice(0, -4);
				const key = mapStem(stem, family, variant);
				if (!key) {
					familyReport.unmappedSourceFiles.push(path.posix.join(variant.subdirectory, file));
					continue;
				}
				if (familyReport.entries[key]) throw new Error(`${family.id} maps ${key} twice.`);
				const target = path.join(staticRoot, family.id, `${key}.png`);
				await copyFile(path.join(directory, file), target);
				familyReport.entries[key] = describe(
					await readFile(target),
					path.posix.join(relative, file)
				);
			}
		}

		summarize(familyReport, await readFamilyBytes(family.id, familyReport));
		report.families[family.id] = familyReport;
	}

	addTotals(report);
	await writeOutputs(report);
	printSummary(report);
}

async function sparseCheckout() {
	const directory = await mkdtemp(path.join(tmpdir(), 'pksx-pokeapi-sprites-'));
	const git = (...gitArgs: string[]) =>
		execFileSync('git', gitArgs, { cwd: directory, stdio: 'inherit' });
	git('init', '-q');
	git('remote', 'add', 'origin', repository);
	git(
		'sparse-checkout',
		'set',
		'--no-cone',
		...families.flatMap((family) =>
			variants.map((variant) =>
				path.posix.join('sprites/pokemon/versions', family.directory, variant.subdirectory, '*.png')
			)
		)
	);
	git('fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', revision);
	git('checkout', '-q', 'FETCH_HEAD');
	return directory;
}

function describe(bytes: Buffer, sourcePath: string): Entry {
	if (bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${sourcePath} is not a PNG.`);
	return {
		sourcePath,
		width: bytes.readUInt32BE(16),
		height: bytes.readUInt32BE(20),
		byteSize: bytes.length
	};
}

async function readFamilyBytes(familyId: string, familyReport: FamilyReport) {
	return Promise.all(
		Object.keys(familyReport.entries).map((key) =>
			readFile(path.join(staticRoot, familyId, `${key}.png`))
		)
	);
}

function summarize(familyReport: FamilyReport, files: Buffer[]) {
	familyReport.assetCount = files.length;
	familyReport.rawBytes = files.reduce((sum, bytes) => sum + bytes.length, 0);
	familyReport.gzipBytes = files.reduce((sum, bytes) => sum + gzipSync(bytes).length, 0);
}

function addTotals(report: Report) {
	for (const family of Object.values(report.families)) {
		report.totals.assetCount += family.assetCount;
		report.totals.rawBytes += family.rawBytes;
		report.totals.gzipBytes += family.gzipBytes;
	}
}

// Compact runtime shape: per variant, space-separated `species` or `species-form` tokens.
function runtimeManifest(report: Report) {
	return Object.fromEntries(
		Object.entries(report.families).map(([id, family]) => {
			const variantTokens: Record<string, string[]> = {};
			const eggs: string[] = [];
			for (const key of Object.keys(family.entries).sort()) {
				const match = /^(\d{4})-(\d{2})-(\w+-\w+)$/.exec(key);
				if (!match) {
					eggs.push(key);
					continue;
				}
				const form = Number(match[2]);
				(variantTokens[match[3]] ??= []).push(`${Number(match[1])}${form ? `-${form}` : ''}`);
			}
			const variants = Object.fromEntries(
				Object.entries(variantTokens).map(([variant, tokens]) => [variant, tokens.join(' ')])
			);
			return [id, { generation: family.generation, variants, eggs }];
		})
	);
}

async function writeOutputs(report: Report) {
	await writeFile(reportPath, await formatJson(report));
	await writeFile(runtimePath, await formatJson(runtimeManifest(report)));
}

async function formatJson(value: unknown) {
	return format(JSON.stringify(value), { parser: 'json', useTabs: true, printWidth: 100 });
}

function printSummary(report: Report) {
	for (const [id, family] of Object.entries(report.families)) {
		console.log(
			`${id}: ${family.assetCount} assets, ${family.rawBytes} raw bytes, ${family.gzipBytes} gzip bytes, ${family.unmappedSourceFiles.length} unmapped source files`
		);
	}
	const { assetCount, rawBytes, gzipBytes } = report.totals;
	console.log(`Total: ${assetCount} assets, ${rawBytes} raw bytes, ${gzipBytes} gzip bytes.`);
}

async function validate() {
	const report = JSON.parse(await readFile(reportPath, 'utf8')) as Report;
	const problems: string[] = [];
	const expected: Report = { ...report, totals: { assetCount: 0, rawBytes: 0, gzipBytes: 0 } };

	for (const [id, family] of Object.entries(report.families)) {
		const onDisk = new Set(await readdir(path.join(staticRoot, id)));
		const copy = { ...family };
		for (const [key, entry] of Object.entries(family.entries)) {
			const file = `${key}.png`;
			if (!onDisk.delete(file)) {
				problems.push(`${id}/${file} is missing.`);
				continue;
			}
			const actual = describe(await readFile(path.join(staticRoot, id, file)), entry.sourcePath);
			if (JSON.stringify(actual) !== JSON.stringify(entry)) problems.push(`${id}/${file} changed.`);
		}
		for (const file of onDisk) problems.push(`${id}/${file} is not in the report.`);
		if (problems.length) break;
		summarize(copy, await readFamilyBytes(id, family));
		if (copy.rawBytes !== family.rawBytes || copy.gzipBytes !== family.gzipBytes)
			problems.push(`${id} totals are stale.`);
		expected.families[id] = copy;
	}

	addTotals(expected);
	if (JSON.stringify(expected.totals) !== JSON.stringify(report.totals))
		problems.push('Report totals are stale.');
	if ((await readFile(runtimePath, 'utf8')) !== (await formatJson(runtimeManifest(report))))
		problems.push('Runtime manifest does not match the report.');

	if (problems.length) {
		console.error(problems.join('\n'));
		process.exit(1);
	}
	printSummary(report);
}

const args = process.argv.slice(2);
if (args.includes('--validate')) await validate();
else await acquire(valueAfter('--sprites-root'));
