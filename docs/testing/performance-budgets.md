# Application performance budgets

PKSX must keep controller navigation responsive and package its Save File workflows for offline use on the web and Capacitor. CI enforces production asset sizes and engine work counts. It does not enforce wall-clock benchmarks on shared runners.

## Run the gates

Use Node 24, the frozen pnpm lockfile, and the Release engine from the normal CI publish:

```sh
pnpm install --frozen-lockfile
pnpm engine:sync
pnpm build
pnpm check:performance
pnpm exec playwright test src/routes/box-shell.e2e.ts --project chromium --grep 'focus and rapid Box'
```

The Playwright command builds and previews the production app. Do not run a build while the size checker is reading it. CI runs the journey within its existing end-to-end suite and checks sizes after its existing final web build, before uploading that build. There is no extra CI publish, browser installation, build, or dependency.

`pnpm check:performance [build-directory]` exits nonzero on a budget violation or an incomplete build, including a missing engine. `--report-only` collects measurements without enforcing limits, but still rejects incomplete builds. It never updates budgets. Each row prints actual bytes, the limit, file count, and pass/fail. The JSON report at `artifacts/performance/bundle-report.json` lists every asset, its group, raw/gzip size, and violations. CI retains it for seven days, including on a budget failure.

## Coverage and baseline

Baseline source is commit `e4f0d9c272ccfcbc2414b35f9fa1541df8c2b201`, measured on macOS arm64 with Node 24.22.1, pnpm 11.5.1, .NET SDK 10.0.300/runtime 10.0.8, Vite 8.0.12, and SvelteKit 2.59.1. CI uses pnpm 10.33.0 and .NET 10.0.x. Installation used the committed lockfile without dependency changes. Engine publishing emitted the known upstream IL2104 warning.

All values below are bytes, not KiB. Gzip uses Node's zlib level 9 independently for each file, then sums the results. It models compressed resource bodies without HTTP headers, connection overhead, or a particular host's compression settings. PNGs may grow slightly under gzip. Raw limits protect native package/cache footprint and JavaScript parse volume even when repetitive additions compress well.

| Group               | Files | Baseline raw |   Raw limit | Baseline gzip |  Gzip limit |
| ------------------- | ----: | -----------: | ----------: | ------------: | ----------: |
| Application JS/CSS  |    49 |    2,797,362 |   3,080,000 |       405,153 |     450,000 |
| Both workers        |     2 |      549,215 |     610,000 |       178,913 |     200,000 |
| PKHeX Engine        |    36 |   26,678,079 |  29,350,000 |     7,675,369 |   8,450,000 |
| Sprite catalogs     | 3,683 |   95,714,330 | 101,000,000 |    93,900,902 |  99,000,000 |
| Other shipped files |    23 |      867,437 |     960,000 |       532,632 |     590,000 |
| Total               | 3,793 |  126,606,423 | 133,000,000 |   102,692,969 | 108,000,000 |

The largest application script is the Boxes route, 139,830 bytes gzip, with a 155,000-byte limit. This catches concentration in one script even if total code stays within budget.

Classification uses output paths, not hashed chunk names or a list of known files. Every new file enters a group and the total. Application includes all JS/CSS outside the dedicated worker, engine, and sprite directories, including lazy routes and the service worker. Workers include both the PKHeX Engine worker and Trade Worker. Engine includes the complete published runtime, assemblies, and associated files. Sprites include both Pokemon and item assets and their manifests. Other includes HTML, icons, legal files, firmware, and host configuration. Source maps and symbols count if shipped. `.gz` and `.br` sidecars with a corresponding uncompressed file are excluded because they are alternative representations of the same resources, so these totals are not deployment directory disk usage when precompression is enabled. Standalone compressed resources still count.

Group limits allow 10% growth rounded up to 10,000 bytes for application, workers, engine, and other assets. Sprites and the overall payload allow 5% rounded up to 1,000,000 bytes. The largest-script limit allows about 11%. These are regression allowances based on today's payload, not claims that the current 103 MB compressed offline install is an ideal download size. The tighter sprite/total allowance reflects their dominant cost. The independent code limits prevent large art budgets from concealing dependency growth.

