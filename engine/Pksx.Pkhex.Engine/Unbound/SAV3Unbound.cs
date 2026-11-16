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
        var span = data.Span;
        var live = ReadUInt32LittleEndian(span[(SlotSize + 0xFFC)..]) > ReadUInt32LittleEndian(span[0xFFC..]) ? SlotSize : 0;
        for (var sector = 0; sector < 14; sector++)
        {
            var offset = live + (sector * SectorSize);
            var id = ReadUInt16LittleEndian(span[(offset + 0xFF4)..]);
            if (id < 14)
                sectionOffsets[id] = offset;
        }

        var cursor = 0;
        foreach (var region in BoxRegions)
        {
            Region(region).CopyTo(storage.AsSpan(cursor));
            cursor += region.End - region.Start;
        }
    }

    public static bool IsUnbound(ReadOnlySpan<byte> data) => UnboundSave.IsUnbound(data);

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
            WriteUInt16LittleEndian(Section(id)[0xFF6..], Checksum(id));
    }

    private ushort Checksum(int id)
    {
        var length = id switch { 0 => 0xF24, 4 => 0xD98, 13 => 0x450, _ => DataSize };
        return Checksums.CheckSum32(Section(id)[..length]);
    }

    public override bool ChecksumsValid => Enumerable.Range(0, 14).All(id => ReadUInt16LittleEndian(Section(id)[0xFF6..]) == Checksum(id));
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
    public override int MaxStringLengthTrainer => 7;
    public override int MaxStringLengthNickname => 10;
    public override ushort MaxMoveID => 826;
    public override ushort MaxSpeciesID => (ushort)Species.Enamorus;
    public override int MaxAbilityID => 267;
    public override int MaxItemID => 1607;
    public override int MaxBallID => (int)Ball.Beast;
    public override GameVersion MaxGameID => GameVersion.CXD;
    public override int BoxCount => BoxCountUnbound;

    protected override Span<byte> BoxBuffer => storage;
    protected override Span<byte> PartyBuffer => Section(1)[0x38..(0x38 + (6 * PK3Unbound.SizeParty))];
    public override int GetBoxOffset(int box) => box * BoxBytes;
    public override int GetPartyOffset(int slot) => slot * PK3Unbound.SizeParty;
    public override bool IsPKMPresent(ReadOnlySpan<byte> data) => ReadUInt16LittleEndian(data[(data.Length >= PK3Unbound.SizeParty ? 0x20 : 0x1C)..]) != 0;

    public override int PartyCount
    {
        get => Section(1)[0x34];
        protected set => Section(1)[0x34] = (byte)value;
    }

    protected override PKM GetPKM(Memory<byte> data) =>
        data.Length >= PK3Unbound.SizeParty ? PK3Unbound.FromParty(data.Span) : PK3Unbound.FromStored(data.Span);

    protected override void DecryptPKM(Span<byte> data) { }

    protected override void SetPartyValues(PKM pk, bool isParty)
    {
        if (!isParty || pk.PartyStatsPresent)
            return;
        pk.ResetPartyStats();
        pk.HealPP();
    }

    public override string OT
    {
        get => GetString(Section(0)[..7]);
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

    public string GetBoxName(int box) => GetString(Section(13).Slice(0x361 + (box * BoxNameLength), BoxNameLength));

    public void SetBoxName(int box, ReadOnlySpan<char> value) =>
        SetString(Section(13).Slice(0x361 + (box * BoxNameLength), BoxNameLength), value, BoxNameLength - 1, StringConverterOption.ClearFF);

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
