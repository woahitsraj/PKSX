using System.Buffers.Binary;
using System.Security.Cryptography;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

internal sealed class PokemonPreservationPayload
{
    private const ushort CurrentVersion = 1;
    private const int HeaderLength = 44;
    private const int ChecksumLength = 32;
    private static ReadOnlySpan<byte> Magic => "PKSX"u8;

    private PokemonPreservationPayload(
        Guid recordId,
        PokemonIdentityFingerprint identity,
        PokemonEntitySnapshot original,
        PokemonEntitySnapshot current)
    {
        RecordId = recordId;
        Identity = identity;
        Original = original;
        Current = current;
    }

    public Guid RecordId { get; }
    public PokemonIdentityFingerprint Identity { get; }
    public PokemonEntitySnapshot Original { get; }
    public PokemonEntitySnapshot Current { get; }
    public byte[] CurrentBytes => Current.Bytes;
    public PKM CurrentPokemon => Current.Pokemon;

    public static PokemonPreservationPayload Create(byte[] entityBytes)
    {
        var pokemon = ParseEntity(entityBytes, EntityContext.None, "Pokemon Entity");
        var bytes = entityBytes.ToArray();
        return new PokemonPreservationPayload(
            Guid.NewGuid(),
            PokemonIdentityFingerprint.From(pokemon),
            new PokemonEntitySnapshot(pokemon.Format, pokemon.Context, bytes, pokemon),
            new PokemonEntitySnapshot(pokemon.Format, pokemon.Context, bytes.ToArray(), pokemon.Clone()));
    }

    public static PokemonPreservationPayload Parse(byte[] payloadBytes)
    {
        var payload = payloadBytes.AsSpan();
        if (payload.Length < Magic.Length + sizeof(ushort))
            throw Malformed("The preservation payload is truncated.");
        if (!payload[..Magic.Length].SequenceEqual(Magic))
            throw new PokemonPreservationException(
                "unsupported-preservation-payload",
                "These bytes are not a supported PKSX preservation payload.");

        var version = BinaryPrimitives.ReadUInt16LittleEndian(payload[Magic.Length..]);
        if (version != CurrentVersion)
            throw new PokemonPreservationException(
                "unknown-preservation-version",
                $"Preservation payload version {version} is not supported.");
        if (payload.Length < HeaderLength + ChecksumLength)
            throw Malformed("The preservation payload is truncated.");

        var originalLength = BinaryPrimitives.ReadInt32LittleEndian(payload[36..]);
        var currentLength = BinaryPrimitives.ReadInt32LittleEndian(payload[40..]);
        if (originalLength <= 0 || currentLength <= 0)
            throw Malformed("The preservation payload has an invalid entity length.");

        int expectedLength;
        try
        {
            expectedLength = checked(HeaderLength + originalLength + currentLength + ChecksumLength);
        }
        catch (OverflowException)
        {
            throw Malformed("The preservation payload has an invalid entity length.");
        }
        if (payload.Length != expectedLength)
            throw Malformed("The preservation payload length does not match its header.");

        var content = payload[..^ChecksumLength];
        var checksum = payload[^ChecksumLength..];
        if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(content), checksum))
            throw Malformed("The preservation payload checksum is invalid.");

        var recordId = new Guid(payload.Slice(6, 16));
        if (recordId == Guid.Empty)
            throw Malformed("The preservation payload Record ID is missing.");

        var identity = new PokemonIdentityFingerprint(
            BinaryPrimitives.ReadUInt16LittleEndian(payload[22..]),
            BinaryPrimitives.ReadUInt16LittleEndian(payload[24..]),
            BinaryPrimitives.ReadUInt16LittleEndian(payload[26..]),
            BinaryPrimitives.ReadUInt32LittleEndian(payload[28..]));
        var originalFormat = payload[32];
        var originalContext = ParseContext(payload[33]);
        var currentFormat = payload[34];
        var currentContext = ParseContext(payload[35]);
        var originalBytes = payload.Slice(HeaderLength, originalLength).ToArray();
        var currentBytes = payload.Slice(HeaderLength + originalLength, currentLength).ToArray();
        var originalPokemon = ParseEntity(originalBytes, originalContext, "original Pokemon Entity");
        var currentPokemon = ParseEntity(currentBytes, currentContext, "current Pokemon Entity");

        ValidateTag(originalPokemon, originalFormat, originalContext, "original");
        ValidateTag(currentPokemon, currentFormat, currentContext, "current");
        if (PokemonIdentityFingerprint.From(originalPokemon) != identity || !identity.Matches(currentPokemon))
        {
            throw new PokemonPreservationException(
                "unsupported-preservation-payload",
                "The preserved Pokemon Entity bytes do not match the identity fingerprint.");
        }

        return new PokemonPreservationPayload(
            recordId,
            identity,
            new PokemonEntitySnapshot(originalFormat, originalContext, originalBytes, originalPokemon),
            new PokemonEntitySnapshot(currentFormat, currentContext, currentBytes, currentPokemon));
    }

    public PokemonPreservationPayload Project(byte targetFormat)
    {
        PKM projected;
        byte[] projectedBytes;
        if (targetFormat == Original.Format)
        {
            projected = Original.Pokemon.Clone();
            projectedBytes = Original.Bytes.ToArray();
        }
        else
        {
            PKM target;
            try
            {
                target = EntityBlank.GetBlank(targetFormat);
            }
            catch (Exception)
            {
                throw UnsupportedProjection(targetFormat, "The target Pokemon format is not supported.");
            }

            if (!EntityConverter.TryMakePKMCompatible(CurrentPokemon, target, out var result, out projected))
                throw UnsupportedProjection(targetFormat, result.GetDisplayString(CurrentPokemon, target.GetType()));

            projectedBytes = projected.Data.ToArray();
        }

        if (!Identity.Matches(projected))
            throw UnsupportedProjection(
                targetFormat,
                "The projection changed the Pokemon identity fingerprint.");

        return new PokemonPreservationPayload(
            RecordId,
            Identity,
            Original.Copy(),
            new PokemonEntitySnapshot(projected.Format, projected.Context, projectedBytes, projected));
    }

    public byte[] ToBytes()
    {
        var bytes = new byte[HeaderLength + Original.Bytes.Length + Current.Bytes.Length + ChecksumLength];
        var payload = bytes.AsSpan();
        Magic.CopyTo(payload);
        BinaryPrimitives.WriteUInt16LittleEndian(payload[4..], CurrentVersion);
        RecordId.TryWriteBytes(payload[6..22]);
        BinaryPrimitives.WriteUInt16LittleEndian(payload[22..], Identity.BaseSpeciesId);
        BinaryPrimitives.WriteUInt16LittleEndian(payload[24..], Identity.TrainerId);
        BinaryPrimitives.WriteUInt16LittleEndian(payload[26..], Identity.SecretId);
        BinaryPrimitives.WriteUInt32LittleEndian(payload[28..], Identity.PersonalityId);
        payload[32] = Original.Format;
        payload[33] = (byte)Original.Context;
        payload[34] = Current.Format;
        payload[35] = (byte)Current.Context;
        BinaryPrimitives.WriteInt32LittleEndian(payload[36..], Original.Bytes.Length);
        BinaryPrimitives.WriteInt32LittleEndian(payload[40..], Current.Bytes.Length);
        Original.Bytes.CopyTo(payload[HeaderLength..]);
        Current.Bytes.CopyTo(payload[(HeaderLength + Original.Bytes.Length)..]);
        SHA256.HashData(payload[..^ChecksumLength]).CopyTo(payload[^ChecksumLength..]);
        return bytes;
    }

    public PreservationPayloadSummary Summary() =>
        new(
            CurrentVersion,
            RecordId.ToString("N"),
            Identity.ToString(),
            Identity.BaseSpeciesId,
            Original.Pokemon.GetType().Name,
            Original.Format,
            Original.Context.ToString(),
            Current.Pokemon.GetType().Name,
            Current.Format,
            Current.Context.ToString(),
            Original.Bytes.Length,
            Current.Bytes.Length,
            Convert.ToHexString(SHA256.HashData(Original.Bytes)).ToLowerInvariant());

    private static PKM ParseEntity(byte[] bytes, EntityContext context, string label)
    {
        try
        {
            var pokemon = EntityFormat.GetFromBytes(bytes, context);
            if (pokemon is null || pokemon.Species == 0)
                throw new PokemonPreservationException(
                    "unsupported-preservation-payload",
                    $"The {label} is not supported by the PKHeX Engine.");
            return pokemon;
        }
        catch (PokemonPreservationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new PokemonPreservationException(
                "unsupported-preservation-payload",
                $"The {label} is not supported by the PKHeX Engine. {ex.Message}");
        }
    }

    private static EntityContext ParseContext(byte value)
    {
        var context = (EntityContext)value;
        if (!context.IsValid)
            throw new PokemonPreservationException(
                "unsupported-preservation-payload",
                $"Pokemon Entity context {value} is not supported.");
        return context;
    }

    private static void ValidateTag(PKM pokemon, byte format, EntityContext context, string label)
    {
        if (pokemon.Format != format || pokemon.Context != context)
            throw new PokemonPreservationException(
                "unsupported-preservation-payload",
                $"The {label} Pokemon Entity does not match its format tag.");
    }

    private static PokemonPreservationException Malformed(string message) =>
        new("malformed-preservation-payload", message);

    private static PokemonPreservationException UnsupportedProjection(byte targetFormat, string detail) =>
        new(
            "unsupported-preservation-projection",
            $"The Pokemon Entity cannot be projected to format {targetFormat}. {detail}");
}

