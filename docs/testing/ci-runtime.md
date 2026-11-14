# CI runtime

## Baseline

Measured before editing CI on 2026-11-14 using `gh run list`, the Actions jobs API,
and `gh run view --log`. Durations below are timestamp differences in seconds,
rounded to whole seconds by GitHub. Wall time spans run creation through the last
successful job's completion, including deployment. These are three successful,
non-retried runs, not a controlled repeated benchmark.

| Run                                                                              | Context                | Wall time | Engine job | E2E step | Android job | iOS job |
| -------------------------------------------------------------------------------- | ---------------------- | --------- | ---------- | -------- | ----------- | ------- |
| [Base commit CI](https://github.com/woahitsraj/PKSX/actions/runs/43567385924)    | main, e4f0d9c2         | 28m28s    | 21m14s     | 18m13s   | 7m04s       | 6m52s   |
| [Switch trade CI](https://github.com/woahitsraj/PKSX/actions/runs/43567725228)   | pull request, 78835203 | 26m05s    | 17m59s     | 14m32s   | 7m53s       | 5m41s   |
| [Backup preview CI](https://github.com/woahitsraj/PKSX/actions/runs/43567035356) | pull request, 78c10ed3 | 37m28s    | 28m53s     | 25m05s   | 8m21s       | 6m56s   |

The main run uses this change's exact base commit and ran 184 E2E tests with two
workers. The engine job's E2E step includes browser installation from the package
script, production build, server startup, and tests. Playwright reports 18.2 minutes
and identifies the Chromium `box-shell.e2e.ts` file as 17.9 minutes. This file runs
sequentially internally, despite two workers being available.

Main's critical path was change detection, engine job, then Android. Initial jobs
started one to two seconds after run creation. The engine started two seconds after
change detection completed, and Android started one second after the engine finished.
These are scheduling gaps derived from job timestamps, not an independent runner
queue metric. They cannot explain minutes of runtime. Summing job durations measures
runner consumption, not time a developer waits.

## Change

Publish and smoke-test the engine, then build the web app once. Transfer the existing
`web-build` artifact to native and deployment jobs. Transfer `.svelte-kit/output` in
`browser-test-build` to four browser shards. SvelteKit preview requires its server
manifest and client/prerendered output, so the static deployment directory alone
cannot replace that artifact.

Each shard runs `playwright test --fully-parallel --workers=2 --shard=N/4` with
`PKSX_E2E_PREBUILT=1`. The flag skips only the build inside Playwright's server
command. Local `pnpm test:e2e` still builds by default. Test-level parallelism is
necessary because file-level sharding would leave the largest file on one runner.
Playwright's [sharding documentation](https://playwright.dev/docs/test-sharding)
describes this distinction. Browser contexts isolate storage, and the existing E2E
suites have no shared mutable Node state or suite-wide setup/teardown hooks.

Native jobs depend on the built artifact and overlap the browser shards. The existing
`PKHeX Engine publish` check name aggregates the build and every browser shard.
Deployment and signed native release jobs require that gate. A failed shard fails
the aggregate gate; `fail-fast: false` lets all shards finish their coverage and
screenshots. Screenshot artifact names include the shard to prevent upload conflicts.
Markdown-only build skipping remains as before.

No tests, projects, timeouts, assertions, retries, or native acceptance steps are
removed. Test discovery verifies exactly the same 184 test identities across the four
shards, with no omissions or duplicates, and 46 tests per shard.

## Setup and cache decisions

The baseline already caches the pnpm store and Gradle dependencies. Node dependency
installation is below eight seconds in the sampled main run. Its .NET workload setup
takes 19 seconds, engine publish 29 seconds, smoke tests 45 seconds, and browser setup
45 seconds. Those are much smaller than E2E execution. Engine and workload caches
would add invalidation and SDK-version concerns without addressing the critical path.
Browser binaries remain uncached, consistent with Playwright's
[CI guidance](https://playwright.dev/docs/ci). Native acceptance, emulator setup, and
iOS's separate compile/test invocations remain possible follow-up work.

## Integration and limitations

Four browser runners and extra artifact transfers trade runner usage for wall time.
Runner capacity, download throughput, and unequal test durations can limit the gain.
Count-balanced shards are not duration-balanced. No proportional fourfold speedup is
claimed. Compare successful runs with identical test counts, runner images, and
cache conditions, and separate native, browser, and scheduling times.

The budgets thread owns new budget gates. Attach bundle measurements to the producing
`web-build` job and preserve the browser gate. The tooling thread owns lint/format
migration. This change leaves `package.json`, the lockfile, and lint commands untouched.
Other CI speed changes must preserve `web-build` producer dependencies, all four
shards, unique artifact names, and explicit browser validation before signed releases.
The existing required check names remain available.
