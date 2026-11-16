using PKHeX.Core;
using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

// CFRU's bag: Items in section 13 at 0xAD8; Balls, TMs and Berries in the shared sector 30. Slots are (item u16, count u16).
public sealed class UnboundBag : PlayerBag
{
    private const int MaxQuantity = 999;
    private readonly SAV3Unbound save;
    private readonly UnboundPouch[] pouches;

    public UnboundBag(SAV3Unbound save)
    {
        this.save = save;
        pouches = [.. new[] { InventoryType.Items, InventoryType.Balls, InventoryType.TMHMs, InventoryType.Berries }
            .Select(type => new UnboundPouch(type, save.GetPocket(type).Length / 4))];
        foreach (var pouch in pouches)
            pouch.GetPouch(save.GetPocket(pouch.Type));
    }

    public override IReadOnlyList<InventoryPouch> Pouches => pouches;
    public override IItemStorage Info => UnboundItemStorage.Instance;

    public override void CopyTo(SaveFile sav)
    {
        foreach (var pouch in pouches)
            pouch.SetPouch(save.GetPocket(pouch.Type));
    }

    private sealed class UnboundPouch(InventoryType type, int capacity)
        : InventoryPouch(type, UnboundItemStorage.Instance, MaxQuantity, 0, capacity)
    {
        private InventoryItem[] items = [];
        // Items with no PKHeX id, such as Unbound key items, stay in the pocket untouched.
        private readonly List<(ushort Id, ushort Count)> unmapped = [];

        public override InventoryItem[] Items => items;

        public override void GetPouch(ReadOnlySpan<byte> data)
        {
            var read = new List<InventoryItem>(capacity);
            unmapped.Clear();
            for (var slot = 0; slot < capacity; slot++)
            {
                var id = ReadUInt16LittleEndian(data[(slot * 4)..]);
                var count = ReadUInt16LittleEndian(data[(slot * 4 + 2)..]);
                if (id == 0)
                    break;
                var pkhex = UnboundTables.Items.ToPkhex(id);
                if (pkhex == 0)
                    unmapped.Add((id, count));
                else
                    read.Add(GetEmpty(pkhex, count));
            }
            while (read.Count < capacity - unmapped.Count)
                read.Add(GetEmpty());
            items = [.. read];
        }

        public override void SetPouch(Span<byte> data)
        {
            var slot = 0;
            foreach (var item in items.Where(item => item.Index > 0 && item.Count > 0))
                WriteSlot(data, slot++, (ushort)UnboundTables.Items.FromPkhex(item.Index), (ushort)item.Count);
            foreach (var (id, count) in unmapped)
                WriteSlot(data, slot++, id, count);
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
        [InventoryType.Balls] = ItemsIn(1),
        [InventoryType.TMHMs] = ItemsIn(2),
        [InventoryType.Berries] = ItemsIn(3),
    };

    private static ushort[] ItemsIn(int pocket) =>
        [.. UnboundTables.Items.PkhexIds.Where(id => UnboundTables.Items.Extra(UnboundTables.Items.FromPkhex(id)) == pocket).Order()];

    public bool IsLegal(InventoryType type, int itemIndex, int itemCount) => GetItems(type).Contains((ushort)itemIndex);

    public ReadOnlySpan<ushort> GetItems(InventoryType type) => ItemsByPouch.TryGetValue(type, out var items) ? items : [];
}
