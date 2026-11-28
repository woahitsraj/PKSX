using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

// Reported is how many goals the game has already reported; Pending is the research level after the next report.
public sealed record PokedexResearchTask(string Label, int Value, int Max, int[] Goals, int Reported, int Points, bool Required, bool Editable);
public sealed record PokedexResearch(int Level, int Pending, bool Complete, bool Perfect, List<PokedexResearchTask> Tasks);

internal static class LegendsArceusPokedex
{
    private static readonly string[] TaskText = Util.GetStringList("tasks8a", "en");
    private static readonly string[] TimeText = Util.GetStringList("time_tasks8a", "en");
    private static readonly string[] QuestText = Util.GetStringList("species_tasks8a", "en");

    public static bool InDex(int species) => PokedexSave8a.GetDexIndex(PokedexType8a.Hisui, (ushort)species) != 0;

    public static PokedexResearchTask8a[] Tasks(ushort species) =>
        PokedexConstants8a.ResearchTasks[PokedexSave8a.GetDexIndex(PokedexType8a.Hisui, species) - 1];

    public static PokedexResearch Research(SAV8LA save, ushort species)
    {
        var dex = save.PokedexSave;
        var level = dex.GetPokeResearchRate(species);
        var pending = level;
        var tasks = Tasks(species).Select((task, index) =>
        {
            var points = task.PointsSingle + task.PointsBonus;
            pending += dex.GetResearchTaskLevel(species, index, out var reported, out var value, out _) * points;
            var editable = task.Task.CanSetCurrentValue();
            return new PokedexResearchTask(task.GetTaskLabelString(TaskText, TimeText, QuestText), value, editable ? PokedexConstants8a.MaxPokedexResearchPoints : value,
                task.TaskThresholds.Select(t => (int)t).ToArray(), reported - 1, points, task.RequiredForCompletion, editable);
        }).ToList();
        return new(level, pending, dex.IsComplete(species), dex.IsPerfect(species), tasks);
    }

    public static void SetSeen(SAV8LA save, ushort species, bool seen)
    {
        if (seen) save.PokedexSave.SetPokeHasBeenUpdated(species);
    }

    public static void SetCaught(SAV8LA save, ushort species, bool caught)
    {
        var dex = save.PokedexSave;
        var forms = Enumerable.Range(0, save.Personal[species].FormCount).Select(f => (byte)f).Where(f => dex.HasFormStorage(species, f));
        if (!caught)
        {
            foreach (var form in forms)
                dex.SetPokeObtainFlags(species, form, 0);
            return;
        }
        if (save.GetCaught(species))
            return;
        // Obtain flags pack gender, alpha and shiny; the low bit is the plain male or genderless entry.
        dex.SetPokeObtainFlags(species, forms.First(), (byte)(save.Personal[species].OnlyFemale ? 2 : 1));
        dex.SetPokeHasBeenUpdated(species);
    }
}

public static partial class PkhexEngineExports
{
    private static SlotMutationResult ApplyResearchEdit(SAV8LA save, PokedexEdit edit)
    {
        if (edit.Species is not int id || !LegendsArceusPokedex.InDex(id) || edit.Seen is not null || edit.Caught is not null || edit.Field is not null || edit.Flag is not null || edit.On is not null)
            return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a Legends: Arceus Pokedex species.");
        var species = (ushort)id;
        var dex = save.PokedexSave;
        if (edit.Kind == "report")
        {
            if (edit.Task is not null || edit.Value is not null)
                return SlotMutationResult.Fail("invalid-save-file-edit", "Report research takes only a species.");
            if (dex.GetUnreportedTaskCount(species) == 0)
                return SlotMutationResult.Success(false);
            dex.UpdateSpecificReportPoke(species);
            return SlotMutationResult.Success(true);
        }
        var tasks = LegendsArceusPokedex.Tasks(species);
        if (edit.Task is not int index || index < 0 || index >= tasks.Length || edit.Value is not long value)
            return SlotMutationResult.Fail("invalid-save-file-edit", "Choose a research task and a value.");
        var task = tasks[index];
        if (!task.Task.CanSetCurrentValue())
            return SlotMutationResult.Fail("invalid-save-file-edit", "The game sets this research task. It cannot be edited.");
        if (value < 0 || value > PokedexConstants8a.MaxPokedexResearchPoints)
            return SlotMutationResult.Fail("invalid-save-file-edit", $"Enter a value from 0 to {PokedexConstants8a.MaxPokedexResearchPoints}.");
        dex.GetResearchTaskLevel(species, index, out _, out var current, out _);
        if (current == value)
            return SlotMutationResult.Success(false);
        dex.SetResearchTaskProgressByForce(species, task, (int)value);
        return SlotMutationResult.Success(true);
    }
}
