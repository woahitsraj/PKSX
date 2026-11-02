import { describe, expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';

const fixtureUrls = import.meta.glob('../../../test-fixtures/save-files/**/*.{sav,bin,gci,dat}', {
	query: '?url',
	import: 'default',
	eager: true
}) as Record<string, string>;

async function readFixture(path: string) {
	const url = fixtureUrls[`../../../test-fixtures/save-files/${path}`];
	if (!url) throw new Error(`Missing fixture ${path}.`);
	return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (byte) => byte.charCodeAt(0));

async function sha256(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const bl1nd = 'bl1ndbeholder-pokemon-saves';
const pkmds = 'pkmds-blazor';
const raj = 'raj-pokemon-save-backups';
const avalonia = 'pkhex-avalonia';
const minna = 'minna-pokemon-saves';

// One Save File per format PKHeX reads for the main games and their GameCube and Wii companions.
const saves = [
	[`${pkmds}/pokemon-red.sav`, 'SAV1', 'RB'],
	[`${pkmds}/pokemon-blue.sav`, 'SAV1', 'RB'],
	[`${pkmds}/blue-virtual-console.dat`, 'SAV1', 'RB'],
	[`${pkmds}/pokemon-yellow.sav`, 'SAV1', 'YW'],
	[`${avalonia}/gen2-gold.sav`, 'SAV2', 'GS'],
	[`${pkmds}/pokemon-silver.sav`, 'SAV2', 'GS'],
	[`${pkmds}/silver-virtual-console.dat`, 'SAV2', 'GS'],
	[`${pkmds}/pokemon-crystal-jp.sav`, 'SAV2', 'C'],
	[`${pkmds}/pokemon-ruby.sav`, 'SAV3RS', 'RS'],
	[`${pkmds}/pokemon-sapphire.sav`, 'SAV3RS', 'RS'],
	[`${bl1nd}/emerald-011020251345.sav`, 'SAV3E', 'E'],
	[`${pkmds}/pokemon-firered.sav`, 'SAV3FRLG', 'FR'],
	[`${pkmds}/pokemon-leafgreen.sav`, 'SAV3FRLG', 'FR'],
	[`${bl1nd}/colosseum/011020251345.gci`, 'SAV3Colosseum', 'COLO'],
	['libpkmn-test-files/pokemon-xd.gci', 'SAV3XD', 'XD'],
	[`${pkmds}/pokemon-box-ruby-sapphire.gci`, 'SAV3RSBox', 'RSBOX'],
	[`${avalonia}/gen4-diamond.sav`, 'SAV4DP', 'DP'],
	[`${pkmds}/pokemon-pearl.sav`, 'SAV4DP', 'DP'],
	[`${raj}/nds/pokemon-platinum-eu.sav`, 'SAV4Pt', 'Pt'],
	[`${raj}/nds/pokemon-heartgold.sav`, 'SAV4HGSS', 'HG'],
	[`${minna}/pokemon-soulsilver.sav`, 'SAV4HGSS', 'SS'],
	[`${pkmds}/pokemon-battle-revolution.sav`, 'SAV4BR', 'BATREV'],
	[`${pkmds}/pokemon-black.sav`, 'SAV5BW', 'B'],
	[`${raj}/nds/pokemon-white.sav`, 'SAV5BW', 'W'],
	[`${raj}/nds/pocket-monsters-white-2-jp.sav`, 'SAV5B2W2', 'W2'],
	[`${minna}/pokemon-black-2.sav`, 'SAV5B2W2', 'B2'],
	[`${bl1nd}/x/011020252224.sav`, 'SAV6XY', 'X'],
	[`${pkmds}/pokemon-y.sav`, 'SAV6XY', 'Y'],
	[`${avalonia}/gen6-omega-ruby.sav`, 'SAV6AO', 'OR'],
	[`${pkmds}/pokemon-alpha-sapphire.sav`, 'SAV6AO', 'AS'],
	[`${pkmds}/pokemon-sun.sav`, 'SAV7SM', 'SN'],
	[`${bl1nd}/moon/011020252257.sav`, 'SAV7SM', 'MN'],
	[`${bl1nd}/sun-moon-demo/181020251439.sav`, 'SAV7SM', 'SN'],
	[`${bl1nd}/ultra-sun/011020252224.sav`, 'SAV7USUM', 'US'],
	[`${bl1nd}/ultra-moon/011020252224.sav`, 'SAV7USUM', 'UM'],
	[`${pkmds}/pokemon-lets-go-pikachu.bin`, 'SAV7b', 'GP'],
	[`${raj}/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin`, 'SAV7b', 'GE'],
	[`${raj}/switch/pokemon-sword-2025-03-24-main.sav`, 'SAV8SWSH', 'SW'],
	[`${pkmds}/test-save-shield.sav`, 'SAV8SWSH', 'SH'],
	[`${pkmds}/pokemon-brilliant-diamond.bin`, 'SAV8BS', 'BD'],
	['pkhex-generated/blank-shining-pearl.sav', 'SAV8BS', 'SP'],
	[`${raj}/switch/pokemon-legends-arceus-2025-03-24-main.sav`, 'SAV8LA', 'PLA'],
	[`${raj}/switch/pokemon-scarlet-2025-03-24-main.sav`, 'SAV9SV', 'SL'],
	[`${pkmds}/pokemon-violet.sav`, 'SAV9SV', 'VL'],
	[`${pkmds}/pokemon-legends-za.sav`, 'SAV9ZA', 'ZA']
] as const;

// Digests come from native PKHeX.Core 26.5.5, which uses the platform AES and MD5.
const nativeCryptographyExports = [
	[`${pkmds}/pokemon-sun.sav`, '44531d420b9ee696fc1734df89db8e129ab6435c1d90bf1cfacf69a4e941643a'],
	[
		`${bl1nd}/moon/011020252257.sav`,
		'0928edb328f421aab0503c95c97cf0f0e131ce2e0ae55d094a6d440e0c2deb40'
	],
	[
		`${bl1nd}/sun-moon-demo/181020251439.sav`,
		'c8a1a28801020747b5519faab115432d5605dccd0c3628bad2f106556583a24e'
	],
	[
		`${bl1nd}/ultra-sun/011020252224.sav`,
		'bf4d8fff68d51246797923303c0ac9fe4d2de5e2b892e5ef04a7e8993623c20d'
	],
	[
		`${bl1nd}/ultra-moon/011020252224.sav`,
		'f670ec35a7481a0db783a4838dede7fa28f82484a3eac8042deb57f3dba8e432'
	],
	[
		`${pkmds}/pokemon-brilliant-diamond.bin`,
		'89aad04612dcb5f03639f48e60d5da8bf1df66dd1c218f83b3d4453c7ab0762d'
	],
	[
		'pkhex-generated/blank-shining-pearl.sav',
		'4e87b1acf874e09e5ba4e78116be2bb4901ef2202b1922ab6009fa871eac9229'
	]
] as const;

describe('PKHeX Engine Save File coverage', () => {
	test.each(saves)('imports and re-exports %s', async (path, saveType, gameVersion) => {
		const fileName = path.split('/').at(-1)!;
		const [engine, bytes] = await Promise.all([
			createPkhexEngine('/pkhex-engine'),
			readFixture(path)
		]);

		const summary = await engine.summarizeSave(bytes, fileName);
		expect(summary.ok, JSON.stringify(summary.error)).toBe(true);
		if (!summary.ok) throw summary.error;
		expect(summary.value).toMatchObject({ saveType, gameVersion });

		const [workspace, card, exported] = await Promise.all([
			engine.loadSaveWorkspace(bytes, fileName, 0),
			engine.summarizeSaveCard(bytes, fileName),
			engine.serializeSave(bytes, fileName)
		]);
		expect(workspace.ok, JSON.stringify(workspace.error)).toBe(true);
		expect(card.ok, JSON.stringify(card.error)).toBe(true);
		expect(exported.ok, JSON.stringify(exported.error)).toBe(true);
		if (!exported.ok) throw exported.error;

		const reimported = await engine.summarizeSave(
			decodeBase64(exported.value.bytesBase64),
			fileName
		);
		expect(reimported).toEqual(summary);
	});

	test.each(nativeCryptographyExports)(
		'exports %s with the same bytes as native PKHeX',
		async (path, digest) => {
			const fileName = path.split('/').at(-1)!;
			const [engine, bytes] = await Promise.all([
				createPkhexEngine('/pkhex-engine'),
				readFixture(path)
			]);

			const exported = await engine.serializeSave(bytes, fileName);
			expect(exported.ok, JSON.stringify(exported.error)).toBe(true);
			if (!exported.ok) throw exported.error;
			expect(await sha256(decodeBase64(exported.value.bytesBase64))).toBe(digest);
		}
	);

	test.each(nativeCryptographyExports)(
		'keeps an edit to %s after export and import',
		async (path) => {
			const fileName = path.split('/').at(-1)!;
			const [engine, bytes] = await Promise.all([
				createPkhexEngine('/pkhex-engine'),
				readFixture(path)
			]);

			const edited = await engine.applySaveFileEditOperation(
				bytes,
				fileName,
				{ boxName: { box: 0, name: 'PKSX' } },
				0
			);
			expect(edited.ok, JSON.stringify(edited.error)).toBe(true);
			if (!edited.ok) throw edited.error;

			const exported = await engine.serializeSave(edited.value.bytes, fileName);
			expect(exported.ok, JSON.stringify(exported.error)).toBe(true);
			if (!exported.ok) throw exported.error;

			const reimported = await engine.applySaveFileEditOperation(
				decodeBase64(exported.value.bytesBase64),
				fileName,
				{ boxName: { box: 1, name: 'PKSX' } },
				0
			);
			expect(reimported.ok, JSON.stringify(reimported.error)).toBe(true);
			if (!reimported.ok) throw reimported.error;
			expect(reimported.value.workspace.boxNames.names[0]).toBe('PKSX');
		}
	);
});
