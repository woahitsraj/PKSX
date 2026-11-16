// Builds Unbound/Data from PUSE (MIT): dotnet run --project scripts/data/unbound-tables -- <PUSE>/backend/data <CFRU>/include/constants <out>
using System.Globalization;
using System.Text;
using System.Text.Json;
using PKHeX.Core;

var source = args[0];
var constantsDir = args[1];
var output = args[2];
var strings = GameInfo.GetStrings("en");
var failures = new List<string>();

var speciesNames = ReadNames("pokemon.txt");
var constants = ReadJson<Dictionary<string, string>>("species_constants.json");
var types = ReadJson<Dictionary<string, JsonElement>>("species_types.json");
var abilitySlots = ReadJson<Dictionary<string, JsonElement>>("species_abilities_meta.json");
var growth = ReadJson<Dictionary<string, JsonElement>>("species_growth_rates.json");
var identity = ReadJson<Dictionary<string, JsonElement>>("species_identity_meta.json");
var baseStats = ReadJson<Dictionary<string, JsonElement>>("species_base_stats.json");

// CFRU calls two moves and both As One abilities by names PKHeX does not use.
var moves = Bridge(ReadNames("moves.txt"), ReadConstants("moves.h", "MOVE_"), strings.movelist, new() { [490] = (int)Move.PetalBlizzard, [635] = (int)Move.CraftyShield });
var abilities = Bridge(ReadNames("abilities.txt"), ReadConstants("abilities.h", "ABILITY_"), strings.abilitylist, new() { [153] = (int)Ability.AsOneG, [154] = (int)Ability.AsOneI });
var items = Bridge(ReadNames("items.txt"), ReadConstants("items.h", "ITEM_"), strings.itemlist, ItemAliases(new()
{
    ["Weak Policy"] = "Weakness Policy", ["Electirizier"] = "Electirizer", ["Alorichium Z"] = "Aloraichium Z",
    ["Pikasunium Z"] = "Pikashunium Z", ["Health Wing"] = "Health Feather", ["Muscle Wing"] = "Muscle Feather",
    ["Resist Wing"] = "Resist Feather", ["Genius Wing"] = "Genius Feather", ["Clever Wing"] = "Clever Feather",
    ["Swift Wing"] = "Swift Feather", ["Pretty Wing"] = "Pretty Feather", ["Rainbow Wing"] = "Rainbow Wing",
    ["Silver Wing"] = "Silver Wing", ["S.S. Ticket"] = "S.S. Ticket", ["HM08"] = "HM08",
}));
var movePp = JsonDocument.Parse(File.ReadAllText(Path.Combine(source, "move_table_from_rom.json"))).RootElement
    .GetProperty("moves").EnumerateArray().ToDictionary(m => m.GetProperty("move_id").GetInt32(), m => m.GetProperty("base_pp").GetInt32());

EntityContext[] FormContexts = [EntityContext.Gen9, EntityContext.Gen8, EntityContext.Gen8a, EntityContext.Gen7, EntityContext.Gen6, EntityContext.Gen5, EntityContext.Gen4];
var SpeciesOverrides = new Dictionary<string, (ushort, byte)>
{
    ["DARMANITANZEN"] = ((ushort)Species.Darmanitan, 1),
    ["ASHGRENINJA"] = ((ushort)Species.Greninja, 2),
    // CFRU's base Pumpkaboo and Gourgeist are the Small size.
    ["PUMPKABOO"] = ((ushort)Species.Pumpkaboo, 1),
    ["GOURGEIST"] = ((ushort)Species.Gourgeist, 1),
};
var speciesByName = new Dictionary<string, ushort>();
for (ushort id = 1; id < strings.specieslist.Length; id++)
    speciesByName.TryAdd(Key(strings.specieslist[id]), id);

var species = new StringBuilder("# unbound\tnational\tform\tgender\tgrowth\thp\tatk\tdef\tspe\tspa\tspd\ttype1\ttype2\tability1\tability2\thidden\n");
foreach (var (id, name) in speciesNames.OrderBy(p => p.Key))
{
    if (id == 0)
        continue;
    var token = constants.GetValueOrDefault(id.ToString(CultureInfo.InvariantCulture), "").Replace("SPECIES_", "");
    var (national, form) = ResolveSpecies(id, token, name);
    var key = id.ToString(CultureInfo.InvariantCulture);
    var stats = baseStats[key];
    var t = types[key];
    var a = abilitySlots[key];
    species.AppendLine(string.Join('\t',
        id, national, form,
        identity[key].GetProperty("gender_threshold").GetInt32(),
        growth[key].GetProperty("growth_rate").GetInt32(),
        stats.GetProperty("hp").GetInt32(), stats.GetProperty("atk").GetInt32(), stats.GetProperty("def").GetInt32(),
        stats.GetProperty("spe").GetInt32(), stats.GetProperty("spa").GetInt32(), stats.GetProperty("spd").GetInt32(),
        Type(t.GetProperty("type1").GetString()!), Type(t.GetProperty("type2").GetString()!),
        abilities.Get(a.GetProperty("ability_1_id").GetInt32()),
        abilities.Get(a.GetProperty("ability_2_id").GetInt32()),
        abilities.Get(a.GetProperty("hidden_ability_id").GetInt32())));
}

