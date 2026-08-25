# Density and type scale prototype

Throwaway route for issue #196. Three candidate token systems are applied to the three approved compositions (box-first Sidecar, Pokemon Editor IV / EV Takeover, Saves) inside fixed frames for every budget canvas.

Run `pnpm prototype:density`, then open `/prototype/density?variant=A`. The switcher or the arrow keys change the variant. `?live=box|editor|saves` fills the real viewport for a phone test. `pnpm prototype:density:measure` prints the measured numbers with the dev server running.

## Variants

- `A`, Two ladders. Every token has one Short value and one Tall value, set by a style query on `--band`.
- `B`, One fluid ladder. Body size is `clamp()` against container height; every other token derives from it by ratio. The band only moves the clamp range.
- `C`, Fixed type, fluid room. Text sizes never change in any band. Spacing, control height, radius and ring scale with allocated height.

## Shared rules under test

- Compositions consume `--t-*` tokens only and never read the band directly.
- A Slot never shrinks below `--t-slot-min`; the pane scrolls instead. Below the floor the Slot degrades in order: name and level, then index, then the sprite fills the Slot.
- The band comes from the frame (`--band`) on the wall and from raw viewport height in live mode.
