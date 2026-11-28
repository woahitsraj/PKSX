using System.Diagnostics;
using System.Runtime.InteropServices.JavaScript;
using PKHeX.Core;
using PKHeX.Core.AutoMod;
using Pksx.Pkhex.Engine.Unbound;

namespace Pksx.Pkhex.Engine;

internal enum AutoLegalStatus
{
    Repaired,
    AlreadyLegal,
    Unresolved,
}

/// <summary>One checked Auto Legal result. Candidate is set only when Status is Repaired.</summary>
internal sealed record AutoLegalOutcome(
    AutoLegalStatus Status,
    string Method,
    string? Reason,
    PKM? Candidate,
    long ElapsedMilliseconds);

public static partial class PkhexEngineExports
{
    // AutoMod checks this between encounters, so one attempt can overrun it by one encounter.
    internal const int AutoLegalAttemptTimeoutSeconds = 6;

    static PkhexEngineExports()
    {
        // The direct GetLegalFromTemplate path never runs the networked version check.
        APILegality.EnableDevMode = true;
        APILegality.UseTrainerData = true;
        APILegality.AllowTrainerOverride = true;
        APILegality.SetAllLegalRibbons = false;
        APILegality.SetMatchingBalls = false;
        APILegality.UseMarkings = false;
        APILegality.UseCompetitiveMarkings = false;
        APILegality.SetBattleVersion = false;
        APILegality.Timeout = AutoLegalAttemptTimeoutSeconds;
        Legalizer.EnableEasterEggs = false;
    }

    [JSExport]
    public static string PreviewAutoLegalJson(byte[] bytes, string? fileName, string sourceJson)
    {
        try
        {
            var save = LoadSave(bytes, fileName);
            if (save is null)
                return Failure("unsupported-save", UnsupportedSaveMessage);
            if (save is SAV3Unbound)
                return Failure("unsupported-save", UnboundLegalityMessage);

            var source = System.Text.Json.JsonSerializer.Deserialize(
                sourceJson,
                EngineJsonContext.Default.SaveSlotRef);
            var sourceResult = SlotRef.From(save, source);
            if (!sourceResult.Ok)
                return Failure(sourceResult.Code, sourceResult.Message);

            var pokemon = sourceResult.Value.Get(save);
            if (pokemon.Species == 0)
                return Failure("empty-source-slot", "Auto Legal needs an occupied Slot.");

            return SerializeAutoLegalPreview(pokemon, sourceResult.Value.StorageSlotType);
        }
        catch (Exception ex)
        {
            return UnknownFailure(ex);
        }
    }

    [JSExport]
    public static string PreviewStoredAutoLegalJson(string entityBytesBase64)
    {
        try
        {
            var pokemon = ParseStoredPokemon(entityBytesBase64);
            return pokemon is null
                ? Failure("invalid-stored-pokemon", "Pokemon Storage entry is missing entity data.")
                : SerializeAutoLegalPreview(pokemon, StorageSlotType.Box);
        }
        catch (Exception ex)
        {
            return Failure("invalid-stored-pokemon", ex.Message);
        }
    }

    private static string Failure(string code, string message) =>
        EngineJson.Serialize(EngineResult.Fail(code, message), EngineJsonContext.Default.EngineResultObject);

    private static string SerializeAutoLegalPreview(PKM pokemon, StorageSlotType storageSlotType)
    {
        var outcome = RepairToLegal(pokemon, storageSlotType);
        var candidate = outcome.Candidate;
        var changes = candidate is null ? [] : DescribeAutoLegalChanges(pokemon, candidate);
        var token = candidate is null
            ? null
            : CacheLegalityFixPreview(pokemon, storageSlotType, "auto-legal", candidate, changes);
        var preview = new AutoLegalPreview(
            outcome.Status switch
            {
                AutoLegalStatus.Repaired => "repaired",
                AutoLegalStatus.AlreadyLegal => "already-legal",
                _ => "unresolved",
            },
            outcome.Method,
            outcome.Reason,
            token,
            changes,
            CreateLegalityReport(pokemon, storageSlotType),
            candidate is null ? null : CreateLegalityReport(candidate, storageSlotType),
            candidate is null ? null : Convert.ToBase64String(candidate.Data),
            outcome.ElapsedMilliseconds);
        return EngineJson.Serialize(
            EngineResult.Ok(preview),
            EngineJsonContext.Default.EngineResultAutoLegalPreview);
    }