Directory.CreateDirectory(output);
File.WriteAllText(Path.Combine(output, "species.tsv"), species.ToString());
File.WriteAllText(Path.Combine(output, "moves.tsv"), moves.Table("pp", movePp));
// Pocket: 0 items, 1 balls, 2 TMs and HMs, 3 berries, 4 key items.
var pockets = JsonDocument.Parse(File.ReadAllText(Path.Combine(source, "item_pocket_map.json"))).RootElement.GetProperty("pockets");
var pocketOf = new Dictionary<int, int>();
foreach (var (name, code) in new[] { ("ball", 1), ("tm", 2), ("hm", 2), ("berry", 3), ("key", 4) })
{
    foreach (var id in pockets.GetProperty(name).GetProperty("ids").EnumerateArray())
        pocketOf[id.GetInt32()] = code;
}
File.WriteAllText(Path.Combine(output, "items.tsv"), items.Table("pocket", pocketOf));

foreach (var failure in failures)
    Console.Error.WriteLine(failure);
Console.WriteLine($"Unmapped: {moves.Unmapped.Count} moves, {items.Unmapped.Count} items, {abilities.Unmapped.Count} abilities, {failures.Count} species");
Console.WriteLine("Moves: " + string.Join(", ", moves.Unmapped));
Console.WriteLine("Abilities: " + string.Join(", ", abilities.Unmapped));
Console.WriteLine("Items: " + string.Join(", ", items.Unmapped));

(ushort National, byte Form) ResolveSpecies(int id, string token, string name)
{
    if (token is "" or "EGG" or "SHADOW_WARRIOR" or "ZYGARDE_CELL" or "ZYGARDE_CORE" || name.StartsWith('?') || id is >= 252 and <= 276)
        return (0, 0);
    if (SpeciesOverrides.TryGetValue(token, out var fixedForm))
        return fixedForm;

    var parts = token.Split('_');
    for (var take = parts.Length; take > 0; take--)
    {
        if (!speciesByName.TryGetValue(Key(string.Join("", parts[..take])), out var national))
            continue;
        var suffix = parts[take..];
        if (suffix.Length == 0)
            return (national, 0);
        var form = ResolveForm(national, suffix);
        if (form >= 0)
            return (national, (byte)form);
        // Unbound-only forms, such as Alolan Cubone, show as the base form.
        failures.Add($"{id} {token}: base form used for {string.Join('_', suffix)}");
        return (national, 0);
    }
    failures.Add($"{id} {token} ({name}): no species");
    return (0, 0);
}

int ResolveForm(ushort national, string[] suffix)
{
    var joined = string.Join(" ", suffix);
    // Gigantamax is battle-only; a female suffix is a gender unless PKHeX lists a female form.
    if (joined.EndsWith("GIGA"))
        return joined == "GIGA" ? 0 : ResolveForm(national, suffix[..^1]);
    var wanted = (Species)national switch
    {
        Species.Unown => joined switch { "EXCLAMATION" => "!", "QUESTION" => "?", _ => joined },
        Species.Pumpkaboo or Species.Gourgeist => joined switch { "XL" => "Super", "L" => "Large", "M" => "Average", _ => joined },
        Species.Minior => joined == "SHIELD" ? "M-Red" : "C-" + joined,
        Species.Oricorio => joined switch { "Y" => "Pom-Pom", "P" => "Pa'u", "S" => "Sensu", _ => joined },
        Species.Magearna => "Original",
        Species.Wishiwashi => "School",
        Species.Lycanroc => joined == "N" ? "Midnight" : joined,
        Species.Sinistea or Species.Polteageist => "Antique",
        Species.Xerneas => "Neutral",
        Species.Genesect => joined switch { "SHOCK" => "Electric", "BURN" => "Fire", "CHILL" => "Ice", _ => "Water" },
        Species.Alcremie => "Vanilla Cream",
        Species.Arceus or Species.Silvally when joined == "FIGHT" => "Fighting",
        _ => joined switch
        {
            "A" => "Alola", "G" => "Galar", "H" => "Hisui", "F" or "FEMALE" => "F", "M" => "M",
            "G ZEN" => "Galar-Zen", "RAPID" => "Rapid Strike", "PHAROAH" => "Pharaoh",
            _ => joined,
        },
    };
    foreach (var context in FormContexts)
    {
        var forms = FormConverter.GetFormList(national, strings.types, strings.forms, GameInfo.GenderSymbolASCII, context);
        for (var i = 0; i < forms.Length; i++)
        {
            if (Key(forms[i]) == Key(wanted) || wanted == "F" && Key(forms[i]) == "female")
                return i;
        }
        for (var i = 0; i < forms.Length; i++)
        {
            if (forms[i].Length > 2 && (Key(forms[i]).Contains(Key(wanted)) || Key(wanted).Contains(Key(forms[i]))))
                return i;
        }
    }
    return wanted == "F" ? 0 : -1;
}

