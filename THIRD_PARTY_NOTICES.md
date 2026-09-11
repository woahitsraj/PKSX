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
