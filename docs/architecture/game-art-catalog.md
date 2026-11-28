# Offline Game Art Catalog

Issue: https://github.com/woahitsraj/pksx/issues/378

## What it does

The **Game Art Catalog** resolves the PKHeX Engine `gameVersion` of a Save File or Backup to local cover art. It is the one game-to-art mapping in PKSX. Saves cards use it now. Box Source headers, save selectors, the Saves preview, and the Backup Browser must use the same mapping and must not keep their own.

## How to use it

- `resolveGameArt(gameVersion)` in `src/lib/pksx/game-art-catalog` returns `{ platform, covers }`.
- `GameArt.svelte` in `src/lib/components/pksx` draws the result. Set its size with the `--game-art-size` custom property. The component is decorative and hidden from assistive technology, so the owner must state the game name in text.

The resolver has four results:

| Result       | `platform` | `covers`   | Example          |
| ------------ | ---------- | ---------- | ---------------- |
| Single game  | known      | one cover  | `E`, `Pt`, `MN`  |
| Paired games | known      | two covers | `RB`, `GS`, `FR` |
| No cover     | known      | empty      | `GSC`, `RBY`     |
| Unknown game | `null`     | empty      | any other value  |

`platform` is one of `gb`, `gbc`, `gba`, `nds`, `3ds`, `gcn`, `wii`, or `switch`. It is present for every known game, also when the game has no cover.

## Rules

- A wrong cover is worse than no cover. The engine cannot tell the two games of some pairs apart, and reports one value such as `RB`, `GS`, `RS`, `DP`, or `FR` (FireRed or LeafGreen). For these values the catalog returns both covers and `GameArt` draws both. It never picks one.
- `GN` has no cover, because it means Green in Japan and Blue in other regions.
- A game without a cover, an unknown game, and an image that fails to load all draw the same fallback tile at the same size. A card never changes size when its art changes.
- The Saves card reads the game from the stored card details of the last session. It draws the cover before it reads the Save File bytes again, and it never starts a Workspace load or box parse to find the art.

## Source and attribution

The covers are box art scans from [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails), the thumbnail set that RetroArch uses. Each system has its own repository, and the acquisition script pins one commit for each. The project states no license for its images. The box art is the property of Nintendo, Creatures Inc., and GAME FREAK inc. `THIRD_PARTY_NOTICES.md` records this. Describe these files as third-party box art scans, not as open-source artwork.

libretro-thumbnails has no Nintendo Switch repository. The ten Nintendo Switch covers are the cover images that English Wikipedia shows for each game under its non-free content policy. Wikipedia keeps one image for a pair of games, so the script cuts the left and right halves. These files have no pinned revision, only the file URL in the manifest.

Pokémon Unbound is a fan game and has no box art. `GN`, `RBY`, and `GSC` cover more than two games and have no cover.

## Files

- `scripts/download-game-art-catalog.ts` holds the checked-in mapping: cover id to exact source file name or Wikipedia file, and engine game version to platform and cover ids. Source file names are never guessed. A source path that is a symbolic link fails the download.
- `pnpm game-art:download` is a manual maintainer step. It downloads each pinned scan, resizes it to fit 256 by 256 pixels, and writes WebP files to `static/game-art` and the manifest to `src/lib/pksx/game-art-catalog/catalog.generated.json`. Normal installs, builds, and CI never access the network for art.
- `pnpm game-art:validate` is offline. It checks that the manifest agrees with the mapping in the script, that each file exists with the recorded format, dimensions, and byte size, and that no file is unreferenced.
- The service worker precaches `static/game-art` through `$service-worker.files`, the same as the sprite catalogs.

The committed catalog has 42 covers and 739,936 bytes. It maps 62 engine game versions, 4 of them without a cover.
