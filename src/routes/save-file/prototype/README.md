# Save File editor prototype

Throwaway route for [issue #169](https://github.com/woahitsraj/PKSX/issues/169). Three layout directions for the redesigned `/save-file`, rendered from the real PKHeX Engine projection of the committed Emerald fixture, inside the current shell. Nothing here merges.

Run `pnpm prototype:save-file`, then open `http://localhost:5173/save-file/prototype?variant=A`. The bottom bar or the arrow keys change the variant. If no Save File is active, the route imports the Emerald fixture on first load.

## Query switches

- `variant=A|B|C`
- `stress=1` fills every pocket to capacity with the longest real catalogue names at max quantity, sets Money to the engine max, and sets the trainer name to `W` repeated to `trainerNameMaxLength`. The name is the only synthetic string.
- `omit=money,inventory,trainer` marks capabilities unsupported with the engine's literal reasons. Per #168 the field is omitted and the reason never renders.
- `view=trainer|bag` picks the initial local view in variant B.
- `controls=0` hides the prototype bar for screenshots.
- The bar's `Fail next` makes the next commit fail so the restore-and-Toast path shows.

## Variants

- `A`, Sheet. One scrolling column: filename, Trainer, then Bag with Money first, a horizontal pocket chip row, and one flat list for the selected pocket. Centered at 720px in large containers.
- `B`, Local views. A Trainer | Bag switch. Bag pins Money and Add Item, puts pockets in a 148px leading rail when the container is wider than tall and a chip row when taller than wide, and scrolls the item list internally.
- `C`, Ledger. No view switch. Trainer and Money in a 260px leading column (wide) or a top block (tall). Every pocket is in one grouped scroll with sticky headers, a jump row, and per-pocket Add. Item names wrap to two lines instead of truncating.

## Shared rules under test

- Commit model from #209: Enter, Done, or blur commits text; Escape restores; gender saves on select; operators commit once and consume a valid draft; Add is one atomic command; Remove uses an inline confirmation.
- Feedback from #168: drafts and pending state are drawn on the owning control with the gold wash at 90% transparency and a `Saving...` caption; failures restore the value and raise one Toast; unsupported fields are omitted.
- Tokens from DENSITY-1 and LARGE-1 in `prototype-tokens.css`. Controls are `clamp(32px, 9.4cqh, 44px)`, spacing `clamp(2px, 0.9cqh, 6px)`, type ladder 10/12/13/16/24 stepping to 11/13/15/18/28 at 900x700.
- Money and quantity inputs are sized in `ch` from the engine max, never from viewport width.

`node src/routes/save-file/prototype/shots.mjs` captures every variant at the spec viewport matrix plus the 1000px dead band with the dev server running.
