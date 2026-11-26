using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public readonly record struct PokedexFlag(string Label, bool On, Action<bool> Set);

// PKHeX gives Generations 4, 5 and 7 no save-level Seen or Caught setters, so these call each Pokedex block.
internal static class PokedexFlags
{
    private const byte None = Zukan4.FORM_NONE;
    // Generation 4 stores German before Italian; Generation 5 stores Italian before German.
    private static readonly string[] Languages4 = ["Japanese", "English", "French", "German", "Italian", "Spanish"];
    private static readonly string[] Languages5 = ["Japanese", "English", "French", "Italian", "German", "Spanish", "Korean"];
    private static readonly string[] Languages7 = [.. Languages5, "Chinese (simplified)", "Chinese (traditional)"];
    private static readonly string[] Genders = ["male or genderless", "female", "shiny male or genderless", "shiny female"];
    private static readonly string[] FormStates = ["Form seen", "Form seen shiny", "Form displayed", "Form displayed shiny"];

    public static void SetSeen(SaveFile save, ushort species, bool seen)
    {
        var female = save.Personal[species].OnlyFemale;
        switch (save)
        {
            case SAV4 s4:
                if (seen && female && !s4.Dex.GetSeen(species))
                    s4.Dex.SetSeenGenderNewFlag(species, 1);
                s4.Dex.SetSeen(species, seen);
                break;
            case SAV5 s5 when !seen:
                s5.Zukan.ClearSeen(species);
                break;
            case SAV5 s5 when !s5.Zukan.GetSeen(species):
                var region = female ? 1 : 0;
                s5.Zukan.SetSeen(species, region);
                if (!s5.Zukan.GetDisplayedAny(species))
                    s5.Zukan.SetDisplayed(species, region);
                break;
            case SAV5:
                break;
            case SAV6 when Dex6(save) is { } d6:
                if (!seen)
                    d6.ClearSeen(species);
                else if (!d6.GetSeen(species))
                {
                    d6.SetSeen(species, female ? 1 : 0);
                    if (!d6.GetDisplayedAny(species))
                        d6.SetDisplayed(species, female ? 1 : 0);
                }
                break;
            case SAV7 s7 when !seen:
                for (var r = 0; r < 4; r++)
                    s7.Zukan.SetSeen(species, r, false);
                break;
            case SAV7 s7 when !s7.Zukan.GetSeen(species):
                s7.Zukan.SetSeen(species, female ? 1 : 0, true);
                if (!Enumerable.Range(0, 4).Any(r => s7.Zukan.GetDisplayed(species - 1, r)))
                    s7.Zukan.SetDisplayed(species - 1, female ? 1 : 0, true);
                break;
            case SAV7:
                break;
            default:
                save.SetSeen(species, seen);
                break;
        }
    }

    public static void SetCaught(SaveFile save, ushort species, bool caught)
    {
        if (save is SAV4 s4) s4.Dex.SetCaught(species, caught);
        else if (save is SAV5 s5) s5.Zukan.SetCaught(species, caught);
        else if (save is SAV7 s7) s7.Zukan.SetCaught(species, caught);
        else save.SetCaught(species, caught);
    }

    public static List<PokedexFlag> Of(SaveFile save, ushort species) => save switch
    {
        SAV4 s4 => Gen4(s4, species),
        SAV5 s5 => Gen5(s5, species),
        SAV6 when Dex6(save) is { } d6 => Gen6(save, d6, species),
        SAV7 s7 => Gen7(s7, species),
        _ => [],
    };

    public static Zukan6? Dex6(SaveFile save) => save switch { SAV6XY xy => xy.Zukan, SAV6AO ao => ao.Zukan, _ => null };

    private static List<PokedexFlag> Gen4(SAV4 save, ushort species)
    {
        var dex = save.Dex;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        var expected = info.OnlyFemale ? 1 : 0;
        var first = dex.GetSeenGenderFirst(species);
        var second = dex.GetSeenGenderSecond(species);
        if (info.IsDualGender || first != expected || second != expected)
        {
            flags.Add(new("First seen gender is female", first == 1, on => dex.SetSeenGenderFirst(species, on ? 1 : 0)));
            flags.Add(new("Second seen gender is female", second == 1, on => dex.SetSeenGenderSecond(species, on ? 1 : 0)));
        }
        if (dex.HasLanguage(species))
        {
            for (var bit = 0; bit < 8; bit++)
            {
                var index = bit;
                var on = dex.GetLanguageBitIndex(species, index);
                if (index < 6 || on)
                    flags.Add(new(index < 6 ? $"Language: {Languages4[index]}" : $"Language bit {index}", on, value => dex.SetLanguageBitIndex(species, index, value)));
            }
        }
        var forms = dex.GetForms(species);
        if (forms.Length == 0)
            return flags;
        var names = Zukan4.GetFormNames4Dex(species);
        if (forms.Length == 2)
        {
            // Two one-bit slots; PKHeX reads a set pair as no form, so the raw bits are shown.
            for (var slot = 0; slot < 2; slot++)
            {
                var index = slot;
                flags.Add(new($"{(index == 0 ? "First" : "Second")} seen form is {names[1]}", forms[index] != 0, on =>
                {
                    var bits = dex.GetForms(species).Select(f => (byte)(f == 0 ? 0 : 1)).ToArray();
                    bits[index] = (byte)(on ? 1 : 0);
                    dex.SetForms(species, bits);
                }));
            }
            return flags;
        }
        var empty = (Species)species switch { Species.Unown => None, Species.Deoxys => (byte)15, Species.Rotom => (byte)7, _ => (byte)3 };
        for (byte form = 0; form < names.Length; form++)
        {
            var value = form;
            flags.Add(new($"Form seen: {names[value]}", forms.Contains(value), on =>
            {
                var current = dex.GetForms(species);
                var kept = current.Where(f => f != None && f != value).ToList();
                if (on) kept.Add(value);
                if (kept.Count > current.Length)
                    return;
                while (kept.Count < current.Length) kept.Add(empty);
                dex.SetForms(species, kept.ToArray());
            }));
        }
        return flags;
    }

