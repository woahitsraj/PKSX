# Third-party notices

The GNU General Public License that covers PKSX source code does not replace the terms below. Third-party files remain subject to their own licenses and permissions.

## PKHeX.Core

PKSX links and distributes `PKHeX.Core`, copyright Kaphotics and PKHeX contributors.

- Package: `PKHeX.Core`
- Version: `26.5.5`
- License: GNU General Public License version 3 or later
- Source: https://github.com/kwsch/PKHeX/tree/26.05.05
- Package: https://www.nuget.org/packages/PKHeX.Core/26.5.5

The full GNU General Public License appears in [`LICENSE`](./LICENSE).

## pokeldn and LDN (the trade worker)

The trade worker in `src/lib/link-trade/trade-worker` is a TypeScript port of the Sword/Shield Link Trade joiner from pokeldn, which includes code from LDN. That module keeps their licenses. Its own notice is `src/lib/link-trade/trade-worker/NOTICE.md`.

- pokeldn v0.4.0, revision `f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691`, copyright Decryptu and pokeldn contributors
- License: GNU Affero General Public License version 3
- Source: https://github.com/Decryptu/pokeldn/tree/f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691
- LDN revision `39d0b2060c7932ff2766726db7af4fb640cfa9ef` as vendored by pokeldn, copyright Yannik Marchand
- License: GNU General Public License version 3 only
- Source: https://github.com/kinnay/LDN/tree/39d0b2060c7932ff2766726db7af4fb640cfa9ef

The app links to the corresponding PKSX source at `/legal/SOURCE.txt`.

## Trade Radio firmware

PKSX serves `static/firmware/pokeldn-radio.bin` and installs it on a Trade Radio when the user selects Install firmware. The file is the unchanged classic ESP32 radio firmware from the pokeldn v0.4.0 release, SHA256 `b96e102c01a29b5b7e8cb4a686654fe6d41ce7fb9c81ed1a378629a35a378ff9`.

- Copyright Decryptu and pokeldn contributors
- License: GNU Affero General Public License version 3
- Download: https://github.com/Decryptu/pokeldn/releases/tag/v0.4.0
- Source: https://github.com/Decryptu/pokeldn/tree/f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691/firmware

`/legal/SOURCE.txt` links to this source.

## esptool-js

PKSX uses esptool-js to install the Trade Radio firmware.

- License: Apache License 2.0
- Source: https://github.com/espressif/esptool-js

## PokemonDB sprite images

The Pokemon sprite images under `static/sprites/pokemon` come from the PokemonDB sprite gallery:

https://pokemondb.net/sprites

PKSX packages these images according to PokemonDB's guidance that sites may save and self-host the images instead of hotlinking them. These images are third-party content and are not licensed under the PKSX GPL license. Their source URLs and retrieval dates appear in `static/sprites/pokemon/catalog.json`.

## PokeAPI item sprite images

The item sprite images under `static/sprites/items` come from the PokeAPI sprites repository at revision `2ecb4eeacd5a1718621fc30f12772e3f60d830b9`:

https://github.com/PokeAPI/sprites/tree/2ecb4eeacd5a1718621fc30f12772e3f60d830b9/sprites/items

The repository distribution is dedicated to the public domain under CC0. Its `LICENCE.txt` separately states that the images are copyrighted by The Pokemon Company. These images remain third-party content and are not licensed under the PKSX GPL license. Exact source paths and byte metadata appear in `static/sprites/items/catalog.json`.

PKSX maps game-specific item indices with PokeAPI data from revision `8fe210b21c9abbe73de93670f3d5a346c80a3625`:

https://github.com/PokeAPI/pokeapi/tree/8fe210b21c9abbe73de93670f3d5a346c80a3625/data/v2/csv

## Bl1ndBeholder Pokemon save fixtures

The files under `test-fixtures/save-files/bl1ndbeholder-pokemon-saves` come from:

https://github.com/Bl1ndBeholder/pokemon-saves

MIT License

Copyright (c) 2025 Bl1ndBeholder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Generated platform files and package dependencies

Generated Android, iOS, .NET, and JavaScript dependency files remain under the licenses and notices supplied by their copyright holders. For example, the checked-in Gradle wrapper scripts retain their Apache License 2.0 notices.

Pokemon and related names and images are trademarks or copyrighted works of their respective owners. PKSX is not affiliated with or endorsed by Nintendo, Game Freak, Creatures, The Pokemon Company, PKHeX, or PokemonDB.
