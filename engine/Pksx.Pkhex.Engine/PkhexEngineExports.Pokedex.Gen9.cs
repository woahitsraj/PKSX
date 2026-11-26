using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

// Scarlet and Violet keep one Kitakami-layout entry per species, with a displayed form, gender, and shiny state per regional Pokedex.
internal static class ScarletVioletPokedex
{
    public const string OldLayout = "This Scarlet or Violet Save File uses the Pokedex layout from before version 2.0.1. Open it in the game once, save, and import it again.";
    private static readonly (LanguageID Id, string Name)[] Languages =
    [
        (LanguageID.Japanese, "Japanese"), (LanguageID.English, "English"), (LanguageID.French, "French"), (LanguageID.Italian, "Italian"), (LanguageID.German, "German"),
        (LanguageID.Spanish, "Spanish"), (LanguageID.Korean, "Korean"), (LanguageID.ChineseS, "Chinese (simplified)"), (LanguageID.ChineseT, "Chinese (traditional)"),
    ];
    private static readonly string[] Regions = ["Paldea", "Kitakami", "Blueberry"];
    private static readonly string[] SeenGenders = ["male", "female", "genderless"];

    // Before 2.0.1 the game stores the Paldea layout, and the Kitakami block is empty.
    public static bool Supported(SAV9SV save) => save.Zukan.GetRevision() != 0;

    // PKHeX does not register a form from a regional Pokedex that the save's DLC revision does not have.
    private static bool Allowed(SAV9SV save, ushort species, byte form)
    {
        var pi = save.Personal.GetFormEntry(species, form);
        return save.Personal.IsPresentInGame(species, form) && (save.SaveRevision >= 2 || pi.DexGroup <= save.SaveRevision + 1);
    }

    private static byte First(SAV9SV save, ushort species)
    {
        for (byte form = 0; form < save.Personal[species].FormCount; form++)
            if (Allowed(save, species, form))
                return form;
        return 0;
    }

    public static bool InDex(SAV9SV save, int species)
    {
        for (byte form = 0; form < save.Personal[species].FormCount; form++)
            if (Allowed(save, (ushort)species, form))
                return true;
        return false;
    }

    private static bool InRegion(SAV9SV save, ushort species, int region)
    {
        if (region > save.SaveRevision)
            return false;
        for (byte form = 0; form < save.Personal[species].FormCount; form++)
        {
            var pi = save.Personal.GetFormEntry(species, form);
            if ((region == 0 ? pi.DexPaldea : region == 1 ? pi.DexKitakami : pi.DexBlueberry) != 0)
                return true;
        }
        return false;
    }

    public static void SetSeen(SAV9SV save, ushort species, bool seen)
    {
        var entry = save.Zukan.DexKitakami.Get(species);
        if (!seen)
        {
            entry.Clear();
            return;
        }
        if (entry.IsSeen)
            return;
        var form = First(save, species);
        var pi = save.Personal.GetFormEntry(species, form);
        entry.SetIsModelSeen(false, true);
        entry.SetSeenForm(form, true);
        entry.SetHeardForm(form, true);
        entry.SetIsGenderSeen(pi.IsDualGender ? (byte)0 : pi.FixedGender(), true);
    }

    public static void SetCaught(SAV9SV save, ushort species, bool caught)
    {
        var entry = save.Zukan.DexKitakami.Get(species);
        if (!caught)
        {
            entry.ClearCaught();
            return;
        }
        SetSeen(save, species, true);
        if (entry.IsCaught)
            return;
        var form = First(save, species);
        var pi = save.Personal.GetFormEntry(species, form);
        entry.SetObtainedForm(form, true);
        entry.SetLocalStates(pi, form, pi.IsDualGender ? (byte)0 : pi.FixedGender(), false);
        entry.SetLanguageFlag(save.Language, true);
    }

