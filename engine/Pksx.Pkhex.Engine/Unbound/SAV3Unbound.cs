using PKHeX.Core;
using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

// Pokémon Unbound 2.1.x: a FireRed save with CFRU's 25 compressed boxes spread over spare sector space.
public sealed class SAV3Unbound : SaveFile, IBoxDetailName
{
    private const int SectorSize = 0x1000;
    private const int SlotSize = 14 * SectorSize;
    private const int DataSize = 0xFF0;
    private const int BoxCountUnbound = 25;
    private const int BoxBytes = 30 * PK3Unbound.SizeStored;
    private const int BoxNameLength = 9;

    // Box data in order: (section in the live slot, or physical sector when >= 30, start, end).
    private static readonly (int Section, int Start, int End)[] BoxRegions =
    [
        (5, 4, DataSize), (6, 0, DataSize), (7, 0, DataSize), (8, 0, DataSize), (9, 0, DataSize),
        (10, 0, DataSize), (11, 0, DataSize), (12, 0, DataSize), (13, 0, 0x1A8),
        (30, 0xB0C, DataSize), (31, 0, 0xF80),
        (2, 0xF18, DataSize), (3, 0, 0xCC0),
        (0, 0xB0, 0xB0 + BoxBytes),
    ];

    private readonly int[] sectionOffsets = new int[14];
    private readonly byte[] storage = new byte[BoxCountUnbound * BoxBytes];

    public SAV3Unbound(Memory<byte> data) : base(data)
    {
        var live = LiveSlot(data.Span) ?? throw new InvalidDataException("Neither save slot in this Pokémon Unbound Save File is intact.");
        for (var sector = 0; sector < 14; sector++)
            sectionOffsets[ReadUInt16LittleEndian(data.Span[(live + (sector * SectorSize) + 0xFF4)..])] = live + (sector * SectorSize);

        var cursor = 0;
        foreach (var region in BoxRegions)
        {
            Region(region).CopyTo(storage.AsSpan(cursor));
            cursor += region.End - region.Start;
        }
    }

    // Like the game, load the newer slot whose 14 sections all carry the signature and a valid checksum.
    private static int? LiveSlot(ReadOnlySpan<byte> data)
    {
        uint? first = SlotCounter(data, 0), second = SlotCounter(data, SlotSize);
        if (first is null || second is null)
            return first is not null ? 0 : second is not null ? SlotSize : null;
        var wrapped = first == uint.MaxValue && second == 0;
        return wrapped || (second > first && !(second == uint.MaxValue && first == 0)) ? SlotSize : 0;
    }

    private static uint? SlotCounter(ReadOnlySpan<byte> data, int slot)
    {
        var seen = 0;
        for (var sector = 0; sector < 14; sector++)
        {
            var span = data.Slice(slot + (sector * SectorSize), SectorSize);
            var id = ReadUInt16LittleEndian(span[0xFF4..]);
            if (id >= 14 || ReadUInt32LittleEndian(span[0xFF8..]) != UnboundSave.Signature || ReadUInt16LittleEndian(span[0xFF6..]) != Checksum(id, span))
                return null;
            seen |= 1 << id;
        }
        return seen == 0x3FFF ? ReadUInt32LittleEndian(data[(slot + 0xFFC)..]) : null;
    }

    private Span<byte> Section(int id) => Data.Slice(sectionOffsets[id], SectorSize);

    private Span<byte> Region((int Section, int Start, int End) region)
    {
        var sector = region.Section >= 30 ? Data.Slice(region.Section * SectorSize, SectorSize) : Section(region.Section);
        return sector[region.Start..region.End];
    }

    protected override Memory<byte> GetFinalData()
    {
        var cursor = 0;
        foreach (var region in BoxRegions)
        {
            var length = region.End - region.Start;
            storage.AsSpan(cursor, length).CopyTo(Region(region));
            cursor += length;
        }
        return base.GetFinalData();
    }

    protected override void SetChecksums()
    {
        for (var id = 0; id < 14; id++)
            WriteUInt16LittleEndian(Section(id)[0xFF6..], Checksum(id, Section(id)));
    }

