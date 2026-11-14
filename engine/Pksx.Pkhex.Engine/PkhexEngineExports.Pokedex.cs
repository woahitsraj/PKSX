using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public sealed record PokedexSpecies(int Id, string Name, bool Seen, bool Caught);
public sealed record PokedexField(string Key, string Label, long Value, long Min, long Max);
public sealed record PokedexEdit(int? Species, bool? Seen, bool? Caught, string? Field, long? Value);
public sealed record PokedexProjection(string Status, string? Reason, List<PokedexSpecies> Species, List<PokedexField> Fields)
{
    public static PokedexProjection From(SaveFile save)
    {
        if (!save.HasPokeDex)
            return new("unavailable", "This Save File format has no Pokedex.", [], []);
        if (save is not (SAV1 or SAV2 or SAV3))
            return new("unavailable", "Pokedex editing currently supports Generations 1 through 3 handheld Save Files.", [], []);
        var species = Enumerable.Range(1, save.MaxSpeciesID)
            .Select(id => new PokedexSpecies(id, GameInfo.Strings.specieslist[id], save.GetSeen((ushort)id), save.GetCaught((ushort)id))).ToList();
        List<PokedexField> fields = [];
        if (save is SAV2 s2)
        {
            fields.Add(new("unown-first", "Unown display letter (1 = A, 26 = Z)", s2.UnownFirstSeen, 1, 26));
            fields.Add(new("unown-unlocked", "Unown unlocked groups (bit mask)", s2.UnownUnlocked, 0, 15));
        }
        if (save is SAV3 s3)
        {
            fields.Add(new("national", "National Pokedex (0 = off, 1 = on)", s3.NationalDex ? 1 : 0, 0, 1));
            fields.Add(new("unown-pid", "Unown display PID", s3.SmallBlock.DexPIDUnown, 0, uint.MaxValue));
            fields.Add(new("spinda-pid", "Spinda display PID", s3.SmallBlock.DexPIDSpinda, 0, uint.MaxValue));
        }
        return new("available", null, species, fields);
    }
}

public static partial class PkhexEngineExports
{
    private static SlotMutationResult ApplyPokedexEdit(SaveFile save, PokedexEdit edit)
    {
        var projection = PokedexProjection.From(save);
        if (projection.Status != "available")
            return SlotMutationResult.Fail("unsupported-save-file-edit", projection.Reason!);
        if (edit.Species is int id)
        {
            if (id < 1 || id > save.MaxSpeciesID || edit.Field is not null || edit.Value is not null || (edit.Seen is null && edit.Caught is null))
                return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex species and flag.");
            var species = (ushort)id;
            var beforeSeen = save.GetSeen(species);
            var beforeCaught = save.GetCaught(species);
            if (edit.Seen is bool seen) save.SetSeen(species, seen);
            if (edit.Caught is bool caught) save.SetCaught(species, caught);
            if (save is SAV3 s3) s3.MirrorSeenFlags();
            return SlotMutationResult.Success(beforeSeen != save.GetSeen(species) || beforeCaught != save.GetCaught(species));
        }
        var field = projection.Fields.Find(f => f.Key == edit.Field);
        if (field is null || edit.Value is not long value || value < field.Min || value > field.Max || edit.Seen is not null || edit.Caught is not null)
            return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a supported Pokedex field and a value in its range.");
        switch (save, field.Key)
        {
            case (SAV2 s2, "unown-first"): s2.UnownFirstSeen = (int)value; break;
            case (SAV2 s2, "unown-unlocked"): s2.UnownUnlocked = (int)value; break;
            case (SAV3 s3, "national"): s3.NationalDex = value != 0; break;
            case (SAV3 s3, "unown-pid"): s3.SmallBlock.DexPIDUnown = (uint)value; break;
            case (SAV3 s3, "spinda-pid"): s3.SmallBlock.DexPIDSpinda = (uint)value; break;
        }
        return SlotMutationResult.Success(value != field.Value);
    }
}
