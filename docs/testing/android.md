# Android testing

PKSX uses an API 36 emulator for native controller acceptance tests. The test sends
controller-sourced Android key and joystick events into `MainActivity`, then verifies
Controller Focus and visible WebView state.

## One-time setup on Apple silicon

Android Studio and JDK 21 must be installed. Accept the Android SDK licenses yourself:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" --licenses
```

Install the API 36 platform and ARM emulator image:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" \
  "platforms;android-36" \
  "system-images;android-36;google_apis;arm64-v8a"
```

Create the test AVD:

```sh
echo no | "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager" \
  create avd \
  --force \
  --name pksx-api-36 \
  --package "system-images;android-36;google_apis;arm64-v8a" \
  --device pixel_2
```

Set JDK 21 for the current shell:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

## Run

Build a debug APK:

```sh
pnpm android:build
```

Run the controller, software-keyboard, and rotation acceptance tests:

```sh
pnpm test:android
```

The test command starts `pksx-api-36` headlessly when no emulator is running, runs the
instrumentation suite, and shuts down only the emulator it started. Set `ANDROID_SERIAL`
to target a specific connected device. The native fixture captures and restores the target's
display size, density, rotation policy, angle, and handwriting setting. The runner independently
captures those settings for an existing target and restores them on normal exit, including a
Gradle or instrumentation failure.

The suite verifies the 360 by 640 portrait and 640 by 360 landscape endpoints at density 160.
It opens the real Android software keyboard, checks the Tall Height Band lock while the WebView
shrinks below 560 CSS pixels, and rotates Boxes, Carry, Menus, the Pokemon Editor, and active
Trainer editing. CI runs the same state and geometry assertions on an API 36 Pixel 2 x86_64
emulator. Failures report the destination, pane and Location identities, Controller Focus, Carry,
open workflow, Height Band, viewport, WebView, insets, and relevant rectangles.

