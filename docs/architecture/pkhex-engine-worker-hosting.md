# PKHeX Engine Worker Hosting Strategy

Issue: https://github.com/woahitsraj/pksx/issues/10

## Decision

Host the PKHeX Engine behind a Web Worker before wiring large save parsing, box traversal, legality checks, or mutation workflows into the UI. Keep the public TypeScript `EngineApi` asynchronous, and make the worker the default browser/PWA and Capacitor execution boundary once implementation work begins.

## Why Worker Hosting

The PKHeX Engine loads a .NET browser WebAssembly runtime and a large PKHeX.Core payload. Local Release measurements after publish showed:

- AppBundle size: about 23 MB uncompressed.
- `PKHeX.Core.wasm`: about 15 MB uncompressed.
- Node import/runtime setup smoke: about 73 ms.
- First version call after import: about 36 ms.
- 1 MiB invalid-save parse smoke: about 6 ms.

Those numbers are acceptable for an explicit engine load, but they are not a good fit for repeated main-thread work once real save parsing, legality checks, and mutation are connected to controller navigation. PKSX's UI depends on responsive **Controller Focus**, so engine startup and save operations should not compete with focus movement, grid navigation, or interaction feedback.

## Main Thread Hosting

Main-thread hosting is useful for the spike because it is simple and proves the .NET WebAssembly boundary with fewer moving parts. It avoids worker packaging questions and makes smoke testing easier.

It is the wrong default for production workflows because startup, parsing, legality, and serialization can run during visible UI interaction. Even if many saves parse quickly, the worst cases are exactly when the user needs the UI to remain responsive: large save files, batch operations, legality analysis, and future backup/export workflows.

## Web Worker Hosting

Worker hosting gives PKSX a stable execution boundary for expensive engine work. The UI sends typed requests and receives typed responses while the worker owns .NET runtime startup, facade calls, and failure normalization.

Byte transfer should use transferable `ArrayBuffer` payloads for save bytes whenever ownership can move to the worker. When the UI still needs to retain the original bytes, PKSX should either copy intentionally or read them again from the **Local Library** rather than relying on accidental shared ownership.

The worker should have an explicit initialization state:

- `idle`: worker exists but the .NET runtime has not loaded.
- `loading`: runtime and facade exports are loading.
- `ready`: facade calls are available.
- `failed`: startup failed and the UI can show engine-unavailable behavior.

## PWA And Capacitor

For the browser/PWA target, the worker can load static engine assets from the same published `/pkhex-engine` path that the current main-thread adapter uses. Service worker caching should cache the engine assets as immutable versioned files once the sync/publish pipeline is formalized.

For Capacitor, the worker should still load local packaged web assets rather than a server endpoint. The worker boundary remains useful because Capacitor WebViews still share a UI thread for rendering and input.

## Follow-Up Implementation Issues

Follow-up implementation issues:

- https://github.com/woahitsraj/pksx/issues/20 - Add a `PkhexEngineWorker` adapter that implements `EngineApi`.
- https://github.com/woahitsraj/pksx/issues/19 - Define typed worker request/response contracts and error normalization.
- https://github.com/woahitsraj/pksx/issues/17 - Add worker startup tests, including an `engine-unavailable` failure path.
- https://github.com/woahitsraj/pksx/issues/18 - Add fixture-backed runtime smoke tests once test save files are available.
