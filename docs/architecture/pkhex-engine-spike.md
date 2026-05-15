# PKHeX Engine Spike

Issue: https://github.com/woahitsraj/pksx/issues/3

## Recommendation

Use a .NET browser WebAssembly app as the first PKHeX Engine shape. It should publish a small `browser-wasm` runtime bundle that the Svelte app serves as static assets and loads from JavaScript. The engine should expose a narrow JSON-returning facade with `[JSExport]`, while Svelte owns UI, storage, and controller workflows.

This keeps PKSX offline-first while preserving a fast upstream update path through the `PKHeX.Core` NuGet package or a local `PKHeX.Core` source checkout.

## What was added

- `Directory.Packages.props`
  - Pins `PKHeX.Core` to `26.5.5`, matching the latest package line observed during the spike.
- `Directory.Build.targets`
  - Adds `UseLocalPKHeX=true` and `PKHeXSourcePath=...` support modeled after PKMDS-Blazor.
- `engine/Pksx.Pkhex.Engine/`
  - Minimal .NET `browser-wasm` executable project.
  - `GetVersionJson()` export for runtime/version smoke testing.
  - `ParseSaveSmoke(byte[] bytes, string? fileName)` export for byte-oriented save recognition.
  - `ListBoxSmoke(byte[] bytes, string? fileName, int box)` export for early box-slot summary testing.
- `src/lib/engine/pkhex-engine.ts`
  - A Svelte-side TypeScript loader/adapter for the published .NET runtime.
  - The public TypeScript contract uses async `EngineApi` methods so the Svelte app can use the same shape for the WebAssembly adapter, mocks, and future worker-backed adapters.

## Reference project findings

### PKHeX

`PKHeX.Core` is the source of truth for save recognition, save models, Pokemon entities, legality, and serialization. The smoke facade uses the same primitives that the existing ecosystem uses:

- `SaveUtil.GetSaveFile(bytes, fileName)` for save recognition.
- `SaveFile.BoxCount`, `SaveFile.BoxSlotCount`, and `SaveFile.GetBoxSlotAtIndex(box, slot)` for box traversal.
- `SaveFile.PartyCount` and `SaveFile.GetPartySlotAtIndex(index)` are the equivalent party traversal API for follow-up work.
- `PKM.Species`, `PKM.Form`, `PKM.Format`, `PKM.CurrentLevel`, `PKM.Nickname`, and `PKM.IsEgg` are enough for the first box-grid summaries.

### PKMDS-Blazor

PKMDS-Blazor is the strongest reference for staying close to upstream PKHeX while running in a web app:

- It consumes `PKHeX.Core` as a package.
- Its `Directory.Build.targets` swaps `PKHeX.Core` for a local source `ProjectReference` when `UseLocalPKHeX=true`.
- Its guidance documents PKHeX.Core gotchas that PKSX should preserve, especially:
  - `CheckResult` is a struct.
  - Legality result spelling uses `Judgement`.
  - Box traversal uses `saveFile.BoxCount`, `saveFile.BoxSlotCount`, and `saveFile.GetBoxSlotAtIndex(box, slot)`.
  - Party traversal uses `saveFile.PartyCount` and `saveFile.GetPartySlotAtIndex(i)`.

PKSX copies the source-override pattern, not the Blazor UI architecture.

### PKHeX.Everywhere

PKHeX.Everywhere shows that a facade layer is useful:

- `src/PKHeX.Facade/Game.cs` wraps `SaveFile` and exposes `LoadFrom(byte[] bytes, string? path = null)`.
- Its facade serializes back through `SaveFile.Write(...)`.
- `src/PKHeX.Facade/PokemonBox.cs` and `src/PKHeX.Facade/Pokemons/Pokemon.cs` demonstrate useful domain-facing wrappers over raw PKHeX.Core objects.

PKSX should copy the facade boundary idea, but keep the MVP facade much smaller and avoid coupling the first spike to plugins or cloud behavior.

## Runtime comparison

### .NET browser WebAssembly

Recommended first path.

Pros:

- Officially supports JavaScript `[JSImport]` and `[JSExport]` interop.
- Produces static assets that can be served by a SvelteKit static/PWA build.
- Works with the offline-first constraint once assets are cached by the PWA service worker.
- Uses `PKHeX.Core` directly.
- Closest fit for a future Capacitor wrapper because Capacitor serves web assets locally.

