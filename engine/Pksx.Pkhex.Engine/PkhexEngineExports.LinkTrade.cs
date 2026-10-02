using System.Runtime.InteropServices.JavaScript;
using System.Security.Cryptography;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public static partial class PkhexEngineExports
{
    // Only destinations verified on retail hardware belong here.
    private static readonly HashSet<string> LinkTradeDestinations = new(StringComparer.Ordinal) { "sword", "shield" };

    [JSExport]
    public static string PrepareOutgoingLinkTradeJson(byte[] sourceBytes, string requestJson)
    {
        try
        {
            var request = System.Text.Json.JsonSerializer.Deserialize(
                requestJson,
                EngineJsonContext.Default.OutgoingLinkTradeRequest);
            if (request is null || !LinkTradeDestinations.Contains(request.DestinationGame))
                return UnsupportedLinkTradeDestination(request?.DestinationGame);

            var sourceSha256 = Sha256Hex(sourceBytes);
            var source = request.SourceKind switch
            {
                "entity" => PokemonPreservationPayload.Create(sourceBytes.ToArray()),
                "preservation-payload" => PokemonPreservationPayload.Parse(sourceBytes),
                _ => throw new PokemonPreservationException(
                    "unsupported-preservation-payload",
                    $"Link Trade source kind {request.SourceKind} is not supported."),
            };

            return EngineJson.Serialize(
                EngineResult.Ok(PrepareSwordShieldOutgoing(request.DestinationGame, source, sourceSha256)),
                EngineJsonContext.Default.EngineResultOutgoingLinkTradeResult);
        }
        catch (PokemonPreservationException ex)
        {
            return PreservationFailure(ex);
        }
        catch (Exception ex)
        {
            return UnknownFailure(ex);
        }
    }

    [JSExport]
    public static string ReadLinkTradePartnerPokemonJson(byte[] partnerBytes, string destinationGame)
    {
        try
        {
            if (!LinkTradeDestinations.Contains(destinationGame))
                return UnsupportedLinkTradeDestination(destinationGame);

            var partnerSha256 = Sha256Hex(partnerBytes);
            var reason = TryParsePartnerPK8(partnerBytes, out var pokemon);
            if (reason is not null)
            {
                return EngineJson.Serialize(
                    EngineResult.Ok(new LinkTradePartnerPokemonResult(
                        destinationGame,
                        Parsed: false,
                        partnerSha256,
                        EntityBytesBase64: null,
                        EntityByteLength: 0,
                        EntityFormat: null,
                        UnparseableReason: reason,
                        Legality: null,
                        Projection: null)),
                    EngineJsonContext.Default.EngineResultLinkTradePartnerPokemonResult);
            }

            var entityBytes = pokemon!.Data[..pokemon.SIZE_PARTY].ToArray();
            return EngineJson.Serialize(
                EngineResult.Ok(new LinkTradePartnerPokemonResult(
                    destinationGame,
                    true,
                    partnerSha256,
                    Convert.ToBase64String(entityBytes),
                    entityBytes.Length,
                    nameof(PK8),
                    null,
                    CreateLegalityReport(pokemon, StorageSlotType.Box),
                    BoxSlotSummary.From(pokemon, BlankSaveForStoredPokemon(pokemon), 0, 0))),
                EngineJsonContext.Default.EngineResultLinkTradePartnerPokemonResult);
        }
        catch (Exception ex)
        {
            return UnknownFailure(ex);
        }
    }

    private static OutgoingLinkTradeResult PrepareSwordShieldOutgoing(
        string destinationGame,
        PokemonPreservationPayload source,
        string sourceSha256)
    {
        // A non-PK8 original is converted from Current so Storage edits survive, like Project.
        var original = source.Original.Pokemon;
        var converted = original is not PK8;
        var from = converted ? source.Current.Pokemon : original;
        var blocking = new List<LinkTradeBlockingReason>();
        PK8 outgoing;
        if (from is PK8 pk8)
        {
            outgoing = (PK8)pk8.Clone();
        }
        else if (EntityConverter.TryMakePKMCompatible(from, new PK8(), out var result, out var convertedPokemon)
            && convertedPokemon is PK8 convertedPk8
            && source.Identity.Matches(convertedPk8))
        {
            outgoing = convertedPk8;
            outgoing.RefreshChecksum();
        }
        else
        {
            var detail = result == EntityConverterResult.Success
                ? "The conversion would change the Pokemon's identity."
                : result.GetDisplayString(from, typeof(PK8));
            blocking.Add(new LinkTradeBlockingReason(
                "unsupported-conversion",
                $"{from.GetType().Name} cannot become a Sword/Shield PK8. {detail}"));
            return new OutgoingLinkTradeResult(
                destinationGame,
                Ready: false,
                nameof(PK8),
                OutgoingBytesBase64: null,
                OutgoingByteLength: 0,
                sourceSha256,
                OutgoingSha256: null,
                converted,
                Changes: [],
                Legality: null,
                blocking,
                Projection: null);
        }

        AddSwordShieldTradeBlocks(outgoing, blocking);
        // Legality is reported for review but never blocks or gets fixed.
        var legality = CreateLegalityReport(outgoing, StorageSlotType.Box);
        var changes = converted ? DescribeLinkTradeConversion(original, outgoing) : [];
        var ready = blocking.Count == 0;
        var outgoingBytes = ready ? EncryptedParty(outgoing) : null;
        return new OutgoingLinkTradeResult(
            destinationGame,
            ready,
            nameof(PK8),
            outgoingBytes is null ? null : Convert.ToBase64String(outgoingBytes),
            outgoingBytes?.Length ?? 0,
            sourceSha256,
            outgoingBytes is null ? null : Sha256Hex(outgoingBytes),
            converted,
            changes,
            legality,
            blocking,
            BoxSlotSummary.From(outgoing, BlankSaveForStoredPokemon(outgoing), 0, 0));
    }

    private static void AddSwordShieldTradeBlocks(PK8 outgoing, List<LinkTradeBlockingReason> blocking)
    {
        if (!PersonalTable.SWSH.IsPresentInGame(outgoing.Species, outgoing.Form))
            blocking.Add(new LinkTradeBlockingReason(
                "unavailable-in-game",
                $"{SpeciesName(outgoing.Species)} in form {outgoing.Form} is not available in Sword/Shield."));
        if (TradeRestrictions.IsUntradable(outgoing.Species, outgoing.Form, outgoing.FormArgument, outgoing.Format))
            blocking.Add(new LinkTradeBlockingReason(
                "trade-restriction",
                $"{SpeciesName(outgoing.Species)} cannot be traded in this form. Change its form in the game first."));
        if (outgoing.HeldItem != 0 && !ItemRestrictions.IsHeldItemAllowed(outgoing.HeldItem, EntityContext.Gen8))
            blocking.Add(new LinkTradeBlockingReason(
                "trade-restriction",
                $"Sword/Shield cannot hold {GameInfo.Strings.Item[outgoing.HeldItem]}. Remove the Held Item first."));
    }

    private static List<PokemonActionChange> DescribeLinkTradeConversion(PKM before, PK8 after)
    {
        var changes = new List<PokemonActionChange>();
        AddChange(changes, "Format", before.GetType().Name, nameof(PK8));
        changes.AddRange(DescribePokemonChanges(before, after));
        AddChange(changes, "Held Item", GameInfo.Strings.Item[before.HeldItem], GameInfo.Strings.Item[after.HeldItem]);
        AddChange(changes, "Encryption Constant", $"{before.EncryptionConstant:X8}", $"{after.EncryptionConstant:X8}");
        return changes;
    }

    private static string? TryParsePartnerPK8(byte[] partnerBytes, out PK8? pokemon)
    {
        pokemon = null;
        if (partnerBytes.Length is not (0x148 or 0x158))
            return $"Sword/Shield sends 328 or 344 bytes, not {partnerBytes.Length}.";

        var parsed = new PK8(partnerBytes.ToArray());
        if (!parsed.Valid || parsed.Species == 0 || parsed.Species > parsed.MaxSpeciesID)
            return "The partner bytes are not a valid Sword/Shield Pokemon.";
        if (EntityFormat.GetFromBytes(parsed.Data[..parsed.SIZE_PARTY].ToArray()) is not PK8)
            return "The partner bytes do not identify as a Sword/Shield Pokemon.";

        pokemon = parsed;
        return null;
    }

    private static byte[] EncryptedParty(PK8 pokemon)
    {
        var bytes = pokemon.Data[..pokemon.SIZE_PARTY].ToArray();
        PokeCrypto.Encrypt8(bytes);
        return bytes;
    }

    private static string Sha256Hex(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static string UnsupportedLinkTradeDestination(string? destinationGame) =>
        EngineJson.Serialize(
            EngineResult.Fail(
                "unsupported-link-trade-destination",
                $"Link Trade does not support {destinationGame ?? "this game"} yet. Supported games: Sword and Shield."),
            EngineJsonContext.Default.EngineResultObject);
}
