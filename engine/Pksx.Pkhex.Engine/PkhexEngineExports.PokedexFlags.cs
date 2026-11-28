using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public readonly record struct PokedexFlag(string Label, bool On, Action<bool> Set);

// PKHeX gives Generation 4 and 5 no save-level Seen or Caught setters, so these call each Pokedex block.
internal static class PokedexFlags
{
    private const byte None = Zukan4.FORM_NONE;
    // Generation 4 stores German before Italian; Generation 5 stores Italian before German.
    private static readonly string[] Languages4 = ["Japanese", "English", "French", "German", "Italian", "Spanish"];
    private static readonly string[] Languages5 = ["Japanese", "English", "French", "Italian", "German", "Spanish", "Korean"];
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
            case SAV8LA la:
                LegendsArceusPokedex.SetSeen(la, species, seen);
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
        else if (save is SAV8LA la) LegendsArceusPokedex.SetCaught(la, species, caught);
        else save.SetCaught(species, caught);
    }

    public static bool InDex(SaveFile save, int species) => save is not SAV8LA || LegendsArceusPokedex.InDex(species);

    public static List<PokedexFlag> Of(SaveFile save, ushort species) => save switch
    {
        SAV4 s4 => Gen4(s4, species),
        SAV5 s5 => Gen5(s5, species),
        _ => [],
    };

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
        if (count == 0)
            return flags;
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, save.Context);
        for (var state = 0; state < FormStates.Length; state++)
        {
            for (var form = 0; form < count; form++)
            {
                var (region, index) = (state, start + form);
                var name = form < names.Length && names[form].Length != 0 ? names[form] : $"Form {form}";
                flags.Add(new($"{FormStates[region]}: {name}", dex.GetFormFlag(index, region), value => dex.SetFormFlag(index, region, value)));
            }
        }
        return flags;
    }
}