    private static ushort Checksum(int id, ReadOnlySpan<byte> section) =>
        Checksums.CheckSum32(section[..(id switch { 0 => 0xF24, 4 => 0xD98, 13 => 0x450, _ => DataSize })]);

    public override bool ChecksumsValid => Enumerable.Range(0, 14).All(id => ReadUInt16LittleEndian(Section(id)[0xFF6..]) == Checksum(id, Section(id)));
    public override string ChecksumInfo => ChecksumsValid ? "Checksums are valid." : "One or more section checksums are invalid.";

    protected override SaveFile CloneInternal() => new SAV3Unbound(GetFinalData().ToArray());
    protected override string ShortSummary => $"{OT} ({Version}) - {PlayTimeString}";
    public override string Extension => ".sav";
    public override GameVersion Version { get => GameVersion.FR; set { } }
    public override byte Generation => 3;
    public override EntityContext Context => EntityContext.Gen8;
    public override IPersonalTable Personal => PersonalTableUnbound.Instance;
    public override Type PKMType => typeof(PK3Unbound);
    public override PKM BlankPKM => new PK3Unbound();
    public override int SIZE_STORED => PK3Unbound.SizeStored;
    public override int SIZE_PARTY => PK3Unbound.SizeParty;
    public override int MaxEV => 255;
    public override ReadOnlySpan<ushort> HeldItems => UnboundTables.HeldItems;
    public override int MaxStringLengthTrainer => PK3Unbound.TrainerNameLength;
    public override int MaxStringLengthNickname => PK3Unbound.NicknameLength;
    public override ushort MaxMoveID => PK3Unbound.LastMove;
    public override ushort MaxSpeciesID => PK3Unbound.LastSpecies;
    public override int MaxAbilityID => PK3Unbound.LastAbility;
    public override int MaxItemID => PK3Unbound.LastItem;
    public override int MaxBallID => (int)Ball.Beast;
    public override GameVersion MaxGameID => GameVersion.CXD;
    public override int BoxCount => BoxCountUnbound;

    protected override Span<byte> BoxBuffer => storage;
    protected override Span<byte> PartyBuffer => Section(1)[0x38..(0x38 + (6 * PK3Unbound.SizeParty))];
    public override int GetBoxOffset(int box) => box * BoxBytes;
    public override int GetPartyOffset(int slot) => slot * PK3Unbound.SizeParty;
    public override bool HasParty => true;
    public override bool HasBox => true;
    // PKHeX asks only about box storage here, with spans longer than one record.
    public override bool IsPKMPresent(ReadOnlySpan<byte> data) => ReadUInt16LittleEndian(data[0x1C..]) != 0;

    public override int PartyCount
    {
        get => Math.Min((int)Section(1)[0x34], 6);
        protected set => Section(1)[0x34] = (byte)value;
    }

    protected override PKM GetPKM(Memory<byte> data) =>
        data.Length >= PK3Unbound.SizeParty ? PK3Unbound.FromParty(data.Span) : PK3Unbound.FromStored(data.Span);

    protected override void DecryptPKM(Span<byte> data) { }

    protected override void SetPartyValues(PKM pk, bool isParty)
    {
        // Empty party slots stay zeroed, as the game writes them.
        if (isParty && pk.Species != 0 && !pk.PartyStatsPresent)
            pk.ResetPartyStats();
    }

    public override string OT
    {
        get => GetString(Section(0)[..8]);
        set => SetString(Section(0)[..8], value, 7, StringConverterOption.ClearFF);
    }