internal readonly record struct PokemonIdentityFingerprint(
    ushort BaseSpeciesId,
    ushort TrainerId,
    ushort SecretId,
    uint PersonalityId)
{
    public static PokemonIdentityFingerprint From(PKM pokemon)
    {
        var (baseSpecies, _) = EvolutionTree
            .GetEvolutionTree(pokemon.Context)
            .GetBaseSpeciesForm(pokemon.Species, pokemon.Form);
        return new PokemonIdentityFingerprint(baseSpecies, pokemon.TID16, pokemon.SID16, pokemon.PID);
    }

    public bool Matches(PKM pokemon)
    {
        if (pokemon.TID16 != TrainerId || pokemon.SID16 != SecretId || pokemon.PID != PersonalityId)
            return false;

        foreach (var context in Enum.GetValues<EntityContext>())
        {
            if (!context.IsValid)
                continue;
            if (EvolutionTree
                .GetEvolutionTree(context)
                .IsSpeciesDerivedFrom(pokemon.Species, pokemon.Form, BaseSpeciesId, 0))
                return true;
        }

        return false;
    }

    public override string ToString() =>
        $"{BaseSpeciesId:D4}-{TrainerId:x4}{SecretId:x4}-{PersonalityId:x8}";
}

internal sealed record PokemonEntitySnapshot(byte Format, EntityContext Context, byte[] Bytes, PKM Pokemon)
{
    public PokemonEntitySnapshot Copy() => new(Format, Context, Bytes.ToArray(), Pokemon.Clone());
}

internal sealed class PokemonPreservationException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
