# Raj Pokemon Save Backup Fixtures

These Save File fixtures were moved from local Pokemon save backup folders for PKHeX Engine smoke coverage across Nintendo DS and Switch games.

- Original Switch backup root: `/Users/rsingh/Games/Switch/Save Backups`
- Original NDS backup root: `/Users/rsingh/Games/NDS Save Backups`
- Moved into this repository on: 2026-06-01

The full save files are covered by `src/lib/engine/pkhex-engine.browser.spec.ts`. The small `poke-trade` and `main2` files are retained with meaningful names because they were part of the Pokemon backup folders, but they are not expected to parse as full PKHeX save files.

| Fixture                                                      | Original game folder         | Byte length | SHA-256                                                            |
| ------------------------------------------------------------ | ---------------------------- | ----------: | ------------------------------------------------------------------ |
| `nds/pocket-monsters-white-2-jp.sav`                         | Pocket Monsters White 2 (JP) |      524288 | `5a1442abfe594464c9f64cd57d4e94c107d37e94a61a121fd93a36b4c96cf5e6` |
| `nds/pokemon-heartgold.sav`                                  | Pokemon Heart Gold           |      524288 | `2da7b027556edaf55ce99bec04c7357fc177f62247942334b45938e0bd664284` |
| `nds/pokemon-platinum-eu.sav`                                | Pokemon Platinum (E)         |      524288 | `29d16eaf5fc5ff1d2e8e96f4830300c4db7c453055c70272239bc168541b6cb6` |
| `nds/pokemon-white-2.sav`                                    | Pokemon White 2              |      524288 | `aed76ea1624e4010f7c0b30ccfabe46b58b2cfa7339f7d9c4fac5b71edfa4ed4` |
| `nds/pokemon-white.sav`                                      | Pokemon White                |      524288 | `d36ccddd44797002ee8c12ea1a4052c02b45dca00595b23719632b28aa6633ae` |
| `switch/pokemon-legends-arceus-2025-03-24-main.sav`          | Pokemon Legends Arceus       |     1289478 | `f8ae2a3aa9ee83a47117ffaeef55c5359799a414aa30f1b590e48c8076e72685` |
| `switch/pokemon-legends-arceus-2025-03-24-main2.bin`         | Pokemon Legends Arceus       |           8 | `387e9212f862f6aca3b9844b8c31c585a62674a4ea35528eabe2f37208ddb0be` |
| `switch/pokemon-legends-arceus-2025-03-24-modified-main.sav` | Pokemon Legends Arceus       |     1289478 | `a8755e79ae71653f4a49b524cb5fd107b34497fc1514841f731c24d831225837` |
| `switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin`       | Pokemon Let's Go Eevee       |     1048576 | `79b323ac5370c9fd5f2683dea9009cd722b23caefcf91bc20cc40b3be5c8ed0a` |
| `switch/pokemon-scarlet-2025-03-24-backup.sav`               | Pokemon Scarlet              |     4435304 | `2c0a87eb6bc306f2121f84954e34a8619de6488bc38b3ed5e9e5cfc720f33612` |
| `switch/pokemon-scarlet-2025-03-24-main.sav`                 | Pokemon Scarlet              |     4435304 | `2c0a87eb6bc306f2121f84954e34a8619de6488bc38b3ed5e9e5cfc720f33612` |
| `switch/pokemon-scarlet-2025-03-24-poke-trade.bin`           | Pokemon Scarlet              |          32 | `85ed9664ab6979e17ded0ffa7ea8e28c3fd29ad03012dea8f791956ab0fb0539` |
| `switch/pokemon-sword-2025-03-24-backup.sav`                 | Pokemon Sword                |     1603146 | `cea268e21da61701eba4f7889d471cf380aece5e38a644fcfa43a041bbc6fbeb` |
| `switch/pokemon-sword-2025-03-24-main.sav`                   | Pokemon Sword                |     1603146 | `c8bfc68e46ffdd2ea5d4c894907ad42d4d88caf293318ccf7b5d6f786657fc35` |
| `switch/pokemon-sword-2025-03-24-poke-trade.bin`             | Pokemon Sword                |         789 | `91c51b3fbbaf394927b2c901c7d12aa86f0bb55e58621993b9fe626c34c16d18` |