    public override byte Gender { get => Section(0)[8]; set => Section(0)[8] = value; }
    public override uint ID32 { get => ReadUInt32LittleEndian(Section(0)[0x0A..]); set => WriteUInt32LittleEndian(Section(0)[0x0A..], value); }
    public override ushort TID16 { get => ReadUInt16LittleEndian(Section(0)[0x0A..]); set => WriteUInt16LittleEndian(Section(0)[0x0A..], value); }
    public override ushort SID16 { get => ReadUInt16LittleEndian(Section(0)[0x0C..]); set => WriteUInt16LittleEndian(Section(0)[0x0C..], value); }
    public override int PlayedHours { get => ReadUInt16LittleEndian(Section(0)[0x0E..]); set => WriteUInt16LittleEndian(Section(0)[0x0E..], (ushort)value); }
    public override int PlayedMinutes { get => Section(0)[0x10]; set => Section(0)[0x10] = (byte)value; }
    public override int PlayedSeconds { get => Section(0)[0x11]; set => Section(0)[0x11] = (byte)value; }
    private uint SecurityKey => ReadUInt32LittleEndian(Section(0)[0xF20..]);
    public override uint Money { get => ReadUInt32LittleEndian(Section(1)[0x290..]) ^ SecurityKey; set => WriteUInt32LittleEndian(Section(1)[0x290..], value ^ SecurityKey); }
    public override int CurrentBox { get => Section(5)[0]; set => Section(5)[0] = (byte)value; }

    public override PlayerBag Inventory => new UnboundBag(this);

    // CFRU's bag (ram_locs.h): Items span section 13 and sector 30; the other pockets sit in sector 30.
    private (int Offset, int Length)[] PocketRegions(InventoryType type) => type switch
    {
        InventoryType.Items => [(sectionOffsets[13] + 0xAD8, DataSize - 0xAD8), (0x1E000, 0x1F0)],
        InventoryType.KeyItems => [(0x1E1F0, 75 * 4)],
        InventoryType.Balls => [(0x1E31C, 50 * 4)],
        InventoryType.TMHMs => [(0x1E3E4, 128 * 4)],
        _ => [(0x1E5E4, 75 * 4)],
    };

    internal byte[] ReadPocket(InventoryType type) =>
        [.. PocketRegions(type).SelectMany(region => Data.Slice(region.Offset, region.Length).ToArray())];

    internal void WritePocket(InventoryType type, ReadOnlySpan<byte> pocket)
    {
        foreach (var (offset, length) in PocketRegions(type))
        {
            pocket[..length].CopyTo(Data.Slice(offset, length));
            pocket = pocket[length..];
        }
    }

    // CFRU keeps names for boxes 1-14 forward from 0x3C4 and boxes 15-25 backward below it.
    private Span<byte> BoxNameSpan(int box) =>
        Section(13).Slice(0x3C4 + ((box < 14 ? box : 13 - box) * BoxNameLength), BoxNameLength);

    public string GetBoxName(int box) => GetString(BoxNameSpan(box));

    public void SetBoxName(int box, ReadOnlySpan<char> value) =>
        SetString(BoxNameSpan(box), value, BoxNameLength - 1, StringConverterOption.ClearFF);

    public override string GetString(ReadOnlySpan<byte> data) => StringConverter3.GetString(data, (int)LanguageID.English);
    public override int LoadString(ReadOnlySpan<byte> data, Span<char> result) => StringConverter3.LoadString(data, result, (int)LanguageID.English);
    public override int SetString(Span<byte> destBuffer, ReadOnlySpan<char> value, int maxLength, StringConverterOption option) =>
        StringConverter3.SetString(destBuffer, value, maxLength, (int)LanguageID.English, option);
}

internal sealed class PersonalTableUnbound : IPersonalTable
{
    public static readonly PersonalTableUnbound Instance = new();

    public ushort MaxSpeciesID => (ushort)Species.Enamorus;
    public int Count => UnboundTables.Species.Length;
    public PersonalInfo this[int index] => UnboundTables.GetSpecies((ushort)index).Personal;
    public PersonalInfo this[ushort species, byte form] => GetFormEntry(species, form);
    public int GetFormIndex(ushort species, byte form) => UnboundTables.GetSpeciesId(species, form) is var id && id != 0 ? id : UnboundTables.GetSpeciesId(species, 0);
    public PersonalInfo GetFormEntry(ushort species, byte form) => this[GetFormIndex(species, form)];
    public bool IsSpeciesInGame(ushort species) => UnboundTables.GetSpeciesId(species, 0) != 0;
    public bool IsPresentInGame(ushort species, byte form) => UnboundTables.GetSpeciesId(species, form) != 0;
}
