using System.Runtime.InteropServices.JavaScript;
using System.Security.Cryptography;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

public static partial class PkhexEngineExports
{
    // Only destinations verified on retail hardware belong here.
    private static readonly HashSet<string> LinkTradeDestinations = new(StringComparer.Ordinal) { "sword", "shield" };

    [JSExport]
    public static string PrepareLinkTradeOfferJson(byte[] sourceBytes, string requestJson)
    {
        try
        {
            var request = System.Text.Json.JsonSerializer.Deserialize(
                requestJson,
                EngineJsonContext.Default.LinkTradeOfferRequest);
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
                EngineResult.Ok(PrepareSwordShieldOffer(request.DestinationGame, source, sourceSha256)),
                EngineJsonContext.Default.EngineResultLinkTradeOfferResult);
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
    public static string ReadLinkTradeReceivedPokemonJson(byte[] receivedBytes, string destinationGame)
    {
        try
        {
            if (!LinkTradeDestinations.Contains(destinationGame))
                return UnsupportedLinkTradeDestination(destinationGame);

            var receivedSha256 = Sha256Hex(receivedBytes);
            var reason = TryParseReceivedPK8(receivedBytes, out var pokemon);
            if (reason is not null)
            {
                return EngineJson.Serialize(
                    EngineResult.Ok(new LinkTradeReceivedPokemonResult(
                        destinationGame, false, receivedSha256, null, 0, null, reason, null, null)),
                    EngineJsonContext.Default.EngineResultLinkTradeReceivedPokemonResult);
            }

            var entityBytes = pokemon!.Data[..pokemon.SIZE_PARTY].ToArray();
            return EngineJson.Serialize(
                EngineResult.Ok(new LinkTradeReceivedPokemonResult(
                    destinationGame,
                    true,
                    receivedSha256,
                    Convert.ToBase64String(entityBytes),
                    entityBytes.Length,
                    nameof(PK8),
                    null,
                    CreateLegalityReport(pokemon, StorageSlotType.Box),
                    BoxSlotSummary.From(pokemon, BlankSaveForStoredPokemon(pokemon), 0, 0))),
                EngineJsonContext.Default.EngineResultLinkTradeReceivedPokemonResult);
        }
        catch (Exception ex)
        {
            return UnknownFailure(ex);
        }
    }

    private static LinkTradeOfferResult PrepareSwordShieldOffer(
        string destinationGame,
        PokemonPreservationPayload source,
        string sourceSha256)
    {
        var native = source.Original.Pokemon is PK8 ? source.Original : source.Current;
        var blocking = new List<LinkTradeBlockingReason>();
        PK8 offer;
        if (native.Pokemon is PK8 pk8)
        {
            offer = (PK8)pk8.Clone();
        }
        else if (EntityConverter.TryMakePKMCompatible(native.Pokemon, new PK8(), out var result, out var convertedPokemon)
            && convertedPokemon is PK8 convertedPk8
            && source.Identity.Matches(convertedPk8))
        {
            offer = convertedPk8;
            offer.RefreshChecksum();
        }
        else
        {
            var detail = result == EntityConverterResult.Success
                ? "The conversion would change the Pokemon's identity."
                : result.GetDisplayString(native.Pokemon, typeof(PK8));
            blocking.Add(new LinkTradeBlockingReason(
                "unsupported-conversion",
                $"{native.Pokemon.GetType().Name} cannot become a Sword/Shield PK8. {detail}"));
            return new LinkTradeOfferResult(
                destinationGame, false, nameof(PK8), null, 0, sourceSha256, null, false, [], null, blocking, null);
        }

        AddSwordShieldTradeBlocks(offer, blocking);
        var legality = CreateLegalityReport(offer, StorageSlotType.Box);
        if (!legality.Legal)
            blocking.Add(new LinkTradeBlockingReason(
                "legality",
                "PKHeX reports legality issues. Review the Legality Check and fix the Pokemon before you trade it."));

        var converted = native.Pokemon is not PK8;
        var changes = converted ? DescribeLinkTradeConversion(native.Pokemon, offer) : [];
        var ready = blocking.Count == 0;
        var offerBytes = ready ? EncryptedParty(offer) : null;
        return new LinkTradeOfferResult(
            destinationGame,
            ready,
            nameof(PK8),
            offerBytes is null ? null : Convert.ToBase64String(offerBytes),
            offerBytes?.Length ?? 0,
            sourceSha256,
            offerBytes is null ? null : Sha256Hex(offerBytes),
            converted,
            changes,
            legality,
            blocking,
            BoxSlotSummary.From(offer, BlankSaveForStoredPokemon(offer), 0, 0));
    }

    private static void AddSwordShieldTradeBlocks(PK8 offer, List<LinkTradeBlockingReason> blocking)
    {
        if (!PersonalTable.SWSH.IsPresentInGame(offer.Species, offer.Form))
            blocking.Add(new LinkTradeBlockingReason(
                "unavailable-in-game",
                $"{SpeciesName(offer.Species)} in form {offer.Form} is not available in Sword/Shield."));
        if (TradeRestrictions.IsUntradable(offer.Species, offer.Form, offer.FormArgument, offer.Format))
            blocking.Add(new LinkTradeBlockingReason(
                "trade-restriction",
                $"{SpeciesName(offer.Species)} cannot be traded in this form. Change its form in the game first."));
        if (offer.HeldItem != 0 && !ItemRestrictions.IsHeldItemAllowed(offer.HeldItem, EntityContext.Gen8))
            blocking.Add(new LinkTradeBlockingReason(
                "trade-restriction",
                $"Sword/Shield cannot hold {GameInfo.Strings.Item[offer.HeldItem]}. Remove the Held Item first."));
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

    private static string? TryParseReceivedPK8(byte[] receivedBytes, out PK8? pokemon)
    {
        pokemon = null;
        if (receivedBytes.Length is not (0x148 or 0x158))
            return $"Sword/Shield sends 328 or 344 bytes, not {receivedBytes.Length}.";

        var parsed = new PK8(receivedBytes.ToArray());
        if (!parsed.Valid || parsed.Species == 0 || parsed.Species > parsed.MaxSpeciesID)
            return "The received bytes are not a valid Sword/Shield Pokemon.";
        if (EntityFormat.GetFromBytes(parsed.Data[..parsed.SIZE_PARTY].ToArray()) is not PK8)
            return "The received bytes do not identify as a Sword/Shield Pokemon.";

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
