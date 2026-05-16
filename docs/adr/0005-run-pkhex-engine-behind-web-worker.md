# Run the PKHeX Engine behind a Web Worker

PKSX will move the PKHeX Engine behind a Web Worker before large save parsing, legality checks, or mutation workflows are wired into the UI. The spike can keep proving the .NET WebAssembly boundary on the main thread, but production engine work should not compete with controller focus, grid navigation, or interaction feedback; a worker gives browser/PWA and Capacitor builds the same asynchronous execution boundary while keeping the Svelte-facing `EngineApi` stable.
