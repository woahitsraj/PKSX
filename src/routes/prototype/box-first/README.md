# Box-first surface prototype

This throwaway route answers issue #159's spatial question. It now tests two decisions from review: Party behaves like another storage location, and transfers use a dedicated two-box view.

Run `pnpm prototype:box-first`, then open `/prototype/box-first?variant=A`. Use the switcher or the left and right arrow keys to compare variants. Add `controls=0` to hide the prototype switcher.

## Variants

- `A`, Navigator. One location and a detail sidecar. Boxes use 6x5, while Party uses its six real slots in the same main area. The header names the current location and exposes Party plus nearby boxes as one-click choices.
- `B`, Transfer. PKSX storage and `Emerald.sav` are visible together. Select a Pokémon, then move it into the first free slot on the other side.
- `C`, Detail dock. One location fills the width with a compact detail dock below it. Party uses the same location switcher as the boxes.

## Current working decisions

- Party does not stay visible while browsing a box.
- Party is a location in the same navigation model as numbered boxes.
- Moving Pokémon between PKSX storage and a game save gets a dedicated side-by-side view.
- The active box number and name remain visible while browsing.

The prototype keeps transfer state in memory. Reloading restores the sample data.