    /// <summary>
    /// Finds one legal candidate for a Pokemon without changing its identity: the four targeted
    /// fixes first, then AutoMod at the original encounter, then AutoMod at any encounter.
    /// The source is never modified.
    /// </summary>
    internal static AutoLegalOutcome RepairToLegal(PKM pokemon, StorageSlotType storageSlotType)
    {
        var timer = Stopwatch.StartNew();
        try
        {
            return RepairToLegal(pokemon, storageSlotType, timer);
        }
        catch (Exception ex)
        {
            // PKHeX and AutoMod throw on some damaged Pokemon; that is an unresolved result, not an engine failure.
            return new(AutoLegalStatus.Unresolved, "none", $"Auto Legal could not rebuild this Pokemon ({ex.Message}).", null, timer.ElapsedMilliseconds);
        }
    }

    private static AutoLegalOutcome RepairToLegal(PKM pokemon, StorageSlotType storageSlotType, Stopwatch timer)
    {
        AutoLegalOutcome Done(AutoLegalStatus status, string method, string? reason, PKM? candidate = null) =>
            new(status, method, reason, candidate, timer.ElapsedMilliseconds);

        var analysis = new LegalityAnalysis(pokemon, storageSlotType);
        if (analysis.Valid)
            return Done(AutoLegalStatus.AlreadyLegal, "none", null);
        if (pokemon.IsEgg)
            return Done(AutoLegalStatus.Unresolved, "none", "Auto Legal does not change Eggs.");

        var targeted = ApplyTargetedLegalityFix(pokemon.Clone(), storageSlotType, null).Pokemon;
        if (new LegalityAnalysis(targeted, storageSlotType).Valid)
            return Done(AutoLegalStatus.Repaired, "targeted", null, targeted);

        if (!pokemon.Version.IsValidSavedVersion())
            return Done(AutoLegalStatus.Unresolved, "none", "The Pokemon has no valid origin game, so Auto Legal cannot pick an encounter.");

        string? reason = null;
        foreach (var keepOrigin in new[] { true, false })
        {
            PKM? attempt;
            LegalizationResult status;
            try
            {
                attempt = RegenerateWithAutoMod(pokemon, analysis, keepOrigin, out status);
            }
            catch (Exception ex)
            {
                reason ??= $"AutoMod could not rebuild this Pokemon ({ex.Message}).";
                continue;
            }
            if (attempt is null)
            {
                reason ??= status == LegalizationResult.Timeout
                    ? "AutoMod ran out of time before it found a legal encounter."
                    : "AutoMod found no legal encounter that keeps this species, form, level and moves.";
                continue;
            }

            var identity = IdentityChange(pokemon, attempt);
            if (identity is not null)
            {
                reason = $"The only legal candidate changes the {identity}, so Auto Legal left this Pokemon unchanged.";
                continue;
            }

            RestoreSourceFields(pokemon, attempt, storageSlotType);
            if (storageSlotType == StorageSlotType.Party || pokemon.PartyStatsPresent)
                attempt.ResetPartyStats();
            else if (attempt.Data.Length == pokemon.Data.Length)
                pokemon.Data[pokemon.SIZE_STORED..].CopyTo(attempt.Data[pokemon.SIZE_STORED..]); // Box slots keep no party stats.
            attempt.RefreshChecksum();
            if (new LegalityAnalysis(attempt, storageSlotType).Valid)
                return Done(AutoLegalStatus.Repaired, keepOrigin ? "automod-origin" : "automod", null, attempt);
            reason = "AutoMod made a candidate, but it failed the Legality Check in this Slot.";
        }

        return Done(AutoLegalStatus.Unresolved, "none", reason);
    }

