using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public sealed record EngineResult<T>(bool Ok, T? Value, EngineError? Error)
{
    public static EngineResult<T> Success(T value) => new(true, value, null);

    public static EngineResult<T> Failure(string code, string message) =>
        new(false, default, new EngineError(code, message));
}

public static class EngineResult
{
    public static EngineResult<T> Ok<T>(T value) => EngineResult<T>.Success(value);

    public static EngineResult<object> Fail(string code, string message) =>
        EngineResult<object>.Failure(code, message);
}

public sealed record EngineError(string Code, string Message);

public sealed record EngineVersion(string PkhexCoreVersion, string FacadeVersion);

public sealed record SaveSummary(
    string? FileName,
    string SaveType,
    string GameVersion,
    int GameVersionId,
    int Generation,
    string? TrainerName,
    uint TrainerId,
    string PlayTime,
    int PlayedHours,
    int PlayedMinutes,
    int PartyCount,
    int BoxCount,
    int BoxSlotCount)
{
    public static SaveSummary From(SaveFile save, string? fileName) =>
        new(
            fileName,
            save.GetType().Name,
            save.Version.ToString(),
            (int)save.Version,
            save.Generation,
            save.OT,
            save.DisplayTID,
            save.PlayTimeString,
            save.PlayedHours,
            save.PlayedMinutes,
            save.PartyCount,
            save.BoxCount,
            save.BoxSlotCount);
}

public sealed record PartySlotSummary(
    int Slot,
    ushort SpeciesId,
    byte Form,
    byte Format,
    int Level,
    string Nickname,
    bool IsEgg,
    bool IsEmpty,
    string? Gender,
    string? Nature,
    string? Ability,
    string? HeldItem,
    List<SlotTypeSummary> Types,
    List<SlotStatSummary> Stats,
    List<SlotMoveSummary> Moves,
    string? OriginalTrainer,
    string? MetLabel)
{
    public static PartySlotSummary From(PKM pokemon, int slot) =>
        new(
            slot,
            pokemon.Species,
            pokemon.Form,
            pokemon.Format,
            pokemon.Species == 0 ? 0 : pokemon.CurrentLevel,
            pokemon.Nickname,
            pokemon.IsEgg,
            pokemon.Species == 0,
            SlotDetailProjection.Gender(pokemon),
            SlotDetailProjection.Nature(pokemon),
            SlotDetailProjection.Ability(pokemon),
            SlotDetailProjection.HeldItem(pokemon),
            SlotDetailProjection.Types(pokemon),
            SlotDetailProjection.Stats(pokemon),
            SlotDetailProjection.Moves(pokemon),
            SlotDetailProjection.OriginalTrainer(pokemon),
            SlotDetailProjection.MetLabel(pokemon));
}

public sealed record BoxSlotSummary(
    int Box,
    int Slot,
    ushort SpeciesId,
    byte Form,
    byte Format,
    int Level,
    string Nickname,
    bool IsEgg,
    bool IsEmpty,
    string? Gender,
    string? Nature,
    string? Ability,
    string? HeldItem,
    List<SlotTypeSummary> Types,
    List<SlotStatSummary> Stats,
    List<SlotMoveSummary> Moves,
    string? OriginalTrainer,
    string? MetLabel)
{
    public static BoxSlotSummary From(PKM pokemon, int box, int slot) =>
        new(
            box,
            slot,
            pokemon.Species,
            pokemon.Form,
            pokemon.Format,
            pokemon.Species == 0 ? 0 : pokemon.CurrentLevel,
            pokemon.Nickname,
            pokemon.IsEgg,
            pokemon.Species == 0,
            SlotDetailProjection.Gender(pokemon),
            SlotDetailProjection.Nature(pokemon),
            SlotDetailProjection.Ability(pokemon),
            SlotDetailProjection.HeldItem(pokemon),
            SlotDetailProjection.Types(pokemon),
            SlotDetailProjection.Stats(pokemon),
            SlotDetailProjection.Moves(pokemon),
            SlotDetailProjection.OriginalTrainer(pokemon),
            SlotDetailProjection.MetLabel(pokemon));
}

public sealed record SlotTypeSummary(string Name, int Hue, double Chroma);

public sealed record SlotStatSummary(string Key, string Label, int Value, int? Ev, int Max);

public sealed record SlotMoveSummary(string Name, string Type, int Hue, double Chroma, int? Pp);

public sealed record SaveWorkspace(
    SaveSummary Summary,
    List<PartySlotSummary> PartySlots,
    List<BoxSlotSummary> BoxSlots);

public sealed record SerializedSave(string BytesBase64, int ByteLength);

internal static class SlotDetailProjection
{
    private static readonly string[] StatKeys = ["HP", "ATK", "DEF", "SPA", "SPD", "SPE"];

