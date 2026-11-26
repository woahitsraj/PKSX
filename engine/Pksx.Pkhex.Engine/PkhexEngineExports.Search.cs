using System.Runtime.InteropServices.JavaScript;
using PKHeX.Core;
using Pksx.Pkhex.Engine.Unbound;

namespace Pksx.Pkhex.Engine;

public sealed record PokemonSearchEntry(
    string Zone,
    int? Box,
    int Slot,
    string SpeciesName,
    string Nickname,
    byte Form,
    string FormName,
    bool IsShiny,
    bool? Legal,
    string? Nature,
    string? Ability,
    string? HeldItem,
    List<string> Moves,
    int Level,
    List<int> Ivs,
    List<int> Evs,
    string? OriginGame);

public sealed record SearchCriterionUnavailable(string Criterion, string Reason);

public sealed record SaveFileSearchProjection(
    List<PokemonSearchEntry> Entries,
    List<SearchCriterionUnavailable> Unavailable);

public static partial class PkhexEngineExports
{
    [JSExport]
    public static string ListSaveFileSearchEntriesJson(byte[] bytes, string? fileName, bool includeLegality)
    {
        try
        {
            var save = GetReadOnlySave(bytes, fileName, cache: true);
            if (save is null)
            {
                return EngineJson.Serialize(
                    EngineResult.Fail("unsupported-save", UnsupportedSaveMessage),
                    EngineJsonContext.Default.EngineResultObject);
            }

            var unavailable = SearchCriteriaUnavailable(save);
            bool Available(string criterion) => unavailable.TrueForAll(item => item.Criterion != criterion);
            var legality = includeLegality && Available("legality");
            var formNames = new Dictionary<ushort, string[]>();

            PokemonSearchEntry Entry(PKM pokemon, string zone, int? box, int slot, StorageSlotType slotType)
            {
                if (!formNames.TryGetValue(pokemon.Species, out var forms))
                {
                    forms = FormConverter.GetFormList(
                        pokemon.Species,
                        GameInfo.Strings.Types,
                        GameInfo.Strings.forms,
                        GameInfo.GenderSymbolUnicode,
                        pokemon.Context);
                    formNames[pokemon.Species] = forms;
                }

                var formName = pokemon.Form < forms.Length && !string.IsNullOrWhiteSpace(forms[pokemon.Form])
                    ? forms[pokemon.Form]
                    : pokemon.Form == 0 ? "Default" : $"Form {pokemon.Form}";

                return new(
                    zone,
                    box,
                    slot,
                    SlotDetailProjection.SpeciesName(pokemon),
                    pokemon.Nickname,
                    pokemon.Form,
                    formName,
                    pokemon.IsShiny,
                    legality ? new LegalityAnalysis(pokemon, slotType).Valid : null,
                    Available("nature") ? SlotDetailProjection.Nature(pokemon) : null,
                    Available("ability") ? SlotDetailProjection.Ability(pokemon) : null,
                    Available("heldItem") ? SlotDetailProjection.HeldItem(pokemon) : null,
                    SlotDetailProjection.Moves(pokemon).ConvertAll(move => move.Name),
                    pokemon.CurrentLevel,
                    [pokemon.IV_HP, pokemon.IV_ATK, pokemon.IV_DEF, pokemon.IV_SPA, pokemon.IV_SPD, pokemon.IV_SPE],
                    [pokemon.EV_HP, pokemon.EV_ATK, pokemon.EV_DEF, pokemon.EV_SPA, pokemon.EV_SPD, pokemon.EV_SPE],
                    Available("originGame") ? GameInfo.GetVersionName(pokemon.Version) : null);
            }

            var entries = new List<PokemonSearchEntry>();
            for (var slot = 0; slot < save.PartyCount; slot++)
            {
                var pokemon = save.GetPartySlotAtIndex(slot);
                if (pokemon.Species != 0)
                    entries.Add(Entry(pokemon, "party", null, slot, StorageSlotType.Party));
            }

            for (var box = 0; box < save.BoxCount; box++)
            {
                for (var slot = 0; slot < save.BoxSlotCount; slot++)
                {
                    var pokemon = save.GetBoxSlotAtIndex(box, slot);
                    if (pokemon.Species != 0)
                        entries.Add(Entry(pokemon, "box", box, slot, StorageSlotType.Box));
                }
            }

            return EngineJson.Serialize(
                EngineResult.Ok(new SaveFileSearchProjection(entries, unavailable)),
                EngineJsonContext.Default.EngineResultSaveFileSearchProjection);
        }
        catch (Exception ex)
        {
            return EngineJson.Serialize(
                EngineResult.Fail("unknown-engine-error", ex.Message),
                EngineJsonContext.Default.EngineResultObject);
        }
    }

    private static List<SearchCriterionUnavailable> SearchCriteriaUnavailable(SaveFile save)
    {
        var unavailable = new List<SearchCriterionUnavailable>();
        var generation = $"Generation {save.Generation} games";
        if (save.Generation < 2)
            unavailable.Add(new("heldItem", $"{generation} have no held items."));
        if (save.Generation < 3)
        {
            unavailable.Add(new("nature", $"{generation} have no Natures."));
            unavailable.Add(new("ability", $"{generation} have no Abilities."));
            unavailable.Add(new("originGame", $"{generation} do not record an origin game."));
        }

        if (save is SAV3Unbound)
        {
            unavailable.Add(new("originGame", "Pokémon Unbound does not record a PKHeX origin game."));
            unavailable.Add(new("legality", UnboundLegalityMessage));
        }

        return unavailable;
    }
}
