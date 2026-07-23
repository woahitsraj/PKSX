using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

[SupportedOSPlatform("browser")]
public static partial class PkhexEngineExports
{
    [JSExport]
    public static string GetVersionJson()
    {
        var pkhexCore = typeof(SaveFile).Assembly.GetName().Version?.ToString() ?? "unknown";
        var facade = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";

        return EngineJson.Serialize(
            EngineResult.Ok(new EngineVersion(pkhexCore, facade)),
            EngineJsonContext.Default.EngineResultEngineVersion);
    }

    [JSExport]
    public static string ParseSaveSmoke(byte[] bytes, string? fileName)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(SaveSummary.From(save, fileName)),
                EngineJsonContext.Default.EngineResultSaveSummary);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ListBoxSmoke(byte[] bytes, string? fileName, int box)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            if ((uint)box >= save.BoxCount)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-box", $"Box {box} is outside the save's box range."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var slots = new List<BoxSlotSummary>(save.BoxSlotCount);
            for (var slot = 0; slot < save.BoxSlotCount; slot++)
                slots.Add(BoxSlotSummary.From(save.GetBoxSlotAtIndex(box, slot), box, slot));

            return EngineJson.Serialize(EngineResult.Ok(slots), EngineJsonContext.Default.EngineResultListBoxSlotSummary);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string LoadSaveWorkspaceJson(byte[] bytes, string? fileName, int box)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            if ((uint)box >= save.BoxCount)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-box", $"Box {box} is outside the save's box range."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(CreateWorkspace(save, fileName, box)),
                EngineJsonContext.Default.EngineResultSaveWorkspace);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string SerializeSaveJson(byte[] bytes, string? fileName)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var serialized = save.Write(BinaryExportSetting.None).ToArray();

            return EngineJson.Serialize(
                EngineResult.Ok(new SerializedSave(Convert.ToBase64String(serialized), serialized.Length)),
                EngineJsonContext.Default.EngineResultSerializedSave);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ApplySlotOperationJson(byte[] bytes, string? fileName, string operationJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var operation = System.Text.Json.JsonSerializer.Deserialize(
                operationJson,
                EngineJsonContext.Default.SlotOperationRequest);

            if (operation is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-slot-operation", "Slot operation payload is missing."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var mutation = ApplySlotOperation(save, operation);
            if (!mutation.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(mutation.Code, mutation.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var serialized = save.Write(BinaryExportSetting.None).ToArray();
            var activeBox = ClampActiveBox(operation.ActiveBox, save);
            var workspace = CreateWorkspace(save, fileName, activeBox);

            return EngineJson.Serialize(
                EngineResult.Ok(new SlotOperationResult(
                    Convert.ToBase64String(serialized),
                    serialized.Length,
                    mutation.Mutated,
                    workspace)),
                EngineJsonContext.Default.EngineResultSlotOperationResult);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ApplyPokemonEditOperationJson(byte[] bytes, string? fileName, string operationJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var operation = System.Text.Json.JsonSerializer.Deserialize(
                operationJson,
                EngineJsonContext.Default.PokemonEditOperationRequest);

            if (operation is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-pokemon-edit", "Pokemon edit payload is missing."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var mutation = ApplyPokemonEditOperation(save, operation);
            if (!mutation.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(mutation.Code, mutation.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var serialized = save.Write(BinaryExportSetting.None).ToArray();
            var activeBox = ClampActiveBox(operation.ActiveBox, save);
            var workspace = CreateWorkspace(save, fileName, activeBox);

            return EngineJson.Serialize(
                EngineResult.Ok(new PokemonEditOperationResult(
                    Convert.ToBase64String(serialized),
                    serialized.Length,
                    mutation.Mutated,
                    workspace)),
                EngineJsonContext.Default.EngineResultPokemonEditOperationResult);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string CheckSlotLegalityJson(byte[] bytes, string? fileName, string sourceJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var source = System.Text.Json.JsonSerializer.Deserialize(
                sourceJson,
                EngineJsonContext.Default.SaveSlotRef);

            if (source is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-slot", "Legality Check needs a source Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var sourceResult = SlotRef.From(save, source);
            if (!sourceResult.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(sourceResult.Code, sourceResult.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var pokemon = sourceResult.Value.Get(save);
            if (pokemon.Species == 0)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("empty-source-slot", "Legality Check needs an occupied Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(CreateLegalityReport(pokemon, sourceResult.Value.StorageSlotType)),
                EngineJsonContext.Default.EngineResultLegalityReport);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string PreviewPokemonActionsJson(byte[] bytes, string? fileName, string sourceJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);
            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var source = System.Text.Json.JsonSerializer.Deserialize(
                sourceJson,
                EngineJsonContext.Default.SaveSlotRef);
            var sourceResult = SlotRef.From(save, source);
            if (!sourceResult.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(sourceResult.Code, sourceResult.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var pokemon = sourceResult.Value.Get(save);
            if (pokemon.Species == 0)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("empty-source-slot", "Pokemon Actions need an occupied Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(CreatePokemonActionPreview(pokemon, sourceResult.Value.StorageSlotType)),
                EngineJsonContext.Default.EngineResultPokemonActionPreview);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ApplyPokemonActionJson(byte[] bytes, string? fileName, string actionJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);
            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var request = System.Text.Json.JsonSerializer.Deserialize(
                actionJson,
                EngineJsonContext.Default.PokemonActionRequest);
            if (request?.Source is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-pokemon-action", "Pokemon Action needs a source Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var sourceResult = SlotRef.From(save, request.Source);
            if (!sourceResult.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(sourceResult.Code, sourceResult.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var pokemon = sourceResult.Value.Get(save);
            if (pokemon.Species == 0)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("empty-source-slot", "Pokemon Actions need an occupied Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var mutation = ApplyPokemonAction(
                pokemon.Clone(),
                sourceResult.Value.StorageSlotType,
                request.Kind,
                request.ChoiceId);
            if (!mutation.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(mutation.Code, mutation.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            sourceResult.Value.Set(save, mutation.Pokemon);
            var serialized = save.Write(BinaryExportSetting.None).ToArray();
            var activeBox = ClampActiveBox(request.ActiveBox, save);

            return EngineJson.Serialize(
                EngineResult.Ok(new PokemonActionResult(
                    Convert.ToBase64String(serialized),
                    serialized.Length,
                    true,
                    CreateWorkspace(save, fileName, activeBox),
                    mutation.Changes)),
                EngineJsonContext.Default.EngineResultPokemonActionResult);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string PreviewStoredPokemonActionsJson(string entityBytesBase64)
    {
        try
        {
            var pokemon = ParseStoredPokemon(entityBytesBase64);
            if (pokemon is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-stored-pokemon", "Pokemon Storage entry is missing entity data."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(CreatePokemonActionPreview(pokemon, StorageSlotType.Box)),
                EngineJsonContext.Default.EngineResultPokemonActionPreview);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("invalid-stored-pokemon", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ApplyStoredPokemonActionJson(string entityBytesBase64, string actionJson)
    {
        try
        {
            var pokemon = ParseStoredPokemon(entityBytesBase64);
            if (pokemon is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-stored-pokemon", "Pokemon Storage entry is missing entity data."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var request = System.Text.Json.JsonSerializer.Deserialize(
                actionJson,
                EngineJsonContext.Default.StoredPokemonActionRequest);
            if (request is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-pokemon-action", "Pokemon Action payload is missing."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var mutation = ApplyPokemonAction(
                pokemon.Clone(),
                StorageSlotType.Box,
                request.Kind,
                request.ChoiceId);
            if (!mutation.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(mutation.Code, mutation.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var entityBytes = mutation.Pokemon.Data.ToArray();
            return EngineJson.Serialize(
                EngineResult.Ok(new StoredPokemonActionResult(
                    Convert.ToBase64String(entityBytes),
                    true,
                    BoxSlotSummary.From(mutation.Pokemon, 0, 0),
                    mutation.Changes)),
                EngineJsonContext.Default.EngineResultStoredPokemonActionResult);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    [JSExport]
    public static string ImportStoredPokemonJson(byte[] bytes, string? fileName, string importJson)
    {
        try
        {
            var save = SaveUtil.GetSaveFile(bytes, fileName);

            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", "PKHeX.Core could not recognize this save file."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var request = System.Text.Json.JsonSerializer.Deserialize(
                importJson,
                EngineJsonContext.Default.StoredPokemonImportRequest);

            if (request is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("invalid-pokemon-import", "Pokemon import payload is missing."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var mutation = ImportStoredPokemon(save, request);
            if (!mutation.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(mutation.Code, mutation.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var serialized = save.Write(BinaryExportSetting.None).ToArray();
            var activeBox = ClampActiveBox(request.ActiveBox, save);
            var workspace = CreateWorkspace(save, fileName, activeBox);

            return EngineJson.Serialize(
                EngineResult.Ok(new StoredPokemonImportResult(
                    Convert.ToBase64String(serialized),
                    serialized.Length,
                    mutation.Mutated,
                    workspace)),
                EngineJsonContext.Default.EngineResultStoredPokemonImportResult);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    private static SaveWorkspace CreateWorkspace(SaveFile save, string? fileName, int box)
    {
        var partySlots = new List<PartySlotSummary>(save.PartyCount);
        for (var slot = 0; slot < save.PartyCount; slot++)
            partySlots.Add(PartySlotSummary.From(save.GetPartySlotAtIndex(slot), slot));

        var boxSlots = new List<BoxSlotSummary>(save.BoxSlotCount);
        for (var slot = 0; slot < save.BoxSlotCount; slot++)
            boxSlots.Add(BoxSlotSummary.From(save.GetBoxSlotAtIndex(box, slot), box, slot));

        return new SaveWorkspace(SaveSummary.From(save, fileName), partySlots, boxSlots);
    }

    private static SlotMutationResult ApplySlotOperation(SaveFile save, SlotOperationRequest operation)
    {
        var sourceResult = SlotRef.From(save, operation.Source);
        if (!sourceResult.Ok)
            return SlotMutationResult.Fail(sourceResult.Code, sourceResult.Message);

        var source = sourceResult.Value;
        var sourcePokemon = source.Get(save);
        if (sourcePokemon.Species == 0)
            return SlotMutationResult.Fail("empty-source-slot", "Move, Copy, and Clear Slot need an occupied source Slot.");

        return operation.Kind switch
        {
            "move" => ApplyMove(save, source, operation.Destination),
            "copy" => ApplyCopy(save, source, operation.Destination),
            "clear" => ApplyClear(save, source),
            _ => SlotMutationResult.Fail("unsupported-slot-operation", $"Slot operation '{operation.Kind}' is not supported."),
        };
    }

    private static SlotMutationResult ApplyPokemonEditOperation(SaveFile save, PokemonEditOperationRequest operation)
    {
        var sourceResult = SlotRef.From(save, operation.Source);
        if (!sourceResult.Ok)
            return SlotMutationResult.Fail(sourceResult.Code, sourceResult.Message);

        var source = sourceResult.Value;
        var pokemon = source.Get(save).Clone();
        if (pokemon.Species == 0)
            return SlotMutationResult.Fail("empty-source-slot", "Pokemon editing needs an occupied source Slot.");

        if (
            operation.Nickname is null &&
            operation.Level is null &&
            operation.Experience is null &&
            operation.Ivs is null &&
            operation.Evs is null &&
            operation.Moves is null)
            return SlotMutationResult.Fail("invalid-pokemon-edit", "Choose a Pokemon edit to apply.");

        if (operation.Level is not null && operation.Experience is not null)
            return SlotMutationResult.Fail("invalid-pokemon-edit", "Apply either level or experience, not both.");

        var originalNickname = pokemon.Nickname;
        var originalIsNicknamed = pokemon.IsNicknamed;
        var originalLevel = pokemon.CurrentLevel;
        var originalExperience = pokemon.EXP;
        int[] originalIvs = [pokemon.IV_HP, pokemon.IV_ATK, pokemon.IV_DEF, pokemon.IV_SPA, pokemon.IV_SPD, pokemon.IV_SPE];
        int[] originalEvs = [pokemon.EV_HP, pokemon.EV_ATK, pokemon.EV_DEF, pokemon.EV_SPA, pokemon.EV_SPD, pokemon.EV_SPE];
        ushort[] originalMoves = [pokemon.Move1, pokemon.Move2, pokemon.Move3, pokemon.Move4];
        int[] originalPp = [pokemon.Move1_PP, pokemon.Move2_PP, pokemon.Move3_PP, pokemon.Move4_PP];
        int[] originalPpUps = [pokemon.Move1_PPUps, pokemon.Move2_PPUps, pokemon.Move3_PPUps, pokemon.Move4_PPUps];

        if (operation.Nickname is string nickname)
        {
            if (nickname.Length == 0)
            {
                CommonEdits.SetDefaultNickname(pokemon);
            }
            else
            {
                if (nickname.Length > pokemon.MaxStringLengthNickname)
                    return SlotMutationResult.Fail(
                        "invalid-pokemon-edit",
                        $"Nickname is too long for this Pokemon format. Maximum length is {pokemon.MaxStringLengthNickname} characters.");

                try
                {
                    CommonEdits.SetNickname(pokemon, nickname);
                }
                catch (Exception ex)
                {
                    return SlotMutationResult.Fail("invalid-pokemon-edit", ex.Message);
                }

                if (!StringComparer.Ordinal.Equals(pokemon.Nickname, nickname))
                    return SlotMutationResult.Fail(
                        "invalid-pokemon-edit",
                        "Nickname contains characters that are not valid for this Pokemon format or language.");
            }
        }

        if (operation.Level is int level)
        {
            if (!Experience.IsValidLevel((byte)level) || level < Experience.MinLevel || level > Experience.MaxLevel)
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"Level must be between {Experience.MinLevel} and {Experience.MaxLevel}.");

            pokemon.CurrentLevel = (byte)level;
        }
        else if (operation.Experience is uint experience)
        {
            var growth = pokemon.PersonalInfo.EXPGrowth;
            var min = Experience.GetEXP((byte)Experience.MinLevel, growth);
            var max = Experience.GetEXP((byte)Experience.MaxLevel, growth);

            if (experience < min || experience > max)
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"Experience must be between {min} and {max}.");

            pokemon.EXP = experience;
        }

        if (operation.Ivs is not null)
        {
            var ivs = StatEditSetToArray(operation.Ivs);
            foreach (var iv in ivs)
            {
                if (iv < 0 || iv > pokemon.MaxIV)
                    return SlotMutationResult.Fail("invalid-pokemon-edit", $"IV values must be between 0 and {pokemon.MaxIV} for this Pokemon format.");
            }

            pokemon.SetIVs(ivs);
        }

        if (operation.Evs is not null)
        {
            var evs = StatEditSetToArray(operation.Evs);
            foreach (var ev in evs)
            {
                if (ev < 0 || ev > pokemon.MaxEV)
                    return SlotMutationResult.Fail("invalid-pokemon-edit", $"EV values must be between 0 and {pokemon.MaxEV} for this Pokemon format.");
            }

            var maxTotalEv = pokemon.MaxEV > EffortValues.Max255
                ? pokemon.MaxEV * evs.Length
                : EffortValues.Max510;
            var totalEv = evs.Sum();
            if (totalEv > maxTotalEv)
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"Total EV values must be {maxTotalEv} or less for this Pokemon format.");

            pokemon.SetEVs(evs);
        }

        if (operation.Moves is not null)
        {
            var moveResult = ApplyMoveSetEdits(pokemon, operation.Moves, source.StorageSlotType);
            if (!moveResult.Ok)
                return moveResult;
        }

        if (pokemon.PartyStatsPresent)
            pokemon.ResetPartyStats();

        var mutated =
            !StringComparer.Ordinal.Equals(originalNickname, pokemon.Nickname) ||
            originalIsNicknamed != pokemon.IsNicknamed ||
            originalLevel != pokemon.CurrentLevel ||
            originalExperience != pokemon.EXP ||
            !originalIvs.SequenceEqual([pokemon.IV_HP, pokemon.IV_ATK, pokemon.IV_DEF, pokemon.IV_SPA, pokemon.IV_SPD, pokemon.IV_SPE]) ||
            !originalEvs.SequenceEqual([pokemon.EV_HP, pokemon.EV_ATK, pokemon.EV_DEF, pokemon.EV_SPA, pokemon.EV_SPD, pokemon.EV_SPE]) ||
            !originalMoves.SequenceEqual([pokemon.Move1, pokemon.Move2, pokemon.Move3, pokemon.Move4]) ||
            !originalPp.SequenceEqual([pokemon.Move1_PP, pokemon.Move2_PP, pokemon.Move3_PP, pokemon.Move4_PP]) ||
            !originalPpUps.SequenceEqual([pokemon.Move1_PPUps, pokemon.Move2_PPUps, pokemon.Move3_PPUps, pokemon.Move4_PPUps]);
        if (mutated)
            source.Set(save, pokemon);

        return SlotMutationResult.Success(mutated);
    }

    private static int[] StatEditSetToArray(PokemonStatEditSet edits) =>
        [edits.HP, edits.ATK, edits.DEF, edits.SPE, edits.SPA, edits.SPD];

    private static SlotMutationResult ApplyMoveSetEdits(PKM pokemon, List<PokemonMoveSlotEdit> edits, StorageSlotType storageSlotType)
    {
        var moves = new[] { pokemon.Move1, pokemon.Move2, pokemon.Move3, pokemon.Move4 };
        var pp = new[] { pokemon.Move1_PP, pokemon.Move2_PP, pokemon.Move3_PP, pokemon.Move4_PP };
        var ppUps = new[] { pokemon.Move1_PPUps, pokemon.Move2_PPUps, pokemon.Move3_PPUps, pokemon.Move4_PPUps };
        var changedEdits = new List<PokemonMoveSlotEdit>();
        var legalMoves = new LegalMoveInfo();
        legalMoves.ReloadMoves(new LegalityAnalysis(pokemon, storageSlotType));

        foreach (var edit in edits)
        {
            if (edit.Slot < 0 || edit.Slot >= moves.Length)
                return SlotMutationResult.Fail("invalid-pokemon-edit", "Move Set slot must be between 1 and 4.");

            if (edit.Move > pokemon.MaxMoveID || (edit.Move != 0 && MoveInfo.IsDummiedMove(pokemon, edit.Move)))
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"Move {edit.Move} is not supported by this Pokemon format.");

            if (edit.Move != 0 && !legalMoves.CanLearn(edit.Move))
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"{MoveName(edit.Move)} is not available for this Pokemon.");

            var nextPpUps = edit.PpUps ?? ppUps[edit.Slot];
            if (nextPpUps < 0 || nextPpUps > 3)
                return SlotMutationResult.Fail("invalid-pokemon-edit", "PP Ups must be between 0 and 3.");

            var maxPp = edit.Move == 0 ? 0 : pokemon.GetMovePP(edit.Move, nextPpUps);
            var nextPp = edit.Pp ?? maxPp;
            if (nextPp < 0 || nextPp > maxPp)
                return SlotMutationResult.Fail("invalid-pokemon-edit", $"PP for {MoveName(edit.Move)} must be between 0 and {maxPp}.");

            if (moves[edit.Slot] != edit.Move || ppUps[edit.Slot] != nextPpUps || pp[edit.Slot] != nextPp)
                changedEdits.Add(edit);

            moves[edit.Slot] = edit.Move;
            ppUps[edit.Slot] = edit.Move == 0 ? 0 : nextPpUps;
            pp[edit.Slot] = edit.Move == 0 ? 0 : nextPp;
        }

        pokemon.SetMoves(moves);
        pokemon.Move1_PPUps = ppUps[0];
        pokemon.Move2_PPUps = ppUps[1];
        pokemon.Move3_PPUps = ppUps[2];
        pokemon.Move4_PPUps = ppUps[3];
        pokemon.Move1_PP = pp[0];
        pokemon.Move2_PP = pp[1];
        pokemon.Move3_PP = pp[2];
        pokemon.Move4_PP = pp[3];

        var analysis = new LegalityAnalysis(pokemon, storageSlotType);
        if (!analysis.Valid)
            return SlotMutationResult.Fail(
                "invalid-pokemon-edit",
                CreateIllegalMoveSetMessage(analysis, changedEdits.Count == 0 ? edits : changedEdits));

        return SlotMutationResult.Success(true);
    }

    private static string CreateIllegalMoveSetMessage(LegalityAnalysis analysis, List<PokemonMoveSlotEdit> edits)
    {
        var details = CreateLegalityMessages(analysis, includeGeneric: true)
            .Where(message => !StringComparer.Ordinal.Equals(message.Severity, Severity.Valid.ToString()))
            .Select(message => message.Message)
            .Distinct(StringComparer.Ordinal)
            .Take(3)
            .ToList();
        if (details.Count == 0)
        {
            var editedMoves = string.Join(", ", edits.Select(edit => $"Move {edit.Slot + 1} {MoveName(edit.Move)}"));
            return "Move Set edit makes this Pokemon illegal for its current format. PKHeX did not return a more specific legality reason."
                + (string.IsNullOrWhiteSpace(editedMoves) ? "" : $" Edited moves: {editedMoves}.");
        }

        return $"Move Set edit makes this Pokemon illegal for its current format. {string.Join(" ", details)}";
    }

    private static string MoveName(ushort move) =>
        move == 0 ? "Empty" : (move >= 0 && move < GameInfo.Strings.Move.Count ? GameInfo.Strings.Move[move] : $"Move {move}");

    private static SlotMutationResult ImportStoredPokemon(SaveFile save, StoredPokemonImportRequest request)
    {
        var destinationResult = SlotRef.From(save, request.Destination);
        if (!destinationResult.Ok)
            return SlotMutationResult.Fail(destinationResult.Code, destinationResult.Message);

        var destination = destinationResult.Value;
        if (destination.Get(save).Species != 0)
            return SlotMutationResult.Fail("occupied-destination-slot", "Moving from Pokemon Storage needs an empty destination Slot.");

        PKM? pokemon;
        try
        {
            pokemon = EntityFormat.GetFromBytes(Convert.FromBase64String(request.EntityBytesBase64), save.Context);
        }
        catch (Exception ex)
        {
            return SlotMutationResult.Fail("invalid-stored-pokemon", ex.Message);
        }

        if (pokemon is null || pokemon.Species == 0)
            return SlotMutationResult.Fail("invalid-stored-pokemon", "Pokemon Storage entry is missing entity data.");

        var target = save.BlankPKM;
        if (pokemon.Format != target.Format)
        {
            if (!EntityConverter.TryMakePKMCompatible(pokemon, target, out var result, out var converted))
                return SlotMutationResult.Fail("incompatible-stored-pokemon", result.GetDisplayString(pokemon, target.GetType()));

            pokemon = converted;
        }

        destination.Set(save, pokemon);
        return SlotMutationResult.Success(true);
    }

    private static SlotMutationResult ApplyMove(SaveFile save, SlotRef source, SaveSlotRef? destinationRef)
    {
        var destinationResult = SlotRef.From(save, destinationRef);
        if (!destinationResult.Ok)
            return SlotMutationResult.Fail(destinationResult.Code, destinationResult.Message);

        var destination = destinationResult.Value;
        if (source.Equals(destination))
            return SlotMutationResult.Success(false);

        var sourcePokemon = source.Get(save).Clone();
        var destinationPokemon = destination.Get(save).Clone();
        var destinationOccupied = destinationPokemon.Species != 0;

        if (source.Zone == SlotZone.Party && !destinationOccupied)
            source.Clear(save);
        else
            source.Set(save, destinationOccupied ? destinationPokemon : save.BlankPKM);

        destination.Set(save, sourcePokemon);
        return SlotMutationResult.Success(true);
    }

    private static SlotMutationResult ApplyCopy(SaveFile save, SlotRef source, SaveSlotRef? destinationRef)
    {
        var destinationResult = SlotRef.From(save, destinationRef);
        if (!destinationResult.Ok)
            return SlotMutationResult.Fail(destinationResult.Code, destinationResult.Message);

        var destination = destinationResult.Value;
        if (source.Equals(destination))
            return SlotMutationResult.Success(false);

        var destinationPokemon = destination.Get(save);
        if (destinationPokemon.Species != 0)
            return SlotMutationResult.Fail("occupied-destination-slot", "Copy needs an empty destination Slot.");

        destination.Set(save, source.Get(save).Clone());
        return SlotMutationResult.Success(true);
    }

    private static SlotMutationResult ApplyClear(SaveFile save, SlotRef source)
    {
        source.Clear(save);
        return SlotMutationResult.Success(true);
    }

    private static LegalityReport CreateLegalityReport(PKM pokemon, StorageSlotType storageSlotType)
    {
        var analysis = new LegalityAnalysis(pokemon, storageSlotType);
        var messages = CreateLegalityMessages(analysis, includeGeneric: false);

        var warnings = messages
            .Where(message => !StringComparer.Ordinal.Equals(message.Severity, Severity.Valid.ToString()))
            .ToList();
        var legal = analysis.Valid;
        var judgement = legal ? "Legal" : "Illegal";
        var summary = legal
            ? "PKHeX judged this Pokemon legal."
            : "PKHeX found legality issues for this Pokemon.";

        return new LegalityReport(
            legal,
            judgement,
            summary,
            GetFixableProblems(analysis),
            warnings,
            messages);
    }

    private static PokemonActionPreview CreatePokemonActionPreview(
        PKM pokemon,
        StorageSlotType storageSlotType)
    {
        var legalityFix = PreviewLegalityFix(pokemon, storageSlotType);
        var evolutionChoices = CreateEvolutionChoices(pokemon);
        var evolve = evolutionChoices.Count > 0
            ? new PokemonActionAvailability("evolve", true, null, [], evolutionChoices)
            : new PokemonActionAvailability(
                "evolve",
                false,
                pokemon.IsEgg
                    ? "Eggs cannot evolve."
                    : "No direct evolution is available for this Pokemon.",
                [],
                []);

        return new PokemonActionPreview(
            CreateLegalityReport(pokemon, storageSlotType),
            [legalityFix, evolve]);
    }

    private static PokemonActionAvailability PreviewLegalityFix(
        PKM pokemon,
        StorageSlotType storageSlotType)
    {
        var clone = pokemon.Clone();
        var result = ApplyTargetedLegalityFix(clone, storageSlotType);
        return result.Changes.Count > 0
            ? new PokemonActionAvailability("legality-fix", true, null, result.Changes, [])
            : new PokemonActionAvailability(
                "legality-fix",
                false,
                "The Legality Report has no supported fixable problems.",
                [],
                []);
    }

    private static PokemonActionMutation ApplyPokemonAction(
        PKM pokemon,
        StorageSlotType storageSlotType,
        string kind,
        string? choiceId)
    {
        switch (kind)
        {
            case "legality-fix":
                {
                    var fix = ApplyTargetedLegalityFix(pokemon, storageSlotType);
                    return fix.Changes.Count == 0
                        ? PokemonActionMutation.Fail(
                            "unsupported-pokemon-action",
                            "The Legality Report has no supported fixable problems.")
                        : PokemonActionMutation.Success(pokemon, fix.Changes);
                }
            case "evolve":
                {
                    if (string.IsNullOrWhiteSpace(choiceId))
                        return PokemonActionMutation.Fail(
                            "invalid-pokemon-action",
                            "Choose an evolution before applying.");

                    var method = DirectEvolutionMethods(pokemon)
                        .FirstOrDefault(candidate => EvolutionChoiceId(candidate, pokemon.Form) == choiceId);
                    if (method.Species == 0)
                        return PokemonActionMutation.Fail(
                            "invalid-pokemon-action",
                            "The selected evolution is no longer available.");

                    var before = pokemon.Clone();
                    ApplyEvolution(pokemon, method);
                    return PokemonActionMutation.Success(
                        pokemon,
                        DescribePokemonChanges(before, pokemon));
                }
            default:
                return PokemonActionMutation.Fail(
                    "unsupported-pokemon-action",
                    $"Pokemon Action '{kind}' is not supported.");
        }
    }

    private static PokemonActionMutation ApplyTargetedLegalityFix(
        PKM pokemon,
        StorageSlotType storageSlotType)
    {
        var before = pokemon.Clone();
        var analysis = new LegalityAnalysis(pokemon, storageSlotType);

        if (
            !MoveResult.AllValid(analysis.Info.Moves) ||
            analysis.Results.Any(result =>
                !result.Valid && result.Identifier == CheckIdentifier.CurrentMove))
        {
            pokemon.SetMoveset();
            if (pokemon is ITechRecord records)
            {
                records.ClearRecordFlags();
                var refreshed = new LegalityAnalysis(pokemon, storageSlotType);
                records.SetRecordFlags(
                    pokemon,
                    TechnicalRecordApplicatorOption.LegalCurrent,
                    refreshed);
            }
        }

        if (
            !MoveResult.AllValid(analysis.Info.Relearn) ||
            analysis.Results.Any(result =>
                !result.Valid && result.Identifier == CheckIdentifier.RelearnMove))
        {
            pokemon.SetRelearnMoves(analysis);
        }

        if (analysis.Results.Any(result =>
            !result.Valid && result.Identifier == CheckIdentifier.Ball))
        {
            BallApplicator.ApplyBallLegalByColor(
                pokemon,
                analysis,
                PersonalColorUtil.GetColor(pokemon));
        }

        if (analysis.Results.Any(result =>
            !result.Valid &&
            result.Identifier is CheckIdentifier.Ribbon or CheckIdentifier.RibbonMark))
        {
            var args = new RibbonVerifierArguments(
                pokemon,
                analysis.EncounterMatch,
                analysis.Info.EvoChainsAllGens);
            RibbonApplicator.FixInvalidRibbons(in args);
        }

        if (pokemon.PartyStatsPresent)
            pokemon.ResetPartyStats();
        pokemon.RefreshChecksum();
        return PokemonActionMutation.Success(pokemon, DescribePokemonChanges(before, pokemon));
    }

    private static List<string> GetFixableProblems(LegalityAnalysis analysis)
    {
        var result = new List<string>();
        if (
            !MoveResult.AllValid(analysis.Info.Moves) ||
            analysis.Results.Any(check =>
                !check.Valid && check.Identifier == CheckIdentifier.CurrentMove))
        {
            result.Add("Move Set");
        }

        if (
            !MoveResult.AllValid(analysis.Info.Relearn) ||
            analysis.Results.Any(check =>
                !check.Valid && check.Identifier == CheckIdentifier.RelearnMove))
        {
            result.Add("Relearn Moves");
        }

        if (analysis.Results.Any(check =>
            !check.Valid && check.Identifier == CheckIdentifier.Ball))
        {
            result.Add("Ball");
        }

        if (analysis.Results.Any(check =>
            !check.Valid &&
            check.Identifier is CheckIdentifier.Ribbon or CheckIdentifier.RibbonMark))
        {
            result.Add("Ribbons");
        }

        return result;
    }

    private static List<PokemonEvolutionChoice> CreateEvolutionChoices(PKM pokemon)
    {
        if (pokemon.IsEgg)
            return [];

        var result = new List<PokemonEvolutionChoice>();
        foreach (var method in DirectEvolutionMethods(pokemon))
        {
            var evolved = pokemon.Clone();
            ApplyEvolution(evolved, method);
            result.Add(new PokemonEvolutionChoice(
                EvolutionChoiceId(method, pokemon.Form),
                method.Species,
                method.GetDestinationForm(pokemon.Form),
                SpeciesName(method.Species),
                method.Method.ToString(),
                EvolutionRequirement(method),
                DescribePokemonChanges(pokemon, evolved)));
        }

        return result;
    }

    private static List<EvolutionMethod> DirectEvolutionMethods(PKM pokemon)
    {
        if (pokemon.IsEgg)
            return [];

        var methods = EvolutionTree
            .GetEvolutionTree(pokemon.Context)
            .Forward
            .GetForward(pokemon.Species, pokemon.Form);
        var hasContestStats = pokemon is IContestStats;
        return
        [
            .. methods.Span
                .ToArray()
                .Where(method =>
                    method.Species != 0 &&
                    method.Method != EvolutionType.LevelUpShedinja &&
                    (method.Method != EvolutionType.LevelUpBeauty || hasContestStats))
                .OrderBy(method => method.Species)
                .ThenBy(method => method.Form)
        ];
    }

    private static void ApplyEvolution(PKM pokemon, EvolutionMethod method)
    {
        var wasNicknamed = pokemon.IsNicknamed;
        if (method.Method == EvolutionType.LevelUpBeauty &&
            pokemon is IContestStats contest &&
            contest.ContestBeauty < method.Argument)
        {
            contest.ContestBeauty = (byte)method.Argument;
        }

        if (method.Level > 0 && pokemon.CurrentLevel < method.Level)
            pokemon.CurrentLevel = method.Level;

        if (
            method.Method.IsLevelUpRequired &&
            pokemon.CurrentLevel <= pokemon.MetLevel &&
            pokemon.CurrentLevel < Experience.MaxLevel)
        {
            pokemon.CurrentLevel = (byte)Math.Min(Experience.MaxLevel, pokemon.MetLevel + 1);
        }

        pokemon.Species = method.Species;
        pokemon.Form = method.GetDestinationForm(pokemon.Form);
        pokemon.Gender = pokemon.GetSaneGender();
        var abilityIndex = pokemon.AbilityNumber switch
        {
            2 => 1,
            4 => 2,
            _ => 0,
        };
        pokemon.RefreshAbility(abilityIndex);
        if (!wasNicknamed)
            pokemon.ClearNickname();
        if (pokemon.PartyStatsPresent)
            pokemon.ResetPartyStats();
        pokemon.RefreshChecksum();
    }

    private static List<PokemonActionChange> DescribePokemonChanges(PKM before, PKM after)
    {
        var changes = new List<PokemonActionChange>();
        AddChange(changes, "Species", SpeciesName(before.Species), SpeciesName(after.Species));
        AddChange(changes, "Form", before.Form.ToString(), after.Form.ToString());
        AddChange(changes, "Level", before.CurrentLevel.ToString(), after.CurrentLevel.ToString());
        AddChange(changes, "Nickname", before.Nickname, after.Nickname);
        AddChange(changes, "Ability", AbilityName(before.Ability), AbilityName(after.Ability));
        AddChange(changes, "Ball", before.Ball.ToString(), after.Ball.ToString());
        AddChange(changes, "Moves", MovesLabel(before), MovesLabel(after));
        AddChange(changes, "Relearn Moves", RelearnMovesLabel(before), RelearnMovesLabel(after));
        AddChange(changes, "Ribbons", RibbonCount(before).ToString(), RibbonCount(after).ToString());
        return changes;
    }

    private static void AddChange(
        List<PokemonActionChange> changes,
        string field,
        string before,
        string after)
    {
        if (!StringComparer.Ordinal.Equals(before, after))
            changes.Add(new PokemonActionChange(field, before, after));
    }

    private static string EvolutionChoiceId(EvolutionMethod method, byte sourceForm) =>
        $"{method.Species}:{method.GetDestinationForm(sourceForm)}:{(int)method.Method}:{method.Argument}:{method.Level}";

    private static string EvolutionRequirement(EvolutionMethod method)
    {
        if (method.Level > 0)
            return $"Level {method.Level}";
        if (method.Argument > 0)
            return $"{method.Method} ({method.Argument})";
        return method.Method.ToString();
    }

    private static string SpeciesName(ushort species) =>
        species < GameInfo.Strings.Species.Count && !string.IsNullOrWhiteSpace(GameInfo.Strings.Species[species])
            ? GameInfo.Strings.Species[species]
            : $"Species {species}";

    private static string AbilityName(int ability) =>
        ability >= 0 && ability < GameInfo.Strings.Ability.Count
            ? GameInfo.Strings.Ability[ability]
            : $"Ability {ability}";

    private static string MovesLabel(PKM pokemon) =>
        string.Join(", ", new[] { pokemon.Move1, pokemon.Move2, pokemon.Move3, pokemon.Move4 }
            .Where(move => move != 0)
            .Select(MoveName));

    private static string RelearnMovesLabel(PKM pokemon) =>
        string.Join(", ", pokemon.RelearnMoves
            .Where(move => move != 0)
            .Select(MoveName));

    private static int RibbonCount(PKM pokemon) =>
        RibbonInfo.GetRibbonInfo(pokemon).Count(ribbon => ribbon.HasRibbon);

    private static PKM? ParseStoredPokemon(string entityBytesBase64) =>
        EntityFormat.GetFromBytes(Convert.FromBase64String(entityBytesBase64));

    private static List<LegalityReportLine> CreateLegalityMessages(LegalityAnalysis analysis, bool includeGeneric)
    {
        var localization = LegalityLocalizationSet.GetLocalization(LanguageID.English);
        var context = LegalityLocalizationContext.Create(analysis, localization);
        var messages = new List<LegalityReportLine>();

        foreach (var check in analysis.Results)
        {
            if (!includeGeneric && !check.IsNotGeneric())
                continue;

            var working = check;
            var message = context.Humanize(in working, false);
            if (string.IsNullOrWhiteSpace(message))
                continue;

            messages.Add(new LegalityReportLine(
                check.Judgement.ToString(),
                check.Identifier.ToString(),
                message));
        }

        return messages;
    }

    private static int ClampActiveBox(int box, SaveFile save)
    {
        if (save.BoxCount <= 0)
            return 0;

        return Math.Clamp(box, 0, save.BoxCount - 1);
    }

    private enum SlotZone
    {
        Party,
        Box,
    }

    private readonly record struct SlotRef(SlotZone Zone, int Box, int Slot)
    {
        public StorageSlotType StorageSlotType => Zone == SlotZone.Party ? StorageSlotType.Party : StorageSlotType.Box;

        public static SlotRefResult From(SaveFile save, SaveSlotRef? value)
        {
            if (value is null)
                return SlotRefResult.Fail("invalid-slot", "Destination Slot is required.");

            return value.Zone switch
            {
                "party" => FromParty(save, value.Slot),
                "box" => FromBox(save, value.Box, value.Slot),
                _ => SlotRefResult.Fail("invalid-slot", "Slot zone must be party or box."),
            };
        }

        private static SlotRefResult FromParty(SaveFile save, int slot)
        {
            if (!save.HasParty || slot < 0 || slot > save.PartyCount || slot >= 6)
                return SlotRefResult.Fail("invalid-slot", "Party Slot is outside the save's party range.");

            return SlotRefResult.Success(new SlotRef(SlotZone.Party, 0, slot));
        }

        private static SlotRefResult FromBox(SaveFile save, int? box, int slot)
        {
            if (box is null || box < 0 || box >= save.BoxCount || slot < 0 || slot >= save.BoxSlotCount)
                return SlotRefResult.Fail("invalid-slot", "Box Slot is outside the save's box range.");

            return SlotRefResult.Success(new SlotRef(SlotZone.Box, box.Value, slot));
        }

        public PKM Get(SaveFile save) =>
            Zone == SlotZone.Party ? PartyPokemonOrBlank(save) : save.GetBoxSlotAtIndex(Box, Slot);

        public void Set(SaveFile save, PKM pokemon)
        {
            if (Zone == SlotZone.Party)
                save.SetPartySlotAtIndex(pokemon, Slot, EntityImportSettings.None);
            else
                save.SetBoxSlotAtIndex(pokemon, Box, Slot, EntityImportSettings.None);
        }

        public void Clear(SaveFile save)
        {
            if (Zone == SlotZone.Party)
                save.DeletePartySlot(Slot);
            else
                save.SetBoxSlotAtIndex(save.BlankPKM, Box, Slot, EntityImportSettings.None);
        }

        private PKM PartyPokemonOrBlank(SaveFile save) =>
            Slot < save.PartyCount ? save.GetPartySlotAtIndex(Slot) : save.BlankPKM;
    }

    private readonly record struct SlotRefResult(bool Ok, SlotRef Value, string Code, string Message)
    {
        public static SlotRefResult Success(SlotRef value) => new(true, value, "", "");

        public static SlotRefResult Fail(string code, string message) => new(false, default, code, message);
    }

    private readonly record struct SlotMutationResult(bool Ok, bool Mutated, string Code, string Message)
    {
        public static SlotMutationResult Success(bool mutated) => new(true, mutated, "", "");

        public static SlotMutationResult Fail(string code, string message) => new(false, false, code, message);
    }

    private readonly record struct PokemonActionMutation(
        bool Ok,
        PKM Pokemon,
        List<PokemonActionChange> Changes,
        string Code,
        string Message)
    {
        public static PokemonActionMutation Success(PKM pokemon, List<PokemonActionChange> changes) =>
            new(true, pokemon, changes, "", "");

        public static PokemonActionMutation Fail(string code, string message) =>
            new(false, null!, [], code, message);
    }
}
