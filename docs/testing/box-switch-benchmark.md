# Box-switch benchmark

`pnpm bench:box-switch` compares held Next Box on your working tree with `main`. It gives the wall-clock numbers that CI does not: the count-based gates in [Application performance budgets](performance-budgets.md) stay as the enforced checks.

## When to run it

Run it for each PR that changes how a Box loads or how Next Box and Previous Box are handled. Examples are the pane Box load queue, the Box slot cache, the adjacent Box prefetch, and key repeat handling in `src/routes/boxes/+page.svelte`. Do not run it in CI. Shared runners are too noisy for a time gate.

## Run it

```sh
pnpm install --frozen-lockfile
pnpm engine:sync
pnpm bench:box-switch            # base is origin/main
pnpm bench:box-switch v0.1.5     # or a ref that you name
```

The command builds the base ref in a temporary git worktree and builds the working tree, uncommitted changes included. It serves both production builds on free ports and removes the worktree at the end, also on Ctrl+C. `RUNS=9` raises the run count. Fewer than 5 runs per side is not possible.

One run does this on the Emerald fixture, then on the Scarlet fixture:

1. Open a new browser profile, with the service worker blocked so its cache download does not load the CPU.
2. Import the Save File through Saves and open Boxes on Box 1.
3. Set a 4x CPU slowdown.
4. Hold `]` for 12 key repeats at 33 ms, then release.

Runs alternate between the base and the branch, so machine load and warmup affect both sides equally. Heavy load still widens the ranges, so stop other test runs when you can. One run of the command takes about 2 minutes on a 14-core Mac.

## Read the report

The report is Markdown on standard output. Each cell is the median with the range of the runs. The raw runs go to `artifacts/performance/box-switch-benchmark.json`.

| Row                     | Meaning                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Settle after release    | Time from key release until the active pane has no Box load pending.                         |
| Longest frozen gap      | Longest time the Box title did not change, from the first key press to the last change.      |
| Boxes shown during hold | Number of Box titles shown before key release. 12 is every Box.                              |
| Hold length             | Time from the first key press to release. It shows how well the driver kept 33 ms.           |
| Work: Box loads         | `listBoxSlots` engine requests from the first key press.                                     |
| Work: engine calls      | All engine requests from the first key press.                                                |
| Errors                  | Failed runs, page errors, failed engine calls, a wrong final Box, and runs with no Box load. |

The run-to-run variation is the wider of the two ranges. The probe reads the page once per animation frame, so its resolution for the time rows is 17 ms. When the gap between the medians is not larger than both, the Result column says `No measurable difference`. Do not claim a speedup or a slowdown from such a row.

A row is not evidence when the error count is not zero or the Box loads are zero. The command exits with code 1 in that case. A side that does less work can be faster because it did not do the job, so compare the work rows before you compare the times.

## Quote the result in a PR

Lead with the verdict, then give one number with its unit, run count, and range.

- Quote the settle row, or the row your change targets, with the Result text as printed. Example: "Settle after release on Scarlet: 21 ms on `main`, 19 ms on this branch, median of 5 runs per side, no measurable difference."
- State the base commit, the error count, the Box load counts, and the machine load line from the report.
- Paste the full report in a collapsed `<details>` block.
- Say that the numbers come from desktop Chromium with a CPU slowdown. They are not device evidence. For Android device numbers, use [Android performance testing](android-performance.md).

## Known result

The 300 ms quiet gate from [Make Android box switching and navigation responsive](https://github.com/woahitsraj/PKSX/pull/431) froze held Next Box until [Show each Save File Box while Next Box repeats](https://github.com/woahitsraj/PKSX/pull/508) removed it. With the gate put back on the branch, the command reported, in 5 runs per side, at a 1-minute machine load of 11 to 16 on 14 cores:

| Fixture | Settle after release, `main` | Settle after release, gate | Boxes shown during hold, `main` | Boxes shown during hold, gate |
| ------- | ---------------------------- | -------------------------- | ------------------------------- | ----------------------------- |
| Emerald | 17 ms (3 to 18)              | 197 ms (188 to 199)        | 12 (11 to 12)                   | 1 (0 to 1)                    |
| Scarlet | 2 ms (0 to 17)               | 199 ms (148 to 204)        | 12 (12 to 12)                   | 1 (1 to 1)                    |

Both slowdowns are larger than the run-to-run variation. A change that brings back a hold freeze of this size shows in the report.
