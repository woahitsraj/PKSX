# Generated Save File Fixtures

`blank-shining-pearl.sav` is not a gameplay save. No public Shining Pearl save was found, so native PKHeX.Core 26.5.5 generated this file:

```csharp
BlankSaveFile.Get(GameVersion.SP, "PKSX", LanguageID.English).Write().ToArray();
```

- SHA-256: `4e87b1acf874e09e5ba4e78116be2bb4901ef2202b1922ab6009fa871eac9229`

`shield-without-crown-tundra.sav` is derived from `../pkmds-blazor/test-save-shield.sav` (GPL-3.0, see `../pkmds-blazor/LICENSE.md`). No public Sword or Shield save without the Crown Tundra update was found. Native PKHeX.Core 26.5.5 replaced the Crown Tundra Pokedex block (`0x3C9366F0`) with an empty block and added an unused filler block (`0x00000001`) of the same serialized length, so the file keeps a size that PKHeX accepts:

```csharp
var blocks = ((SAV8SWSH)SaveUtil.GetSaveFile(source)!).AllBlocks.ToList();
var index = blocks.FindIndex(b => b.Key == 0x3C9366F0);
var removed = blocks[index].GetSerializedLength();
blocks[index] = new SCBlock(0x3C9366F0, SCTypeCode.Object, Memory<byte>.Empty); // internal constructor, called by reflection
blocks.Add(new SCBlock(0x00000001, SCTypeCode.Object, new byte[removed - 9 - 9]));
SwishCrypto.Encrypt(blocks).ToArray();
```

- SHA-256: `a9ee514f4aad6929fb59506433dd07932e973a098f9589f790c3f8170ccbc4e8`
