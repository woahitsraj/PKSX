using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

// Let's Go keeps the Generation 7 flag layout for Kanto species plus Meltan and Melmetal, and adds size records.
internal static class LetsGoPokedex
{
    private static readonly string[] Genders = ["male or genderless", "female", "shiny male or genderless", "shiny female"];
    private static readonly string[] Languages = ["Japanese", "English", "French", "Italian", "German", "Spanish", "Korean", "Chinese (simplified)", "Chinese (traditional)"];
    private static readonly (DexSizeType Group, string Key, string Label)[] Records =
        [(DexSizeType.MinHeight, "shortest", "Shortest"), (DexSizeType.MaxHeight, "tallest", "Tallest"), (DexSizeType.MinWeight, "lightest", "Lightest"), (DexSizeType.MaxWeight, "heaviest", "Heaviest")];

    private static readonly string NoRecord = $" (no record: height {Zukan7b.DefaultEntryValueH}, weight {Zukan7b.DefaultEntryValueW})";

    public static bool InDex(int species) => species is >= 1 and <= 151 or 808 or 809;

    public static void SetSeen(SAV7b save, ushort species, bool seen)
    {
        var dex = save.Blocks.Zukan;
        if (!seen)
        {
            for (var r = 0; r < 4; r++)
                dex.SetSeen(species, r, false);
            return;
        }
        if (dex.GetSeen(species))
            return;
        var region = save.Personal[species].OnlyFemale ? 1 : 0;
        dex.SetSeen(species, region, true);
        if (!Enumerable.Range(0, 4).Any(r => dex.GetDisplayed(species - 1, r)))
            dex.SetDisplayed(species - 1, region, true);
    }

    public static List<PokedexFlag> Flags(SAV7b save, ushort species)
    {
        var dex = save.Blocks.Zukan;
        List<PokedexFlag> flags = [];
        var index = species - 1;
        Regions(flags, "", dex.GetBaseSpeciesGenderValue(index), r => dex.GetSeen(species, r), (r, on) => dex.SetSeen(species, r, on), r => dex.GetDisplayed(index, r), (r, on) => dex.SetDisplayed(index, r, on));
        for (var language = 0; language < Languages.Length; language++)
        {
            var lang = language;
            flags.Add(new($"Language: {Languages[lang]}", dex.GetLanguageFlag(index, lang), on => dex.SetLanguageFlag(index, lang, on)));
        }
        foreach (var (form, entry) in Forms(save, species))
        {
            var name = FormName(save, species, form);
            Regions(flags, $" ({name})", dex.GetBaseSpeciesGenderValue(entry), r => dex.GetSeen((ushort)(entry + 1), r), (r, on) => dex.SetSeen((ushort)(entry + 1), r, on), r => dex.GetDisplayed(entry, r), (r, on) => dex.SetDisplayed(entry, r, on));
        }
        foreach (var (form, record) in SizeRecords(species))
        {
            foreach (var (group, _, label) in Records)
            {
                dex.GetSizeData(group, record, out _, out _, out var flagged);
                var suffix = form == 0 ? "" : $" ({FormName(save, species, form)})";
                flags.Add(new($"{label} record flag{suffix}", flagged, on =>
                {
                    dex.GetSizeData(group, record, out var h, out var w, out _);
                    dex.SetSizeData(group, record, h, w, on);
                }));
            }
        }
        return flags;
    }

    public static IEnumerable<PokedexField> Fields(SAV7b save)
    {
        var dex = save.Blocks.Zukan;
        for (ushort species = 1; species <= save.MaxSpeciesID; species++)
        {
            if (!InDex(species))
                continue;
            foreach (var (form, record) in SizeRecords(species))
            {
                var suffix = form == 0 ? "" : $" ({FormName(save, species, form)})";
                foreach (var (group, key, label) in Records)
                {
                    dex.GetSizeData(group, record, out var height, out var weight, out _);
                    yield return new($"{key}-height-{record}", $"{label} record height{suffix}{NoRecord}", height, 0, 255, species);
                    yield return new($"{key}-weight-{record}", $"{label} record weight{suffix}{NoRecord}", weight, 0, 255, species);
                }
            }
        }
    }

    public static void SetField(SAV7b save, string key, long value)
    {
        var parts = key.Split('-');
        var (group, _, _) = Records.First(r => r.Key == parts[0]);
        var record = int.Parse(parts[2]);
        var dex = save.Blocks.Zukan;
        dex.GetSizeData(group, record, out var h, out var w, out var flagged);
        if (parts[1] == "height") h = (byte)value;
        else w = (byte)value;
        dex.SetSizeData(group, record, h, w, flagged);
    }

    // Each form that the game gives its own Pokedex entry, as (form, entry bit index).
    private static IEnumerable<(byte Form, int Entry)> Forms(SAV7b save, ushort species)
    {
        var count = save.Personal[species].FormCount;
        for (byte form = 1; form < count; form++)
        {
            var entry = save.Blocks.Zukan.GetDexFormIndex(species, count, form);
            if (entry >= 0)
                yield return (form, entry);
        }
    }

    private static IEnumerable<(byte Form, int Record)> SizeRecords(ushort species)
    {
        for (byte form = 0; form < 3; form++)
        {
            if (Zukan7b.TryGetSizeEntryIndex(species, form, out var record))
                yield return (form, record);
        }
    }

    private static string FormName(SAV7b save, ushort species, byte form)
    {
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, save.Context);
        return form < names.Length && names[form].Length != 0 ? names[form] : $"Form {form}";
    }

    private static void Regions(List<PokedexFlag> flags, string suffix, byte gender, Func<int, bool> seen, Action<int, bool> setSeen, Func<int, bool> displayed, Action<int, bool> setDisplayed)
    {
        var male = gender != PersonalInfo.RatioMagicFemale;
        var female = gender is not (PersonalInfo.RatioMagicMale or PersonalInfo.RatioMagicGenderless);
        for (var shown = 0; shown < 2; shown++)
        {
            for (var region = 0; region < 4; region++)
            {
                var (isShown, r) = (shown == 1, region);
                var on = isShown ? displayed(r) : seen(r);
                if (((r & 1) == 0 ? male : female) || on)
                    flags.Add(new($"{(isShown ? "Displayed" : "Seen")}: {Genders[r]}{suffix}", on, value =>
                    {
                        if (isShown) setDisplayed(r, value);
                        else setSeen(r, value);
                    }));
            }
        }
    }
}