Dictionary<int, int> ItemAliases(Dictionary<string, string> aliases)
{
    var unbound = ReadNames("items.txt");
    var result = new Dictionary<int, int>();
    foreach (var (id, name) in unbound)
    {
        if (aliases.TryGetValue(name, out var pkhexName) && Array.IndexOf(strings.itemlist, pkhexName) is > 0 and var pkhex)
            result[id] = pkhex;
    }
    return result;
}

byte Type(string name) => (byte)Array.FindIndex(strings.types, t => Key(t) == Key(name));

Dictionary<int, string> ReadNames(string file) =>
    File.ReadLines(Path.Combine(source, file))
        .Select(line => line.Split(':', 2))
        .ToDictionary(p => int.Parse(p[0], CultureInfo.InvariantCulture), p => p[1]);

T ReadJson<T>(string file) => JsonSerializer.Deserialize<T>(File.ReadAllText(Path.Combine(source, file)))!;

static string Key(string name)
{
    var builder = new StringBuilder(name.Length);
    foreach (var ch in name.Normalize(NormalizationForm.FormD))
    {
        if (ch == '♀') builder.Append('f');
        else if (ch == '♂') builder.Append('m');
        else if (char.IsAsciiLetterOrDigit(ch) || ch is '!' or '?') builder.Append(char.ToLowerInvariant(ch));
    }
    return builder.ToString();
}

// Reads "#define PREFIX_NAME value" lines as the UNBOUND build sees them; the first name for an id wins.
Dictionary<int, string> ReadConstants(string file, string prefix)
{
    var result = new Dictionary<int, string>();
    var active = new Stack<bool>();
    foreach (var raw in File.ReadLines(Path.Combine(constantsDir, file)))
    {
        var line = raw.Split("//")[0].Trim();
        var words = line.Split((char[])[' ', '\t'], StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0)
            continue;
        var enabled = active.All(a => a);
        switch (words[0])
        {
            case "#ifdef": active.Push(words[1] == "UNBOUND"); continue;
            case "#ifndef": active.Push(words[1] != "UNBOUND"); continue;
            case "#if": active.Push(false); continue;
            case "#else": active.Push(!active.Pop()); continue;
            case "#endif": active.Pop(); continue;
        }
        if (!enabled || words[0] != "#define" || words.Length < 3 || !words[1].StartsWith(prefix))
            continue;
        var value = words[2];
        if (value.StartsWith("0x") ? int.TryParse(value[2..], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var id) : int.TryParse(value, out id))
            result.TryAdd(id, words[1][prefix.Length..]);
    }
    return result;
}

IdBridge Bridge(Dictionary<int, string> names, Dictionary<int, string> tokens, IReadOnlyList<string> pkhex, Dictionary<int, int> overrides)
{
    var byName = new Dictionary<string, int>();
    for (var id = 1; id < pkhex.Count; id++)
        byName.TryAdd(Key(pkhex[id]), id);
    var bridge = new IdBridge(names);
    foreach (var (id, name) in names)
    {
        if (id > 0 && (overrides.TryGetValue(id, out var mapped) || byName.TryGetValue(Key(name), out mapped)
            || tokens.TryGetValue(id, out var token) && byName.TryGetValue(Key(token), out mapped)))
            bridge.Map[id] = mapped;
    }
    return bridge;
}

internal sealed class IdBridge(Dictionary<int, string> names)
{
    public Dictionary<int, int> Map { get; } = [];
    public List<string> Unmapped => names.Where(p => p.Key > 0 && !Map.ContainsKey(p.Key)).Select(p => $"{p.Key}:{p.Value}").ToList();
    public int Get(int id) => Map.GetValueOrDefault(id);

    public string Table(string? extraName, Dictionary<int, int>? extra)
    {
        var builder = new StringBuilder($"# unbound\tpkhex\tname{(extraName is null ? "" : "\t" + extraName)}\n");
        foreach (var (id, name) in names.OrderBy(p => p.Key).Where(p => p.Key > 0))
            builder.AppendLine($"{id}\t{Get(id)}\t{name}{(extra is null ? "" : "\t" + extra.GetValueOrDefault(id))}");
        return builder.ToString();
    }
}
