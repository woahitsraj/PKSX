using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public sealed record PokedexRegion(string Label, int Count, bool Available, string? Reason);

// Sword and Shield keep one entry per species in the Galar, Isle of Armor, or Crown Tundra block.
internal static class SwordShieldPokedex
{
    private const byte Gigantamax = 63;
    private static readonly string[] Genders = ["male or genderless", "female", "shiny male or genderless", "shiny female"];
    private static readonly string[] Languages = ["Japanese", "English", "French", "Italian", "German", "Spanish", "Korean", "Chinese (simplified)", "Chinese (traditional)"];
    private static readonly string[] Decorations = ["Strawberry", "Berry", "Love", "Star", "Clover", "Flower", "Ribbon"];

    public static bool InDex(SAV8SWSH save, int species) => save.Zukan.GetEntry((ushort)species, out _);

    public static List<PokedexRegion> Regions(SAV8SWSH save)
    {
        var revision = save.Zukan.GetRevision();
        var pt = save.Personal;
        int Count(Func<PersonalInfo8SWSH, int> index) => Enumerable.Range(1, pt.MaxSpeciesID).Count(id => index(pt[id]) != 0);
        return
        [
            new("Galar Pokedex", Count(p => p.PokeDexIndex), true, null),
            new("Isle of Armor Pokedex", Count(p => p.ArmorDexIndex), revision >= 1, revision >= 1 ? null : "This Save File has no Isle of Armor Pokedex data."),
            new("Crown Tundra Pokedex", Count(p => p.CrownDexIndex), revision >= 2, revision >= 2 ? null : "This Save File has no Crown Tundra Pokedex data."),
        ];
    }

    public static string Regional(SAV8SWSH save, ushort species)
    {
        var p = save.Personal[species];
        var revision = save.Zukan.GetRevision();
        List<string> numbers = [];
        if (p.PokeDexIndex != 0) numbers.Add($"Galar {p.PokeDexIndex:000}");
        if (p.ArmorDexIndex != 0 && revision >= 1) numbers.Add($"Isle of Armor {p.ArmorDexIndex:000}");
        if (p.CrownDexIndex != 0 && revision >= 2) numbers.Add($"Crown Tundra {p.CrownDexIndex:000}");
        return string.Join(", ", numbers);
    }

    public static void SetSeen(SAV8SWSH save, ushort species, bool seen)
    {
        var dex = save.Zukan;
        if (!seen)
        {
            for (var region = 0; region < 4; region++)
                for (byte form = 0; form <= Gigantamax; form++)
                    dex.SetSeenRegion(species, form, region, false);
            return;
        }
        if (!dex.GetSeen(species))
            dex.SetSeenRegion(species, 0, save.Personal[species].OnlyFemale ? 1 : 0);
    }

    public static List<PokedexFlag> Flags(SAV8SWSH save, ushort species)
    {
        var dex = save.Zukan;
        var info = save.Personal[species];
        List<PokedexFlag> flags = [];
        void Seen(byte bit, string name)
        {
            for (var region = 0; region < 4; region++)
            {
                var r = region;
                var on = dex.GetSeenRegion(species, bit, r);
                var applies = (r & 1) == 0 ? !info.OnlyFemale : !(info.OnlyMale || info.Genderless);
                if (applies || on)
                    flags.Add(new($"{(name.Length == 0 ? "Seen" : $"Seen {name}")}: {Genders[r]}", on, value => dex.SetSeenRegion(species, bit, r, value)));
            }
        }
        foreach (var (bit, name) in Forms(save, species))
            Seen(bit, name);
        flags.Add(new("Displayed shiny", dex.GetDisplayShiny(species), on => dex.SetDisplayShiny(species, on)));
        if (Zukan8.IsGigantamaxFormStored(species))
        {
            flags.Add(new("Caught Gigantamaxed", dex.GetCaughtGigantamaxed(species), on => dex.SetCaughtGigantamax(species, on)));
            if (species == (int)Species.Urshifu)
                flags.Add(new("Caught Gigantamaxed (Rapid Strike)", dex.GetCaughtGigantamax1(species), on => dex.SetCaughtGigantamax1(species, on)));
            flags.Add(new("Displayed Gigantamax instead", dex.GetDisplayDynamaxInstead(species), on => dex.SetDisplayDynamaxInstead(species, on)));
        }
        for (var language = 0; language < Languages.Length; language++)
        {
            var index = language;
            flags.Add(new($"Language: {Languages[index]}", dex.GetIsLanguageIndexObtained(species, index), on => dex.SetIsLanguageIndexObtained(species, index, on)));
        }
        return flags;
    }

    public static IEnumerable<PokedexField> Fields(SAV8SWSH save)
    {
        var dex = save.Zukan;
        foreach (var species in dex.DexLookup.Keys.Order())
        {
            var info = save.Personal[species];
            var form = dex.GetFormDisplayed(species);
            var forms = species == (int)Species.Alcremie ? Decorations.Length * info.FormCount : info.FormCount;
            if (forms > 1 || form != 0)
                yield return new($"display-form-{species}", $"Displayed form (0 to {forms - 1})", form, 0, Math.Max(forms - 1, form), species);
            var gender = dex.GetGenderDisplayed(species);
            if (info.IsDualGender || gender != 0)
                yield return new($"display-gender-{species}", "Displayed gender (0 = male, 1 = female)", gender, 0, Math.Max(1, gender), species);
            yield return new($"battled-{species}", "Times battled", dex.GetBattledCount(species), 0, uint.MaxValue, species);
        }
    }

    public static void SetField(SAV8SWSH save, PokedexField field, long value)
    {
        var dex = save.Zukan;
        var species = (ushort)field.Species!.Value;
        if (field.Key.StartsWith("display-form-")) dex.SetFormDisplayed(species, (uint)value);
        else if (field.Key.StartsWith("display-gender-")) dex.SetGenderDisplayed(species, (uint)value);
        else if (field.Key.StartsWith("battled-")) dex.SetBattledCount(species, (uint)value);
    }

    private static IEnumerable<(byte Bit, string Name)> Forms(SAV8SWSH save, ushort species)
    {
        var info = save.Personal[species];
        var names = FormConverter.GetFormList(species, GameInfo.Strings.Types, GameInfo.Strings.forms, GameInfo.GenderSymbolUnicode, save.Context);
        string Name(int form) => form < names.Length && names[form].Length != 0 ? names[form] : $"form {form}";
        if (species == (int)Species.Alcremie)
        {
            for (var form = 0; form < info.FormCount; form++)
                for (var deco = 0; deco < Decorations.Length; deco++)
                    yield return ((byte)(form * Decorations.Length + deco), $"{Name(form)} with {Decorations[deco]}");
        }
        else
        {
            // Eternamax is not a stored form; PKHeX records it in the Gigantamax bit.
            var count = species == (int)Species.Eternatus ? 1 : info.FormCount;
            for (var form = 0; form < count; form++)
                yield return ((byte)form, count == 1 ? "" : Name(form));
        }
        if (species == (int)Species.Eternatus)
            yield return (Gigantamax, "Eternamax");
        else if (Zukan8.IsGigantamaxFormStored(species))
        {
            yield return (Gigantamax, species == (int)Species.Urshifu ? "Gigantamax (Single Strike)" : "Gigantamax");
            if (species == (int)Species.Urshifu)
                yield return (Gigantamax - 1, "Gigantamax (Rapid Strike)");
        }
    }
}