The service worker eagerly caches most shipped assets, including sprites and engine assets, so the total matters for first offline installation. It excludes firmware and debug assets from its cache. This checker conservatively counts those shipped bytes anyway. It does not claim that all resources block the first page, or measure route-specific critical request chains, LCP, memory, or interaction latency. Engine bytes can vary with .NET servicing releases; both raw and compressed budgets allow modest toolchain variation. A Linux CI run remains necessary to confirm the hosted runner's engine output.

One local size-check run took 49.31 seconds wall time, 4.81 seconds user CPU, and 1.63 seconds system CPU, including pnpm startup. This is a local observation, not a hosted-runner cost guarantee. It compresses 3,793 files and adds no browser or build job.

After rebasing onto main commit `e9a38b9d6f26d1fe9f481971ae373550cd7d991b`, verification under the exclusive `perf-budgets` Mac lock measured 126,623,775 raw / 102,698,040 gzip bytes and a 144,774-byte largest application script. All existing budgets passed without raising limits. The exclusive size check took 2.81 seconds wall time, 2.67 seconds user CPU and 0.31 seconds system CPU. All 707 unit tests and three repeated Chromium journeys passed. This supersedes the earlier contended run as the local check-cost observation; hosted-runner cost is still unmeasured.

A second production build changed the total by +82 raw bytes and -8 gzip bytes, with identical file counts. Engine, sprite, and worker sizes were identical. Generated service-worker version and content hashes cause small application/HTML differences.

## Navigation work budgets

The existing Emerald import journey now counts outgoing engine requests through the real browser worker, rather than counting only responses intercepted by its hold helper:

- Twenty alternating Controller Focus moves must update the selected Slot with zero engine requests.
- Five rapid Next Box presses, with an engine response held to model a slow device, must finish on Box 06 with one or two `listBoxSlots` requests and no `loadSaveWorkspace` request.

The baseline and three repeated production-browser runs each measured zero focus requests and one Box load. The two-load limit is the accepted coalescing allowance in [Android performance testing](android-performance.md). The test controls response delivery and verifies final UI state, without a millisecond performance threshold or fixed post-operation sleep. Playwright timeouts only detect a stuck journey. Its JSON attachment and console output expose the measured work counts. This does not benchmark engine parsing speed or replace the documented Retroid device p90 latency measurements.

## Review and update

1. Run the commands above on the base and proposed branch with the same Node/.NET versions and frozen lockfile. Repeat builds to distinguish hash/version or runtime packaging changes from new application code. Keep the JSON reports with the review evidence.
2. Inspect added files and the largest scripts in the report. Check accidental eager imports, duplicated dependencies, debug files, engine packaging, or sprite generation before raising limits.
3. If growth is intentional, edit only the relevant values in `scripts/performance-budgets.json`, explain the product need and before/after bytes, and update this baseline table and toolchain record. Review the total separately. Never regenerate thresholds automatically to make CI green.
4. Re-run both gates. Keep the engine work limits unless a reviewed product/architecture decision changes the accepted navigation behavior. New journeys should count expensive work or use dedicated device measurements before adding hosted-runner timing gates.

## Regression proof

A local check added a new 524,288-byte incompressible file at `build/_app/immutable/chunks/performance-regression.js`. The unchanged gate exited 1, rejecting application raw size, application gzip size, and the largest application script, even though the overall payload remained within its budget. Removing the file restored a passing result. This proves newly emitted chunks are covered without editing a manifest or lowering a threshold. A standalone 512 KiB compressed resource also failed the other-assets budgets, and removing the engine entry file failed the incomplete-build check. Use a temporary build-only file for this experiment, never commit it. The engine-work gate was also fault-tested against the already verified production build with one Chromium worker: a temporary controller-input hook sent a real `getVersion` request through the worker on each input event. The zero-request focus assertion rejected the injected traffic. Restoring the test harness produced a passing run with zero focus requests and one Box load. Neither fault was committed.

## Integration with the other CI threads

This change adds one `check:performance` package script, two steps immediately after `Build web app` in the engine job, and strengthens one existing end-to-end test. Keep the size check after the final Release-engine-backed production build and before publishing or uploading it if the CI speed work moves that build. Preserve the report upload on failure. Run this journey once within the normal Chromium end-to-end suite; do not add a duplicate CI invocation. Lint/format migration can format these files and retain the package script without changing the lockfile or the budget semantics. Budget failures after integrating other branches require measuring their combined output, not discarding the gate.
