import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import sharp from 'sharp';

type Platform = 'gb' | 'gbc' | 'gba' | 'nds' | '3ds' | 'gcn' | 'wii' | 'switch';

// One pinned libretro-thumbnails repository per system. Switch has none.
const repositories: Record<Exclude<Platform, 'switch'>, { name: string; revision: string }> = {
	gb: { name: 'Nintendo_-_Game_Boy', revision: 'f033af49af2d9761d6821aff479bb0ba5feea5e3' },
	gbc: { name: 'Nintendo_-_Game_Boy_Color', revision: '0931985ba8a3a9f38fb87f006611a13dc094260f' },
	gba: {
		name: 'Nintendo_-_Game_Boy_Advance',
		revision: '23b8665408e767fd3220bfb83fd5ad8dfe1a9aa1'
	},
	nds: { name: 'Nintendo_-_Nintendo_DS', revision: 'a119dcab8fa04c9974b9c229eda824318d923322' },
	'3ds': { name: 'Nintendo_-_Nintendo_3DS', revision: 'a1e242aca9d194ba7c168e38e14c637ff206189f' },
	gcn: { name: 'Nintendo_-_GameCube', revision: 'c0e778f3242811f31f4815ff2807022c1c5ac7bd' },
	wii: { name: 'Nintendo_-_Wii', revision: '1a44c6f4251dc9ef051043f22f8d9df4237c1ee8' }
};

// Cover id -> [platform, title, exact file name under Named_Boxarts].
const covers: Record<string, [Exclude<Platform, 'switch'>, string, string]> = {
	red: ['gb', 'Pokemon Red', 'Pokemon - Red Version (USA, Europe) (SGB Enhanced)'],
	blue: ['gb', 'Pokemon Blue', 'Pokemon - Blue Version (USA, Europe) (SGB Enhanced)'],
	yellow: [
		'gb',
		'Pokemon Yellow',
		'Pokemon - Yellow Version - Special Pikachu Edition (USA, Europe) (CGB+SGB Enhanced)'
	],
	gold: [
		'gbc',
		'Pokemon Gold',
		'Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible)'
	],
	silver: [
		'gbc',
		'Pokemon Silver',
		'Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible)'
	],
	crystal: ['gbc', 'Pokemon Crystal', 'Pokemon - Crystal Version (USA)'],
	ruby: ['gba', 'Pokemon Ruby', 'Pokemon - Ruby Version (USA, Europe)'],
	sapphire: ['gba', 'Pokemon Sapphire', 'Pokemon - Sapphire Version (USA, Europe)'],
	emerald: ['gba', 'Pokemon Emerald', 'Pokemon - Emerald Version (USA, Europe)'],
	firered: ['gba', 'Pokemon FireRed', 'Pokemon - FireRed Version (USA, Europe)'],
	leafgreen: ['gba', 'Pokemon LeafGreen', 'Pokemon - LeafGreen Version (USA, Europe)'],
	diamond: ['nds', 'Pokemon Diamond', 'Pokemon - Diamond Version (USA) (Rev 5)'],
	pearl: ['nds', 'Pokemon Pearl', 'Pokemon - Pearl Version (USA) (Rev 5)'],
	platinum: ['nds', 'Pokemon Platinum', 'Pokemon - Platinum Version (USA)'],
	heartgold: ['nds', 'Pokemon HeartGold', 'Pokemon - HeartGold Version (USA)'],
	soulsilver: ['nds', 'Pokemon SoulSilver', 'Pokemon - SoulSilver Version (USA)'],
	black: ['nds', 'Pokemon Black', 'Pokemon - Black Version (USA, Europe) (NDSi Enhanced)'],
	white: ['nds', 'Pokemon White', 'Pokemon - White Version (USA, Europe) (NDSi Enhanced)'],
	'black-2': ['nds', 'Pokemon Black 2', 'Pokemon - Black Version 2 (USA, Europe) (NDSi Enhanced)'],
	'white-2': ['nds', 'Pokemon White 2', 'Pokemon - White Version 2 (USA, Europe) (NDSi Enhanced)'],
	x: ['3ds', 'Pokemon X', 'Pokemon X (USA) (En,Ja,Fr,De,Es,It,Ko)'],
	y: ['3ds', 'Pokemon Y', 'Pokemon Y (USA) (En,Ja,Fr,De,Es,It,Ko)'],
	'omega-ruby': ['3ds', 'Pokemon Omega Ruby', 'Pokemon Omega Ruby (USA) (En,Ja,Fr,De,Es,It,Ko)'],
	'alpha-sapphire': [
		'3ds',
		'Pokemon Alpha Sapphire',
		'Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko)'
	],
	sun: ['3ds', 'Pokemon Sun', 'Pokemon Sun (USA) (En,Ja,Fr,De,Es,It,Zh,Ko)'],
	moon: ['3ds', 'Pokemon Moon', 'Pokemon Moon (USA) (En,Ja,Fr,De,Es,It,Zh,Ko)'],
	'ultra-sun': ['3ds', 'Pokemon Ultra Sun', 'Pokemon Ultra Sun (USA) (En,Ja,Fr,De,Es,It,Zh,Ko)'],
	'ultra-moon': ['3ds', 'Pokemon Ultra Moon', 'Pokemon Ultra Moon (USA) (En,Ja,Fr,De,Es,It,Zh,Ko)'],
	'box-ruby-sapphire': ['gcn', 'Pokemon Box Ruby / Sapphire', 'Pokemon Box_ Ruby _ Sapphire (USA)'],
	colosseum: ['gcn', 'Pokemon Colosseum', 'Pokemon Colosseum (USA)'],
	xd: ['gcn', 'Pokemon XD', 'Pokemon XD - Gale of Darkness (USA)'],
	'battle-revolution': ['wii', 'Pokemon Battle Revolution', 'Pokemon Battle Revolution (USA)']
};

