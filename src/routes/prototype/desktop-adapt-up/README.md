# Desktop adapt-up prototype

Throwaway route for issue #203. It applies three large Tall-canvas rule sets to the locked Boxes, Pokemon Editor, and Saves compositions at 1280×800 and 1920×1080.

Run `pnpm prototype:desktop`, then open `/prototype/desktop-adapt-up?variant=A`. The switcher or the left and right arrow keys changes variants. Add `?live=boxes|editor|saves` to fill the current viewport, `&screen=boxes|editor|saves` to show one row, or `&controls=0` to hide the switcher.

## Variants

- `A`, Natural stretch. The #196 type ladder stays fixed, Boxes and Saves consume the whole canvas, and Boxes remains single-pane.
- `B`, Reading island. A 900×700 container steps the type ladder to 11 / 13 / 15 / 18 / 28px. Boxes stays single-pane with an 800px Box Pane and 260px Active Slot Detail Rail; Saves caps at 1200px and four columns.
- `C`, Auto workbench. The same type step applies, but a second Box Pane opens when the large composition is selected. Each Box Pane caps at 640px around the 260px rail; Saves keeps B's cap.

No variant gives desktop input a unique action. Pointer-only arrows and transfer controls invoke the same actions available from controller and keyboard bindings.

Variant C deliberately exposes the responsive-model conflict. Automatically adding a Box Pane also adds a Focus Zone, but #157 and #201 require responsive refinements to keep semantic structure and Focus Zones stable. The prototype makes that cost visible before the ticket records a decision.
