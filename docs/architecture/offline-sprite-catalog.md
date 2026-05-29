# Offline Sprite Catalog

Issue: https://github.com/woahitsraj/pksx/issues/36

## Settled Constraints

PKSX uses a **Sprite Catalog** to resolve a PKHeX Engine-projected **Sprite Identity** to an offline local asset for party, box, and Pokemon Storage views.

The first milestone **Sprite Identity** is based on visible Pokemon characteristics. It includes species, form, egg state, and, when supported, shiny state and sex-difference sprite state. It excludes nickname, level, slot position, current owner, UI state, save format, and generation unless a concrete asset collision requires a later variant.

Sprite assets should be packaged as local static files and addressed through deterministic app paths. The Sprite Catalog should return local URL strings and fallback metadata rather than importing every sprite into the JavaScript module graph.

Static packaging keeps sprite bytes out of JS chunks, lets browser image loading handle decoding, and aligns with the existing SvelteKit service worker, which precaches static files through `$service-worker.files`.

Catalog lookup should try an exact Sprite Identity first, then fall back to the base species asset when a non-egg form-specific asset is missing, then fall back to generic unknown or text-only rendering. Egg identities should prefer a dedicated egg asset when available; otherwise they should use generic fallback rendering rather than a species sprite.

For shiny Pokemon with missing exact assets, fallback should preserve visible shape before shiny coloration. Lookup should preserve form first, then sex-difference state, then shiny state: exact form plus exact sex difference plus shiny; exact form plus exact sex difference plus normal coloration; exact form plus default sex plus shiny; exact form plus default sex plus normal coloration; then the same sequence for base form before generic fallback. Shiny coverage is expected to be complete, but a normal-color fallback is acceptable for rare missing shiny assets.

The first bundled catalog should include all base species assets available from the chosen source, provided the compressed app size remains reasonable. Form-specific assets may be added where the source has clear coverage and naming. The catalog should not be limited to committed save fixtures.

PokemonDB is the chosen acquisition source for the first catalog because it has broad current species and form coverage, including Generation 9. PokemonDB's sprite pages permit saving images and uploading them to your own hosting as an alternative to hotlinking. PKSX should package downloaded images locally and should not hotlink PokemonDB at runtime. Repository documentation should describe these assets as saved from PokemonDB under that self-hosting guidance, not as open-source licensed artwork.

The Issue #55 download rule should use PokemonDB HOME front sprites as the default source because PokemonDB's game-family pages do not provide complete form and shiny coverage. The acquisition script should keep a source-family preference list so PKSX can later add non-HOME sources when a future catalog mode wants them, but the committed Issue #55 catalog should consistently use HOME for selectable species, form, shiny, and sex-difference assets. Back and animated sprites remain out of scope.

Sprite acquisition should be a manual maintainer action, such as a `scripts/` command invoked through `pnpm sprites:download`. The generated static assets and manifest should be committed. Normal install, build, and CI workflows should not crawl PokemonDB. CI may validate that the committed manifest and assets are internally consistent.

Issue #55 should keep generated sprite assets committed to git. Because full shiny and mapped variant coverage can materially increase repository size, the acquisition tooling or PR summary should make asset count and size impact visible for review. Moving sprite assets to an external cache or install-time download would be a separate distribution decision.

The committed catalog manifest should be generated JSON keyed by deterministic catalog key. Each entry should record species id, form, egg state, local asset path, PokemonDB source URL, selected source family, retrieval date, and image dimensions and byte size where practical. Retrieval dates should change only when assets are actually refreshed.

Issue #55 should migrate deterministic catalog keys to encode all active Sprite Identity dimensions explicitly, including display sex and shiny state. Existing base normal entries should be regenerated into the new key shape instead of maintaining parallel legacy keys, because the catalog manifest is generated and committed.

Variant asset paths should use compact deterministic filenames under the existing `static/sprites/pokemon/species/` directory, with the full display identity encoded in the filename, such as `0025-form-00-sex-default-normal.png` or `0025-form-00-sex-female-shiny.png`.

When Issue #55 migrates asset filenames, old generated base-species files such as `0025.png` should be removed after their replacement entries are generated. Validation should flag unreferenced generated sprite files under the species directory, except for intentionally shared fallback assets documented outside the generated manifest.

Issue #55 should generate catalog entries for every PokemonDB HOME filename that can be mapped to a PKHeX form id, shiny state, and display-sex state with checked-in mapping data. Incorrect form visuals are worse than missing form-specific visuals, so unmapped or engine-unselectable HOME visuals should be skipped and allowed to fall back.

