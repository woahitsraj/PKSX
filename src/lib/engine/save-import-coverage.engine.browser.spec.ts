import { describe, expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import type { SlotOperation } from './types';

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
	[`${raj}/gba/pokemon-unbound-2.1.1.1.sav`, 'SAV3Unbound', 'Pokémon Unbound'],
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
		const [engine, bytes] = await Promise.all([createPkhexEngine(), readFixture(path)]);

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
			const [engine, bytes] = await Promise.all([createPkhexEngine(), readFixture(path)]);

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
			const [engine, bytes] = await Promise.all([createPkhexEngine(), readFixture(path)]);

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

	test('reads the party and all 25 boxes of a Pokemon Unbound Save File', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, bytes] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);

		const [workspace, card, exported] = await Promise.all([
			engine.loadSaveWorkspace(bytes, fileName, 24),
			engine.summarizeSaveCard(bytes, fileName),
			engine.serializeSave(bytes, fileName)
		]);
		if (!workspace.ok || !card.ok || !exported.ok) throw new Error('Unbound save did not load.');

		expect(workspace.value.summary).toMatchObject({
			trainerName: 'Luna',
			boxCount: 25,
			partyCount: 6
		});
		expect(card.value.pokemonCount).toBe(92);
		expect(workspace.value.boxNames.names).toHaveLength(25);
		expect(workspace.value.boxNames.names[0]).toBe('Box1');
		expect(workspace.value.boxNames.names[24]).toBe('Preset');
		const [metang, , , , , luxray] = workspace.value.partySlots;
		expect(metang).toMatchObject({
			speciesName: 'Metang',
			level: 44,
			heldItem: 'Eviolite',
			ability: 'Clear Body'
		});
		expect(metang).toMatchObject({ nickname: 'Metang', nature: 'Impish' });
		expect(metang.stats[0]).toMatchObject({ key: 'HP', value: 121, iv: 18, ev: 60 });
		expect(luxray.moves.map((move) => move.name)).toEqual([
			'Volt Switch',
			'Crunch',
			'Thunder Fang',
			'Electric Terrain'
		]);
		expect(workspace.value.boxSlots[24]).toMatchObject({ speciesName: 'Mawile', level: 34 });
		expect(workspace.value.boxSlots[24].entityBytesBase64 ?? null).toBeNull();
		expect(workspace.value.boxSlots[24].moves[0]).toMatchObject({ name: 'Crunch', pp: 15 });
		expect(decodeBase64(exported.value.bytesBase64)).toEqual(bytes);
		expect(
			await engine.checkSlotLegality(bytes, fileName, { zone: 'party', slot: 0 })
		).toMatchObject({
			ok: false,
			error: { code: 'unsupported-save', message: expect.stringContaining('Pokémon Unbound') }
		});
	});

	test('reads the intact older slot when the newer Pokemon Unbound slot is damaged', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, damaged] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		const counter = (slot: number) => new DataView(damaged.buffer).getUint32(slot + 0xffc, true);
		const live = counter(0xe000) > counter(0) ? 0xe000 : 0;
		const trainerSector = [...Array(14).keys()]
			.map((sector) => live + sector * 0x1000)
			.find((offset) => damaged[offset + 0xff4] === 0)!;
		damaged[trainerSector] ^= 0xff;

		const summary = await engine.summarizeSave(damaged, fileName);
		expect(summary).toMatchObject({ ok: true, value: { trainerName: 'Luna' } });
	});

	test('moves, copies and clears Pokemon Unbound slots with valid checksums', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, original] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		let bytes: Uint8Array = original;
		const operations: SlotOperation[] = [
			{
				kind: 'move',
				source: { zone: 'party', slot: 5 },
				destination: { zone: 'box', box: 18, slot: 29 }
			},
			{
				kind: 'copy',
				source: { zone: 'box', box: 0, slot: 1 },
				destination: { zone: 'box', box: 19, slot: 21 }
			},
			{ kind: 'clear', source: { zone: 'box', box: 0, slot: 0 } },
			{
				kind: 'move',
				source: { zone: 'box', box: 0, slot: 2 },
				destination: { zone: 'party', slot: 0 }
			}
		];
		for (const operation of operations) {
			const result = await engine.applySlotOperation(bytes, fileName, operation, 0);
			if (!result.ok) throw result.error;
			bytes = result.value.bytes;
		}

		const [box0, box18, box19] = await Promise.all(
			[0, 18, 19].map((box) => engine.loadSaveWorkspace(bytes, fileName, box))
		);
		if (!box0.ok || !box18.ok || !box19.ok) throw new Error('Edited Unbound save did not load.');
		expect(box0.value.summary.partyCount).toBe(5);
		expect(box0.value.boxSlots[0].isEmpty).toBe(true);
		expect(box0.value.partySlots[0]).toMatchObject({ speciesName: 'Sandshrew', level: 13 });
		expect(box0.value.boxSlots[2]).toMatchObject({ speciesName: 'Metang', level: 44 });
		expect(box18.value.boxSlots[29]).toMatchObject({ speciesName: 'Luxray', level: 45 });
		expect(box19.value.boxSlots[21]).toMatchObject({ speciesName: 'Spheal', level: 15 });

		const live = unboundLiveSlot(bytes);
		expect(live).toBe(unboundLiveSlot(original));
		for (const [id, offset] of unboundSections(bytes, live))
			expect(unboundChecksum(bytes, offset, id), `section ${id}`).toBe(
				readU16(bytes, offset + 0xff6)
			);
		const changed = bytes.findIndex(
			(byte, index) =>
				byte !== original[index] &&
				(index < live || index >= live + 0xe000) &&
				index < unboundSharedSectors
		);
		expect(changed, 'only the live slot and sectors 30 and 31 change').toBe(-1);
	});

	test('edits only the intact older slot when the newer Pokemon Unbound slot is damaged', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, original] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		const damaged = original.slice();
		const live = unboundLiveSlot(damaged);
		damaged[live + 0x100] ^= 0xff;

		const result = await engine.applySlotOperation(
			damaged,
			fileName,
			{ kind: 'clear', source: { zone: 'box', box: 0, slot: 0 } },
			0
		);
		if (!result.ok) throw result.error;
		const changed = result.value.bytes.findIndex(
			(byte, index) => byte !== damaged[index] && index >= live && index < live + 0xe000
		);
		expect(changed, 'the damaged slot stays as it was').toBe(-1);
	});

	test('edits a Pokemon Unbound Pokemon without changing its gender or shininess', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, original] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		const source = { zone: 'box', box: 0, slot: 0 } as const;
		const before = await engine.loadSlotEditData(original, fileName, source);
		const party = await engine.loadSlotEditData(original, fileName, { zone: 'party', slot: 0 });
		expect(
			party.ok &&
				party.value.abilityEditConstraints?.options.map(({ name, hidden }) => [name, hidden])
		).toEqual([
			['Clear Body', false],
			['Light Metal', true]
		]);
		const met = before.ok ? before.value.metDataEditConstraints : undefined;
		if (!met) throw new Error('Unbound slot has no met data.');
		const leechLife = before.ok
			? before.value.moveSetEditConstraints?.availableMoves.find((move) => move.id === 141)
			: undefined;
		expect(leechLife?.maxPp, 'move options use Unbound PP').toBe(15);
		const edited = await engine.applyPokemonEditOperation(
			original,
			fileName,
			{
				source,
				nickname: 'Frosty',
				level: 20,
				natureId: 3,
				heldItemId: 234,
				abilityIndex: 2,
				ivs: { HP: 31, ATK: 31, DEF: 31, SPA: 31, SPD: 31, SPE: 31 },
				evs: { HP: 252, ATK: 252, DEF: 4, SPA: 0, SPD: 0, SPE: 0 },
				moves: [
					{ slot: 2, move: 301 },
					{ slot: 3, move: 57 }
				],
				metData: { locationId: met.currentLocationId, metLevel: met.currentMetLevel, ballId: 2 }
			},
			0
		);
		if (!edited.ok) throw edited.error;

		const slot = await engine.loadSlotEditData(edited.value.bytes, fileName, source);
		if (!slot.ok) throw slot.error;
		expect(slot.value).toMatchObject({
			nickname: 'Frosty',
			level: 20,
			nature: 'Adamant',
			heldItem: 'Leftovers',
			ability: 'Moody',
			gender: '♀',
			spriteIdentity: { isShiny: false }
		});
		expect(slot.value.moves[3]).toMatchObject({ name: 'Surf', pp: 15 });
		expect(slot.value.stats.map((stat) => [stat.iv, stat.ev ?? 0])).toEqual([
			[31, 252],
			[31, 252],
			[31, 4],
			[31, 0],
			[31, 0],
			[31, 0]
		]);
		expect(slot.value.metDataEditConstraints?.currentBallId).toBe(2);

		const cleared = await engine.applyPokemonEditOperation(
			edited.value.bytes,
			fileName,
			{ source, nickname: '' },
			0
		);
		if (!cleared.ok) throw cleared.error;
		const reset = await engine.loadSlotEditData(cleared.value.bytes, fileName, source);
		expect(reset.ok && reset.value.nickname).toBe('Snorunt');
	});
	test('reads and edits the Pokemon Unbound bag', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, original] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		const pockets = async (bytes: Uint8Array) => {
			const loaded = await engine.loadSaveWorkspace(bytes, fileName, 0);
			if (!loaded.ok) throw loaded.error;
			const found = loaded.value.saveFile?.inventory.pockets ?? [];
			const item = (pocket: string, name: string) =>
				found.find((entry) => entry.key === pocket)?.items.find((entry) => entry.name === name);
			return { found, item };
		};

		const before = await pockets(original);
		expect(before.found.map((pocket) => pocket.key)).toEqual([
			'Items',
			'KeyItems',
			'Balls',
			'TMHMs',
			'Berries'
		]);
		expect(before.item('Items', 'Revive')?.quantity).toBe(12);
		expect(before.item('Balls', 'Ultra Ball')?.quantity).toBe(27);
		expect(before.item('KeyItems', 'Town Map')?.quantity).toBe(1);
		expect(before.item('TMHMs', 'HM01')?.quantity).toBe(1);
		expect(before.item('Berries', 'Kee Berry')?.quantity).toBe(5);

		const ultraBall = before.item('Balls', 'Ultra Ball')!.id;
		const revive = before.item('Items', 'Revive')!.id;
		const edited = await engine.applySaveFileEditOperation(
			original,
			fileName,
			{
				inventory: [
					{ kind: 'set', pocket: 'Balls', itemId: ultraBall, quantity: 99 },
					{ kind: 'remove', pocket: 'Items', itemId: revive },
					{ kind: 'add', pocket: 'Berries', itemId: 151, quantity: 3 }
				]
			},
			0
		);
		if (!edited.ok) throw edited.error;

		const after = await pockets(edited.value.bytes);
		expect(after.item('Balls', 'Ultra Ball')?.quantity).toBe(99);
		expect(after.item('Items', 'Revive')).toBeUndefined();
		expect(after.item('Berries', 'Pecha Berry')?.quantity).toBe(3);
		expect(after.item('Items', 'Max Repel')?.quantity).toBe(2);
		const live = unboundLiveSlot(edited.value.bytes);
		for (const [id, offset] of unboundSections(edited.value.bytes, live))
			expect(unboundChecksum(edited.value.bytes, offset, id), `section ${id}`).toBe(
				readU16(edited.value.bytes, offset + 0xff6)
			);
		const rawBefore = unboundItemIds(original, unboundLiveSlot(original));
		const rawAfter = unboundItemIds(edited.value.bytes, live);
		expect(rawAfter).toHaveLength(rawBefore.length - 1);
		expect(rawAfter).toEqual(rawBefore.filter((id) => rawAfter.includes(id)));
	});

	test('shows and edits Pokemon Unbound-only items', async () => {
		const fileName = 'pokemon-unbound-2.1.1.1.sav';
		const [engine, original] = await Promise.all([
			createPkhexEngine(),
			readFixture(`${raj}/gba/${fileName}`)
		]);
		const items = async (bytes: Uint8Array, pocket: string) => {
			const loaded = await engine.loadSaveWorkspace(bytes, fileName, 0);
			if (!loaded.ok) throw loaded.error;
			const found = loaded.value.saveFile?.inventory.pockets.find((entry) => entry.key === pocket);
			return new Map(found?.items.map((item) => [item.name, item]));
		};

		const before = await items(original, 'Items');
		expect(before.get('Dream Mist')?.quantity).toBe(1);
		expect(before.get('Link Stone')?.quantity).toBe(1);
		expect((await items(original, 'KeyItems')).get('Motorcycle')?.quantity).toBe(1);

		const hisuiRock = 10000 + 728;
		const edited = await engine.applySaveFileEditOperation(
			original,
			fileName,
			{
				inventory: [
					{ kind: 'set', pocket: 'Items', itemId: before.get('Dream Mist')!.id, quantity: 5 },
					{ kind: 'remove', pocket: 'Items', itemId: before.get('Link Stone')!.id },
					{ kind: 'add', pocket: 'Items', itemId: hisuiRock, quantity: 2 }
				]
			},
			0
		);
		if (!edited.ok) throw edited.error;
		const after = await items(edited.value.bytes, 'Items');
		expect(after.get('Dream Mist')?.quantity).toBe(5);
		expect(after.has('Link Stone')).toBe(false);
		expect(after.get('Hisui Rock')?.quantity).toBe(2);
		const raw = unboundItemIds(edited.value.bytes, unboundLiveSlot(edited.value.bytes));
		expect(raw).toContain(89);
		expect(raw).not.toContain(91);
		expect(raw.at(-1)).toBe(728);

		const source = { zone: 'box', box: 0, slot: 0 } as const;
		const slot = await engine.loadSlotEditData(original, fileName, source);
		if (!slot.ok) throw slot.error;
		const options = slot.value.heldItemEditConstraints?.options ?? [];
		expect(options.find((option) => option.name === 'Hisui Rock')).toMatchObject({
			id: hisuiRock,
			available: true
		});
		expect(options.find((option) => option.name === 'Orange Mail')?.available).toBe(false);
		expect(options.some((option) => option.name === 'Motorcycle')).toBe(false);
		const held = await engine.applyPokemonEditOperation(
			original,
			fileName,
			{ source, heldItemId: hisuiRock },
			0
		);
		if (!held.ok) throw held.error;
		const reloaded = await engine.loadSlotEditData(held.value.bytes, fileName, source);
		expect(reloaded.ok && reloaded.value.heldItem).toBe('Hisui Rock');
	});
});