// Engine game version -> [platform, cover ids]. A paired version lists both covers.
const versions: Record<string, [Platform, ...string[]]> = {
	RD: ['gb', 'red'],
	BU: ['gb', 'blue'],
	GN: ['gb'], // Green in Japan, Blue elsewhere: no safe single cover.
	YW: ['gb', 'yellow'],
	RB: ['gb', 'red', 'blue'],
	RBY: ['gb'],
	GD: ['gbc', 'gold'],
	SI: ['gbc', 'silver'],
	GS: ['gbc', 'gold', 'silver'],
	C: ['gbc', 'crystal'],
	GSC: ['gbc'],
	R: ['gba', 'ruby'],
	S: ['gba', 'sapphire'],
	RS: ['gba', 'ruby', 'sapphire'],
	E: ['gba', 'emerald'],
	// The engine reports FR for a FireRed or LeafGreen Save File.
	FR: ['gba', 'firered', 'leafgreen'],
	LG: ['gba', 'leafgreen'],
	FRLG: ['gba', 'firered', 'leafgreen'],
	'Pokémon Unbound': ['gba'],
	D: ['nds', 'diamond'],
	P: ['nds', 'pearl'],
	DP: ['nds', 'diamond', 'pearl'],
	Pt: ['nds', 'platinum'],
	HG: ['nds', 'heartgold'],
	SS: ['nds', 'soulsilver'],
	HGSS: ['nds', 'heartgold', 'soulsilver'],
	B: ['nds', 'black'],
	W: ['nds', 'white'],
	BW: ['nds', 'black', 'white'],
	B2: ['nds', 'black-2'],
	W2: ['nds', 'white-2'],
	B2W2: ['nds', 'black-2', 'white-2'],
	X: ['3ds', 'x'],
	Y: ['3ds', 'y'],
	XY: ['3ds', 'x', 'y'],
	OR: ['3ds', 'omega-ruby'],
	AS: ['3ds', 'alpha-sapphire'],
	ORAS: ['3ds', 'omega-ruby', 'alpha-sapphire'],
	SN: ['3ds', 'sun'],
	MN: ['3ds', 'moon'],
	SM: ['3ds', 'sun', 'moon'],
	US: ['3ds', 'ultra-sun'],
	UM: ['3ds', 'ultra-moon'],
	USUM: ['3ds', 'ultra-sun', 'ultra-moon'],
	RSBOX: ['gcn', 'box-ruby-sapphire'],
	COLO: ['gcn', 'colosseum'],
	XD: ['gcn', 'xd'],
	BATREV: ['wii', 'battle-revolution'],
	GP: ['switch'],
	GE: ['switch'],
	GG: ['switch'],
	SW: ['switch'],
	SH: ['switch'],
	SWSH: ['switch'],
	BD: ['switch'],
	SP: ['switch'],
	BDSP: ['switch'],
	PLA: ['switch'],
	SL: ['switch'],
	VL: ['switch'],
	SV: ['switch'],
	ZA: ['switch']
};