    public static List<PokedexFlag> Flags(SAV9SV save, ushort species)
    {
        var dex = save.Zukan.DexKitakami;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, EntityContext.Gen9);
        List<byte> forms = [];
        for (byte form = 0; form < 32; form++)
        {
            var entry = dex.Get(species);
            if ((form < info.FormCount && Allowed(save, species, form)) || entry.GetSeenForm(form) || entry.GetObtainedForm(form) || entry.GetHeardForm(form) || entry.GetCheckedForm(form))
                forms.Add(form);
        }
        void Form(string state, Func<byte, bool> get, Action<byte, bool> set)
        {
            foreach (var form in forms)
            {
                var name = form < names.Length && names[form].Length != 0 ? names[form] : $"form {form}";
                flags.Add(new(forms.Count == 1 ? state : $"{state}: {name}", get(form), on => set(form, on)));
            }
        }
        Form("Form seen", f => dex.Get(species).GetSeenForm(f), (f, on) => dex.Get(species).SetSeenForm(f, on));
        Form("Form caught", f => dex.Get(species).GetObtainedForm(f), (f, on) => dex.Get(species).SetObtainedForm(f, on));
        Form("Form known", f => dex.Get(species).GetHeardForm(f), (f, on) => dex.Get(species).SetHeardForm(f, on));
        Form("Form viewed", f => dex.Get(species).GetCheckedForm(f), (f, on) => dex.Get(species).SetCheckedForm(f, on));
        for (byte gender = 0; gender < SeenGenders.Length; gender++)
        {
            var g = gender;
            var on = dex.Get(species).GetIsGenderSeen(g);
            var applies = g switch { 0 => !info.OnlyFemale && !info.Genderless, 1 => !info.OnlyMale && !info.Genderless, _ => info.Genderless };
            if (applies || on)
                flags.Add(new($"Seen: {SeenGenders[g]}", on, value => dex.Get(species).SetIsGenderSeen(g, value)));
        }
        flags.Add(new("Seen: shiny", dex.Get(species).GetIsModelSeen(true), on => dex.Get(species).SetIsModelSeen(true, on)));
        foreach (var (id, name) in Languages)
            flags.Add(new($"Language: {name}", dex.Get(species).GetLanguageFlag((int)id), on => dex.Get(species).SetLanguageFlag((int)id, on)));
        for (var region = 0; region < Regions.Length; region++)
        {
            var r = region;
            var shiny = Display(dex.Get(species), r).Shiny;
            if (InRegion(save, species, r) || shiny != 0)
                flags.Add(new($"{Regions[r]} Pokedex: displayed shiny", shiny != 0, on => SetDisplay(dex.Get(species), r, shiny: (byte)(on ? 1 : 0))));
        }
        return flags;
    }

    public static IEnumerable<PokedexField> Fields(SAV9SV save)
    {
        var dex = save.Zukan.DexKitakami;
        for (ushort species = 1; species <= save.MaxSpeciesID; species++)
        {
            if (!InDex(save, species))
                continue;
            var count = save.Personal[species].FormCount;
            for (var region = 0; region < Regions.Length; region++)
            {
                var (form, gender, _) = Display(dex.Get(species), region);
                if (!InRegion(save, species, region) && form == 0 && gender == 0)
                    continue;
                var key = Regions[region].ToLowerInvariant();
                yield return new($"{key}-form-{species}", $"{Regions[region]} Pokedex: displayed form (0 to {count - 1})", form, 0, Math.Max(count - 1, form), species);
                yield return new($"{key}-gender-{species}", $"{Regions[region]} Pokedex: displayed gender (0 = male, 1 = female, 2 = genderless)", gender, 0, Math.Max((byte)2, gender), species);
            }
        }
    }

    public static void SetField(SAV9SV save, PokedexField field, long value)
    {
        var entry = save.Zukan.DexKitakami.Get((ushort)field.Species!.Value);
        var region = Array.FindIndex(Regions, r => field.Key.StartsWith(r.ToLowerInvariant() + "-"));
        if (field.Key.Contains("-form-")) SetDisplay(entry, region, form: (byte)value);
        else SetDisplay(entry, region, gender: (byte)value);
    }

    private static (byte Form, byte Gender, byte Shiny) Display(PokeDexEntry9Kitakami entry, int region) => region switch
    {
        0 => (entry.DisplayedPaldeaForm, entry.DisplayedPaldeaGender, entry.DisplayedPaldeaShiny),
        1 => (entry.DisplayedKitakamiForm, entry.DisplayedKitakamiGender, entry.DisplayedKitakamiShiny),
        _ => (entry.DisplayedBlueberryForm, entry.DisplayedBlueberryGender, entry.DisplayedBlueberryShiny),
    };

    private static void SetDisplay(PokeDexEntry9Kitakami entry, int region, byte? form = null, byte? gender = null, byte? shiny = null)
    {
        var (f, g, s) = Display(entry, region);
        (f, g, s) = (form ?? f, gender ?? g, shiny ?? s);
        if (region == 0) entry.SetLocalPaldea(f, g, s);
        else if (region == 1) entry.SetLocalKitakami(f, g, s);
        else entry.SetLocalBlueberry(f, g, s);
    }
}

