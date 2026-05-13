# Use a C# WebAssembly PKHeX engine

PKSX keeps PKHeX-compatible save parsing, legality, and mutation logic in C# by running a thin PKHeX.Core facade in WebAssembly. This preserves offline-first behavior while allowing upstream PKHeX updates through NuGet or a local PKHeX source override, instead of attempting a fragile TypeScript port.