    private static PKM? RegenerateWithAutoMod(
        PKM pokemon,
        LegalityAnalysis analysis,
        bool keepOrigin,
        out LegalizationResult status)
    {
        var set = keepOrigin
            ? new RegenTemplate(pokemon, pokemon.Format)
            : new RegenTemplate(new ShowdownSet(pokemon), pokemon.Format);
        APILegality.AllowBatchCommands = keepOrigin;
        TrainerSettings.Clear();
        try
        {
            // AutoMod asks for a trainer per encounter game; every answer is this Pokemon's trainer.
            foreach (var version in GameUtil.GameVersions)
            {
                TrainerSettings.Register(new SimpleTrainerInfo(version)
                {
                    OT = pokemon.OriginalTrainerName,
                    TID16 = pokemon.TID16,
                    SID16 = pokemon.SID16,
                    Gender = pokemon.OriginalTrainerGender,
                    Language = pokemon.Language,
                });
            }

            // Prefer the Pokemon's own game, so a repair does not move it to another game or handler.
            APILegality.GameVersionPriority = GameVersionPriorityType.PriorityOrder;
            APILegality.PriorityOrder =
            [
                pokemon.Version,
                .. GameUtil.GameVersions.Where(version => version != pokemon.Version).OrderByDescending(version => version),
            ];
            var trainer = TrainerSettings.GetSavedTrainerData(pokemon.Version);
            var result = trainer.GetLegalFromTemplate(pokemon.Clone(), set, out status, analysis.EncounterOriginal);
            return status == LegalizationResult.Regenerated ? result : null;
        }
        finally
        {
            TrainerSettings.Clear();
            APILegality.AllowBatchCommands = true;
        }
    }

    private static string? IdentityChange(PKM before, PKM after)
    {
        if (before.GetType() != after.GetType())
            return "storage format";
        if (before.Species != after.Species)
            return "species";
        if (before.Form != after.Form)
            return "form";
        if (before.IsShiny != after.IsShiny)
            return "shiny state";
        if (before.OriginalTrainerName != after.OriginalTrainerName ||
            before.TID16 != after.TID16 ||
            before.SID16 != after.SID16 ||
            before.OriginalTrainerGender != after.OriginalTrainerGender)
            return "original trainer";
        return null;
    }

    // AutoMod rewrites fields that the encounter does not need. Each one goes back when the result stays legal.
    private static void RestoreSourceFields(PKM source, PKM candidate, StorageSlotType storageSlotType)
    {
        Action<PKM>[] restores =
        [
            pk => pk.Ball = source.Ball,
            pk => { pk.AbilityNumber = source.AbilityNumber; pk.Ability = source.Ability; },
            pk => { pk.IsNicknamed = source.IsNicknamed; pk.Nickname = source.Nickname; },
            pk => pk.EXP = source.EXP,
            pk => pk.HeldItem = source.HeldItem,
            pk => pk.MetDate = source.MetDate,
            pk => pk.EggMetDate = source.EggMetDate,
            pk => pk.OriginalTrainerFriendship = source.OriginalTrainerFriendship,
            pk => pk.HandlingTrainerFriendship = source.HandlingTrainerFriendship,
            pk =>
            {
                pk.HandlingTrainerName = source.HandlingTrainerName;
                pk.HandlingTrainerGender = source.HandlingTrainerGender;
                pk.CurrentHandler = source.CurrentHandler;
            },
            pk =>
            {
                (pk.Move1_PPUps, pk.Move2_PPUps, pk.Move3_PPUps, pk.Move4_PPUps) =
                    (source.Move1_PPUps, source.Move2_PPUps, source.Move3_PPUps, source.Move4_PPUps);
                pk.HealPP();
            },
            pk => { pk.PokerusStrain = source.PokerusStrain; pk.PokerusDays = source.PokerusDays; },
            pk =>
            {
                if (pk is IRegionOrigin region && source is IRegionOriginReadOnly original)
                    (region.ConsoleRegion, region.Region, region.Country) = (original.ConsoleRegion, original.Region, original.Country);
            },
            pk =>
            {
                if (pk is IScaledSize size && source is IScaledSize original)
                    (size.HeightScalar, size.WeightScalar) = (original.HeightScalar, original.WeightScalar);
            },
        ];
        foreach (var restore in restores)
            RestoreIfStillLegal(candidate, storageSlotType, restore);
    }

