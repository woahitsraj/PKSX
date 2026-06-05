using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace Pksx.Pkhex.Engine;

internal static class EngineJson
{
    public static string Serialize<T>(T value, JsonTypeInfo<T> typeInfo) =>
        JsonSerializer.Serialize(value, typeInfo);
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(EngineResult<object>))]
[JsonSerializable(typeof(EngineResult<EngineVersion>))]
[JsonSerializable(typeof(EngineResult<SaveSummary>))]
[JsonSerializable(typeof(EngineResult<SaveWorkspace>))]
[JsonSerializable(typeof(EngineResult<SerializedSave>))]
[JsonSerializable(typeof(EngineResult<SlotOperationResult>))]
[JsonSerializable(typeof(EngineResult<PokemonEditOperationResult>))]
[JsonSerializable(typeof(EngineResult<LegalityReport>))]
[JsonSerializable(typeof(SlotOperationRequest))]
[JsonSerializable(typeof(PokemonEditOperationRequest))]
[JsonSerializable(typeof(SaveSlotRef))]
[JsonSerializable(typeof(EngineResult<List<PartySlotSummary>>))]
[JsonSerializable(typeof(EngineResult<List<BoxSlotSummary>>))]
internal sealed partial class EngineJsonContext : JsonSerializerContext;
