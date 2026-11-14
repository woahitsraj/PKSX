import { expect, it } from 'vitest';
import { candidateFile } from './index';
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
