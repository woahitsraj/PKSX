---
version: 1
slug: 'src-routes-pokedex-page-svelte'
primary_target: 'src/routes/pokedex/+page.svelte'
related_targets: []
---

# Pokedex destination

Scope: `src/routes/pokedex/+page.svelte`. Mode: Operate. World: the established PKSX look, unchanged.

Audience and job: a person on a handheld, phone, or desktop who marks species Seen or Caught in a Generation 1 through 5 or Legends: Arceus Save File, and sometimes changes the game-specific values the engine reports.

Constraints: controller, keyboard, touch, and pointer. Floors 640x360 and 360x640. No ambient Dirty Workspace label. Engine labels and ranges are shown as given. A value the Engine ties to a species is edited on that species row, and so are the gender, form, and language flags that Generations 4 and 5 report as toggles; the rest stay in game-specific values. Legends: Arceus lists only the Hisui Pokedex. Its species editor shows the research level, Complete and Perfect, a Report research action, and one number input per research task with the goals and reported count in the label; tasks the game sets show their value as text. Mark all Seen and Mark all Caught each apply one Engine edit to every species.

Shared product and design authority: PRODUCT.md, DESIGN.md and .impeccable/design.json on main. This screen extends that system; it does not replace those records.

Unresolved: status filters are not in scope.

## Direction contract

THESIS: The Pokedex leads with its own count. The screen answers "how complete is this dex" before it lists anything, and every edit moves that count in place. It refuses the flat settings list of unlabelled rows.

OWN-WORLD: PKSX paper panels and ink text. Seen and Caught are durable state, so they use ink only: an eye mark for Seen, a checked box for Caught, filled when set and outlined when not, with a muted ink meter for Seen and a full ink meter for Caught. Rust (Ember in dark) is kept for focus, hover, and the caret, as the One Accent Rule requires. Brass is not used, because nothing here is a Carry source. Numbers are mono; words are sans. Signature move: a species sprite is a dark outline until it is Seen or Caught, so the list reads as dex state without reading labels.

STORY: The user sees Seen and Caught totals, finds a species by name or number, and presses Seen or Caught on its row. The totals and the sprite change at once.

FIRST VIEWPORT: Wide containers: one composition, at most rail plus 44rem, centered like Saves and Boxes. A left rail with title, Save File name, Seen and Caught totals with meters, then game-specific values. The right column holds search and the species list at full height. Narrow containers: title, totals side by side, a collapsed game-specific values control, search, then the list.

FORM: Totals-led summary rail, position 7 of 7 on the ordered list (1 flat ledger list, 2 check table with column headers, 3 generation bands with jumps, 4 multi-column ledger, 5 sprite grid, 6 list plus detail rail, 7 totals-led). seed:ae6932c9adf8cbc0

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
