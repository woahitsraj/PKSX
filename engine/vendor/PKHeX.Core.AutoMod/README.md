# PKHeX.Core.AutoMod

Unchanged copy of `PKHeX.Core.AutoMod` from PKHeX-Plugins, tag `26.05.05` (revision `bb57f2e1a785ac65edf6f5d233a113f80046ef04`): https://github.com/santacrab2/PKHeX-Plugins/tree/26.05.05/PKHeX.Core.AutoMod

The tag matches the `PKHeX.Core` version in `Directory.Packages.props`. Update both together: replace `AutoMod/` and `Enhancements/` with the new tag's files, and update this file, `THIRD_PARTY_NOTICES.md` and `docs/adr/0023-repair-legality-with-automod-candidates.md`.

The engine calls only `APILegality.GetLegalFromTemplate`. The timeout wrappers block on a `Task`, which single-thread browser WebAssembly cannot do, and the version check makes a network request.