When adding form-specific catalog entries, PKSX should aim for every PokemonDB form that can be explicitly mapped to a PKHeX form id with confidence, not only a curated proof subset. Unmapped or ambiguous forms should continue to fall back rather than guess from filenames alone.

Issue #55 should package shiny coverage for every base species in the current National Dex catalog, plus shiny assets for every explicitly mapped form and sex-difference entry where the source provides them. Missing shiny assets should be rare enough that normal-color fallback remains an edge case rather than a routine rendering path.

High-cardinality visual variants, such as Alcremie combinations, should only be included when the PKHeX Engine-projected **Sprite Identity** can select the exact visual distinction. If PokemonDB exposes a finer visual distinction than the current Sprite Identity dimensions can represent, PKSX should leave those assets unmapped rather than choose a closest-looking variant.

PKHeX form ids are authoritative for the **Sprite Identity** form dimension. PokemonDB page labels and sprite filenames may be used as acquisition metadata, but they must be bridged through checked-in explicit mapping data before form assets are included. If PokemonDB's naming or coverage cannot be reconciled with PKHeX form ids for a species, PKSX should leave that form unmapped or evaluate an alternate sprite source rather than infer a visual from filename order.

Slot summaries should carry a purpose-built PKHeX Engine-projected **Sprite Identity** for catalog lookup instead of requiring the Svelte app to assemble display identity from raw slot fields. The Svelte UI may still receive raw fields for labels and details, but form, egg state, shiny state, and sex-difference state used for sprite lookup should come from the engine projection.

Issue #55 includes sex-difference sprite resolution for Pokemon whose male and female sprites are visibly different. Sex-difference assets should use the same explicit-mapping standard as form assets: PokemonDB labels and filenames may be acquisition metadata, but PKSX should only include entries that can be reconciled with the PKHeX Engine-projected **Display Sex**. The catalog dimension should be visual display sex, not raw gender: `default`, `male`, or `female`. Species and forms without visible sex-difference assets should use `default` rather than duplicating entries per raw gender.

Issue #55 also keeps generation and game family out of **Sprite Identity**. The catalog should choose one preferred local normal-front asset per species, form, egg state, shiny state, and sex-difference state, with HOME as the current preferred source for complete variant coverage. Generation-specific visual fidelity is a separate catalog mode and should not be introduced as part of form, shiny, and sex-difference support.

Egg slots should use a generic egg identity. If PokemonDB exposes a suitable egg asset through the acquisition path, the first catalog may bundle it. Otherwise, eggs should use a local generic fallback image or stable text/generic rendering. Egg slots should not display the species sprite.

Issue #36 should wire the Sprite Catalog into party and box slots, not stop at asset infrastructure. The implementation should remove the current hard-coded remote Pikachu image and resolve each occupied slot through the catalog from engine-projected slot fields. Missing images should preserve stable slot dimensions with generic or text fallback rendering.

The focused detail rail should use the same Sprite Catalog asset as the slot grid in the first milestone. PKSX should not introduce a separate portrait-art source until a later PRD calls for higher-resolution detail art.

Pokemon Storage does not need to be implemented as part of issue #36. The catalog API should be reusable by future Pokemon Storage views, but this issue should integrate existing Party, Box, and Detail Rail surfaces only.

Issue #36 does include the manual download script and the committed downloaded sprite assets. The app should be able to render the first catalog offline from repository-packaged files after the issue lands.

## Acceptance Test Boundary

Unit tests should cover Sprite Identity key construction, exact lookup, form fallback to base species, egg lookup and fallback, missing species fallback, and manifest/path consistency.

The download tooling should have a validation mode or companion test that checks every manifest entry points to an existing static file.

Issue #55 download tooling should also produce a mapping compatibility report or validation output before or during acquisition. The report should make PKHeX-projected Sprite Identities, PokemonDB labels and filenames, mapped entries, unmapped or ambiguous entries, and missing variant assets inspectable before reviewers trust the generated catalog.

Browser or end-to-end tests should verify that imported fixture Pokemon render local sprite images or stable fallback in Party, Box, and Detail Rail surfaces. The rendered DOM should not contain PokemonDB image URLs. For Issue #55, browser coverage should prove at least one non-base Sprite Identity dimension flows through the UI, while unit and integration tests should cover form, shiny, sex-difference, egg, and fallback behavior exhaustively.

Offline cache coverage should verify, where practical, that committed sprite files are included in the SvelteKit service worker static asset list.

Visual or layout tests should verify that sprite and fallback states preserve stable Slot dimensions.

## Open Questions

None.
