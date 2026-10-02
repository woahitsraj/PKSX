# Port the Link Trade host into a browser trade worker

PKSX will port the pokeldn Sword/Shield host protocol (serial framing, LDN session crypto, game session protocol, and trade state machine) into a TypeScript Web Worker that talks to the Trade Radio over an injected serial port. A local companion process would not work in Safari and needs loopback permission prompts in Chromium, and Pyodide cannot run pokeldn's trio event loop on the browser event loop. The PKHeX Engine stays PKHeX.Core-only and still prepares and parses every Pokemon Entity; the worker transmits the reviewed bytes unchanged and does not port pokeldn's trainer rewrite or PID re-roll.

## Consequences

- The first release supports desktop Chrome and Edge through Web Serial. The Android app needs a native USB serial plugin. Safari, iOS, and Android Chrome cannot reach a USB Trade Radio and show Link Trade as unavailable.
- The ported module keeps pokeldn's AGPL-3.0 and vendored LDN's GPL-3.0-only terms, so the served app links to its source and `THIRD_PARTY_NOTICES.md` lists the module.
- Users supply their own Switch keys. PKSX stores only the values the protocol needs, on the device, outside Cloud Sync, Backups, Export, logs, and Trade Receipts. The Trade Radio receives only derived session keys.
- PKSX installs pinned firmware through the same serial port with esptool-js, only when the user asks, and checks the firmware's protocol version before a Link Trade. The served firmware images are AGPL-3.0 and covered by the source link.
