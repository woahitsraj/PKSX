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
            save.PartyCount,
            save.BoxCount,
            save.BoxSlotCount);
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
    bool IsEmpty)
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
            pokemon.Species == 0);
}
