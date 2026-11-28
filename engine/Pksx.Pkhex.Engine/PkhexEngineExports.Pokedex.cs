using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public sealed record PokedexSpecies(int Id, string Name, bool Seen, bool Caught, int? FlagSet = null, string? Flags = null);
public sealed record PokedexField(string Key, string Label, long Value, long Min, long Max, int? Species = null);
public sealed record PokedexEdit(string Kind, int? Species, bool? Seen, bool? Caught, string? Field, long? Value, int? Flag = null, bool? On = null);
// FlagSets holds each distinct list of flag labels once; a species names its list and packs its values as 0 and 1.
public sealed record PokedexProjection(string Status, string? Reason, List<PokedexSpecies> Species, List<PokedexField> Fields, List<string[]>? FlagSets = null)
{
    public static PokedexProjection From(SaveFile save)
    {
        if (!save.HasPokeDex)
            return new("unavailable", "This Save File format has no Pokedex.", [], []);
        if (save is not (SAV1 or SAV2 or SAV3 or SAV4 or SAV5 or SAV6XY or SAV6AO or SAV7SM or SAV7USUM))
            return new("unavailable", "Pokedex editing currently supports Generations 1 through 7 handheld Save Files.", [], []);
        List<string[]> flagSets = [];
        Dictionary<string, int> flagSetIds = [];
        var species = Enumerable.Range(1, save.MaxSpeciesID).Select(id =>
        {
            var flags = PokedexFlags.Of(save, (ushort)id);
            int? set = null;
            if (flags.Count != 0)
            {
                var labels = flags.Select(f => f.Label).ToArray();
                var key = string.Join('\n', labels);
                if (!flagSetIds.TryGetValue(key, out var index))
                {
                    flagSetIds[key] = index = flagSets.Count;
                    flagSets.Add(labels);
                }
                set = index;
            }
            return new PokedexSpecies(id, GameInfo.Strings.specieslist[id], save.GetSeen((ushort)id), save.GetCaught((ushort)id), set, set is null ? null : string.Concat(flags.Select(f => f.On ? '1' : '0')));
        }).ToList();
        List<PokedexField> fields = [];
        if (save is SAV2 s2)
        {
            fields.Add(new("unown-first", "Unown display letter (1 = A, 26 = Z)", s2.UnownFirstSeen, 1, 26, (int)PKHeX.Core.Species.Unown));
            fields.Add(new("unown-unlocked", "Unown unlocked groups (bit mask)", s2.UnownUnlocked, 0, 15, (int)PKHeX.Core.Species.Unown));
        }
        if (save is SAV3 s3)
        {
            fields.Add(new("national", "National Pokedex (0 = off, 1 = on)", s3.NationalDex ? 1 : 0, 0, 1));
            fields.Add(new("unown-pid", "Unown display PID", s3.SmallBlock.DexPIDUnown, 0, uint.MaxValue, (int)PKHeX.Core.Species.Unown));
            fields.Add(new("spinda-pid", "Spinda display PID", s3.SmallBlock.DexPIDSpinda, 0, uint.MaxValue, (int)PKHeX.Core.Species.Spinda));
        }
        if (save is SAV4 s4)
        {
            var modes = s4 is SAV4HGSS ? "1 = simple, 2 = National, 3 = other languages" : "1 = simple, 2 = forms, 3 = National, 4 = other languages";
            fields.Add(new("national", "National Pokedex (0 = off, 1 = on)", s4.NationalDex ? 1 : 0, 0, 1));
            // PKHeX reads and writes the upgrade only when the save reports a paired version.
            if (s4.Version is GameVersion.DP or GameVersion.Pt or GameVersion.HGSS)
                fields.Add(new("upgrade", $"Pokedex upgrade (0 = not given, {modes})", s4.DexUpgraded, 0, s4 is SAV4HGSS ? 3 : 4));
            fields.Add(new("spinda-pid", "Spinda display PID", s4.Dex.SpindaPID, 0, uint.MaxValue, (int)PKHeX.Core.Species.Spinda));
        }
        if (save is SAV5 s5)
        {
            fields.Add(new("national", "National Pokedex (0 = off, 1 = on)", s5.Zukan.IsNationalDexUnlocked ? 1 : 0, 0, 1));
            fields.Add(new("national-mode", "National Pokedex mode (0 = off, 1 = on)", s5.Zukan.IsNationalDexMode ? 1 : 0, 0, 1));
            fields.Add(new("opens-on", "Species number the Pokedex opens on", s5.Zukan.InitialSpecies, 0, save.MaxSpeciesID));
            fields.Add(new("spinda-pid", "Spinda display PID", s5.Zukan.Spinda, 0, uint.MaxValue, (int)PKHeX.Core.Species.Spinda));
        }
        if (PokedexFlags.Dex6(save) is { } d6)
        {
            fields.Add(new("national", "National Pokedex (0 = off, 1 = on)", d6.IsNationalDexUnlocked ? 1 : 0, 0, 1));
            fields.Add(new("national-mode", "National Pokedex mode (0 = off, 1 = on)", d6.IsNationalDexMode ? 1 : 0, 0, 1));
            fields.Add(new("opens-on", "Species number the Pokedex opens on", d6.InitialSpecies, 0, save.MaxSpeciesID));
            fields.Add(new("spinda-pid", "Spinda display PID", d6.Spinda, 0, uint.MaxValue, (int)PKHeX.Core.Species.Spinda));
        }
        if (save is SAV6AO ao)
        {
            for (ushort id = 1; id <= save.MaxSpeciesID; id++)
            {
                fields.Add(new($"seen-count-{id}", "Times seen", ao.Zukan.GetCountSeen(id), 0, ushort.MaxValue, id));
                fields.Add(new($"obtained-count-{id}", "Times obtained", ao.Zukan.GetCountObtained(id), 0, ushort.MaxValue, id));
            }
        }
        return new("available", null, species, fields, flagSets.Count == 0 ? null : flagSets);
    }
}

