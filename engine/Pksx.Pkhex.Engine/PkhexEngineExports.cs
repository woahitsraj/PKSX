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

            var partySlots = new List<PartySlotSummary>(save.PartyCount);
            for (var slot = 0; slot < save.PartyCount; slot++)
                partySlots.Add(PartySlotSummary.From(save.GetPartySlotAtIndex(slot), slot));

            var boxSlots = new List<BoxSlotSummary>(save.BoxSlotCount);
            for (var slot = 0; slot < save.BoxSlotCount; slot++)
                boxSlots.Add(BoxSlotSummary.From(save.GetBoxSlotAtIndex(box, slot), box, slot));

            return EngineJson.Serialize(
                EngineResult.Ok(new SaveWorkspace(SaveSummary.From(save, fileName), partySlots, boxSlots)),
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
}
