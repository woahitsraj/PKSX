# Linked-save Export model

`LinkedSaveExport.tla` is a TLA+ model of **Export** to an Android-linked emulator file and of its pending-recovery journal. This path writes the user's real emulator files. TLC checks every order of the steps below, so it finds races that unit tests do not reach.

Run it with:

```sh
pnpm check:export-model
```

It needs `java` 11 or later on `PATH` (or set `JAVA`). On the first run it downloads a pinned `tla2tools.jar` to `~/.cache/pksx-tla/`. It takes about 10 seconds. CI runs it in the Svelte checks job.

## When to run it

Run the check, and read this model again, when a change touches:

- `src/lib/pksx/linked-save-sources/index.ts`: `observe`, `export`, `loadExternal`, `recover`, or `#inspect`.
- `android/app/src/main/java/com/pksx/app/LinkedSavesPlugin.java`: `source`, `inspect`, `accept`, or `write`.
- The "Restore the emulator file first" guards: `recoveryBackupId` in `src/lib/pksx/linked-save-sources/runtime.ts`, `confirmDelete` in `src/routes/saves/SavesGrid.svelte`, and `deleteBackup` in `src/lib/components/pksx/BackupBrowser.svelte`.
- How a rescan imports a linked document: `#scan` in `src/lib/pksx/linked-save-folders/runtime.svelte.ts`, `importLinkedSave`, and the `linkedDocumentId` match in `importSave` of `src/lib/pksx/saves/capacitor-storage.ts`.
- Any new code path that deletes a Save File or a Backup.

The script also looks for each mapped function by name. If a name is gone, it prints `MISSING` and fails. Then update the model and the table below, and the names in the script.

If a change alters what a function does, change the matching action so that it does the same: the same guard, the same writes, one action for each atomic step. Do not change the rules to make a check pass.

## Rules