    private static List<PokedexFlag> Gen5(SAV5 save, ushort species)
    {
        var dex = save.Zukan;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        for (var displayed = 0; displayed < 2; displayed++)
        {
            for (var gender = 0; gender < 4; gender++)
            {
                var (shown, region) = (displayed == 1, gender);
                var on = shown ? dex.GetDisplayed(species, region) : dex.GetSeen(species, region);
                var applies = (region & 1) == 0 ? !info.OnlyFemale : !(info.OnlyMale || info.Genderless);
                if (applies || on)
                    flags.Add(new($"{(shown ? "Displayed" : "Seen")}: {Genders[region]}", on, value =>
                    {
                        if (shown) dex.SetDisplayed(species, region, value);
                        else dex.SetSeen(species, region, value);
                    }));
            }
        }
        if (species <= 493) // Generation 5 keeps language flags only up to Arceus.
        {
            for (var language = 0; language < Languages5.Length; language++)
            {
                var index = language;
                flags.Add(new($"Language: {Languages5[index]}", dex.GetLanguageFlag(species, index), value => dex.SetLanguageFlag(species, index, value)));
            }
        }
        var (start, count) = dex.GetFormIndex(species);
        AddForms(flags, save, species, start, count, dex.GetFormFlag, dex.SetFormFlag);
        return flags;
    }

    private static List<PokedexFlag> Gen6(SaveFile save, Zukan6 dex, ushort species)
    {
        List<PokedexFlag> flags = [];
        AddRegions(flags, "", save.Personal[species].Gender, region => dex.GetSeen(species, region), (region, on) => dex.SetSeen(species, region, on), region => dex.GetDisplayed(species, region), (region, on) => dex.SetDisplayed(species, region, on));
        if (dex is Zukan6XY xy && species <= (int)Species.Genesect)
            flags.Add(new("Caught in an earlier generation", xy.GetForeignFlag(species), on => xy.SetForeignFlag(species, on)));
        for (var language = 0; language < Languages5.Length; language++)
        {
            var index = language;
            flags.Add(new($"Language: {Languages5[index]}", dex.GetLanguageFlag(species, index), on => dex.SetLanguageFlag(species, index, on)));
        }
        var (start, count) = dex.GetFormIndex(species);
        AddForms(flags, save, species, start, count, dex.GetFormFlag, dex.SetFormFlag);
        return flags;
    }

    // Generation 7 keeps a separate Seen and Displayed entry for each alternate form after the species entries.
    private static List<PokedexFlag> Gen7(SAV7 save, ushort species)
    {
        var dex = save.Zukan;
        List<PokedexFlag> flags = [];
        var index = species - 1;
        AddRegions(flags, "", dex.GetBaseSpeciesGenderValue(index), region => dex.GetSeen(species, region), (region, on) => dex.SetSeen(species, region, on), region => dex.GetDisplayed(index, region), (region, on) => dex.SetDisplayed(index, region, on));
        for (var language = 0; language < Languages7.Length; language++)
        {
            var lang = language;
            flags.Add(new($"Language: {Languages7[lang]}", dex.GetLanguageFlag(index, lang), on => dex.SetLanguageFlag(index, lang, on)));
        }
        var formCount = save.Personal[species].FormCount;
        var names = FormNames(save, species);
        for (var form = 1; form < formCount; form++)
        {
            var entry = dex.GetDexFormIndex(species, formCount, form);
            if (entry < 0)
                continue;
            var name = FormName(names, form);
            AddRegions(flags, $" ({name})", dex.GetBaseSpeciesGenderValue(entry), region => dex.GetSeen((ushort)(entry + 1), region), (region, on) => dex.SetSeen((ushort)(entry + 1), region, on), region => dex.GetDisplayed(entry, region), (region, on) => dex.SetDisplayed(entry, region, on));
        }
        return flags;
    }

    private static void AddRegions(List<PokedexFlag> flags, string suffix, byte gender, Func<int, bool> seen, Action<int, bool> setSeen, Func<int, bool> displayed, Action<int, bool> setDisplayed)
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

    private static void AddForms(List<PokedexFlag> flags, SaveFile save, ushort species, int start, int count, Func<int, int, bool> get, Action<int, int, bool> set)
    {
        if (count == 0)
            return;
        var names = FormNames(save, species);
        for (var state = 0; state < FormStates.Length; state++)
        {
            for (var form = 0; form < count; form++)
            {
                var (region, index) = (state, start + form);
                flags.Add(new($"{FormStates[region]}: {FormName(names, form)}", get(index, region), value => set(index, region, value)));
            }
        }
    }

    private static string[] FormNames(SaveFile save, ushort species) =>
        FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, save.Context);

    private static string FormName(string[] names, int form) => form < names.Length && names[form].Length != 0 ? names[form] : $"Form {form}";
}
