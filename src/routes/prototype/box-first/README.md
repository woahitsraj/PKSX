# Box-first surface prototype

This throwaway route records the answer to issue #159's layout question. The Box view is one reusable pane with its save name, box number, box name, navigation, slot grid, and selection state.

Run `pnpm prototype:box-first`, then open `/prototype/box-first?variant=A`. Use the switcher or the left and right arrow keys to change modes. Add `controls=0` to hide the prototype switcher.

## Modes

- `A`, Single pane. One Box pane sits beside the selected Pokémon details. Party and nearby boxes remain available in the quick location switcher.
- `B`, Two panes. Two instances of the same Box pane sit on either side of the transfer controls. Select a Pokémon, then move it into the first free slot on the other side.

## Validated decisions

- Party is a six-slot location, not permanent chrome.
- The save name, box number, and box name stay at the top of every Box pane.
- Opening a second box changes the page composition, not the Box pane itself.
- PKSX storage and game storage use the same Box pane.

The prototype keeps transfer state in memory. Reloading restores the sample data.
