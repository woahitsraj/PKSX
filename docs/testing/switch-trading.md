# Switch trading support matrix

Issue: https://github.com/woahitsraj/pksx/issues/370

This document records which Link Trade combinations have passed on real hardware, which checks are still open, and what a game needs before PKSX enables it. Decisions are in [ADR 0019](../adr/0019-port-the-link-trade-host-into-a-browser-trade-worker.md). The message contract is in [trade-worker-contract.md](../architecture/trade-worker-contract.md).

## Evidence rules

- Only a completed exchange with a retail console and a real Trade Radio is hardware evidence.
- A run with `FakeTradeRadio`, the simulated radio, or a received-offer file is never hardware evidence.
- A row is "Verified" only when its evidence names the PKSX revision, the console result after save and reopen, and the received bytes.
- Evidence must not contain Switch key values, session keys, or console trainer data. Raw captures stay on the test Mac. Publish only redacted copies.

## Verified combination

One combination has a completed retail exchange through the PKSX trade worker.

| Item            | Value                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Game            | Pokemon Sword 1.3.2                                                                                                        |
| Console         | Switch 2, system 23.0.1. The console hosts and PKSX joins. No link code.                                                   |
| Board           | ELEGOO ESP32 Type-C, ESP32-D0WD-V3 rev 3.1 (classic ESP32)                                                                 |
| USB bridge      | CP2102, 921600 baud                                                                                                        |
| Firmware        | pokeldn v0.4.0 `pokeldn-radio.bin`, version `1.0.0`, radio protocol 1                                                      |
| Firmware SHA256 | `b96e102c01a29b5b7e8cb4a686654fe6d41ce7fb9c81ed1a378629a35a378ff9`                                                         |
| Ported revision | pokeldn v0.4.0, `f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691`, with LDN `39d0b2060c7932ff2766726db7af4fb640cfa9ef`            |
| Browser and OS  | Chrome on macOS 27.0.1 (arm64), Web Serial. The Chrome version was not recorded.                                           |
| Switch keys     | `prod.keys` from system 22.5.0                                                                                             |
| PKHeX.Core      | 26.5.5                                                                                                                     |
| Date and source | 2026-10-02, [Port the pokeldn Sword/Shield trade host to a PKSX trade worker](https://github.com/woahitsraj/pksx/pull/406) |

Limits of this evidence:

- The exchange ran the production-mode worker bundle from a standalone page. The Trade with Switch workflow in Boxes did not exist then. No real exchange has run through that workflow, the trade journal, or the Storage import.
- The user confirmed the result on the console. A save, close and reopen after a trade was checked only in the upstream pokeldn run ([Verify retail Switch trading with pokeldn and the Trade Radio](https://github.com/woahitsraj/pksx/issues/365)).
- No comparison of the received bytes with the console's saved result is recorded.

## Game status

| Game                             | Format | Status     | Reason                                             |
| -------------------------------- | ------ | ---------- | -------------------------------------------------- |
| Sword                            | PK8    | Enabled    | The combination above                              |
| Shield                           | PK8    | Disabled   | No real trade yet. Same adapter as Sword.          |
| Brilliant Diamond, Shining Pearl | PB8    | No adapter |                                                    |
| Scarlet, Violet                  | PK9    | No adapter |                                                    |
| Legends: Z-A                     | PA9    | No adapter |                                                    |
| Legends: Arceus                  | PA8    | No adapter |                                                    |
| Let's Go Pikachu, Let's Go Eevee | PB7    | No adapter |                                                    |
| FireRed, LeafGreen (Switch)      | PK3    | No adapter | No test console. GB-Link is a different transport. |

The worker reports `hardwareVerified` for each game (`runtime.ts`). The workflow disables a game whose value is false (`TradeWithSwitch.svelte`, tested in `TradeWithSwitch.svelte.spec.ts`). Change the value only in the pull request that adds the evidence row.

Not verified: an original Switch, Switch Lite or Switch OLED, other Sword versions, Edge, Windows, Linux, ChromeOS, ESP32-S3 and ESP32-C3 boards, and other USB bridges. The worker refuses boards that are not a classic ESP32 with the pinned firmware.

## Open hardware checks

Each check needs the user at the console and the Trade Radio on the test Mac. Ask for approval before each real exchange. Never repeat a trade automatically.

| Check                                                                    | Expected result                                           | Status |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ------ |
| Sword trade through the Trade with Switch workflow in a production build | Receipt, one new record in Unfiled, source Slot unchanged | Open   |
| Shield trade                                                             | Same as Sword. Then enable Shield.                        | Open   |
| Console save, close and reopen, then PKSX reload                         | Both sides keep the result. No second record.             | Open   |
| Received bytes compared with the console's saved Pokemon                 | Record each field that differs                            | Open   |
| Outgoing Pokemon that cannot enter the game                              | Blocked at review. Nothing is sent.                       | Open   |
| Supported forms                                                          | The console shows the same form                           | Open   |
| Egg                                                                      | Record whether the game accepts it                        | Open   |
| Trade evolution (for example Machoke)                                    | Record what the receipt holds and what the console saves  | Open   |
| Cancel in PKSX before the console confirms                               | `cancelled`. The console keeps its Pokemon.               | Open   |
| Missing keys                                                             | The workflow names the missing keys and starts no trade   | Open   |
| USB loss between console confirmation and ladder phase 4                 | Unknown Trade Outcome. Record the console result.         | Open   |
| USB loss just after phase 4, with two different Pokemon                  | Unknown Trade Outcome. Record the console result.         | Open   |
| Browser reload during a trade                                            | Trade recovery lists it. No retrade.                      | Open   |
| Failed Storage write after a completed trade                             | Retry local import adds one record. No retrade.           | Open   |

Earlier results that apply:

- With upstream pokeldn, a cancel on the console before confirmation left the console's Pokemon in place.
- With upstream pokeldn, a USB loss about 0.5 s after phase 4 made the console show "Communication was interrupted". Both sides had offered the same species, so the console result is not known.
- The fake-radio browser tests cover each interruption above in software. They are not hardware evidence.

## Requirements to enable a game

A game stays disabled until its adapter issue records all of these:

1. One completed retail exchange through the PKSX workflow in a production build, with a row in the format of "Verified combination".
2. The console keeps the result after save, close and reopen. PKSX keeps one record after reload.
3. The digest of the sent bytes equals the digest of the reviewed bytes.
4. The received Pokemon parses in the PKHeX Engine. Record its legality findings.
5. One cancellation before confirmation, with the console result.
6. A statement that PKHeX.Core 26.5.5 handles the format, or the pin update that fixes it. pokeldn tested 26.8.26.
7. Redacted evidence and the steps to repeat it.

Create one scoped adapter issue for each game before work starts, in this order:

| Order | Game                             | Format | pokeldn v0.4.0 entry points       | Wire notes                     |
| ----- | -------------------------------- | ------ | --------------------------------- | ------------------------------ |
| 1     | Brilliant Diamond, Shining Pearl | PB8    | `bdsp_host.py`, `bdsp_connect.py` |                                |
| 2     | Scarlet, Violet                  | PK9    | `sv_host.py`, `sv_join.py`        | 348 or 352-byte wire form      |
| 3     | Legends: Z-A                     | PA9    | `za_host.py`, `za_join.py`        | Offer header around the entity |
| 4     | Legends: Arceus                  | PA8    | `pla_host.py`, `pla_join.py`      |                                |
| 5     | Let's Go Pikachu, Let's Go Eevee | PB7    | `lgpe_host.py`, `lgpe_join.py`    | Sends the first 232 bytes      |

Each issue covers the Engine part (prepare and parse the native format), the trade worker adapter, the PKHeX.Core pin check and one real trade on the test Switch 2.

## Setup

You need desktop Chrome or Edge, a classic ESP32 board with a USB data cable, your own `prod.keys` file, and the game on a Switch near the board.

1. In Boxes, open the Slot Menu of the Pokemon and select **Trade with Switch**. PKSX sends a copy. The original stays in its Slot.
2. **Switch keys:** select **Import keys** and choose your `prod.keys` file. PKSX keeps four values on this device only. **Forget keys** deletes them.
3. **Trade Radio:** plug in the board and select **Connect**. Choose the board in the browser dialog. If PKSX reports another firmware version, select **Install firmware**.
4. **Destination game:** select the game that is open on the Switch.
5. Read **Changes to the copy**. PKSX sends these exact bytes.
6. On the Switch, open Link Trade (no link code) and press A on both messages.
7. Select **Start trade**. Choose a Pokemon on the Switch and confirm there. PKSX does not ask you to confirm again.
8. Keep the board plugged in until PKSX shows the outcome.

## What PKSX tells you

| PKSX shows                                       | Meaning                                                                                                                            | What to do                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The partner's Pokemon during the trade           | A Trade Offer. Nothing has changed yet.                                                                                            | Continue on the Switch                                                        |
| Trade completed                                  | A Trade Receipt. The console confirmed, the exchange finished, and the session ended normally. The received Pokemon is in Unfiled. | Save on the Switch                                                            |
| Trade cancelled                                  | The session ended before the console confirmed. Each side keeps its Pokemon.                                                       | Start again if you want                                                       |
| Switch isn't ready, or Could not join the Switch | No trade happened.                                                                                                                 | Check the Switch and select Retry                                             |
| Unknown Trade Outcome                            | The connection stopped after the console confirmed. The trade may or may not have happened.                                        | Look at the Switch. PKSX keeps the evidence and never trades again by itself. |

An offer is never a receipt. PKSX adds a Pokemon only from a receipt, and only once for each trade.

## Troubleshooting

| Problem                                                  | Cause and action                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| "This browser cannot trade"                              | Safari, iOS and Android Chrome cannot reach a USB serial device. Use desktop Chrome or Edge.                                      |
| The key import names missing keys                        | The file lacks `aes_kek_generation_source`, `aes_key_generation_source`, `master_key_00` or `master_key_12`. Dump the keys again. |
| "The board is unplugged, or another tab or app uses it." | Close other tabs and serial tools, then connect again.                                                                            |
| "This board did not answer as a Trade Radio."            | Select **Install firmware**. If the board does not enter its bootloader, hold BOOT and try again.                                 |
| ESP32-S3 or ESP32-C3 board refused                       | Only a classic ESP32 is verified.                                                                                                 |
| Two boards with the same USB IDs                         | Disconnect one.                                                                                                                   |
| "Switch isn't ready"                                     | Press A on both Link Trade messages, then retry within about 60 s.                                                                |
| The first join fails                                     | This occurred on the test rig (Wi-Fi reasons `0x2` and `0xc9`, cause not known). Retry once.                                      |
| Trade completed, but the import failed                   | Select **Retry local import**. It does not contact the Switch.                                                                    |
| A trade is listed in **Trade recovery** after a reload   | Follow its action. Recovery never starts a console trade.                                                                         |

Notes for testers: the board keeps 921600 baud until it loses power. The ELEGOO board has no BOOT button that a user can reach.

## Platform follow-ups

| Platform               | State       | Next step                                                                               |
| ---------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Android app            | Unavailable | A native USB serial plugin (`usb-serial-for-android`) that implements `TradeSerialPort` |
| iOS app                | Unavailable | A BLE spike: radio coexistence and throughput, or a trade that the firmware hosts       |
| Safari, Android Chrome | Unavailable | Stay unavailable until the browser can reach a USB serial device                        |
| ESP32-S3, ESP32-C3     | Refused     | Firmware build and one real trade for each chip                                         |
