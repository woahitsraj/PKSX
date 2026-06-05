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
    public static string CheckSlotLegalityJson(byte[] bytes, string? fileName, string slotRefJson)
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

            var slotRef = System.Text.Json.JsonSerializer.Deserialize(
                slotRefJson,
                EngineJsonContext.Default.SaveSlotRef);

            var sourceResult = SlotRef.From(save, slotRef);
            if (!sourceResult.Ok)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail(sourceResult.Code, sourceResult.Message),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var source = sourceResult.Value;
            var pokemon = source.Get(save);
            if (pokemon.Species == 0)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("empty-source-slot", "Legality Check needs an occupied source Slot."),
                    EngineJsonContext.Default.EngineResultObject);
            }

            return EngineJson.Serialize(
                EngineResult.Ok(CreateLegalityReport(pokemon, source.StorageSlotType)),
                EngineJsonContext.Default.EngineResultLegalityReport);
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

    private static LegalityReport CreateLegalityReport(PKM pokemon, StorageSlotType slotType)
    {
        var analysis = new LegalityAnalysis(pokemon, slotType);
        var localization = LegalityLocalizationSet.GetLocalization(LanguageID.English);
        var context = LegalityLocalizationContext.Create(analysis, localization);
        var warnings = new List<LegalityReportLine>();
        var messages = new List<LegalityReportLine>();

        foreach (var check in analysis.Results)
        {
            if (!check.IsNotGeneric())
                continue;

            var working = check;
            var message = context.Humanize(in working, false);
            if (string.IsNullOrWhiteSpace(message))
                continue;

            var line = new LegalityReportLine(
                check.Judgement.ToString(),
                check.Identifier.ToString(),
                message);

            if (check.Judgement == Severity.Fishy)
                warnings.Add(line);
            else if (check.Judgement == Severity.Invalid)
                messages.Add(line);
        }

        var summary = analysis.Valid
            ? "PKHeX judged this Pokemon legal."
            : "PKHeX found legality issues for this Pokemon.";
        var judgement = analysis.Valid ? "Legal" : "Illegal";

        return new LegalityReport(analysis.Valid, judgement, summary, warnings, messages);
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

        public StorageSlotType StorageSlotType =>
            Zone == SlotZone.Party ? StorageSlotType.Party : StorageSlotType.Box;

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
}
