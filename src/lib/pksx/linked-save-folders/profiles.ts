export const emulatorProfiles = [
	{ id: 'dolphin', name: 'Dolphin' },
	{ id: 'retroarch', name: 'RetroArch' },
	{ id: 'melonds', name: 'melonDS' },
	{ id: 'drastic', name: 'DraStic' },
	{ id: 'pizza', name: 'Pizza Boy' },
	{ id: 'azahar', name: 'Azahar' }
] as const;

export type EmulatorProfile = (typeof emulatorProfiles)[number]['id'] | 'generic';

export function emulatorName(id: string | undefined) {
	return emulatorProfiles.find((profile) => profile.id === id)?.name;
}

export function fileEmulator(file: { emulator?: string; linkedDocumentId?: string }) {
	if (file.emulator) return emulatorName(file.emulator);
	return file.linkedDocumentId ? emulatorName(folderProfile(file.linkedDocumentId, '')) : undefined;
}

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
