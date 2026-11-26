---
version: 1
slug: 'src-routes-saves-savesgrid-svelte'
primary_target: 'src/routes/saves/SavesGrid.svelte'
related_targets: []
---

# Saves library bar

## Scope and mode

Operate. A local redesign of the Saves search and sort controls, the result count and the zero-result state in `src/routes/saves/SavesGrid.svelte`. The established PKSX world, the cards, the menus and the save behavior stay as they are.

## Audience and task

A player with several imported Save Files finds one and opens it, by touch, keyboard or controller, on a phone, a short handheld or a desktop browser. Save Files stay the primary content. Pokemon Storage and Import stay reachable in every state, including zero results.

## Constraints

- Tokens and container rules from `docs/design-system.md`, ADR 0013 and ADR 0015. No viewport classification.
- At the landscape floor (616x336 allocated) the chrome is one control row, so two card rows stay visible.
- `#saves-search`, the label "Search Saves" and the Clear name "Clear search" stay.
- Filtering, the stored sort, successful-open history and focus by identity do not change.

## Direction contract

THESIS: One library bar. The title, the live count, a bounded search field and a two-segment sort share one row. It refuses the stacked toolbar of three equal bordered boxes with a generic empty panel below.

OWN-WORLD: The existing PKSX palette and tokens. Panel-filled field with a drawn search icon, a recessed two-segment track whose pressed segment is a raised panel tile in accent text, mono metadata for the count. No new color, face or shape.

STORY: The player sees how many Save Files exist, types, sees "n of total", and opens a card. On zero results one plain line names the fields that search reads and the query: "No name, game, trainer or filename contains “query”." Storage and Import are still there.

FIRST VIEWPORT: Wide or short containers: title and count at the left, search (max 22rem), the Show hidden saves button and sort at the right, clear of the Main Menu button, one control row. Containers narrower than 560px: title, count and sort on row one, search and the Show hidden saves button on row two. Cards follow directly.

FORM: seed: none (pinned). "ONE library bar: title+live count, bounded search field, trailing conditional Clear, Name/Recent segmented buttons aria-pressed, compact query-specific zero-result line without panel. Desktop/short handheld inline with title; phone title/count+sort row then full-width search."

DEVIATIONS: The sort labels are "A–Z" and "Recent" (accessible names "A to Z" and "Recent"), because "Name" beside a search field reads as a search scope. The bar stacks below a 560px container at any height, so an on-screen keyboard cannot flip the layout. In the stacked bar the count shows the number only. The placeholder is "Name, game or trainer" so it never truncates. The inline count reserves the width of "N Save Files", so the search field does not move when the count becomes "n of N". The resting field border is `--ink-soft` (at least 3:1 in both themes), hover is `--ink`, and focus stays accent. Stacked focus is measured from element geometry at keydown: ArrowUp from the field focuses the pressed sort, ArrowDown from the sort focuses the field, and Left and Right go sort first, then field. Tab and Shift+Tab follow sort, field, Clear, Show hidden saves and grid in the stacked layout, including entry and exit. The inline layout retains native DOM order. Hidden file-picker inputs are excluded from Tab; visible Import remains the entry point.

FINISH: This local redesign preserves the existing system documentation. Finish requires the independent verdict and current-source interaction evidence. Status: the independent Fable 5.2 verdicts score all four listed fixes resolved. The last verdict is ship for the stacked Tab fix; it does not reopen or reapprove the entire surface.

## Unresolved

- Show hidden saves (issue 449) shares the phone search row, so the field is about 74% of a 390px viewport, not 80%. Placing the button on the title row collapsed the count to 0px.
- No required design fix remains open. This is a local redesign within the established world, so DESIGN.md is not rewritten. Physical gamepad/native keyboard verification remains outside this browser pass.