type CoverEntry = {
	title: string;
	platform: Platform;
	path: string;
	sourceUrl: string;
	width: number;
	height: number;
	byteSize: number;
};
type Manifest = {
	source: {
		name: string;
		url: string;
		imageCopyright: string;
		repositories: Record<string, { repository: string; revision: string }>;
	};
	summary: {
		coverCount: number;
		byteSize: number;
		versionCount: number;
		unmappedVersions: string[];
	};
	covers: Record<string, CoverEntry>;
	versions: Record<string, { platform: Platform; covers: string[] }>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artDirectory = path.join(root, 'static/game-art');
const manifestPath = path.join(root, 'src/lib/pksx/game-art-catalog/catalog.generated.json');
const maxSide = 256;

function sourceUrl(platform: Exclude<Platform, 'switch'>, fileName: string) {
	const { name, revision } = repositories[platform];
	return `https://raw.githubusercontent.com/libretro-thumbnails/${name}/${revision}/Named_Boxarts/${encodeURIComponent(fileName)}.png`;
}

function versionEntries() {
	return Object.fromEntries(
		Object.entries(versions).map(([version, [platform, ...ids]]) => {
			for (const id of ids) if (!covers[id]) throw new Error(`${version}: unknown cover ${id}`);
			return [version, { platform, covers: ids }];
		})
	);
}

async function download() {
	await rm(artDirectory, { recursive: true, force: true });
	await mkdir(artDirectory, { recursive: true });
	const entries: Record<string, CoverEntry> = {};
	for (const [id, [platform, title, fileName]] of Object.entries(covers)) {
		const url = sourceUrl(platform, fileName);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${id}: ${response.status} ${url}`);
		const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
			.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer({ resolveWithObject: true });
		await writeFile(path.join(artDirectory, `${id}.webp`), data);
		entries[id] = {
			title,
			platform,
			path: `/game-art/${id}.webp`,
			sourceUrl: url,
			width: info.width,
			height: info.height,
			byteSize: data.byteLength
		};
	}
	const versionMap = versionEntries();
	const manifest: Manifest = {
		source: {
			name: 'libretro-thumbnails',
			url: 'https://github.com/libretro-thumbnails/libretro-thumbnails',
			imageCopyright:
				'Box art is the property of Nintendo, Creatures Inc., and GAME FREAK inc. PKSX resizes these scans and holds no license to them.',
			repositories: Object.fromEntries(
				Object.entries(repositories).map(([platform, { name, revision }]) => [
					platform,
					{ repository: `https://github.com/libretro-thumbnails/${name}`, revision }
				])
			)
		},
		summary: {
			coverCount: Object.keys(entries).length,
			byteSize: Object.values(entries).reduce((total, entry) => total + entry.byteSize, 0),
			versionCount: Object.keys(versionMap).length,
			unmappedVersions: Object.keys(versionMap).filter((key) => !versionMap[key].covers.length)
		},
		covers: entries,
		versions: versionMap
	};
	await mkdir(path.dirname(manifestPath), { recursive: true });
	await writeFile(manifestPath, await format(JSON.stringify(manifest), { parser: 'json' }));
	console.log(`${manifest.summary.coverCount} covers, ${manifest.summary.byteSize} bytes`);
}

async function validate() {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
	const problems: string[] = [];
	if (JSON.stringify(manifest.versions) !== JSON.stringify(versionEntries())) {
		problems.push('versions differ from the mapping in this script');
	}
	if (Object.keys(manifest.covers).join() !== Object.keys(covers).join()) {
		problems.push('covers differ from the mapping in this script');
	}
	let byteSize = 0;
	for (const [id, entry] of Object.entries(manifest.covers)) {
		const [platform, title, fileName] = covers[id] ?? [];
		if (!platform || entry.title !== title || entry.sourceUrl !== sourceUrl(platform, fileName)) {
			problems.push(`${id}: entry differs from the mapping in this script`);
		}
		const bytes = await readFile(path.join(root, 'static', entry.path)).catch(() => null);
		if (!bytes) {
			problems.push(`${id}: missing ${entry.path}`);
			continue;
		}
		const { width, height, format: imageFormat } = await sharp(bytes).metadata();
		if (
			imageFormat !== 'webp' ||
			width !== entry.width ||
			height !== entry.height ||
			bytes.byteLength !== entry.byteSize
		) {
			problems.push(`${id}: ${entry.path} differs from its entry`);
		}
		byteSize += bytes.byteLength;
	}
	const referenced = new Set(Object.values(manifest.covers).map((entry) => entry.path));
	for (const file of await readdir(artDirectory)) {
		if (!referenced.has(`/game-art/${file}`)) problems.push(`unreferenced static/game-art/${file}`);
	}
	if (
		manifest.summary.byteSize !== byteSize ||
		manifest.summary.coverCount !== referenced.size ||
		manifest.summary.versionCount !== Object.keys(manifest.versions).length
	) {
		problems.push('summary differs from the covers');
	}
	if (problems.length) throw new Error(problems.join('\n'));
	console.log(`Game art catalog is consistent: ${referenced.size} covers, ${byteSize} bytes`);
}

await (process.argv.includes('--validate') ? validate() : download());