// Sectors 30 and 31 hold boxes 20 to 22 for both save slots.
const unboundSharedSectors = 0x1e000;
const readU16 = (bytes: Uint8Array, offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
const readU32 = (bytes: Uint8Array, offset: number) =>
	(readU16(bytes, offset) | (readU16(bytes, offset + 2) << 16)) >>> 0;
const unboundLiveSlot = (bytes: Uint8Array) =>
	readU32(bytes, 0xe000 + 0xffc) > readU32(bytes, 0xffc) ? 0xe000 : 0;
const unboundSections = (bytes: Uint8Array, live: number) =>
	Array.from({ length: 14 }, (_, sector) => {
		const offset = live + sector * 0x1000;
		return [readU16(bytes, offset + 0xff4), offset] as const;
	});
function unboundChecksum(bytes: Uint8Array, offset: number, id: number) {
	const length = id === 0 ? 0xf24 : id === 4 ? 0xd98 : id === 13 ? 0x450 : 0xff0;
	let sum = 0;
	for (let index = 0; index < length; index += 4)
		sum = (sum + readU32(bytes, offset + index)) >>> 0;
	return ((sum >>> 16) + (sum & 0xffff)) & 0xffff;
}
// Raw Unbound ids in the Items pocket, including items PKHeX has no id for.
function unboundItemIds(bytes: Uint8Array, live: number) {
	const section13 = unboundSections(bytes, live).find(([id]) => id === 13)![1];
	const ids: number[] = [];
	for (let slot = 0; slot < 100; slot++) {
		const id = readU16(bytes, section13 + 0xad8 + slot * 4);
		if (id === 0) break;
		ids.push(id);
	}
	return ids;
}