    private static void RestoreIfStillLegal(PKM candidate, StorageSlotType storageSlotType, Action<PKM> restore)
    {
        var trial = candidate.Clone();
        restore(trial);
        trial.RefreshChecksum();
        if (new LegalityAnalysis(trial, storageSlotType).Valid)
            restore(candidate);
    }

    private sealed record ChangeField(string Label, Func<PKM, string?> Describe, Action<PKM, PKM> Copy);

    // Each field can describe itself and copy itself back, so bytes that no field explains are still shown.
    private static readonly ChangeField[] AutoLegalFields =
    [
        new("Species", pk => SpeciesName(pk.Species), (from, to) => to.Species = from.Species),
        new("Form", pk => pk.Form.ToString(), (from, to) => to.Form = from.Form),
        new("Nickname", pk => pk.Nickname, (from, to) => { to.IsNicknamed = from.IsNicknamed; to.Nickname = from.Nickname; }),
        new("Experience", pk => $"{pk.EXP} (level {pk.CurrentLevel})", (from, to) => to.EXP = from.EXP),
        new("PID", pk => pk.PID.ToString("X8"), (from, to) => to.PID = from.PID),
        new("Encryption Constant", pk => pk.EncryptionConstant.ToString("X8"), (from, to) => to.EncryptionConstant = from.EncryptionConstant),
        new("Shiny", pk => pk.IsShiny ? "Yes" : "No", (_, _) => { }),
        new("Gender", pk => GenderName(pk.Gender), (from, to) => to.Gender = from.Gender),
        new("Nature", pk => NatureLabel(pk.Nature), (from, to) => to.Nature = from.Nature),
        new("Stat Nature", pk => NatureLabel(pk.StatNature), (from, to) => to.StatNature = from.StatNature),
        new("Ability", pk => AbilityName(pk.Ability), (from, to) => to.Ability = from.Ability),
        new("Ability Slot", pk => pk.AbilityNumber.ToString(), (from, to) => to.AbilityNumber = from.AbilityNumber),
        new("IVs", pk => StatsLabel(pk.IV_HP, pk.IV_ATK, pk.IV_DEF, pk.IV_SPA, pk.IV_SPD, pk.IV_SPE), (from, to) =>
        {
            (to.IV_HP, to.IV_ATK, to.IV_DEF) = (from.IV_HP, from.IV_ATK, from.IV_DEF);
            (to.IV_SPA, to.IV_SPD, to.IV_SPE) = (from.IV_SPA, from.IV_SPD, from.IV_SPE);
        }),
        new("EVs", pk => StatsLabel(pk.EV_HP, pk.EV_ATK, pk.EV_DEF, pk.EV_SPA, pk.EV_SPD, pk.EV_SPE), (from, to) =>
        {
            (to.EV_HP, to.EV_ATK, to.EV_DEF) = (from.EV_HP, from.EV_ATK, from.EV_DEF);
            (to.EV_SPA, to.EV_SPD, to.EV_SPE) = (from.EV_SPA, from.EV_SPD, from.EV_SPE);
        }),
        new("Held Item", pk => ItemLabel(pk.HeldItem), (from, to) => to.HeldItem = from.HeldItem),
        new("Ball", pk => BallName(pk.Ball), (from, to) => to.Ball = from.Ball),
        new("Origin Game", pk => pk.Version.ToString(), (from, to) => to.Version = from.Version),
        new("Met Location", pk => LocationLabel(pk, false, pk.MetLocation), (from, to) => to.MetLocation = from.MetLocation),
        new("Met Level", pk => pk.MetLevel.ToString(), (from, to) => to.MetLevel = from.MetLevel),
        new("Met Date", pk => DateLabel(pk.MetDate), (from, to) => to.MetDate = from.MetDate),
        new("Egg Location", pk => LocationLabel(pk, true, pk.EggLocation), (from, to) => to.EggLocation = from.EggLocation),
        new("Egg Date", pk => DateLabel(pk.EggMetDate), (from, to) => to.EggMetDate = from.EggMetDate),
        new("Fateful Encounter", pk => pk.FatefulEncounter ? "Yes" : "No", (from, to) => to.FatefulEncounter = from.FatefulEncounter),
        new("Language", pk => ((LanguageID)pk.Language).ToString(), (from, to) => to.Language = from.Language),
        new("Original Trainer", pk => $"{pk.OriginalTrainerName} ({GenderName(pk.OriginalTrainerGender)})", (from, to) =>
        {
            to.OriginalTrainerName = from.OriginalTrainerName;
            to.OriginalTrainerGender = from.OriginalTrainerGender;
        }),
        new("Trainer ID", pk => pk.Format >= 7 ? $"{pk.ID32 % 1_000_000} / {pk.ID32 / 1_000_000}" : $"{pk.TID16} / {pk.SID16}", (from, to) => (to.TID16, to.SID16) = (from.TID16, from.SID16)),
        new("Handling Trainer", pk => $"{pk.HandlingTrainerName} ({GenderName(pk.HandlingTrainerGender)}), current {pk.CurrentHandler}", (from, to) =>
        {
            to.HandlingTrainerName = from.HandlingTrainerName;
            to.HandlingTrainerGender = from.HandlingTrainerGender;
            to.CurrentHandler = from.CurrentHandler;
        }),
        new("Friendship", pk => $"{pk.OriginalTrainerFriendship} / {pk.HandlingTrainerFriendship}", (from, to) =>
        {
            to.OriginalTrainerFriendship = from.OriginalTrainerFriendship;
            to.HandlingTrainerFriendship = from.HandlingTrainerFriendship;
        }),
        new("Pokerus", pk => $"{pk.PokerusStrain}/{pk.PokerusDays}", (from, to) => (to.PokerusStrain, to.PokerusDays) = (from.PokerusStrain, from.PokerusDays)),
        new("Contest Stats", pk => pk is IContestStats c ? $"{c.ContestCool}/{c.ContestBeauty}/{c.ContestCute}/{c.ContestSmart}/{c.ContestTough}/{c.ContestSheen}" : null, (from, to) =>
        {
            if (from is IContestStats a && to is IContestStats b)
                a.CopyContestStatsTo(b);
        }),
        new("Original Trainer Memory", pk => pk is IMemoryOT m ? $"{m.OriginalTrainerMemory}/{m.OriginalTrainerMemoryIntensity}/{m.OriginalTrainerMemoryFeeling}/{m.OriginalTrainerMemoryVariable}" : null, (from, to) =>
        {
            if (from is IMemoryOT a && to is IMemoryOT b)
            {
                (b.OriginalTrainerMemory, b.OriginalTrainerMemoryIntensity) = (a.OriginalTrainerMemory, a.OriginalTrainerMemoryIntensity);
                (b.OriginalTrainerMemoryFeeling, b.OriginalTrainerMemoryVariable) = (a.OriginalTrainerMemoryFeeling, a.OriginalTrainerMemoryVariable);
            }
        }),
        new("Handling Trainer Memory", pk => pk is IMemoryHT m ? $"{m.HandlingTrainerMemory}/{m.HandlingTrainerMemoryIntensity}/{m.HandlingTrainerMemoryFeeling}/{m.HandlingTrainerMemoryVariable}" : null, (from, to) =>
        {
            if (from is IMemoryHT a && to is IMemoryHT b)
            {
                (b.HandlingTrainerMemory, b.HandlingTrainerMemoryIntensity) = (a.HandlingTrainerMemory, a.HandlingTrainerMemoryIntensity);
                (b.HandlingTrainerMemoryFeeling, b.HandlingTrainerMemoryVariable) = (a.HandlingTrainerMemoryFeeling, a.HandlingTrainerMemoryVariable);
            }
        }),
        new("Region", pk => pk is IRegionOriginReadOnly r ? $"console {r.ConsoleRegion}, region {r.Region}, country {r.Country}" : null, (from, to) =>
        {
            if (from is IRegionOriginReadOnly a && to is IRegionOrigin b)
                (b.ConsoleRegion, b.Region, b.Country) = (a.ConsoleRegion, a.Region, a.Country);
        }),
        new("Geolocations", pk => pk is IGeoTrack g ? $"{g.Geo1_Country}/{g.Geo2_Country}/{g.Geo3_Country}/{g.Geo4_Country}/{g.Geo5_Country}" : null, (from, to) =>
        {
            if (from is IGeoTrack a && to is IGeoTrack b)
            {
                (b.Geo1_Country, b.Geo2_Country, b.Geo3_Country, b.Geo4_Country, b.Geo5_Country) = (a.Geo1_Country, a.Geo2_Country, a.Geo3_Country, a.Geo4_Country, a.Geo5_Country);
                (b.Geo1_Region, b.Geo2_Region, b.Geo3_Region, b.Geo4_Region, b.Geo5_Region) = (a.Geo1_Region, a.Geo2_Region, a.Geo3_Region, a.Geo4_Region, a.Geo5_Region);
            }
        }),
        new("Affection", pk => pk is IAffection a ? $"{a.OriginalTrainerAffection} / {a.HandlingTrainerAffection}" : null, (from, to) =>
        {
            if (from is IAffection a && to is IAffection b)
                (b.OriginalTrainerAffection, b.HandlingTrainerAffection) = (a.OriginalTrainerAffection, a.HandlingTrainerAffection);
        }),
        new("Hyper Training", pk => pk is IHyperTrain h ? h.HyperTrainFlags.ToString() : null, (from, to) =>
        {
            if (from is IHyperTrain a && to is IHyperTrain b)
                b.HyperTrainFlags = a.HyperTrainFlags;
        }),
        new("Tera Type", pk => pk is ITeraType t ? $"{t.TeraTypeOriginal} / {t.TeraTypeOverride}" : null, (from, to) =>
        {
            if (from is ITeraType a && to is ITeraType b)
                (b.TeraTypeOriginal, b.TeraTypeOverride) = (a.TeraTypeOriginal, a.TeraTypeOverride);
        }),
        new("Size", pk => pk is IScaledSize z ? $"{z.HeightScalar}/{z.WeightScalar}" : null, (from, to) =>
        {
            if (from is IScaledSize a && to is IScaledSize b)
                (b.HeightScalar, b.WeightScalar) = (a.HeightScalar, a.WeightScalar);
        }),
    ];