// Legends: Z-A keeps one entry per species with form, shiny, Mega, and Alpha state; Hyperspace species need the Mega Dimension data.
internal static class LegendsZAPokedex
{
    private const int Lumiose = 232;
    private static readonly (LanguageID Id, string Name)[] Languages =
    [
        (LanguageID.Japanese, "Japanese"), (LanguageID.English, "English"), (LanguageID.French, "French"), (LanguageID.Italian, "Italian"), (LanguageID.German, "German"),
        (LanguageID.Spanish, "Spanish (Spain)"), (LanguageID.Korean, "Korean"), (LanguageID.ChineseS, "Chinese (simplified)"), (LanguageID.ChineseT, "Chinese (traditional)"),
        (LanguageID.SpanishL, "Spanish (Latin America)"),
    ];
    private static readonly string[] SeenGenders = ["male", "female", "genderless"];

    private static byte First(SAV9ZA save, ushort species)
    {
        for (byte form = 0; form < save.Personal[species].FormCount; form++)
            if (save.Personal.IsPresentInGame(species, form))
                return form;
        return 0;
    }

    public static bool InDex(SAV9ZA save, int species)
    {
        var id = (ushort)species;
        if (!save.Personal.IsSpeciesInGame(id))
            return false;
        var dex = save.Personal.GetFormEntry(id, First(save, id)).DexIndex;
        return save.SaveRevision != 0 || dex is > 0 and <= Lumiose;
    }

    public static void SetSeen(SAV9ZA save, ushort species, bool seen)
    {
        var entry = save.Zukan.GetEntry(species);
        if (!seen)
        {
            entry.Clear();
            return;
        }
        if (entry.IsSeen)
            return;
        var form = First(save, species);
        var pi = save.Personal.GetFormEntry(species, form);
        entry.SetIsFormSeen(form, true);
        entry.SetIsGenderSeen(pi.IsDualGender ? (byte)0 : pi.FixedGender(), true);
    }

    public static void SetCaught(SAV9ZA save, ushort species, bool caught)
    {
        var entry = save.Zukan.GetEntry(species);
        if (!caught)
        {
            entry.ClearCaught();
            return;
        }
        SetSeen(save, species, true);
        if (entry.IsCaught)
            return;
        var form = First(save, species);
        var pi = save.Personal.GetFormEntry(species, form);
        entry.SetIsFormCaught(form, true);
        entry.SetLanguageFlag(save.Language, true);
        entry.DisplayForm = form;
        entry.SetDisplayGender((Gender)(pi.IsDualGender ? 0 : pi.FixedGender()), species, form);
    }

