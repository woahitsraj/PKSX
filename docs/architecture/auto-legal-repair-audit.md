# Auto Legal repair audit

Issue: https://github.com/woahitsraj/pksx/issues/286. Policy: [ADR 0023](../adr/0023-repair-legality-with-automod-candidates.md).

This audit sorts PKHeX legality findings (`CheckIdentifier` in PKHeX.Core 26.5.5) by what Auto Legal can do with them. The engine code is `engine/Pksx.Pkhex.Engine/PkhexEngineExports.AutoLegal.cs`. The fixture tests are in `src/lib/engine/auto-legal.engine.browser.spec.ts` and run in the published browser WebAssembly bundle.

## Repaired automatically

| Finding                                                                                                                                                 | How                                                                                                                                                                                             | Evidence                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CurrentMove`, `RelearnMove`, `Ball`, `Ribbon`, `RibbonMark`                                                                                            | The four targeted Legality Fixes (`ApplyTargetedLegalityFix`). Auto Legal uses them alone when they are enough.                                                                                 | Test "uses the targeted fixes alone": a Cherish Ball on a Platinum catch changes only Ball.                                                                                                                                                                                                    |
| `PID`, `EC`, `IVs`, `Nature`, `Gender`, `Ability`, `Shiny` (correlation)                                                                                | AutoMod regenerates PID, Encryption Constant, IVs, nature, gender and ability slot together from the encounter's RNG method. The engine never corrects one value alone.                         | Test "regenerates PID and IVs together": a Platinum catch with one IV bit changed gets a new PID and IVs, same met location.                                                                                                                                                                   |
| `Encounter`, `Level`, `GameOrigin`, `Egg` (hatch data), `Fateful`, `Memory`, `Geography`, `Handler`, `Training`, `GVs`, `AVs`, `EVs`, `Misc`, `Marking` | AutoMod rebuilds the Pokemon from a matching encounter, the Pokemon's own encounter first, then sets the met data, memories, region, handler, training flags and size that the encounter needs. | Tests "repairs a newly created Pokemon" and "repairs a newly created ... Pokemon in its own game" (Emerald, Moon, Sword): a new Pikachu in X gets a PID, Encryption Constant, met data and relearn moves. AutoMod's `ApplySetDetails` sets the other values; no fixture tests them one by one. |

The candidate is offered only when a fresh Legality Check passes. Each changed field is listed with its before and after values.

## Needs a user choice

Auto Legal does not make these choices. The result is unresolved, and the reason says so.

| Finding                                                                           | Why                                                                                                           | Evidence                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Evolution` or `Level` that no encounter allows at this level                     | A repair must change the level or the species. Both are the user's choice.                                    | Test "leaves a Pokemon with an unrepairable finding unchanged": a level 5 Pikachu in Emerald. |
| `Shiny` for a shiny-locked encounter, `Trainer` for a fixed-trainer gift or trade | A repair must change the shiny state or the original trainer. The engine refuses identity changes (ADR 0023). | `IdentityChange` in the engine.                                                               |
| `Form`, `Nickname`, `Language`, `HeldItem` that conflict with every encounter     | AutoMod keeps the requested form, nickname, language and item. A legal result needs a different value.        | AutoMod returns `Failed`; the engine reports no legal encounter.                              |

## Cannot be repaired

| Finding                                                          | Why                                                       | Evidence                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Encounter` for a Mystery Gift that is not in the event database | No encounter can produce it without a different identity. | Test "leaves mixed repairable and unrepairable findings unchanged": the hacked Platinum MEW (Box 3, Slot 19). |
| Any finding on an Egg                                            | Auto Legal does not change Eggs.                          | `RepairToLegal` returns unresolved for Eggs.                                                                  |
| `SlotType`                                                       | The problem is where the Pokemon is stored, not its data. | Not changed by AutoMod.                                                                                       |
| Pokemon Unbound Save Files                                       | The engine does not run PKHeX legality for Unbound.       | `PreviewAutoLegalJson` refuses Unbound.                                                                       |

## Context matters

A candidate is checked in the context it will be written to: the Save File Slot, or Pokemon Storage. During fixture work, a candidate that passed in an X Save File Slot did not pass as a Pokemon Storage entry, so a result from one context is not reused in the other. The cause was not investigated.

## AutoMod errors

AutoMod throws on some Pokemon, for example the hacked Platinum Pokemon in Box 3, Slot 20 ("Any is not a valid entry"). The engine catches the error for each attempt and reports an unresolved result with the message. Test: "reports an AutoMod failure as an unresolved result".

## Follow-ups

- Show a choice for level or species changes instead of leaving them unresolved.
- Stop a running AutoMod attempt at once. Today Cancel ends the review, but the engine worker finishes the attempt first. A separate worker or a cancellation hook in AutoMod would fix this.
- Add fixtures for Generation 1 and 2, Legends: Arceus, Scarlet and Violet, and for `Geography`, `Memory`, `GVs` and `AVs` findings one by one.
- Batch repair (issue 387) and Showdown generation (issue 388) reuse `RepairToLegal` and the AutoMod settings in ADR 0023.
