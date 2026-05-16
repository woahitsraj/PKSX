# Keep save artifacts out of TinyBase

PKSX stores raw imported save bytes and backup bytes behind a platform-specific Local Library storage adapter, while TinyBase is reserved for the reactive editor workspace, parsed projections, dirty state, validation output, and UI state. The web/PWA adapter can start with IndexedDB, but native Capacitor builds should add a native-capable adapter instead of relying on WebView IndexedDB for durable save artifacts; this keeps unchanged exports byte-for-byte faithful and lets storage durability vary by platform without leaking into UI or PKHeX Engine code.