    public static List<PokedexFlag> Flags(SAV9ZA save, ushort species)
    {
        var dex = save.Zukan;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, EntityContext.Gen9a);
        List<byte> forms = [];
        for (byte form = 0; form < 32; form++)
        {
            var entry = dex.GetEntry(species);
            if ((form < info.FormCount && save.Personal.IsPresentInGame(species, form)) || entry.GetIsFormSeen(form) || entry.GetIsFormCaught(form) || entry.GetIsShinySeen(form))
                forms.Add(form);
        }
        void Form(string state, Func<byte, bool> get, Action<byte, bool> set)
        {
            foreach (var form in forms)
            {
                var name = form < names.Length && names[form].Length != 0 ? names[form] : $"form {form}";
                flags.Add(new(forms.Count == 1 ? state : $"{state}: {name}", get(form), on => set(form, on)));
            }
        }
        Form("Form seen", f => dex.GetEntry(species).GetIsFormSeen(f), (f, on) => dex.GetEntry(species).SetIsFormSeen(f, on));
        Form("Form caught", f => dex.GetEntry(species).GetIsFormCaught(f), (f, on) => dex.GetEntry(species).SetIsFormCaught(f, on));
        Form("Form seen shiny", f => dex.GetEntry(species).GetIsShinySeen(f), (f, on) => dex.GetEntry(species).SetIsShinySeen(f, on));
        for (byte gender = 0; gender < SeenGenders.Length; gender++)
        {
            var g = gender;
            var on = dex.GetEntry(species).GetIsGenderSeen(g);
            var applies = g switch { 0 => !info.OnlyFemale && !info.Genderless, 1 => !info.OnlyMale && !info.Genderless, _ => info.Genderless };
            if (applies || on)
                flags.Add(new($"Seen: {SeenGenders[g]}", on, value => dex.GetEntry(species).SetIsGenderSeen(g, value)));
        }
        var megas = Megas(save, species);
        for (byte index = 0; index < 8; index++)
        {
            var i = index;
            var on = dex.GetEntry(species).GetIsSeenMega(i);
            if (i < megas.Length || on)
                flags.Add(new($"Seen: {(i < megas.Length ? megas[i] : $"Mega {i}")}", on, value => dex.GetEntry(species).SetIsSeenMega(i, value)));
        }
        flags.Add(new("Seen: Alpha", dex.GetEntry(species).GetIsSeenAlpha(), on => dex.GetEntry(species).SetIsSeenAlpha(on)));
        foreach (var (id, name) in Languages)
            flags.Add(new($"Language: {name}", dex.GetEntry(species).GetLanguageFlag((int)id), on => dex.GetEntry(species).SetLanguageFlag((int)id, on)));
        flags.Add(new("Displayed shiny", dex.GetEntry(species).GetDisplayIsShiny(), on => dex.GetEntry(species).SetDisplayIsShiny(on)));
        flags.Add(new("Shown as new", dex.GetEntry(species).GetDisplayIsNew(), on => dex.GetEntry(species).SetDisplayIsNew(on)));
        return flags;
    }

    // The same Mega labels and slots as the PKHeX Z-A Pokedex editor.
    private static string[] Megas(SAV9ZA save, ushort species)
    {
        var n = FormConverter.GetMegaFormNames(GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, GameInfo.Strings.Types);
        if (Zukan9a.IsMegaFormXY(species, save.SaveRevision)) return [n.X, n.Y];
        if (Zukan9a.IsMegaFormZA(species, save.SaveRevision)) return [n.Regular, n.Z];
        return (Species)species switch
        {
            Species.Meowstic => [n.MeowsticM, n.MeowsticF],
            Species.Magearna => [n.Magearna0, n.Magearna1],
            Species.Tatsugiri => [n.Tatsu0, n.Tatsu1, n.Tatsu2],
            _ => FormInfo.HasMegaForm(species) ? [n.Regular] : [],
        };
    }

    public static IEnumerable<PokedexField> Fields(SAV9ZA save)
    {
        for (ushort species = 1; species <= save.MaxSpeciesID; species++)
        {
            if (!InDex(save, species))
                continue;
            var entry = save.Zukan.GetEntry(species);
            var (form, gender) = (entry.DisplayForm, (byte)entry.DisplayGender);
            var count = save.Personal[species].FormCount;
            yield return new($"za-form-{species}", $"Displayed form (0 to {count - 1})", form, 0, Math.Max(count - 1, form), species);
            yield return new($"za-gender-{species}", "Displayed gender (0 = genderless, 1 = male, 2 = female, 3 = no gender difference)", gender, 0, Math.Max((byte)3, gender), species);
        }
    }

    public static void SetField(SAV9ZA save, PokedexField field, long value)
    {
        var entry = save.Zukan.GetEntry((ushort)field.Species!.Value);
        if (field.Key.StartsWith("za-form-")) entry.DisplayForm = (byte)value;
        else entry.DisplayGender = (DisplayGender9a)value;
    }
}
