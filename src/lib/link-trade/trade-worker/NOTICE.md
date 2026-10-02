# PKSX trade worker notices

The files in this directory port the Sword/Shield Link Trade joiner from third-party code. They keep those projects' licenses, which differ from the rest of PKSX.

## pokeldn

- Source: https://github.com/Decryptu/pokeldn
- Version: v0.4.0, revision `f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691`
- Copyright: Decryptu and pokeldn contributors
- License: GNU Affero General Public License version 3 (AGPL-3.0)
- Ported: `bin/swsh_connect.py` (the `trade` preset, joiner role), `pokeldn/ldn/{esp32,esp32_wlan,userspace_ip,sead,pia4,pia5,reliable4,reliable5,broadcast4,station4,station_protocol,mesh_protocol,local_protocol,rtt_protocol}.py` and `pokeldn/swsh/{session,trade,trade_payload}.py`.
- Not ported: the trainer rewrite of the offered Pokemon and the PID/EC re-roll. PKSX sends the offer it prepared, unchanged.

## LDN

- Source: https://github.com/kinnay/LDN, revision `39d0b2060c7932ff2766726db7af4fb640cfa9ef`, as vendored in pokeldn v0.4.0 under `vendor/LDN`
- Copyright: Yannik Marchand
- License: GNU General Public License version 3 only (GPL-3.0-only)
- Ported: `ldn/__init__.py` (key derivation, advertisements, authentication, the station join) and the frame helpers of `ldn/wlan.py`, mainly in `crypto.ts`, `ldn.ts` and `session.ts`.

Each file names its source and license in its header. The full license texts are at https://www.gnu.org/licenses/agpl-3.0.txt and https://www.gnu.org/licenses/gpl-3.0.txt.

## Changes

The code is a TypeScript port for a browser Web Worker: WebCrypto replaces PyCryptodome, the browser's `DecompressionStream` replaces zlib, and an injected serial port replaces pyserial and trio. `test-vectors.json` comes from `scripts/link-trade/generate_vectors.py` run against the revision above, with synthetic keys. `fake-radio.ts` is a scripted test double for tests and dev builds only.

This notice is not legal advice.
