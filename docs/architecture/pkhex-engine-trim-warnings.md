# PKHeX Engine Trim Warnings

Issue: https://github.com/woahitsraj/pksx/issues/11

## Decision

Keep Release trimming enabled for the browser WebAssembly publish and keep the upstream `PKHeX.Core` trim warning visible in CI. Do not suppress IL2104, add root descriptors, or disable trimming for the spike until a facade API is proven broken by a trimmed runtime test.

The current warning is accepted because the detailed warnings come from broad PKHeX.Core internals rather than from the narrow PKSX facade. The facade currently uses version reporting, `SaveUtil.GetSaveFile`, save metadata, and box-slot summary reads. Those calls publish successfully and the generated runtime smoke test still returns the expected version response and unsupported-save response.

## Reproducible Evidence

Capture the grouped warning and binary log:

```sh
dotnet clean engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj --configuration Release
dotnet publish engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj --configuration Release -bl:artifacts/pkhex-engine-publish.binlog
```

Capture detailed package warnings:

```sh
dotnet clean engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj --configuration Release
dotnet publish engine/Pksx.Pkhex.Engine/Pksx.Pkhex.Engine.csproj --configuration Release -p:TrimmerSingleWarn=false -bl:artifacts/pkhex-engine-publish-trim-details.binlog
```

The detailed run on .NET SDK `10.0.300` and `PKHeX.Core` `26.5.5` produced warnings in these areas:

- `PKHeX.Core.ReflectUtil.GetAllProperties`: reflection property access without matching trim annotations.
- `PKHeX.Core.EntityBlank.GetBlank`: reflection constructor access without matching trim annotations.
- `PKHeX.Core.BinLinkerAccessor` and `BinLinkerAccessor16`: `LengthAttribute` usage marked `RequiresUnreferencedCode`.
- Encounter/evolution helpers such as `Encounters3FRLG`, `Encounters3RSE`, `Encounters8Nest`, `EncounterUtil`, and `EvolutionTree`: `LengthAttribute` usage marked `RequiresUnreferencedCode`.

## Impact On Current Facade

The current facade does not use reflection directly, does not deserialize PKHeX.Core types through `System.Text.Json`, and uses source-generated JSON metadata for its own response contracts. The warnings indicate PKHeX.Core is not fully trim-annotated as a package; they do not identify a PKSX-owned trim violation.

The current smoke surface should still be covered by runtime tests as soon as fixture save files are available:

- `GetVersionJson()`
- `ParseSaveSmoke(byte[] bytes, string? fileName)`
- `ListBoxSmoke(byte[] bytes, string? fileName, int box)`

## Options Considered

Suppress IL2104:
Rejected for now. Suppression would make CI quieter, but it would also hide newly introduced trim risk from later PKHeX.Core updates.

Add root descriptors:
Rejected for now. The detailed warnings point at broad PKHeX.Core internals, and rooting large sections of PKHeX.Core before a failing runtime scenario would make the WebAssembly bundle larger without a targeted reason.

Disable trimming:
Rejected for now. Browser and Capacitor delivery both benefit from smaller static assets, and the current trimmed bundle runs the smoke facade.

Adjust facade usage:
Not needed for the current API. Revisit this when legality checks, mutation, or generated Pokemon helpers are added, because those paths are closer to the warning-producing encounter and reflection code.

## CI Expectation

CI should fail if `dotnet publish` fails, but the current `PKHeX.Core.dll : warning IL2104` output is intentional and should remain visible. Treat new PKSX-owned trim warnings or runtime failures in the smoke facade as regressions.