| Rule                   | Meaning                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PendingKeepsSaveFile` | While the source has a pending recovery, its Save File exists.                                                                                                                                                                                           |
| `PendingKeepsBackup`   | While the source has a pending recovery, its pre-export Backup exists, with the same owner and bytes.                                                                                                                                                    |
| `NoWriteWithoutBackup` | No Export or recovery opens the emulator file for write unless that Backup exists.                                                                                                                                                                       |
| `NoDuplicateSaveFile`  | A rescan never makes a second Save File for one linked document. No check can break it: `importSave` matches `linkedDocumentId` in the same step that it adds the Save File, and scans run one at a time.                                                |
| `SourceStaysUsable`    | The plugin does not reject a Save File because an older owner left a pending recovery. This is the harm of the first Codex finding on [Export linked Android saves to their source with conflict recovery](https://github.com/woahitsraj/PKSX/pull/488). |
| `TypeOK`               | Each variable has a value of the correct type.                                                                                                                                                                                                           |

## Checks

| Check                         | Expected | What it shows                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guarded`                     | holds    | All rules hold with the code on `main`.                                                                                                                                                                                                                                                                             |
| `reaches-pending-recovery`    | breaks   | An Export can leave a pending record, so the `guarded` pass is not vacuous.                                                                                                                                                                                                                                         |
| `source-can-vanish`           | breaks   | Finding 1, open on `main`. See Findings.                                                                                                                                                                                                                                                                            |
| `delete-races-export`         | breaks   | Finding 2, if the UI allows it. See Findings.                                                                                                                                                                                                                                                                       |
| `without-delete-save-guard`   | breaks   | Without the Saves guard, the first Codex finding on [Export linked Android saves to their source with conflict recovery](https://github.com/woahitsraj/PKSX/pull/488) comes back: an app kill leaves a pending record, the Save File is deleted, and a rescan makes a new Save File that the plugin always rejects. |
| `without-delete-backup-guard` | breaks   | Without the Backup Browser guard, the second finding comes back: the pre-export Backup is deleted while recovery needs it.                                                                                                                                                                                          |

`ok` means the result is as expected. `CHANGED` means a change made a rule break or hold. When a rule that held now breaks, the change adds a bug or the model edit is wrong. When `source-can-vanish` or `delete-races-export` holds, a change closed that gap: remove its check, and turn on that case in `guarded` (`SourceCanVanish = TRUE` or `DeleteRacesExport = TRUE`).

## Actions and code

| Action                                       | Code                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RescanSnapshot`, `RescanImport`             | `LinkedSaveDiscovery.#scan` (`runtime.svelte.ts`) reads `listSaves`, then calls `importLinkedSave`. `CapacitorSavesStorage.importSave` returns the existing Save File for the same `linkedDocumentId`.                                                                                                   |
| `ObserveAny`                                 | `LinkedSaveSources.observe`, called by `checkSources` and by `recoveryBackupId`. `Inspect` is `LinkedSavesPlugin.inspect` with `source()`: it rejects a new owner while the old one is pending, clears a pending record when the file has the `afterHash` (completed) or the `beforeHash` (not written). |
| `LoadExternalAny`                            | `LinkedSaveSources.loadExternal` and `LinkedSavesPlugin.accept`.                                                                                                                                                                                                                                         |
| `ExportStartAny`                             | `LinkedSaveSources.export` up to `createBackup`: inspect, refuse a pending record, accept equal bytes, refuse a changed or damaged emulator file.                                                                                                                                                        |
| `RecoverStartAny`                            | `LinkedSaveSources.recover` up to `createBackup`: the journal's recovery Backup must exist with the recorded hash.                                                                                                                                                                                       |
| `ExportBackup`                               | `storage.createBackup` with reason `linked-source-before-export` (or `linked-source-before-recovery`).                                                                                                                                                                                                   |
| `WriteJournal`                               | `LinkedSavesPlugin.write` up to the first `persist`: hash checks, then the pending record.                                                                                                                                                                                                               |
| `WriteTruncate`                              | `openFileDescriptor(before.uri, "rwt")`, which empties the emulator file.                                                                                                                                                                                                                                |
| `WriteBytes`                                 | `output.write(bytes)` and `sync()`.                                                                                                                                                                                                                                                                      |
| `WriteCommit`                                | The read-back check and the second `persist`, which clears the pending record.                                                                                                                                                                                                                           |
| `DeleteSaveCheckAny`, `DeleteSaveCommit`     | `SavesGrid.confirmDelete`: the `recoveryBackupId` guard (check), then `SaveFileEditCoordinator.deleteSave` and `CapacitorSavesStorage.deleteSave`, which removes the Save File and its Backups (commit).                                                                                                 |
| `DeleteBackupCheckAny`, `DeleteBackupCommit` | `BackupBrowser.deleteBackup`: the `recoveryBackupId` guard (check), then `deleteOwnedBackup` (commit).                                                                                                                                                                                                   |
| `EmulatorWriteAny`                           | The emulator writes its file.                                                                                                                                                                                                                                                                            |
| `SourceVanishes`, `SourceReturns`            | The user unlinks the folder (`LinkedSaveDiscovery.unlink`) or moves the file, then links it again. The plugin can then not read the file.                                                                                                                                                                |
| `AppKill`                                    | The app stops at any step. An error in a step has the same effect.                                                                                                                                                                                                                                       |

`unsafeWrite` is a ghost variable. It exists only to state `NoWriteWithoutBackup`.

## Findings on `main`

1. `source-can-vanish`: Export starts, the journal is written, then the user unlinks the folder (or the file becomes unreadable) and the app stops. `observe` now returns `unavailable`, so `recoveryBackupId` returns nothing and both guards let the delete continue. After the folder is linked again, the rescan makes a new Save File, and the plugin rejects it with "The previous source link needs Export recovery." The guards treat "cannot read the source" as "no pending recovery". The pending record is in the plugin's own storage, so the guards could read it without the emulator file.
2. `delete-races-export`: the delete guard passes because nothing is pending. Then an Export starts and writes its Backup and journal. The delete commits and removes the Save File and that Backup, and the Export then empties the emulator file. The guard's `observe` waits for a running Export, but the delete itself does not. The model does not know if the UI can start an Export from Boxes while a delete from Saves waits, so `guarded` assumes it cannot (`DeleteRacesExport = FALSE`). A device test or a lock in the delete would settle it.

## Assumptions and bounds

- One linked document. At most 2 Save Files in one run, 2 Backups at one time, and 3 Exports or recoveries (`MaxSaves`, `MaxLiveBackups`, `MaxExports`). About 73,000 states.
- File contents are three valid values and one torn value. A hash is the same as the bytes.
- One Export or recovery runs at a time. `LinkedSaveSources.#run` queues them for each document, and the plugin runs on one worker thread.
- The guard check of a delete waits for a running Export, as `observe` does. In `guarded`, the delete commit also waits (`DeleteRacesExport = FALSE`). Finding 2 is the case where it does not.
- Each `persist` to `SharedPreferences` is atomic (`commit()`).
- The rescan can remove a document from the "dismissed" list, because linking the folder again clears it.
- Left out: Workspace edits, `Export a copy`, Cloud Sync, more than one linked document, Backup pruning, and the content of the dismissed list.
- A pass covers this model only, not the whole system.
