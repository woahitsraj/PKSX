# PKSX

PKSX is an offline-first Pokemon save management app. The app uses a controller-friendly SvelteKit UI and a C# WebAssembly **PKHeX Engine** that wraps `PKHeX.Core` for save parsing, validation, legality, serialization, and mutation work.

The first milestone is a browser/PWA tracer bullet: prove that the Svelte app can load local save bytes, call PKHeX-compatible logic through WebAssembly, and keep user-controlled import/export workflows explicit.

## Environments

| Environment | URL                                           | Deployment                               |
| ----------- | --------------------------------------------- | ---------------------------------------- |
| Production  | [pksx.app](https://pksx.app/)                 | Signed `vX.Y.Z` release tags from `main` |
| Staging     | [staging.pksx.app](https://staging.pksx.app/) | Every push to `main`                     |

## Project Shape

- **Frontend**: SvelteKit 2, Svelte 5, Tailwind CSS, static adapter
- **Engine**: .NET `browser-wasm` project in `engine/Pksx.Pkhex.Engine`
- **PKHeX source**: pinned `PKHeX.Core` NuGet package by default, optional local PKHeX source checkout for upstream testing
- **Storage direction**: app-managed Local Library for imported save artifacts, backups, and future bank data
- **Primary UX direction**: box-first, controller-friendly save management

PKSX should stay aligned with upstream PKHeX behavior. Prefer wrapping `PKHeX.Core` over reimplementing Pokemon save logic in TypeScript.

## Prerequisites

- Node.js 23.6 or newer
  - The engine sync script is TypeScript and runs through Node's native type stripping.
- pnpm
- .NET 10 SDK
- .NET WebAssembly workload:

```sh
dotnet workload install wasm-tools
```

## Setup

Install dependencies:

```sh
pnpm install
```

Start the development server through Portless:

```sh
pnpm dev
```

This serves the app at `https://pksx.localhost`. On first run, Portless may ask to trust its local development CA so it can serve HTTPS locally.

Open the app automatically:

```sh
pnpm dev -- --open
```

## Commands

| Command                    | Purpose                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                 | Start the Vite/SvelteKit dev server through Portless at `https://pksx.localhost`.           |
| `pnpm build`               | Build the static production app.                                                            |
| `pnpm preview`             | Preview the production build locally.                                                       |
| `pnpm engine:sync`         | Publish the PKHeX Engine and sync generated browser WASM assets into `static/pkhex-engine`. |
| `pnpm typecheck`           | Run `svelte-check` and TypeScript checks for `scripts/**/*.ts`.                             |
| `pnpm check`               | Alias for `pnpm typecheck`.                                                                 |
| `pnpm check:watch`         | Run Svelte type checking in watch mode.                                                     |
| `pnpm native:sync:ios`     | Build the web app and sync it into the Capacitor iOS project.                               |
| `pnpm ios:open`            | Open the native iOS project in Xcode.                                                       |
| `pnpm ios:build`           | Build and sync the web app, then compile an unsigned iOS Simulator app.                     |
| `pnpm test:ios`            | Run native controller acceptance tests in an iPhone simulator.                              |
| `pnpm native:sync:android` | Build the web app and sync it into the Capacitor Android project.                           |
| `pnpm android:open`        | Open the native Android project in Android Studio.                                          |
| `pnpm android:build`       | Build and sync the web app, then assemble an Android debug APK.                             |
| `pnpm android:run`         | Build PKSX, start the visible Android emulator, install it, and launch the app.             |
| `pnpm test:android`        | Run native controller acceptance tests on the API 36 test emulator.                         |
| `pnpm lint`                | Check Prettier formatting and ESLint.                                                       |
| `pnpm format`              | Format the repo with Prettier.                                                              |
| `pnpm test:unit -- --run`  | Run unit tests once.                                                                        |
| `pnpm test:e2e`            | Run Playwright tests. Currently passes when no E2E tests exist.                             |
| `pnpm test`                | Run unit tests and Playwright tests.                                                        |

## PKHeX Engine

See [Android testing](./docs/testing/android.md) and [iOS testing](./docs/testing/ios.md)
for the one-time simulator setup and headless local acceptance-test workflows.

The Svelte app loads the engine from `/pkhex-engine`, which maps to generated static files under `static/pkhex-engine`.

Generate those assets with:

```sh
pnpm engine:sync
```

The command:

1. Publishes `engine/Pksx.Pkhex.Engine` with `dotnet publish`.
2. Defaults to `Release`.
3. Verifies the `.NET` SDK and `wasm-tools` workload are present.
4. Removes any existing `static/pkhex-engine`.
5. Copies the published `AppBundle` into `static/pkhex-engine`.

`static/pkhex-engine` is generated output and is ignored by git.

`engine/Pksx.Pkhex.Engine/main.js` is the required browser WebAssembly boot entry selected by `WasmMainJSPath`. Its `_framework/dotnet.js` dependency is generated into the published `AppBundle`, so focused Fallow suppressions cover that build-time boundary.

### Debug Publish

```sh
pnpm engine:sync -- --configuration Debug
```

### Local PKHeX Source

By default, PKSX uses the pinned `PKHeX.Core` NuGet package from `Directory.Packages.props`.

To test against a local PKHeX checkout instead:

```sh
pnpm engine:sync -- --property UseLocalPKHeX=true --property PKHeXSourcePath=/path/to/PKHeX/PKHeX.Core/PKHeX.Core.csproj
```

This uses the `Directory.Build.targets` source override and swaps the NuGet package reference for a local `ProjectReference`.

## Local Library storage

PKSX selects its Local Library adapter at runtime. Web and installed PWA builds use IndexedDB. Native Capacitor builds detected by `Capacitor.isNativePlatform()` use the official Filesystem plugin with `Directory.Data`.

The native adapter stores imported saves, active Workspace bytes, and Backups as binary files under `pksx-local-library`. A versioned JSON catalog stores metadata, while Pokemon Storage uses a separate JSON file. Raw Save File and Backup bytes never enter TinyBase, and unchanged Export reads the original imported file.

After adding or updating a native platform project, run `pnpm exec cap sync`. The iOS project includes the Filesystem plugin's required privacy manifest entry for App Store submission.

### Engine Versioning

- `PKHeX.Core` version is pinned in `Directory.Packages.props`.
- The PKSX facade version is reported by the engine through `GetVersionJson()`.
- Updating upstream PKHeX behavior should happen by changing the pinned package version, publishing the engine, and validating the Svelte-side contract.

## Repository Layout

```text
engine/Pksx.Pkhex.Engine/   C# browser-wasm PKHeX Engine
scripts/                    Node-executed TypeScript maintenance scripts
src/lib/engine/             Svelte-side engine API, mock engine, and WASM loader
src/lib/pksx/local-library/ Local Library storage primitives
src/routes/                 SvelteKit app routes
static/                     Static assets served by SvelteKit
docs/architecture/          Architecture notes and reference-project findings
docs/adr/                   Architecture decision records
CONTEXT.md                  Project glossary and domain language
```

## Generated Files

The following are generated and should not be committed:

- `static/pkhex-engine`
- `.svelte-kit`
- `build`
- `engine/**/bin`
- `engine/**/obj`
- `src/lib/paraglide` if Paraglide is reintroduced later

## Documentation

- [Domain glossary](./CONTEXT.md)
- [Reference projects](./docs/architecture/reference-projects.md)
- [PKHeX Engine spike](./docs/architecture/pkhex-engine-spike.md)
- [ADR: C# WebAssembly PKHeX Engine](./docs/adr/0001-use-csharp-wasm-pkhex-engine.md)
- [ADR: App-managed Local Library](./docs/adr/0002-use-app-managed-local-library.md)
- [ADR: Box-first controller UI](./docs/adr/0003-build-box-first-controller-ui.md)
- [ADR: Keep save artifacts out of TinyBase](./docs/adr/0004-keep-save-artifacts-out-of-tinybase.md)
