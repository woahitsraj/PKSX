using System.Globalization;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine.Unbound;

// Unbound 2.1.1.1 ids bridged to PKHeX ids. Built by scripts/data/unbound-tables.
internal static class UnboundTables
{
    public static readonly UnboundSpecies[] Species = LoadSpecies();
    public static readonly IdTable Moves = new("moves");
    // Unbound-only items take ids above every PKHeX item id: this base plus the Unbound id.
    public const int OwnItemBase = 10000;
    public static readonly IdTable Items = new("items", OwnItemBase);

    private static readonly Dictionary<(ushort, byte), ushort> SpeciesByNational = Species
        .Where(s => s.National != 0)
        .GroupBy(s => (s.National, s.Form))
        .ToDictionary(g => g.Key, g => g.First().Id);

    // Unbound-only key items and HMs cannot be held.
    public static readonly ushort[] HeldItems = [.. Items.PkhexIds.Where(id => id < OwnItemBase || Items.Extra(id - OwnItemBase) == 0).Order()];

    private static (IReadOnlyList<string> Pkhex, string[] Names) itemNames = ([], []);

    // PKHeX's item names, plus the Unbound names of Unbound-only items.
    public static IReadOnlyList<string> ItemNames(IReadOnlyList<string> pkhex)
    {
        if (!ReferenceEquals(itemNames.Pkhex, pkhex))
        {
            var names = new string[PK3Unbound.LastItem + 1];
            Array.Fill(names, "");
            for (var id = 0; id < pkhex.Count && id < OwnItemBase; id++)
                names[id] = pkhex[id];
            foreach (var (id, name) in Items.OwnNames)
                names[id] = name;
            itemNames = (pkhex, names);
        }
        return itemNames.Names;
    }

    // A held mail needs a message record that PKSX does not write.
    public static bool IsMail(int item) => item - OwnItemBase is >= 121 and <= 132;

    public static UnboundSpecies GetSpecies(ushort id) => id < Species.Length ? Species[id] : Species[0];

    public static ushort GetSpeciesId(ushort national, byte form) =>
        SpeciesByNational.GetValueOrDefault((national, form));

    public static byte GetPp(ushort move) => (byte)Moves.Extra(move);

    private static UnboundSpecies[] LoadSpecies()
    {
        var rows = ReadRows("species");
        var result = new UnboundSpecies[rows.Max(r => r[0]) + 1];
        for (var i = 0; i < result.Length; i++)
            result[i] = new UnboundSpecies((ushort)i, 0, 0, new PersonalInfoUnbound([]));
        foreach (var r in rows)
            result[r[0]] = new UnboundSpecies((ushort)r[0], (ushort)r[1], (byte)r[2], new PersonalInfoUnbound(r));
        return result;
    }

    private static List<int[]> ReadRows(string name) =>
        ReadLines(name).Select(r => r.Select(v => int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : 0).ToArray()).ToList();

    internal static List<string[]> ReadLines(string name)
    {
        using var stream = typeof(UnboundTables).Assembly.GetManifestResourceStream($"Unbound.{name}.tsv")
            ?? throw new InvalidOperationException($"Missing Unbound table {name}.");
        using var reader = new StreamReader(stream);
        var rows = new List<string[]>();
        while (reader.ReadLine() is { } line)
        {
            if (line.Length > 0 && line[0] != '#')
                rows.Add(line.Split('\t'));
        }
        return rows;
    }
}

internal sealed record UnboundSpecies(ushort Id, ushort National, byte Form, PersonalInfoUnbound Personal);

// Rows are: Unbound id, PKHeX id, Unbound name, then an optional number.
internal sealed class IdTable
{
    private readonly Dictionary<int, int> toPkhex = [];
    private readonly Dictionary<int, int> fromPkhex = [];
    private readonly Dictionary<int, int> extra = [];
    private readonly Dictionary<int, string> ownNames = [];

    public IdTable(string name, int ownBase = 0)
    {
        foreach (var line in UnboundTables.ReadLines(name))
        {
            var id = int.Parse(line[0], CultureInfo.InvariantCulture);
            var pkhex = int.Parse(line[1], CultureInfo.InvariantCulture);
            extra[id] = line.Length > 3 ? int.Parse(line[3], CultureInfo.InvariantCulture) : 0;
            if (pkhex == 0)
            {
                if (ownBase == 0 || line[2] == "unknown")
                    continue;
                pkhex = ownBase + id;
                ownNames[pkhex] = line[2];
            }
            toPkhex[id] = pkhex;
            fromPkhex.TryAdd(pkhex, id);
        }
    }

    public IEnumerable<ushort> PkhexIds => fromPkhex.Keys.Select(id => (ushort)id);
    public IEnumerable<int> MappedIds => toPkhex.Keys;
    public IReadOnlyDictionary<int, string> OwnNames => ownNames;

    public bool HasPkhex(int id) => fromPkhex.ContainsKey(id);

    public int FromPkhex(int id) =>
        id == 0 ? 0 : fromPkhex.TryGetValue(id, out var unbound) ? unbound : throw new ArgumentException($"Pokémon Unbound has no id for {id}.");

    public int ToPkhex(int id) => toPkhex.GetValueOrDefault(id);
    public int Extra(int id) => extra.GetValueOrDefault(id);
}
