import catalogManifest from './catalog.generated.json';

export type GamePlatform = 'gb' | 'gbc' | 'gba' | 'nds' | '3ds' | 'gcn' | 'wii' | 'switch';

export type GameArtCover = {
	title: string;
	platform: GamePlatform;
	path: string;
	sourceUrl: string;
	width: number;
	height: number;
	byteSize: number;
};

export type GameArt = {
	/** Null when PKSX does not know the game. */
	platform: GamePlatform | null;
	/** Empty for the fallback. A paired version, such as RB, has both of its covers. */
	covers: GameArtCover[];
};

type GameArtCatalogManifest = {
	covers: Record<string, GameArtCover>;
	versions: Record<string, { platform: GamePlatform; covers: string[] }>;
};

const manifest = catalogManifest as GameArtCatalogManifest;
const unknownGame: GameArt = { platform: null, covers: [] };

/** Resolves the engine `gameVersion` of a Save File or Backup to its offline cover art. */
export function resolveGameArt(gameVersion: string | null | undefined): GameArt {
	const version = gameVersion ? manifest.versions[gameVersion] : undefined;
	if (!version) return unknownGame;
	return { platform: version.platform, covers: version.covers.map((id) => manifest.covers[id]) };
}