    private static readonly string[] StatLabels = ["HP", "ATK", "DEF", "SPA", "SPD", "SPE"];

    private static readonly int[] TypeHues =
    [
        107, 28, 294, 328, 88, 98, 117, 303, 286,
        53, 264, 136, 94, 6, 192, 287, 56, 349
    ];

    private static readonly double[] TypeChromas =
    [
        0.06, 0.18, 0.14, 0.17, 0.11, 0.12, 0.16, 0.10, 0.04,
        0.16, 0.15, 0.17, 0.16, 0.20, 0.07, 0.21, 0.05, 0.11
    ];

    public static string? Gender(PKM pokemon) =>
        pokemon.Species == 0 ? null : pokemon.Gender switch
        {
            0 => "♂",
            1 => "♀",
            _ => null,
        };

    public static string? Nature(PKM pokemon) =>
        pokemon.Species == 0 ? null : NameAt(GameInfo.Strings.Natures, (int)pokemon.Nature);

    public static string? Ability(PKM pokemon) =>
        pokemon.Species == 0 ? null : NameAt(GameInfo.Strings.Ability, pokemon.Ability);

    public static string? HeldItem(PKM pokemon) =>
        pokemon.Species == 0 || pokemon.HeldItem <= 0 ? null : NameAt(GameInfo.Strings.Item, pokemon.HeldItem);

    public static List<SlotTypeSummary> Types(PKM pokemon)
    {
        if (pokemon.Species == 0)
            return [];

        var info = pokemon.PersonalInfo;
        var first = TypeName(info.Type1);
        var second = info.Type2 == info.Type1 ? null : TypeName(info.Type2);

        var result = new List<SlotTypeSummary>(2);
        if (first is not null)
            result.Add(new SlotTypeSummary(first, TypeHue(info.Type1), TypeChroma(info.Type1)));
        if (second is not null)
            result.Add(new SlotTypeSummary(second, TypeHue(info.Type2), TypeChroma(info.Type2)));
        return result;
    }

    public static List<SlotStatSummary> Stats(PKM pokemon)
    {
        if (pokemon.Species == 0)
            return [];

        var values = pokemon.GetStats(pokemon.PersonalInfo);
        var evs = new[] { pokemon.EV_HP, pokemon.EV_ATK, pokemon.EV_DEF, pokemon.EV_SPA, pokemon.EV_SPD, pokemon.EV_SPE };
        var result = new List<SlotStatSummary>(StatKeys.Length);

        for (var index = 0; index < StatKeys.Length && index < values.Length; index++)
        {
            result.Add(new SlotStatSummary(
                StatKeys[index],
                StatLabels[index],
                values[index],
                evs[index] > 0 ? evs[index] : null,
                255));
        }

        return result;
    }

    public static List<SlotMoveSummary> Moves(PKM pokemon)
    {
        if (pokemon.Species == 0)
            return [];

        ushort[] moves = [pokemon.Move1, pokemon.Move2, pokemon.Move3, pokemon.Move4];
        int[] pp = [pokemon.Move1_PP, pokemon.Move2_PP, pokemon.Move3_PP, pokemon.Move4_PP];
        var result = new List<SlotMoveSummary>(moves.Length);

        for (var index = 0; index < moves.Length; index++)
        {
            var move = moves[index];
            if (move == 0)
                continue;

            var name = NameAt(GameInfo.Strings.Move, move);
            if (name is null)
                continue;

            var typeId = MoveInfo.GetType(move, pokemon.Context);
            var type = TypeName(typeId) ?? "Move";
            var hue = TypeHue(typeId);
            result.Add(new SlotMoveSummary(name, type, hue, TypeChroma(typeId), pp[index] > 0 ? pp[index] : null));
        }

        return result;
    }

    public static string? OriginalTrainer(PKM pokemon) =>
        pokemon.Species == 0 || string.IsNullOrWhiteSpace(pokemon.OriginalTrainerName) ? null : pokemon.OriginalTrainerName;

    public static string? MetLabel(PKM pokemon) =>
        pokemon.Species == 0 || pokemon.MetLevel <= 0 ? null : $"Lv. {pokemon.MetLevel}";

    private static string? TypeName(int type) => NameAt(GameInfo.Strings.Types, type);

    private static int TypeHue(int type) =>
        type >= 0 && type < TypeHues.Length ? TypeHues[type] : 48;

    private static double TypeChroma(int type) =>
        type >= 0 && type < TypeChromas.Length ? TypeChromas[type] : 0.09;

    private static string? NameAt(IReadOnlyList<string> names, int index) =>
        index >= 0 && index < names.Count && !string.IsNullOrWhiteSpace(names[index]) ? names[index] : null;
}
