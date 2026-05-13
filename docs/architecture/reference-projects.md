# Reference Projects

PKSX is a Svelte/Capacitor app, but its save-editing behavior should stay closely aligned with PKHeX and the existing web/cross-platform PKHeX ecosystem. Agents working on the PKHeX Engine, save parsing, legality, storage, or parity roadmap must inspect these projects before making architectural decisions.

## Primary upstream

### PKHeX

- Repository: https://github.com/kwsch/PKHeX
- Purpose: Official Pokemon save file editor and source of truth for save parsing, legality, serialization, and game-specific behavior.
- Key areas to inspect:
  - `PKHeX.Core/` for reusable parsing, legality, entity, save, and serialization APIs.
  - PKHeX desktop UI code when an API usage pattern is unclear.
  - Releases and package versions when deciding how to update the PKHeX Engine.
- PKSX rule:
  - Prefer consuming or wrapping `PKHeX.Core` over reimplementing PKHeX behavior in TypeScript.
  - When behavior differs between PKSX and PKHeX, assume PKHeX is correct unless an issue explicitly documents a deliberate deviation.

## Existing web and cross-platform projects

### PKMDS-Blazor

- Repository: https://github.com/codemonkey85/PKMDS-Blazor
- App: https://pkmds.app/
- Purpose: Blazor WebAssembly Pokemon save editor powered by `PKHeX.Core`; useful as the closest reference for offline web/PWA behavior and PKHeX.Core integration.
- Key areas to inspect:
  - `AGENTS.md` for project-specific PKHeX.Core guidance and known API gotchas.
  - `Directory.Packages.props` for current `PKHeX.Core` package usage.
  - `Directory.Build.targets` for the `UseLocalPKHeX` source override pattern.
  - `Pkmds.Core/` for UI-independent helper APIs around PKHeX.Core.
  - `Pkmds.Rcl/Services/` and `Pkmds.Rcl/Components/` for app state, save loading, backups, bank behavior, and editor organization.
  - `Pkmds.Web/` for Blazor WebAssembly PWA host behavior and publish/deploy setup.
  - `PKHEX_PARITY_ROADMAP.md` for a feature-parity breakdown.
- PKSX rule:
  - Reuse the architecture lessons, not the UI framework. PKSX should stay Svelte-first, but PKMDS is the strongest reference for keeping a web app current with PKHeX.Core.

### PKHeX.Everywhere

- Repository: https://github.com/arleypadua/PKHeX.Everywhere
- App: https://pkhex-web.github.io/
- Purpose: Cross-platform PKHeX tooling with web and CLI surfaces; useful as a reference for facade design, plugin boundaries, and non-Windows PKHeX workflows.
- Key areas to inspect:
  - `src/PKHeX.Facade/` for a facade layer over PKHeX-related behavior.
  - `src/PKHeX.Web/` for web app structure and browser-facing workflows.
  - `src/PKHeX.CLI/` for command-oriented save operations.
  - `src/PKHeX.Web.Plugins*/` for plugin extension patterns.
  - `build-plugins.sh` and `gen-pkhexwebplugins.sh` for plugin packaging metadata.
  - `external/PKHeX` and `external/PKHeX-Plugins` for how the project tracks upstream code.
- PKSX rule:
  - Use this project as a reference for boundaries and portability, but do not assume its UI, plugin model, or cloud features are required for the PKSX MVP.

## Additional related projects

### PKHeX-Plugins / AutoMod

- Repository: https://github.com/architdate/PKHeX-Plugins
- Purpose: Plugin ecosystem around PKHeX, including automation such as legality helpers.
- PKSX rule:
  - Treat plugin and auto-legality integration as future work unless an issue explicitly includes it. Do not couple the MVP PKHeX Engine spike to plugin support.

## Local source preference

When possible, agents should prefer local source checkouts over memory or summarized docs. Reasonable default checkout paths:

- PKHeX: `../PKHeX`, `~/Code/PKHeX`, or `~/Code/codemonkey85/PKHeX`
- PKMDS-Blazor: `../PKMDS-Blazor` or `~/Code/codemonkey85/PKMDS-Blazor`
- PKHeX.Everywhere: `../PKHeX.Everywhere` or `~/Code/PKHeX.Everywhere`

If no local checkout exists, inspect GitHub directly. Do not vendor these repositories into PKSX unless a specific issue calls for it.

## Decisions already made for PKSX

- PKSX is offline-first.
- Browser/PWA comes before Capacitor.
- Electron is future work.
- The Svelte app owns UI, routing, controller focus, and Local Library flows.
- The PKHeX Engine owns PKHeX.Core-backed parsing, validation, legality, serialization, and mutation behavior.
- The first milestone is a tracer bullet, not broad PKHeX feature parity.
- The first PKHeX Engine spike must prove the C# WebAssembly boundary before major UI work proceeds.
