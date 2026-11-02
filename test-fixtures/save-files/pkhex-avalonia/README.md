# PKHeX-Avalonia Save File Fixtures

- Source repository: https://github.com/realgarit/PKHeX-Avalonia
- Source commit: `782612b8ed491a63a01761af8ef695e266e95269`
- License: GPL-3.0, the repository license
- PKHeX reports the Gold and Diamond files as `GS` and `DP`, because those saves do not record the exact version.

The fixture bytes are unchanged from upstream. File names are normalized. They contain public gameplay data, so tests and review evidence must not expose Trainer values.

| Fixture               | Game       | Source path                        | Byte length | SHA-256                                                            |
| --------------------- | ---------- | ---------------------------------- | ----------: | ------------------------------------------------------------------ |
| `gen2-gold.sav`       | Gold       | `Tests/savefiles/gen2_gold.sav`    |       32816 | `d18efe645d453c94b3ac3fce9bcc37ed95527f8caeb3b051dbbb52b7c3bf7fd7` |
| `gen4-diamond.sav`    | Diamond    | `Tests/savefiles/gen4_diamond.sav` |      524288 | `6adc6a7b60f05d3acb76e291c3c2693211b3116e513b55fe6f8778c4aea2696a` |
| `gen6-omega-ruby.sav` | Omega Ruby | `Tests/savefiles/gen6_or.main`     |      483328 | `c1b0d905009a3ce83bdde2c4f2c508a85392158e4d0be93bc7d5d1381e83d478` |