    private static List<PokemonActionChange> DescribeAutoLegalChanges(PKM before, PKM after)
    {
        var changes = new List<PokemonActionChange>();
        foreach (var field in AutoLegalFields)
            AddChange(changes, field.Label, field.Describe(before) ?? "", field.Describe(after) ?? "");

        changes.AddRange(DescribeLegalityFixChanges(before, after)
            .Where(change => changes.All(existing => existing.Field != change.Field))
            .Where(change => before.PartyStatsPresent || !PartyStatFields.Contains(change.Field)));

        var original = before.Clone();
        original.RefreshChecksum();
        var unexplained = CountChangedBytes(original.Data, CopyNamedFields(before, after).Data);
        if (unexplained > 0)
            changes.Add(new PokemonActionChange("Other stored data", "Original", $"{unexplained} bytes changed"));
        return changes;
    }

    private static PKM CopyNamedFields(PKM from, PKM after)
    {
        var to = after.Clone();
        foreach (var field in AutoLegalFields)
            field.Copy(from, to);
        (to.Move1, to.Move2, to.Move3, to.Move4) = (from.Move1, from.Move2, from.Move3, from.Move4);
        (to.Move1_PP, to.Move2_PP, to.Move3_PP, to.Move4_PP) = (from.Move1_PP, from.Move2_PP, from.Move3_PP, from.Move4_PP);
        (to.Move1_PPUps, to.Move2_PPUps, to.Move3_PPUps, to.Move4_PPUps) =
            (from.Move1_PPUps, from.Move2_PPUps, from.Move3_PPUps, from.Move4_PPUps);
        (to.RelearnMove1, to.RelearnMove2, to.RelearnMove3, to.RelearnMove4) =
            (from.RelearnMove1, from.RelearnMove2, from.RelearnMove3, from.RelearnMove4);
        if (from is ITechRecord fromRecords && to is ITechRecord toRecords)
        {
            for (var index = 0; index < fromRecords.Permit.RecordCountTotal; index++)
                toRecords.SetMoveRecordFlag(index, fromRecords.GetMoveRecordFlag(index));
        }
        foreach (var ribbon in RibbonInfo.GetRibbonInfo(from))
        {
            object value = ribbon.Type == RibbonValueType.Byte ? ribbon.RibbonCount : ribbon.HasRibbon;
            ReflectUtil.SetValue(to, ribbon.Name, value);
        }
        (to.Stat_HPCurrent, to.Stat_HPMax, to.Stat_ATK, to.Stat_DEF) = (from.Stat_HPCurrent, from.Stat_HPMax, from.Stat_ATK, from.Stat_DEF);
        (to.Stat_SPE, to.Stat_SPA, to.Stat_SPD, to.Stat_Level) = (from.Stat_SPE, from.Stat_SPA, from.Stat_SPD, from.Stat_Level);
        to.Status_Condition = from.Status_Condition;
        if (from.Data.Length == to.Data.Length)
            from.Data[from.SIZE_STORED..].CopyTo(to.Data[from.SIZE_STORED..]);
        to.RefreshChecksum();
        return to;
    }

