# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The same SvelteKit build ships as a PWA and inside Capacitor shells for iOS and Android (ADR 0007). The shells wrap the web UI. They do not use a native design language. Electron desktop packaging comes after Capacitor.

## Users

Three audiences have equal weight. Design must serve each of them.

- **Handheld and emulator players.** They play on emulator handhelds (for example, Retroid devices) or phones, and manage saves with a gamepad on the same device.
- **Collectors.** They keep a long-term collection and move Pokemon between games, like a personal Bank or HOME.
- **PKHeX users.** They know PKHeX and want a friendlier, cross-platform tool for edits and legality.

## Product Purpose

PKSX is an offline-first Pokemon save management app. Users import a Save File, inspect it, back it up, edit it, and export it. PKSX also keeps Pokemon that no Save File owns in Pokemon Storage, so a collection can outlive any one game.

Success: a user can do common save and collection work from a controller or touch screen on any supported device, and trust that PKSX will not damage a save.

## Positioning

- **Controller-first, box-first.** The primary workflow is to move through Party and Box grids, open focused actions, and return to storage navigation (ADR 0003). PKSX is not a dense desktop form editor.
- **A home for a collection across games.** Pokemon Storage, Cloud Sync, and Link Trade make PKSX a place to keep and move a collection, not only a file editor.

## Operating Context

- Input is keyboard, gamepad, pointer, and touch. All input produces the same Navigation Actions. Controller Focus is independent of browser DOM focus.
- Screens range from small landscape handhelds to phones, tablets, and desktops. Layout uses two Height Bands, Short below 560 CSS px and Tall at or above it (ADR 0013).
- Supported browsers are Chromium 140 and Safari/WebKit 26 (ADR 0017). Firefox is not supported.
- Users bring their own save files from emulators, flash carts, or save managers. Import and Export are explicit user actions.
- Link Trade needs a user-owned Trade Radio (a USB devboard with matching firmware).

## Capabilities and Constraints

- The PKHeX Engine runs `PKHeX.Core` in C# WebAssembly behind a web worker. PKSX wraps PKHeX behavior. It does not reimplement Pokemon save logic in TypeScript.
- Saves keep immutable baseline bytes. PKSX creates a Backup before a Risky Change. Workspaces hold edits until Export. Nothing silently overwrites a user file.
- Pokemon Editor edits are staged, then applied through an engine-backed contract (ADR 0010).
- Legality Check, Legality Report, and Legality Fix come from the PKHeX Engine.
- Summoned surfaces are Menus or Takeovers only (ADR 0014). Durable state draws in place (ADR 0012). Persistent status and Toasts are separate (ADR 0009).
- The type scale is fixed. Room scales by container height (ADR 0015).
- Cloud Sync is opt-in and comes before Peer Transfer (ADR 0016, ADR 0021).
- No visitor analytics are installed.
- Use the terms in `CONTEXT.md` for all product language. Follow its `_Avoid_` lists.

## Brand Commitments

- **Unofficial fan tool.** Do not use Nintendo, Game Freak, or The Pokemon Company marks or look-alike branding. State that PKSX is not affiliated with them.
- **Plain-language voice.** UI copy uses short, plain words and the `CONTEXT.md` terms. Do not use design or platform jargon such as "scrim", "snackbar", or "modal" in UI copy.
- Name: PKSX. App icon: `resources/icon.png`.

## Evidence on Hand

- Test Save Files: `test-fixtures/save-files/`.
- Offline Sprite Catalog and item sprites: `static/sprites/`.
- Reference screenshots of related tools: `docs/example-screenshots/` (bank, HOME, PKSM). These are references, not PKSX assets.
- Current UI tokens: `docs/design-system.md` and `src/routes/layout.css`.
- No testimonials, user counts, press, or public download links exist yet. Download labels stay "Planned" until a public release URL exists. Do not invent them.

## Product Principles

1. **Every action is reachable from a controller.** Pointer and touch are equal, not primary.
2. **Protect the save.** Changes are explicit, staged, and recoverable through Backups.
3. **Boxes are home.** Each workflow starts from and returns to the Party and Box grids.
4. **PKHeX is the source of truth.** Accuracy comes from the engine, not from app-side guesses.
5. **Serve all three audiences.** Do not simplify away power that PKHeX users need, and do not bury common tasks under it.

## Accessibility & Inclusion

- WCAG 2.2 AA is the required standard.
- Every action must be reachable by keyboard and gamepad, in addition to pointer and touch.
