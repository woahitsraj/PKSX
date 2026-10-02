# Android performance

This procedure measures Save File opening, Box switching and navigation on a real Android
device. It gives the baseline for #372 and #373, and it is the verification procedure for
their fixes. Emulator results are not device evidence.

## Profile build

The `profile` build type uses the release configuration and the production web bundle. It
installs as `com.pksx.app.profile` beside the store app, so the store app and its Saves stay
unchanged. It is signed with the debug key and enables WebView debugging, nothing else.

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
pnpm engine:sync
pnpm android:build:profile
adb install -r android/app/build/outputs/apk/profile/app-profile.apk
```

An update install keeps the service worker of the previous build, and it serves the previous
engine files until the update is accepted. With the app running and its DevTools socket
forwarded, run `node scripts/android-perf/clear-cache.ts` after each install. Then leave the app
open until the new service worker has cached its files, which takes about a minute. A force-stop
during that time restarts the download and slows every cold launch.

## Fixtures

Import these Save Files into the profile app. With the app running and its DevTools socket
forwarded (`run.ts` does this on a cold start), `scripts/android-perf/import.ts <files>` imports
them through the real import control.

| Fixture                                                                    | Size   | Boxes | Pokemon |
| -------------------------------------------------------------------------- | ------ | ----- | ------- |
| `raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav`      | 4.4 MB | 32    | 22      |
| `raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav`        | 1.6 MB | 32    | 7       |
| `raj-pokemon-save-backups/nds/pokemon-heartgold.sav`                       | 512 KB | 18    | 187     |
| Private Pokemon XD memory card file (`01-GXXE-PokemonXD.gci`, not in repo) | 344 KB | 8     | 50      |

The repository XD fixture fails to load in the engine (#400), so XD uses a private Save
File.

## Run

Keep the device awake and on charge. Close other apps. `ANDROID_SERIAL` selects the device.

```sh
# Each scenario repeats RUNS times. SAVES are substrings of the Save File names.
RUNS=5 node scripts/android-perf/run.ts coldCards coldOpen
RUNS=5 node scripts/android-perf/run.ts warmOpen boxSwitch focus held destinations menus twoPane
RUNS=3 ENGINE_FILES=<path>,<path> node scripts/android-perf/run.ts engine
```

The runner writes every sample to `$OUT` (default `/tmp/pksx-android-perf`) and prints
p50 and p90. Each sample also lists its engine requests, long tasks and the largest frame gap.

| Scenario       | Measures                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `coldCards`    | Force-stop, launch, Saves cards visible, all card details ready          |
| `coldOpen`     | Force-stop, launch, open the active Save File as soon as its card exists |
| `warmOpen`     | Open each Save File from Saves, then return to Saves                     |
| `boxSwitch`    | One `PageDown`, and five `PageDown` presses 90 ms apart                  |
| `focus`        | One D-pad move until Controller Focus moves                              |
| `held`         | Hold Right for five moves; expected cadence is 0/280/390/500/610 ms      |
| `destinations` | Main Menu to Bag, Trainer, Boxes, Settings and Saves                     |
| `menus`        | Main Menu, Slot Menu and Pokemon Editor opening                          |
| `twoPane`      | Open a second Box Pane, then switch Boxes and move focus in each pane    |
| `engine`       | One engine call in a fresh worker, split into .NET, JSON and messaging   |

A sample ends when the expected state is in the DOM, no Box Pane is busy, every slot sprite is
decoded, and one more frame has run. Input is the same `pksxcontroller` event that
`MainActivity` dispatches.

## Baseline

Retroid Pocket 6, Android 13, Snapdragon 8 Gen 2, 11 GB. Android System WebView
109.0.5414.123 with a 32-bit renderer. Profile build of `0efb3d45`, 2026-10-01. Times are
milliseconds, p50 / p90, five runs unless noted.

| Scenario                                    | Scarlet       | Sword         | HeartGold   | XD          |
| ------------------------------------------- | ------------- | ------------- | ----------- | ----------- |
| Cold launch to cards visible (all saves)    | 3414 / 3552   |               |             |             |
| Cold launch to all card details (all saves) | 50681 / 50972 |               |             |             |
| Cold open, from tap (active Save File)      | 15774 / 16123 |               |             |             |
| Warm open                                   | 8603 / 17380  | 5871 / 5909   | 3833 / 3892 | 1797 / 2846 |
| Boxes to Saves, card details ready          | 27228 / 27382 | 11403 / 11547 | 9507 / 9572 | 1339 / 1360 |
| Next Box                                    | 1619 / 2779   | 1091 / 1185   | 856 / 1614  | 259 / 837   |
| Five rapid Next Box presses (one run)       | 6846          | 4316          | 2536        | 754         |
| Focus move, occupied Box (20 moves)         | 75 / 85       | 75 / 79       | 87 / 103    | 98 / 104    |

| Scenario                                         | Result                        |
| ------------------------------------------------ | ----------------------------- |
| Focus move, empty Box (two Box Panes, 20 moves)  | 32 / 41                       |
| Held Right, fifth move (expected 610)            | 700 / 703                     |
| Second Box Pane open (Sword beside Scarlet)      | 1692                          |
| Next Box, Scarlet pane / Sword pane              | 1690 / 2883, 1453 / 1557      |
| Main Menu to Bag / Trainer / Settings (two runs) | 2190–2401 / 440–473 / 245–250 |
| Main Menu to Boxes (Scarlet, two runs)           | 2763–3066                     |
| Main Menu, Slot Menu, Pokemon Editor opening     | 102–311, 103–336, 95–136      |

Engine calls in a fresh worker, p50 of three runs:

| Save File | `summarizeSave` | `loadSaveWorkspace` (JSON) | `listBoxSlots` box 2 (JSON) |
| --------- | --------------- | -------------------------- | --------------------------- |
| Scarlet   | 643             | 1448 (3.7 MB)              | 1591 (4.5 MB)               |
| Sword     | 241             | 1035 (3.8 MB)              | 336 (0.4 MB)                |
| HeartGold | 8               | 581 (2.7 MB)               | 1170 (5.5 MB)               |
| XD        | 23              | 633 (3.1 MB)               | 377 (1.8 MB)                |

## After #372

Same device, fixtures and procedure. Profile build of the #372 branch, 2026-10-02, after
`clear-cache.ts` and a completed service worker install. p50 / p90, five runs.

| Scenario                                    | Scarlet     | Sword     | HeartGold | XD        |
| ------------------------------------------- | ----------- | --------- | --------- | --------- |
| Cold launch to cards visible (all saves)    | 319 / 325   |           |           |           |
| Cold launch to all card details (all saves) | 3696 / 3856 |           |           |           |
| Cold open, from tap (active Save File)      | 1210 / 1278 |           |           |           |
| Warm open                                   | 1349 / 1404 | 742 / 810 | 428 / 446 | 390 / 415 |
| Boxes to Saves, card details ready (all)    | 279 / 407   |           |           |           |
| Main Menu to Boxes                          | 260 / 303   |           |           |           |
| Main Menu to Saves                          | 357 / 362   |           |           |           |

- Cold cards visible is now the paint time of the first card from Element Timing. The baseline
  value polled the DOM after DevTools connected, at about 1.8 s, so it is not comparable.
- The longest main-thread task during a warm open is 106 ms.
- Main Menu to Bag is unchanged at 2156 to 2412 ms, with a long task of about 1.3 s while the
  inventory catalogue loads.

## Bottlenecks

- **The engine keeps no state.** Every request sends the whole Save File, parses it again and
  rebuilds every slot with its edit constraints. One occupied slot costs about 20 to 25 ms of
  .NET time and about 180 KB of JSON.
- **Opening repeats work.** One warm open runs `loadSaveWorkspace` three times in series. Every
  visit to Saves loads the active Save File and calls `listBoxSlots` for every other Box. All
  calls share one first-in, first-out worker queue, so opening waits behind card scans.
- **Rapid input queues every Box.** Five `PageDown` presses run five full loads in series.
- **Native storage decodes base64 one byte at a time.** `Uint8Array.from(atob(data), callback)`
  used 2.3 s of main-thread time during one warm Scarlet open. Every save is also read and
  decoded before the first card shows, so cold cards appear at 2.8 s while first paint is at
  0.45 s.
- **Large responses cost the main thread.** Deserializing engine responses took about 0.95 s,
  and garbage collection about 0.8 s, during one warm Scarlet open.
- **Focus moves rebuild the Box.** A move in an occupied Box takes 75 to 104 ms with a long task
  of 70 to 100 ms. A move in an empty Box takes about 32 ms.
- **The renderer runs out of memory.** The main-thread heap is 100 MB at launch and reached
  268 MB. The 32-bit renderer stopped twice with `V8 javascript OOM` in two hours of scripted
  use. Each stop closed the app (#399).

## Budgets

Accepted for #372 and #373. Measure p90 with the fixtures and build above.

| Interaction                          | Budget                                                 |
| ------------------------------------ | ------------------------------------------------------ |
| Warm open, Scarlet-size Save File    | ≤ 1500 ms                                              |
| Cold launch to cards visible         | ≤ 1500 ms                                              |
| Cold open, from tap                  | ≤ 2500 ms; card details never delay opening            |
| Next Box                             | ≤ 400 ms                                               |
| Five rapid Next Box presses          | final Box ≤ 500 ms after the last press; ≤ 2 Box loads |
| Focus move                           | ≤ 33 ms; no long task over 50 ms                       |
| Held direction                       | each repeat within one frame of 280 / 110 ms           |
| Main Menu to Boxes or Saves          | ≤ 500 ms                                               |
| Main Menu, Slot Menu, Pokemon Editor | ≤ 200 ms plus their animation                          |
| 30-minute scripted session           | no renderer crash                                      |
