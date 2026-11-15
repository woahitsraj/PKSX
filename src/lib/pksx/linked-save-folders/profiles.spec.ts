import { expect, it } from 'vitest';
import { candidateFile, folderOf } from './index';
import { folderProfile, skipFolder } from './profiles';

it('discovers battery saves in each supported layout while pruning emulator assets and save states', () => {
	const layouts = [
		['RetroArch', 'saves/mGBA/Pokemon.srm', 'retroarch'],
		['melonDS', 'roms/Pokemon.sav', 'melonds'],
		['DraStic', 'backup/Pokemon.dsv', 'drastic'],
		['Pizza Boy A', 'saves/Pokemon.sav', 'pizza'],
		['Azahar', 'sdmc/Nintendo 3DS/id0/id1/title/00040000/00055e00/data/00000001/main', 'azahar']
	] as const;
	for (const [name, path, expected] of layouts) {
		const profile = folderProfile('content://test/tree/' + encodeURIComponent(name), name);
		expect(profile).toBe(expected);
		const segments = path.split('/');
		const filename = segments.pop()!;
		let parent = '';
		for (const segment of segments) {
			expect(skipFolder(segment, profile, parent)).toBe(false);
			parent += segment + '/';
		}
		expect(candidateFile(filename)).toBe(true);
		expect(skipFolder('states', profile, '')).toBe(true);
	}
	expect(skipFolder('roms', 'retroarch', '')).toBe(true);
	expect(skipFolder('roms', 'melonds', '')).toBe(false);
	for (const name of [
		'Pokemon.gba',
		'Pokemon.nds',
		'Pokemon.state',
		'Pokemon.ds0',
		'card.raw',
		'card.gcp'
	])
		expect(candidateFile(name)).toBe(false);
});

it('matches a linked save to the folder that contains it', () => {
	const authority = 'com.android.externalstorage.documents';
	const gc = { tree: `content://${authority}/tree/primary%3ADolphin%2FGC`, name: 'GC' };
	const gcPlus = { tree: `content://${authority}/tree/primary%3ADolphin%2FGC2`, name: 'GC2' };
	const id = (docId: string) => JSON.stringify([authority, docId]);
	expect(folderOf(id('primary:Dolphin/GC2/a.gci'), [gc, gcPlus])).toBe(gcPlus);
	expect(folderOf(id('primary:Dolphin/GC/USA/a.gci'), [gc, gcPlus])).toBe(gc);
	expect(folderOf(id('primary:Other/a.gci'), [gc])).toBeUndefined();
	expect(folderOf(undefined, [gc])).toBeUndefined();
});