public static partial class PkhexEngineExports
{
    private static SlotMutationResult ApplyPokedexEdit(SaveFile save, PokedexEdit edit)
    {
        var projection = PokedexProjection.From(save);
        if (projection.Status != "available")
            return SlotMutationResult.Fail("unsupported-save-file-edit", projection.Reason!);
        if (edit.Kind == "flag")
        {
            if (edit.Species is not int owner || owner < 1 || owner > save.MaxSpeciesID || edit.On is not bool on || edit.Seen is not null || edit.Caught is not null || edit.Field is not null || edit.Value is not null)
                return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex species and flag.");
            var flags = PokedexFlags.Of(save, (ushort)owner);
            if (edit.Flag is not int flag || flag < 0 || flag >= flags.Count)
                return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex species and flag.");
            if (flags[flag].On == on)
                return SlotMutationResult.Success(false);
            flags[flag].Set(on);
            return SlotMutationResult.Success(!PokedexFlags.Of(save, (ushort)owner).Select(f => f.On).SequenceEqual(flags.Select(f => f.On)));
        }
        if (edit.Flag is not null || edit.On is not null)
            return SlotMutationResult.Fail("invalid-save-file-edit", "Only a Pokedex flag edit takes a flag.");
        if (edit.Kind is "seen" or "caught")
        {
            if (edit.Species is not int id || id < 1 || id > save.MaxSpeciesID || edit.Field is not null || edit.Value is not null || (edit.Kind == "seen" && (edit.Seen is null || edit.Caught is not null)) || (edit.Kind == "caught" && (edit.Caught is null || edit.Seen is not null)))
                return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex species and flag.");
            var species = (ushort)id;
            var beforeSeen = save.GetSeen(species);
            var beforeCaught = save.GetCaught(species);
            if (edit.Seen is bool seen) PokedexFlags.SetSeen(save, species, seen);
            if (edit.Caught is bool caught) PokedexFlags.SetCaught(save, species, caught);
            if (save is SAV3 s3) s3.MirrorSeenFlags();
            return SlotMutationResult.Success(beforeSeen != save.GetSeen(species) || beforeCaught != save.GetCaught(species));
        }
        if (edit.Kind is "all-seen" or "all-caught")
        {
            if (edit.Species is not null || edit.Seen is not null || edit.Caught is not null || edit.Field is not null || edit.Value is not null)
                return SlotMutationResult.Fail("invalid-save-file-edit", "Mark all Seen or all Caught takes no other values.");
            var seen = edit.Kind == "all-seen";
            var mutated = false;
            for (ushort id = 1; id <= save.MaxSpeciesID; id++)
            {
                if (seen ? save.GetSeen(id) : save.GetCaught(id))
                    continue;
                if (seen) PokedexFlags.SetSeen(save, id, true);
                else PokedexFlags.SetCaught(save, id, true);
                mutated = true;
            }
            if (mutated && save is SAV3 sav3) sav3.MirrorSeenFlags();
            return SlotMutationResult.Success(mutated);
        }
        var field = projection.Fields.Find(f => f.Key == edit.Field);
        if (edit.Kind != "field" || edit.Species is not null || field is null || edit.Value is not long value || value < field.Min || value > field.Max || edit.Seen is not null || edit.Caught is not null)
            return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex field and a value in its range.");
        if (value == field.Value)
            return SlotMutationResult.Success(false);
        switch (save, field.Key)
        {
            case (SAV2 s2, "unown-first"): s2.UnownFirstSeen = (int)value; break;
            case (SAV2 s2, "unown-unlocked"): s2.UnownUnlocked = (int)value; break;
            case (SAV3 s3, "national"): s3.NationalDex = value != 0; break;
            case (SAV3 s3, "unown-pid"): s3.SmallBlock.DexPIDUnown = (uint)value; break;
            case (SAV3 s3, "spinda-pid"): s3.SmallBlock.DexPIDSpinda = (uint)value; break;
            case (SAV4 s4, "national"): s4.NationalDex = value != 0; break;
            case (SAV4 s4, "upgrade"): s4.DexUpgraded = (int)value; break;
            case (SAV4 s4, "spinda-pid"): s4.Dex.SpindaPID = (uint)value; break;
            case (SAV5 s5, "national"): s5.Zukan.IsNationalDexUnlocked = value != 0; break;
            case (SAV5 s5, "national-mode"): s5.Zukan.IsNationalDexMode = value != 0; break;
            case (SAV5 s5, "opens-on"): s5.Zukan.InitialSpecies = (ushort)value; break;
            case (SAV5 s5, "spinda-pid"): s5.Zukan.Spinda = (uint)value; break;
            case (SAV6AO ao, _) when field.Species is int id && field.Key.StartsWith("seen-count-"): ao.Zukan.SetCountSeen((ushort)id, (ushort)value); break;
            case (SAV6AO ao, _) when field.Species is int id && field.Key.StartsWith("obtained-count-"): ao.Zukan.SetCountObtained((ushort)id, (ushort)value); break;
            case (SAV6, "national"): PokedexFlags.Dex6(save)!.IsNationalDexUnlocked = value != 0; break;
            case (SAV6, "national-mode"): PokedexFlags.Dex6(save)!.IsNationalDexMode = value != 0; break;
            case (SAV6, "opens-on"): PokedexFlags.Dex6(save)!.InitialSpecies = (ushort)value; break;
            case (SAV6, "spinda-pid"): PokedexFlags.Dex6(save)!.Spinda = (uint)value; break;
        }
        return SlotMutationResult.Success(value != field.Value);
    }
}
