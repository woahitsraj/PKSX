# Offline Sprite Catalog

Issue: https://github.com/woahitsraj/pksx/issues/36

## Settled Constraints

PKSX uses a **Sprite Catalog** to resolve a PKHeX Engine-projected **Sprite Identity** to an offline local asset for party, box, and Pokemon Storage views.

The first milestone **Sprite Identity** is based on visible Pokemon characteristics. It includes species, form, and egg state. It excludes nickname, level, slot position, current owner, UI state, save format, and generation unless a concrete asset collision requires a later variant.

Sprite assets should be packaged as local static files and addressed through deterministic app paths. The Sprite Catalog should return local URL strings and fallback metadata rather than importing every sprite into the JavaScript module graph.

Static packaging keeps sprite bytes out of JS chunks, lets browser image loading handle decoding, and aligns with the existing SvelteKit service worker, which precaches static files through `$service-worker.files`.

Catalog lookup should try an exact Sprite Identity first, then fall back to the base species asset when a non-egg form-specific asset is missing, then fall back to generic unknown or text-only rendering. Egg identities should prefer a dedicated egg asset when available; otherwise they should use generic fallback rendering rather than a species sprite.

The first bundled catalog should include all base species assets available from the chosen source, provided the compressed app size remains reasonable. Form-specific assets may be added where the source has clear coverage and naming. The catalog should not be limited to committed save fixtures.

PokemonDB is the chosen acquisition source for the first catalog because it has broad current species and form coverage, including Generation 9. PokemonDB's sprite pages permit saving images and uploading them to your own hosting as an alternative to hotlinking. PKSX should package downloaded images locally and should not hotlink PokemonDB at runtime. Repository documentation should describe these assets as saved from PokemonDB under that self-hosting guidance, not as open-source licensed artwork.

The first download rule should prefer the newest available PokemonDB normal front sprite from a game family. The script should walk game families from newest to oldest, starting with Scarlet/Violet, then fall back to Pokemon HOME only when no game sprite is available. Shiny, back, and animated sprites are out of scope for the first catalog.

Sprite acquisition should be a manual maintainer action, such as a `scripts/` command invoked through `pnpm sprites:download`. The generated static assets and manifest should be committed. Normal install, build, and CI workflows should not crawl PokemonDB. CI may validate that the committed manifest and assets are internally consistent.

The committed catalog manifest should be generated JSON keyed by deterministic catalog key. Each entry should record species id, form, egg state, local asset path, PokemonDB source URL, selected source family, retrieval date, and image dimensions and byte size where practical. Retrieval dates should change only when assets are actually refreshed.

The first implementation should generate base species form `0` entries only. The lookup API should remain form-aware, but non-zero forms should fall back to the base species until PokemonDB form names are verified against PKHeX form ids. Incorrect form visuals are worse than missing form-specific visuals.

Egg slots should use a generic egg identity. If PokemonDB exposes a suitable egg asset through the acquisition path, the first catalog may bundle it. Otherwise, eggs should use a local generic fallback image or stable text/generic rendering. Egg slots should not display the species sprite.

Issue #36 should wire the Sprite Catalog into party and box slots, not stop at asset infrastructure. The implementation should remove the current hard-coded remote Pikachu image and resolve each occupied slot through the catalog from engine-projected slot fields. Missing images should preserve stable slot dimensions with generic or text fallback rendering.

The focused detail rail should use the same Sprite Catalog asset as the slot grid in the first milestone. PKSX should not introduce a separate portrait-art source until a later PRD calls for higher-resolution detail art.

Pokemon Storage does not need to be implemented as part of issue #36. The catalog API should be reusable by future Pokemon Storage views, but this issue should integrate existing Party, Box, and Detail Rail surfaces only.

Issue #36 does include the manual download script and the committed downloaded sprite assets. The app should be able to render the first catalog offline from repository-packaged files after the issue lands.

## Acceptance Test Boundary

Unit tests should cover Sprite Identity key construction, exact lookup, form fallback to base species, egg lookup and fallback, missing species fallback, and manifest/path consistency.

The download tooling should have a validation mode or companion test that checks every manifest entry points to an existing static file.

Browser or end-to-end tests should verify that imported fixture Pokemon render local sprite images or stable fallback in Party, Box, and Detail Rail surfaces. The rendered DOM should not contain PokemonDB image URLs.

Offline cache coverage should verify, where practical, that committed sprite files are included in the SvelteKit service worker static asset list.

Visual or layout tests should verify that sprite and fallback states preserve stable Slot dimensions.

## Open Questions

None.