Cons:

- Requires .NET SDK plus `wasm-tools` to build.
- Requires copying or otherwise integrating published `_framework` assets into the Svelte static output.
- Interop should stay coarse-grained because crossing the JS/.NET boundary is not free.

### WASI

Not recommended for the first browser/PWA milestone.

Pros:

- Potentially useful for CLI, automation, server-side execution, or future worker-like isolation.

Cons:

- Browser integration is less direct for a Svelte PWA.
- File and host capability handling would add complexity before the browser path is proven.
- The first user-facing target is browser/PWA, not a WASI shell.

### Generated or packaged JS interop layer

Useful later, not the first spike target.

Pros:

- Could make the Svelte-facing API cleaner after the .NET runtime shape stabilizes.
- Could generate TypeScript types from C# contracts.

Cons:

- Does not remove the core need to host .NET WebAssembly.
- Adds tooling before the runtime feasibility question is closed.

## Build and verification commands

On a machine with .NET installed:

```sh
dotnet workload install wasm-tools
dotnet restore engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj
dotnet publish engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj -c Release
```

The spike was validated locally with:

- .NET SDK `10.0.300`
- `wasm-tools` workload `10.0.108/10.0.100`
- `PKHeX.Core` package `26.5.5`

The publish command succeeds and produces:

- `engine/Pksx.Pkhex.Engine/bin/Release/net10.0/browser-wasm/AppBundle/`
- `AppBundle/_framework/PKHeX.Core.wasm`
- `AppBundle/_framework/Pksx.Pkhex.Engine.wasm`

The generated bundle was also smoke-tested through Node:

```sh
node -e "import('./engine/Pksx.Pkhex.Engine/bin/Release/net10.0/browser-wasm/AppBundle/main.js').then((m) => { console.log(m.pkhexEngine.GetVersionJson()); console.log(m.pkhexEngine.ParseSaveSmoke(new Uint8Array([1,2,3]), 'bad.sav')); })"
```

Expected smoke output shape:

```json
{"ok":true,"value":{"pkhexCoreVersion":"26.5.5.0","facadeVersion":"1.0.0.0"},"error":null}
{"ok":false,"value":null,"error":{"code":"unsupported-save","message":"PKHeX.Core could not recognize this save file."}}
```

To test against a local PKHeX source checkout:

```sh
dotnet publish engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj -c Release -p:UseLocalPKHeX=true -p:PKHeXSourcePath=/path/to/PKHeX/PKHeX.Core/PKHeX.Core.csproj
```

After publish, copy the publish output to a static path served by Svelte, for example:

```sh
rm -rf static/pkhex-engine
mkdir -p static/pkhex-engine
cp -R engine/Pksx.Pkhex.Engine/bin/Release/net10.0/browser-wasm/publish/* static/pkhex-engine/
```

Then the Svelte app can load the facade through `createPkhexEngine('/pkhex-engine')`.

## Follow-up issues

- Add a CI job that installs .NET SDK + `wasm-tools` and publishes `engine/Pksx.Pkhex.Engine`.
- Add a script that publishes the PKHeX Engine and copies its static assets into `static/pkhex-engine`.
- Replace JSON string exports with a measured interop strategy if byte arrays or large summaries become expensive.
- Add a fixture-based browser smoke test once test save files are available.
- Decide whether the engine should run on the main thread or inside a Web Worker before large save operations are wired into the UI.
- Generate or expose stronger TypeScript game-version types from PKHeX.Core if UI workflows need exhaustive game branching. Do not maintain a hand-written TypeScript enum that can drift from PKHeX.Core.
- Investigate the remaining `PKHeX.Core` trim warnings before treating Release publish as production-hardening complete.

## Remaining warning

Release publish currently emits:

```text
PKHeX.Core.dll : warning IL2104: Assembly 'PKHeX.Core' produced trim warnings.
```

The PKSX facade's own JSON trim warnings were removed by switching exported JSON responses to `System.Text.Json` source generation. The remaining warning comes from the upstream `PKHeX.Core` assembly under WebAssembly trimming and should be tracked separately from the architecture spike.
