using PKHeX.Core;
using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

// CFRU's bag pockets; each slot is (Unbound item u16, count u16).
public sealed class UnboundBag : PlayerBag
{
    private const int MaxQuantity = 999;
    private readonly SAV3Unbound save;
    private readonly UnboundPouch[] pouches;

    public UnboundBag(SAV3Unbound save)
    {
        this.save = save;
        pouches = [.. new[] { InventoryType.Items, InventoryType.KeyItems, InventoryType.Balls, InventoryType.TMHMs, InventoryType.Berries }
            .Select(type => new UnboundPouch(type, save.ReadPocket(type).Length / 4))];
        foreach (var pouch in pouches)
            pouch.GetPouch(save.ReadPocket(pouch.Type));
    }

    public override IReadOnlyList<InventoryPouch> Pouches => pouches;
    public override IItemStorage Info => UnboundItemStorage.Instance;

    public override void CopyTo(SaveFile sav)
    {
        foreach (var pouch in pouches)
        {
            var data = save.ReadPocket(pouch.Type);
            pouch.SetPouch(data);
            save.WritePocket(pouch.Type, data);
        }
    }

    private sealed class UnboundPouch(InventoryType type, int capacity)
        : InventoryPouch(type, UnboundItemStorage.Instance, MaxQuantity, 0, capacity)
    {
        private InventoryItem[] items = [];
        // Saved slots in order; unmapped ones (Item null) and shared PKHeX ids keep their raw Unbound id and place.
        private readonly List<(InventoryItem? Item, ushort Raw, ushort Count)> saved = [];

        public override InventoryItem[] Items => items;

        public override void GetPouch(ReadOnlySpan<byte> data)
        {
            saved.Clear();
            var mapped = new List<InventoryItem>(capacity);
            for (var slot = 0; slot < capacity; slot++)
            {
                var raw = ReadUInt16LittleEndian(data[(slot * 4)..]);
                var count = ReadUInt16LittleEndian(data[(slot * 4 + 2)..]);
                if (raw == 0)
                    break;
                var pkhex = UnboundTables.Items.ToPkhex(raw);
                var item = pkhex == 0 ? null : GetEmpty(pkhex, count);
                saved.Add((item, raw, count));
                if (item is not null)
                    mapped.Add(item);
            }
            var unmapped = saved.Count - mapped.Count;
            while (mapped.Count < capacity - unmapped)
                mapped.Add(GetEmpty());
            items = [.. mapped];
        }

        public override void SetPouch(Span<byte> data)
        {
            var written = new HashSet<InventoryItem>(ReferenceEqualityComparer.Instance);
            var slot = 0;
            foreach (var (item, raw, count) in saved)
            {
                if (item is null)
                {
                    WriteSlot(data, slot++, raw, count);
                }
                else if (item.Index > 0 && item.Count > 0 && items.Contains(item, ReferenceEqualityComparer.Instance))
                {
                    var id = UnboundTables.Items.ToPkhex(raw) == item.Index ? raw : (ushort)UnboundTables.Items.FromPkhex(item.Index);
                    WriteSlot(data, slot++, id, (ushort)item.Count);
                    written.Add(item);
                }
            }
            foreach (var item in items.Where(item => item.Index > 0 && item.Count > 0 && !written.Contains(item)))
                WriteSlot(data, slot++, (ushort)UnboundTables.Items.FromPkhex(item.Index), (ushort)item.Count);
            data[(slot * 4)..(capacity * 4)].Clear();
        }

        private static void WriteSlot(Span<byte> data, int slot, ushort id, ushort count)
        {
            WriteUInt16LittleEndian(data[(slot * 4)..], id);
            WriteUInt16LittleEndian(data[(slot * 4 + 2)..], count);
        }

        public override InventoryItem GetEmpty(int itemID = 0, int count = 0) => new() { Index = itemID, Count = count };
    }
}

internal sealed class UnboundItemStorage : IItemStorage
{
    public static readonly UnboundItemStorage Instance = new();

    private static readonly Dictionary<InventoryType, ushort[]> ItemsByPouch = new()
    {
        [InventoryType.Items] = ItemsIn(0),
        [InventoryType.KeyItems] = ItemsIn(4),
        [InventoryType.Balls] = ItemsIn(1),
        [InventoryType.TMHMs] = ItemsIn(2),
        [InventoryType.Berries] = ItemsIn(3),
    };

    private static ushort[] ItemsIn(int pocket) =>
        [.. UnboundTables.Items.PkhexIds.Where(id => UnboundTables.Items.Extra(UnboundTables.Items.FromPkhex(id)) == pocket).Order()];

    public bool IsLegal(InventoryType type, int itemIndex, int itemCount) => GetItems(type).Contains((ushort)itemIndex);

    public ReadOnlySpan<ushort> GetItems(InventoryType type) => ItemsByPouch.TryGetValue(type, out var items) ? items : [];
}