This is the executable Native gate from
[`design-contract-enforcement.md`](../architecture/design-contract-enforcement.md#native-gate).
It traces the fixed API 36 Pixel 2 baseline to BUDGET-2, keyboard-open rotation and live input
to RESP-2, pane and Carry identity to FOCUS-2 and FOCUS-3, and destination, Menu, and Takeover
ownership to FOCUS-4. Together with the deterministic browser coverage, it supplies the native
acceptance assigned to #205.

## Linked Dolphin save folders

Settings > Linked save folder uses Android's system folder picker. Choose the
Dolphin location exported by its document provider, then GC or a GCI save subfolder.
No direct Android/data path or broad storage permission is required. If Dolphin
is absent from the picker, export individual GCI files into a selectable folder.
Whole RAW/GCP memory cards are not supported. The generic folder option recognizes
GCI, SAV, DAT, BIN, DSV, SRM, and extensionless save candidates through the engine.

The following device acceptance checks must run outside performance measurements.
Never replace a package another thread is measuring. The browser XD fixture test
covers engine validation and import, but does not prove Android grants or Dolphin
provider behavior.

1. Cancel the system picker and confirm the previous link and Saves stay intact.
2. Select installed Dolphin's GC folder. Scan its Pokemon XD GCI save, inspect the
   relative path, and explicitly import it. Open it from Saves and verify XD game,
   trainer, party and boxes. Confirm the original GCI bytes remain unchanged.
3. Restart PKSX, rescan, and verify the grant survives and the document reads
   Already in Saves. Repeat with a relink and with two different GCI documents
   sharing a filename. The latter must remain separate imports.
4. Cancel during discovery. Confirm the UI remains responsive and partial results
   remain importable. Check that Cache, shaders, textures and unrelated Dolphin
   folders are skipped. Select a smaller folder when entry or depth limits appear.
5. Remove the grant or move the selected folder. Confirm scan errors explain
   relinking. Relink and rescan. Unlink and verify previously imported Saves remain.
6. Choose another save folder and discover a recognized non-GCI save. Check invalid
   files do not appear as importable saves, and RAW/GCP guidance stays visible.

Native discovery and reads use a background executor and cancellable provider
queries. Scans stop after 2,000 entries or 12 nested folder levels, with per-folder
results also capped at 2,000 entries. Candidate reads stop at 16 MiB. Cancellation
stops scheduling new work and suppresses results from an engine validation already
in flight. Each import re-reads and revalidates the source. The Saves catalog stores
provider authority and document ID atomically with the import, so rescans and
concurrent repeated imports cannot duplicate a linked document. It deliberately
keeps the imported copy when the source changes. Trainer-based replace/import-as-new
reconciliation remains separate work in
[Detect repeated Save File imports and offer replace or import as new](https://github.com/woahitsraj/PKSX/issues/269).

## General emulator discovery

Choose save folder in Settings. Multiple folders stay linked. Scanning starts after
linking, on startup, when returning to PKSX, and on request. Recognized new saves
appear automatically in Saves. Background discovery preserves the active Save File,
Workspace, navigation and controller focus. Unlink removes access, not imported copies.
Android still requires a user grant, PKSX cannot silently scan other apps' private data.

| Family       | Layout fixture                                                         | Verification scope                                                         |
| ------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| RetroArch    | `RetroArch/saves/mGBA/Pokemon.srm`                                     | Flat battery saves, nested per-core folders; ROMs and system assets pruned |
| melonDS      | `melonDS/roms/Pokemon.sav`                                             | Saves beside ROMs, so ROM directories remain traversable                   |
| DraStic      | `DraStic/backup/Pokemon.dsv`                                           | Battery save path; save states excluded                                    |
| Pizza Boy    | `Pizza Boy A/saves/Pokemon.sav`                                        | Accessible battery exports; private folders require emulator export        |
| Azahar/Citra | `sdmc/Nintendo 3DS/id0/id1/title/00040000/00055e00/data/00000001/main` | Emulated SD layout; content, extdata, databases and NAND pruned            |
| Dolphin      | `GC/USA/Card A/Pokemon.gci`                                            | Dolphin 2603a on Retroid Pocket 6 verified with the installed XD save      |

The first five rows describe verified layout fixtures, not a promise that every
emulator version or container format works. Every candidate must pass the existing
PKHeX Engine. Compressed, encrypted, unknown and inaccessible saves are not claimed
as supported; link an accessible battery-save export if parsing or access fails.
Supported filename filters include SAV, SRM, BIN, DAT, GCI, DSV, BAK, MAIN and
extensionless files. ROM and save-state extensions never qualify. Empty files are
skipped. Scan entry/depth/read limits remain the same as the linked-folder gate above.
Cancellation waits for an already-started durable import to settle before releasing
the scan, so a cancelled scan cannot leave an untracked background import.

Discovery rules were checked against the
[PKForge linking guide](https://pkforgeapp.com/wiki/linking-your-emulator/) and
[scanner reference at c1d12b6](https://github.com/sofianeelhor/PKForge/blob/c1d12b6d1b0239e57ead0c1e1add1432d24f7e3a/src/PKForge.App/Platforms/Android/AndroidEmulatorScanner.cs).
Fixtures simulate directory layouts and reuse engine-readable save bytes. They do
not emulate those apps or verify platform-specific save containers.

## Linked source Export and refresh

This extends folder discovery. New links request read/write grants. Previously read-only links can still scan and import; select the folder again to grant write access. Export on a linked Save File targets its original document. Export a copy stays available when permissions or source conflicts block write-back. Manual imports without a linked document retain copy Export.

Use disposable copies in a user-selected folder, close the emulator before Export, and preserve the original profile package and emulator files. Verify the exact frontend/native head, not only a previous discovery build:

1. Restart and resume with an unchanged source. Confirm no duplicate imports or modal update prompts, and verify navigation stays usable.
2. Edit only the app Workspace and Export. Check the pre-write external Backup, source byte equality with serialized Workspace bytes, unchanged imported baseline, and no write/extra Backup on identical Export.
3. Change only the source, then change both source and Workspace. Confirm Export blocks competing bytes, Export a copy works, and external refresh requires confirmation and preserves the prior Workspace and imported baseline in Backups. Open those Backups for the correct owner and restore them through the existing workflow.
4. Remove the grant and restart. Confirm clear relink guidance, retained local data, and refused write-back. Relink the same document and confirm no duplicate import.
5. With a controlled test document provider, reject write access, fail after truncation/partial output, and stop the isolated app after durable journal creation and after completed output. Confirm failures never claim success; restart distinguishes unwritten, completed, and indeterminate bytes. Explicit recovery must preserve partial bytes, restore the original external Backup, and verify read-back. A normal filesystem provider alone cannot prove interrupted-provider behavior.
6. Repeat source Export and reload in Dolphin Pokemon XD when device access is granted. Never overwrite the user's original emulator save during acceptance. General emulator layout fixtures prove discovery/Engine recognition, not write behavior for every emulator version or provider.

SAF provides no portable atomic replace or compare-and-swap. A provider may truncate before a failed write and descriptor sync may be unsupported. The durable journal, pre-write Backup, read-back check, and explicit recovery are the guarantees under test. No automatic retry overwrites a document.

Write-back acceptance for this expansion is pending. Historical read-only Dolphin acceptance does not prove this path.
