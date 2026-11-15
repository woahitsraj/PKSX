export const emulatorProfiles = [
	{
		id: 'retroarch',
		name: 'RetroArch',
		folder: 'RetroArch/saves, including per-core folders',
		example: 'RetroArch/saves/mGBA/Pokemon.srm'
	},
	{
		id: 'melonds',
		name: 'melonDS',
		folder: 'Configured save folder, or the folder beside your ROMs',
		example: 'melonDS/roms/Pokemon.sav'
	},
	{
		id: 'drastic',
		name: 'DraStic',
		folder: 'DraStic/backup',
		example: 'DraStic/backup/Pokemon.dsv'
	},
	{
		id: 'pizza',
		name: 'Pizza Boy',
		folder: 'Folder containing exported or accessible battery saves',
		example: 'Pizza Boy A/Pokemon.sav'
	},
	{
		id: 'azahar',
		name: 'Azahar / Citra',
		folder: 'User folder containing sdmc/Nintendo 3DS',
		example: 'sdmc/Nintendo 3DS/id0/id1/title/00040000/00055e00/data/00000001/main'
	},
	{
		id: 'dolphin',
		name: 'Dolphin',
		folder: 'GC, a region folder, or Card A / Card B',
		example: 'GC/USA/Card A/Pokemon.gci'
	}
] as const;

export type EmulatorProfile = (typeof emulatorProfiles)[number]['id'] | 'generic';

export function folderProfile(tree: string, name: string): EmulatorProfile {
	const label = (decodeURIComponent(tree) + '/' + name).toLowerCase();
	if (label.includes('retroarch')) return 'retroarch';
	if (label.includes('melonds')) return 'melonds';
	if (label.includes('drastic')) return 'drastic';
	if (/pizza.?boy/.test(label)) return 'pizza';
	if (/azahar|citra|lime3ds/.test(label)) return 'azahar';
	if (label.includes('dolphin')) return 'dolphin';
	return 'generic';
}

const irrelevant =
	/^(?:assets|autoconfig|cache|caches|cheats|config|cores|covers|database|dump|filters|info|load|logs|overlays|playlists|remaps|resourcepacks|screenshots|shader_cache|shaders|states|statesaves|temp|textures|thumbnails)$/i;

export function skipFolder(name: string, profile: EmulatorProfile, path: string) {
	if (irrelevant.test(name)) return true;
	if (profile === 'retroarch' && /^(?:roms|system)$/i.test(name)) return true;
	if (profile === 'dolphin' && /^(?:wii|games|gamesettings)$/i.test(name)) return true;
	if (profile === 'azahar') {
		if (/^(?:extdata|dbs|sysdata|nand)$/i.test(name)) return true;
		if (/\/title\/[^/]+\/[^/]+\/$/i.test(path) && name.toLowerCase() !== 'data') return true;
	}
	return false;
}
