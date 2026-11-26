using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

// Brilliant Diamond and Shining Pearl keep a state, gender, form, and language entry for each of the 493 species.
internal static class BrilliantDiamondShiningPearlPokedex
{
    private static readonly (LanguageID Id, string Name)[] Languages =
    [
        (LanguageID.Japanese, "Japanese"), (LanguageID.English, "English"), (LanguageID.French, "French"),
        (LanguageID.Italian, "Italian"), (LanguageID.German, "German"), (LanguageID.Spanish, "Spanish"),
        (LanguageID.Korean, "Korean"), (LanguageID.ChineseS, "Chinese (simplified)"), (LanguageID.ChineseT, "Chinese (traditional)"),
    ];
    private static readonly string[] Genders = ["male", "female", "shiny male", "shiny female"];
    private static readonly string[] SpindaRecords = ["seen", "caught"];

    public static void SetSeen(SAV8BS save, ushort species, bool seen)
    {
        var dex = save.Zukan;
        if (!seen)
        {
            dex.ClearDexEntryAll(species);
            return;
        }
        if (dex.GetSeen(species))
            return;
        dex.SetState(species, ZukanState8b.Seen);
        SeenGender(save, species);
    }

    public static void SetCaught(SAV8BS save, ushort species, bool caught)
    {
        var dex = save.Zukan;
        if (caught)
        {
            if (dex.GetCaught(species))
                return;
            // Like PKHeX CaughtAll, a new catch records the Save File language.
            dex.SetState(species, ZukanState8b.Caught);
            dex.SetLanguageFlag(species, save.Language, true);
            SeenGender(save, species);
        }
        else if (dex.GetCaught(species))
        {
            // PKHeX drops the language flags with the Caught state.
            dex.SetState(species, ZukanState8b.Seen);
            dex.SetLanguageFlags(species, 0);
        }
    }

    public static List<PokedexFlag> Flags(SAV8BS save, ushort species)
    {
        var dex = save.Zukan;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        bool[] Gender()
        {
            dex.GetGenderFlags(species, out var m, out var f, out var ms, out var fs);
            return [m, f, ms, fs];
        }
        var genders = Gender();
        for (var gender = 0; gender < Genders.Length; gender++)
        {
            var index = gender;
            var applies = (index & 1) == 0 ? !info.OnlyFemale : !info.OnlyMale;
            if (applies || genders[index])
                flags.Add(new($"Seen: {Genders[index]}", genders[index], on =>
                {
                    var next = Gender();
                    next[index] = on;
                    dex.SetGenderFlags(species, next[0], next[1], next[2], next[3]);
                }));
        }
        foreach (var (id, name) in Languages)
            flags.Add(new($"Language: {name}", dex.GetLanguageFlag(species, (int)id), on => dex.SetLanguageFlag(species, (int)id, on)));
        var count = Zukan8b.GetFormCount(species);
        if (count == 0)
            return flags;
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, save.Context);
        foreach (var shiny in (bool[])[false, true])
        {
            for (byte form = 0; form < count; form++)
            {
                var value = form;
                var name = value < names.Length && names[value].Length != 0 ? names[value] : $"Form {value}";
                flags.Add(new($"{(shiny ? "Form seen shiny" : "Form seen")}: {name}", dex.GetHasFormFlag(species, value, shiny), on => dex.SetHasFormFlag(species, value, shiny, on)));
            }
        }
        return flags;
    }

    public static IEnumerable<PokedexField> Fields(SAV8BS save)
    {
        var dex = save.Zukan;
        yield return new("regional", "Sinnoh Pokedex (0 = off, 1 = on)", dex.HasRegionalDex ? 1 : 0, 0, 1);
        yield return new("national", "National Pokedex (0 = off, 1 = on)", dex.HasNationalDex ? 1 : 0, 0, 1);
        for (ushort species = 1; species <= save.MaxSpeciesID; species++)
        {
            var state = (int)dex.GetState(species);
            yield return new($"state-{species}", "Pokedex state (0 = none, 1 = heard of, 2 = seen, 3 = caught)", state, 0, Math.Max(3, state), species);
            if (species != (int)Species.Spinda)
                continue;
            for (var record = 0; record < SpindaRecords.Length; record++)
                for (var gender = 0; gender < Genders.Length; gender++)
                    yield return new($"spinda-{SpindaRecords[record]}-{gender}", $"Spinda first {SpindaRecords[record]} PID: {Genders[gender]}", SpindaPid(save, record, gender), 0, uint.MaxValue, species);
        }
    }

    public static void SetField(SAV8BS save, PokedexField field, long value)
    {
        var dex = save.Zukan;
        if (field.Key == "regional") dex.HasRegionalDex = value != 0;
        else if (field.Key == "national") dex.HasNationalDex = value != 0;
        else if (field.Key.StartsWith("state-")) dex.SetState((ushort)field.Species!.Value, (ZukanState8b)value);
        else if (field.Key.StartsWith("spinda-"))
        {
            var parts = field.Key.Split('-');
            var (gender, shiny) = Spinda(int.Parse(parts[2]));
            if (parts[1] == "seen") save.ZukanExtra.SetSeen(gender, shiny, (uint)value);
            else save.ZukanExtra.SetCaught(gender, shiny, (uint)value);
        }
    }

    private static uint SpindaPid(SAV8BS save, int record, int index)
    {
        var (gender, shiny) = Spinda(index);
        return record == 0 ? save.ZukanExtra.GetSeen(gender, shiny) : save.ZukanExtra.GetCaught(gender, shiny);
    }

    private static (byte Gender, bool Shiny) Spinda(int index) => ((byte)(index & 1), index >= 2);

    // A seen species with no gender flag gets the one PKHeX records for its first encounter.
    private static void SeenGender(SAV8BS save, ushort species)
    {
        var dex = save.Zukan;
        dex.GetGenderFlags(species, out var m, out var f, out var ms, out var fs);
        if (m || f || ms || fs)
            return;
        var info = save.Personal[species];
        dex.SetGenderFlags(species, !info.OnlyFemale, info.OnlyFemale || info.Genderless, false, false);
    }
}
