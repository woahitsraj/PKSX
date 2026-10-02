# Trade worker contract

Issue: https://github.com/woahitsraj/pksx/issues/367

The trade worker runs one Link Trade with a retail Switch through a Trade Radio (ADR 0019). This document describes version 1 of its message contract. #368 (receipts and recovery) and #369 (the workflow) build on it. The schemas are in `src/lib/link-trade/contract.ts`. If the code and this document disagree, the schemas are correct.

## Messages

The page sends commands with `postMessage`. Each command has a `requestId`. The worker sends two kinds of message:

- `response`: one for each command, with `ok`, then `result` or `error`.
- `event`: sent as the trade progresses.

Every message from the worker carries `contractVersion: 1`. Bytes are `ArrayBuffer`s.

| Command            | Result                                          | Notes                                                                                                                                                                    |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get-capabilities` | supported games, firmware, ports, `keysPresent` | `fakePort` is true only in dev builds.                                                                                                                                   |
| `import-keys`      | `{ keysPresent: true }`                         | `prodKeys` is the text of a `prod.keys` file. Errors name missing keys, never values.                                                                                    |
| `forget-keys`      | `{ keysPresent: false }`                        | Deletes the stored keys.                                                                                                                                                 |
| `connect-radio`    | `{ board }`                                     | `port` is `{ kind: 'web-serial', usbVendorId?, usbProductId? }`. The page calls `navigator.serial.requestPort()` first; the worker opens the granted port.               |
| `disconnect-radio` | `{}`                                            | Refused while a session runs.                                                                                                                                            |
| `start-session`    | the session status                              | `sessionId`, `game: 'sword-shield'`, and `offer`: the encrypted 0x158-byte party PK8 that #366 prepared. This is the wire form; the worker does not encrypt or parse it. |
| `confirm-offer`    | error `confirmation-not-supported`              | The player confirms Sword/Shield trades on the Switch. PKSX has no pause before that point.                                                                              |
| `cancel-session`   | the session status                              | The outcome follows as `session-ended`.                                                                                                                                  |
| `get-status`       | keys, board, active session                     |                                                                                                                                                                          |
| `recover-session`  | `{ status, receipt, unknown }`                  | Returns any session this worker has run since it started. #368 keeps the durable journal.                                                                                |

Session IDs are chosen by the caller: 1 to 64 characters from `A-Z a-z 0-9 _ -`. Every event of a session carries the ID and a `sequence` that starts at 0 and has no gaps, so a consumer can drop repeated events.

A `start-session` for a session ID that the worker already knows does not start another trade. It returns that session's status. A start for any other ID while a session runs fails with `session-active`.

## Checks before a trade

`connect-radio` sends HELLO and checks the reply. The board must speak radio protocol 1, report `pokeldn-radio esp32`, and run firmware `1.0.0` (pokeldn v0.4.0 `pokeldn-radio.bin`). Otherwise the command fails with one of these errors:

- `unsupported-board`: the device is not a pokeldn radio, or not a verified target.
- `protocol-mismatch`
- `firmware-mismatch`
- `port-busy`: another tab or app has the port open.
- `port-not-found`

Then the worker switches the board to 921600 baud. A trade's traffic does not fit in 115200 baud, so a board that does not hold the fast rate is refused with `unsupported-board`. A board keeps the fast rate until it loses power, so the worker also tries that rate when the base rate is silent.

`start-session` fails with these errors before any radio work starts:

- `keys-missing`
- `invalid-offer`
- `radio-not-connected`
- `session-active`

## Events

| Event                   | Meaning                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `radio-connected`       | The board passed its checks. `board.simulated` is true only for the dev fake port, which is never a supported board. |
| `radio-disconnected`    | `error.code` is `radio-lost` when the USB link dropped.                                                              |
| `session-phase`         | `scanning`, `joining`, `waiting-for-console`, `in-trade-room`, `offer-received`, `confirming` or `finishing`.        |
| `trade-offer`           | The console's Trade Offer: the Pokemon its player selected. **This is not a Trade Receipt.**                         |
| `console-action`        | Box sync commands from #365: 1 `offer-shown`, 4 `confirmed`, 5 `withdrew`, 3 `left`.                                 |
| `confirmation-progress` | The confirmation ladder phase, from 0 to 4.                                                                          |
| `session-ended`         | `outcome`, plus a `receipt`, `unknown` evidence or an `error`.                                                       |

## Outcomes

These rules use the signals recorded in #365:

- **`completed`**: needs all three of these signals:
  - The console confirmed (box command 4).
  - The confirmation ladder reached phase 4.
  - The session then ended gracefully. Either the console left Link Trade (box command 3, then host migration), or it offered again for a next trade.

  `receipt` holds the received Pokemon's bytes, the digests of the sent and received bytes, and the completion evidence.

- **`cancelled`**: the session ended before the console confirmed. This covers the player cancelling in PKSX, and the console backing out (command 5) and leaving. The console keeps its Pokemon.
- **`failed`**: no trade could have happened. The error is one of these:
  - `console-not-ready`: the console did not accept the session within about 60 s. The player must press A on both Link Trade messages, then retry.
  - `session-full`
  - `join-failed`
  - `connection-lost`
  - `radio-lost`
  - `timed-out`
- **`outcome-unknown`**: an Unknown Trade Outcome. The session stopped after the console confirmed or the ladder started, but without a graceful end. A connection loss near or after phase 4 is always this outcome. `unknown` keeps the console's offered bytes, the ladder phase and the reason. Never retry the trade automatically.

A received offer alone never makes a receipt.

## Keys

`import-keys` keeps only `aes_kek_generation_source`, `aes_key_generation_source`, `master_key_00` and `master_key_12`. They are stored in the device-only IndexedDB database `pksx-switch-keys`. That database is separate from Saves, Backups, Export and any Cloud Sync store. Keys never appear in responses, events, errors or receipts. The Trade Radio receives only the derived session key that it needs to join the console's network.

## Transport

The worker owns all protocol code, ported from pokeldn v0.4.0 and its vendored LDN (see `src/lib/link-trade/trade-worker/NOTICE.md`). This includes:

- COBS/CRC serial framing
- the HELLO handshake
- LDN scanning, authentication and key derivation
- a userspace IPv4/UDP stack
- Pia version 4
- the Sword/Shield trade state machine

The radio is injected as a `TradeSerialPort`. The first implementation is Web Serial (desktop Chrome and Edge, in a dedicated worker). Android USB serial and BLE ports can implement the same interface.

Sword/Shield's Pia version 4 compresses with zlib only, so the worker uses the browser's `DecompressionStream` and needs no zstd library. Snapshot fragments go out uncompressed; pokeldn does the same whenever compression would not save space.

## Testing

- `test-vectors.json` comes from `scripts/link-trade/generate_vectors.py`, run against the pinned pokeldn source with synthetic keys. The unit tests compare framing, key derivation, LDN frames, Pia packets and trade messages with these vectors byte for byte.
- `runtime.spec.ts` drives the worker through `FakeTradeRadio`. This fake is a simulated board and Sword console that follows the message order of the #365 capture. The tests cover these cases:
  - a completed trade
  - a console that backs out
  - a USB loss after phase 4
  - a console that is not ready
  - repeated starts
  - cancellation
  - malformed serial frames
  - each refused board
- The fake port is loaded only when `import.meta.env.DEV` is true, so production builds do not include it.
- A real exchange through the worker with the Trade Radio is a separate hardware check.