    // Box storage does not keep these; the Slot recalculates them when the Pokemon joins the Party.
    private static readonly HashSet<string> PartyStatFields =
        ["Current HP", "Maximum HP", "Attack", "Defense", "Speed", "Sp. Atk", "Sp. Def", "Party Level", "Status"];

    private static int CountChangedBytes(ReadOnlySpan<byte> before, ReadOnlySpan<byte> after)
    {
        var count = Math.Abs(before.Length - after.Length);
        for (var index = 0; index < Math.Min(before.Length, after.Length); index++)
        {
            if (before[index] != after[index])
                count++;
        }
        return count;
    }

    private static string StatsLabel(int hp, int atk, int def, int spa, int spd, int spe) =>
        $"{hp}/{atk}/{def}/{spa}/{spd}/{spe}";

    private static string GenderName(byte gender) => gender switch
    {
        0 => "Male",
        1 => "Female",
        _ => "Genderless",
    };

    private static string NatureLabel(Nature nature) =>
        (int)nature < GameInfo.Strings.Natures.Count ? GameInfo.Strings.Natures[(int)nature] : nature.ToString();

    private static string ItemLabel(int item) =>
        item == 0 ? "None" : item < GameInfo.Strings.Item.Count ? GameInfo.Strings.Item[item] : $"Item {item}";

    private static string LocationLabel(PKM pokemon, bool egg, ushort location)
    {
        var name = GameInfo.GetLocationName(egg, location, pokemon.Format, pokemon.Generation, pokemon.Version);
        return string.IsNullOrWhiteSpace(name) ? location.ToString() : name;
    }

    private static string DateLabel(DateOnly? date) => date?.ToString("yyyy-MM-dd") ?? "None";
}
