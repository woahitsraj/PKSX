# Repair legality with checked AutoMod candidates

Issue: https://github.com/woahitsraj/pksx/issues/286

PKSX repairs an illegal Pokemon with one **Auto Legal** candidate that the PKHeX Engine makes and checks. The engine tries the least change first: the four targeted Legality Fixes, then upstream AutoMod at the Pokemon's own encounter, then AutoMod at any encounter. The user sees every changed field before an explicit Apply, and Apply writes exactly that candidate through the existing Legality Fix token contract.

## Decisions

- **Use upstream AutoMod, built from source.** The engine builds `PKHeX.Core.AutoMod` from PKHeX-Plugins tag `26.05.05`, the tag that matches `PKHeX.Core` 26.5.5. The files are vendored unchanged in `engine/vendor/PKHeX.Core.AutoMod`. The license is MIT, which is compatible with the GPL engine. No NuGet package exists for this fork.
- **Call only the synchronous core.** The engine calls `APILegality.GetLegalFromTemplate`. AutoMod's timeout wrappers block on a `Task`, which single-thread browser WebAssembly cannot do. Its version check makes a network request. Neither runs.
- **Keep the Pokemon's identity.** AutoMod gets the Pokemon's own trainer for every game, not its built-in "ALM" trainer. The engine refuses a candidate that changes the species, form, shiny state, storage format or original trainer. It leaves the Pokemon unchanged and gives that reason.
- **Prefer the Pokemon's own game and encounter.** The first AutoMod attempt keeps the origin game, met location and met level. The second attempt allows another encounter, with the Pokemon's own game first. A changed encounter is a visible change in the review, never a silent one.
- **Restore fields that the encounter does not need.** After AutoMod, the engine puts back each original field (Ball, ability slot, nickname, experience, held item, dates, friendship, handler, PP Ups, Pokerus, size) when the result stays legal.
- **Offer only a legal candidate.** A candidate is offered only when a fresh Legality Check in the same Slot type is valid. Otherwise the result is unresolved with a concrete reason, and the Legality Report keeps its findings. Warning-only (Fishy) Pokemon are legal and get no candidate.
- **Do not change Eggs.** Auto Legal leaves Eggs unchanged.
- **Reuse the Legality Fix apply contract.** The candidate is cached under an `auto-legal:` token. Apply uses the `legality-fix` Pokemon Action with that token, so the stale-source check, Backup, Pokemon Editor draft isolation and Pokemon Storage persistence stay the same.

## Consequences

- The engine bundle grows by the AutoMod assembly, about 90 KB before compression.
- AutoMod checks its time limit between encounters. One attempt can run past the limit by one encounter. The engine worker is busy until the attempt ends, so Cancel stops the review at once but the next engine request waits for the attempt to finish.
- Settings in AutoMod are process-wide. The engine sets them once and resets the trainer list after each attempt. The engine worker is single-threaded, so attempts cannot overlap.
- The reusable core is `PkhexEngineExports.RepairToLegal(PKM, StorageSlotType)`. Batch repair and Showdown generation call it, or its AutoMod step, without the JSON layer.
