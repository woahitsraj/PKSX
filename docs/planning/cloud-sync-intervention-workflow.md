# Cloud Sync intervention workflow proposal

For [Define exceptional Cloud Sync intervention workflow](https://github.com/woahitsraj/PKSX/issues/360), on [Wayfinder: Cloud Sync for Saves](https://github.com/woahitsraj/PKSX/issues/302).

Status: proposed for discussion, not an accepted decision. This document separates existing rules from recommendations. It does not change `CONTEXT.md` or authorize implementation.

## Already settled

[CONTEXT.md](../../CONTEXT.md) establishes causal Conflict Resolution, durable Pending Sync Changes, indefinite silent transient retries, and local editing and Export during sync pauses. Every unchosen competing state becomes a Conflict Recovery until explicitly deleted. Only the latest head of each causal branch is presented. Resolutions include every competing head as parents. Concurrent resolutions conflict again.

[ADR 0012](../adr/0012-draw-durable-state-in-place.md) puts durable state on its owner rather than in a global strip. [ADR 0014](../adr/0014-present-summoned-surfaces-as-menus-and-takeovers.md) requires a Takeover for a focused workflow, inline confirmations, one open surface, and focus restoration. These decisions rule out a new blocking dialog layer or permanent status bar.

## Recommended entry and deferral

Show an actionable status on the affected Save File or Pokemon Storage item, with a review entry on its existing actions. Opening an affected object shows its local state and the same review action. Do not automatically open review, interrupt a Carry or staged edit, or force a choice before local work can continue. Unrelated objects remain usable and keep syncing.

A user opens a Cloud Sync review Takeover explicitly. Back defers the decision and returns focus to its launcher. Deferral changes no local bytes, pending work, or competing states. The status persists until resolved. The Takeover must not apply incoming changes over staged Pokemon Edits.

## Recommended conflict review

List the newest head from every causal branch, including a deletion as a choice. Identify each by the affected Save File or Pokemon Storage item, available game/trainer or entity summary, and whether it is the current local state. Dates may aid recognition but never rank authority. Missing labels must not make a branch unselectable. Do not suggest that the newest timestamp is correct.

For a Save File Family conflict, explain the affected Workspace and Backups. For a move between a Save File and Pokemon Storage, show the linked consequences together. Offer a whole coherent state, never independent choices that strand a child or duplicate a moved entity. Show deletion and restoration consequences before confirmation.

The user selects one state's contents and confirms. Explain that other states remain as Conflict Recoveries, with an entry to browse and restore them later. Do not add a generic "keep both" choice: restoring a recovery or creating a copy is a separate explicit action with the appropriate identity rules. Keeping an edited Pokemon in Storage after it moved into a Save File must be described as creating a copy.

Prepare resolution against the exact heads shown. If a head changes before confirmation, refresh the choices and require confirmation again. Persist the resolution and its recovery references durably before indicating success. Preserve remote-only recovery artifacts on the provider; do not require every recovery byte to fit locally. If the chosen state needs unavailable bytes, keep review read-only until they can be downloaded and validated. Offline confirmation may become durable pending work, but must not claim cross-device completion. Another device's concurrent resolution remains a new conflict under the existing rules.

## Recommended failure actions

| Condition                                                                                                      | Presentation and action                                                                                            | Work that continues                                                       |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Expired credential with successful silent renewal                                                              | Nothing                                                                                                            | All local work and sync                                                   |
| Proven need to sign in                                                                                         | Account status in Cloud Sync settings, with Sign in; affected objects link there                                   | Local editing and Export; pending work waits                              |
| Unsupported Sync Revision                                                                                      | Affected object or family status with Update PKSX                                                                  | Local editing and Export; unrelated sync                                  |
| Provider Sync Quota rejection                                                                                  | Cloud Sync storage status with Manage storage, linked from affected objects                                        | Local editing, Export, downloads, and Deletion Markers                    |
| Local write cannot fit                                                                                         | Explain local storage failure on the affected operation after skipping optional Backup and Conflict Recovery bytes | Previous durable local state and unrelated work; no false acknowledgement |
| Persistent storage request denied                                                                              | Persistent degraded durability status in Cloud Sync settings                                                       | Sync and local work, subject to platform eviction                         |
| Network, rate limit, outage, unknown error, invalid revision, or migrator failure without a proven user remedy | Preserve data and retry silently; no escalation timer or generic Retry prompt                                      | Local work; unrelated sync where safe                                     |

A failed user-invoked action may give transient feedback under ADR 0012. That does not turn automatic retry failures into notifications. Do not offer Update PKSX for known-invalid data or promise that signing in repairs an unknown authorization failure.

Storage management is an entry point, not a quota amount, payment, or automatic cleanup decision. Its detailed settings and space view remain open on the map.

## Review scenarios

- Two offline Workspace edits: opening either device preserves its local edit; review selects one complete branch and retains the other as recovery.
- Save File deletion versus a new Backup: review chooses a deleted family or a live family; no orphan Backup appears.
- Save-to-Storage move versus a Workspace edit: review keeps the Workspace and Storage outcome coherent.
- A third head arrives during review: confirmation cannot silently resolve only the earlier two.
- Sign-in is cancelled: local work and pending changes survive; no adoption into another profile occurs.
- An outage lasts a month: no timer produces a prompt. A quota rejection offers storage management immediately.

## Approval needed

1. Accept explicit review with an in-place status, allowing affected objects to open and remain editable while the decision is deferred?
2. Accept selection of one coherent state, recovery of every losing state, and refreshed confirmation when the reviewed heads change, without a generic "keep both" action?

After approval, record the agreed interaction relationships in `CONTEXT.md`. An ADR is needed only if the final choice adds a durable trade-off beyond ADRs 0012 and 0014. This issue remains open until those decisions are recorded.
