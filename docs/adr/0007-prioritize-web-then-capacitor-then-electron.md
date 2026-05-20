# Prioritize Web, then Capacitor, then Electron

PKSX will ship core workflows on the web/PWA surface first, then bring them to native iOS and Android through Capacitor, and only after that package the app for macOS, Windows, and Linux through Electron. This keeps the shared Svelte UI, Local Library model, and PKHeX Engine Facade stable before adding platform-specific storage, file access, sharing, and packaging adapters.
