using PKHeX.Core;
using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

// A CFRU Pokémon in the unencrypted 100-byte party layout; boxes keep a 58-byte copy and ids read as PKHeX ids.
public sealed class PK3Unbound : PKM
{
    public const int SizeParty = 100;
    public const int SizeStored = 58;
    private const int HeaderSize = 0x1C;
    public const int NicknameLength = 10;
    public const int TrainerNameLength = 7;
    public static readonly ushort LastMove = UnboundTables.Moves.PkhexIds.Max();
    public static readonly int LastItem = UnboundTables.Items.PkhexIds.Max();
    // As One (Glastrier) is the last ability Unbound maps.
    public const int LastAbility = 267;
    public const ushort LastSpecies = (ushort)PKHeX.Core.Species.Enamorus;

    public PK3Unbound() : base(SizeParty) { }

    private PK3Unbound(byte[] party) : base(party) { }

    public static PK3Unbound FromStored(ReadOnlySpan<byte> stored)
    {
        var party = new byte[SizeParty];
        stored[..HeaderSize].CopyTo(party);
        stored.Slice(HeaderSize, 11).CopyTo(party.AsSpan(0x20));
        var moves = ReadUInt64LittleEndian([.. stored.Slice(0x27, 5), 0, 0, 0]);
        for (var i = 0; i < 4; i++)
            WriteUInt16LittleEndian(party.AsSpan(0x2C + (i * 2)), (ushort)((moves >> (10 * i)) & 0x3FF));
        stored.Slice(0x2C, 6).CopyTo(party.AsSpan(0x38));
        stored.Slice(0x32, 8).CopyTo(party.AsSpan(0x44));
        var pokemon = new PK3Unbound(party);
        pokemon.RestorePp();
        return pokemon;
    }

    public static PK3Unbound FromParty(ReadOnlySpan<byte> party) => new(party[..SizeParty].ToArray());

    public void WriteStored(Span<byte> stored)
    {
        Data[..HeaderSize].CopyTo(stored);
        Data.Slice(0x20, 11).CopyTo(stored[HeaderSize..]);
        ulong moves = 0;
        for (var i = 0; i < 4; i++)
            moves |= (ulong)(ReadUInt16LittleEndian(Data[(0x2C + (i * 2))..]) & 0x3FF) << (10 * i);
        Span<byte> packed = stackalloc byte[8];
        WriteUInt64LittleEndian(packed, moves);
        packed[..5].CopyTo(stored[0x27..]);
        Data.Slice(0x38, 6).CopyTo(stored[0x2C..]);
        Data.Slice(0x44, 8).CopyTo(stored[0x32..]);
    }

    public override int WriteDecryptedDataStored(Span<byte> destination)
    {
        WriteStored(destination);
        return SizeStored;
    }

    public override void WriteDecryptedDataParty(Span<byte> destination) => Data.CopyTo(destination);
    public override void WriteEncryptedDataStored(Span<byte> destination) => WriteStored(destination);
    public override void WriteEncryptedDataParty(Span<byte> destination) => Data.CopyTo(destination);
    protected override void EncryptStored(Span<byte> stored) { }
    protected override void EncryptParty(Span<byte> party) { }
    public override void RefreshChecksum() { }
    public override bool ChecksumValid => true;
    public override PKM Clone() => new PK3Unbound(Data.ToArray());

    public override int SIZE_PARTY => SizeParty;
    public override int SIZE_STORED => SizeStored;
    public override EntityContext Context => EntityContext.Gen8;
    public ushort UnboundSpeciesId { get => ReadUInt16LittleEndian(Data[0x20..]); set => WriteUInt16LittleEndian(Data[0x20..], value); }
    private UnboundSpecies Entry => UnboundTables.GetSpecies(UnboundSpeciesId);
    public override PersonalInfo PersonalInfo => Entry.Personal;

    public override uint PID { get => ReadUInt32LittleEndian(Data); set => WriteUInt32LittleEndian(Data, value); }
    public override uint EncryptionConstant { get => PID; set { } }
    public override uint ID32 { get => ReadUInt32LittleEndian(Data[0x04..]); set => WriteUInt32LittleEndian(Data[0x04..], value); }
    public override ushort TID16 { get => ReadUInt16LittleEndian(Data[0x04..]); set => WriteUInt16LittleEndian(Data[0x04..], value); }
    public override ushort SID16 { get => ReadUInt16LittleEndian(Data[0x06..]); set => WriteUInt16LittleEndian(Data[0x06..], value); }
    public override uint TSV => (uint)(TID16 ^ SID16) >> 4;
    public override uint PSV => ((PID >> 16) ^ (PID & 0xFFFF)) >> 4;
    // Unbound doubles the retail shiny odds.
    public override bool IsShiny => (TID16 ^ SID16 ^ (PID >> 16) ^ (PID & 0xFFFF)) < 16;

    public override Span<byte> NicknameTrash => Data.Slice(0x08, 10);
    public override Span<byte> OriginalTrainerTrash => Data.Slice(0x14, 7);
    public override int TrashCharCountNickname => 10;
    public override int TrashCharCountTrainer => 7;
    public override int MaxStringLengthNickname => NicknameLength;
    public override int MaxStringLengthTrainer => TrainerNameLength;
    public override string Nickname { get => GetString(NicknameTrash); set => SetString(NicknameTrash, value, 10, StringConverterOption.None); }
    public override string OriginalTrainerName { get => GetString(OriginalTrainerTrash); set => SetString(OriginalTrainerTrash, value, 7, StringConverterOption.None); }
    public override int Language { get => Data[0x12]; set => Data[0x12] = (byte)value; }

    public override bool IsNicknamed
    {
        get => Species != 0 && !string.Equals(Nickname, SpeciesName.GetSpeciesNameGeneration(Species, (int)LanguageID.English, 9), StringComparison.OrdinalIgnoreCase);
        set { }
    }

    private byte Sanity { get => Data[0x13]; set => Data[0x13] = value; }
    public override bool Valid { get => (Sanity & 0b011) == 0b010; set => Sanity = (byte)(value ? (Sanity & ~1) | 2 : Sanity & ~2); }

    public override ushort Species { get => Entry.National; set { } }
    public override byte Form { get => Entry.Form; set { } }
    // Setters write only on change, so ids PKHeX lacks or shares (Park Ball, a second Choice Band) survive edits.
    public override int HeldItem
    {
        get => UnboundTables.Items.ToPkhex(UnboundHeldItem);
        set
        {
            if (value != HeldItem)
                UnboundHeldItem = (ushort)UnboundTables.Items.FromPkhex(value);
        }
    }
    public ushort UnboundHeldItem { get => ReadUInt16LittleEndian(Data[0x22..]); set => WriteUInt16LittleEndian(Data[0x22..], value); }
    public override uint EXP { get => ReadUInt32LittleEndian(Data[0x24..]); set => WriteUInt32LittleEndian(Data[0x24..], value); }
    private byte PPUps { get => Data[0x28]; set => Data[0x28] = value; }
    public override int Move1_PPUps { get => PPUps & 3; set => PPUps = (byte)((PPUps & ~3) | (value & 3)); }
    public override int Move2_PPUps { get => (PPUps >> 2) & 3; set => PPUps = (byte)((PPUps & ~(3 << 2)) | ((value & 3) << 2)); }
    public override int Move3_PPUps { get => (PPUps >> 4) & 3; set => PPUps = (byte)((PPUps & ~(3 << 4)) | ((value & 3) << 4)); }
    public override int Move4_PPUps { get => (PPUps >> 6) & 3; set => PPUps = (byte)((PPUps & ~(3 << 6)) | ((value & 3) << 6)); }
    public override byte CurrentFriendship { get => Data[0x29]; set => Data[0x29] = value; }
    public override byte OriginalTrainerFriendship { get => Data[0x29]; set => Data[0x29] = value; }
    public byte UnboundBall { get => Data[0x2A]; set => Data[0x2A] = value; }
    public override byte Ball
    {
        get => UnboundBalls.ToPkhex(UnboundBall);
        set
        {
            if (value != Ball)
                UnboundBall = UnboundBalls.FromPkhex(value);
        }
    }

    public ushort GetUnboundMove(int index) => ReadUInt16LittleEndian(Data[(0x2C + (index * 2))..]);
    private ushort PkhexMove(int index) => (ushort)UnboundTables.Moves.ToPkhex(GetUnboundMove(index));
    private void SetPkhexMove(int index, ushort move)
    {
        if (move != PkhexMove(index))
            WriteUInt16LittleEndian(Data[(0x2C + (index * 2))..], (ushort)UnboundTables.Moves.FromPkhex(move));
    }
    public override ushort Move1 { get => PkhexMove(0); set => SetPkhexMove(0, value); }
    public override ushort Move2 { get => PkhexMove(1); set => SetPkhexMove(1, value); }
    public override ushort Move3 { get => PkhexMove(2); set => SetPkhexMove(2, value); }
    public override ushort Move4 { get => PkhexMove(3); set => SetPkhexMove(3, value); }

    public int GetUnboundMaxPp(ushort move, int ppUps)
    {
        var basePp = UnboundTables.GetPp((ushort)UnboundTables.Moves.FromPkhex(move));
        return basePp + (basePp * ppUps / 5);
    }
    public override int Move1_PP { get => Data[0x34]; set => Data[0x34] = (byte)value; }
    public override int Move2_PP { get => Data[0x35]; set => Data[0x35] = (byte)value; }
    public override int Move3_PP { get => Data[0x36]; set => Data[0x36] = (byte)value; }
    public override int Move4_PP { get => Data[0x37]; set => Data[0x37] = (byte)value; }

    // Boxes drop PP, and the game refills it from Unbound's move table.
    public void RestorePp()
    {
        for (var i = 0; i < 4; i++)
        {
            var basePp = UnboundTables.GetPp(GetUnboundMove(i));
            Data[0x34 + i] = (byte)(basePp + (basePp * ((PPUps >> (i * 2)) & 3) / 5));
        }
    }

    public override int EV_HP { get => Data[0x38]; set => Data[0x38] = (byte)value; }
    public override int EV_ATK { get => Data[0x39]; set => Data[0x39] = (byte)value; }
    public override int EV_DEF { get => Data[0x3A]; set => Data[0x3A] = (byte)value; }
    public override int EV_SPE { get => Data[0x3B]; set => Data[0x3B] = (byte)value; }
    public override int EV_SPA { get => Data[0x3C]; set => Data[0x3C] = (byte)value; }
    public override int EV_SPD { get => Data[0x3D]; set => Data[0x3D] = (byte)value; }

    private byte Pokerus { get => Data[0x44]; set => Data[0x44] = value; }
    public override int PokerusDays { get => Pokerus & 0xF; set => Pokerus = (byte)((Pokerus & ~0xF) | (value & 0xF)); }
    public override int PokerusStrain { get => Pokerus >> 4; set => Pokerus = (byte)((Pokerus & 0xF) | ((value & 0xF) << 4)); }
    public override ushort MetLocation { get => Data[0x45]; set => Data[0x45] = (byte)value; }
    private ushort MetInfo { get => ReadUInt16LittleEndian(Data[0x46..]); set => WriteUInt16LittleEndian(Data[0x46..], value); }
    public override byte MetLevel { get => (byte)(MetInfo & 0x7F); set => MetInfo = (ushort)((MetInfo & ~0x7F) | (value & 0x7F)); }
    public override GameVersion Version { get => (GameVersion)((MetInfo >> 7) & 0xF); set => MetInfo = (ushort)((MetInfo & ~0x780) | (((int)value & 0xF) << 7)); }
    public override byte OriginalTrainerGender { get => (byte)(MetInfo >> 15); set => MetInfo = (ushort)((MetInfo & 0x7FFF) | ((value & 1) << 15)); }

    private uint IV32 { get => ReadUInt32LittleEndian(Data[0x48..]); set => WriteUInt32LittleEndian(Data[0x48..], value); }
    private int ReadIV(int shift) => (int)(IV32 >> shift) & 0x1F;
    private void WriteIV(int shift, int value) => IV32 = (IV32 & ~(0x1Fu << shift)) | ((uint)Math.Clamp(value, 0, 31) << shift);
    public override int IV_HP { get => ReadIV(0); set => WriteIV(0, value); }
    public override int IV_ATK { get => ReadIV(5); set => WriteIV(5, value); }
    public override int IV_DEF { get => ReadIV(10); set => WriteIV(10, value); }
    public override int IV_SPE { get => ReadIV(15); set => WriteIV(15, value); }
    public override int IV_SPA { get => ReadIV(20); set => WriteIV(20, value); }
    public override int IV_SPD { get => ReadIV(25); set => WriteIV(25, value); }

    public override bool IsEgg
    {
        get => (IV32 & (1u << 30)) != 0;
        set
        {
            IV32 = value ? IV32 | (1u << 30) : IV32 & ~(1u << 30);
            Sanity = (byte)(value ? Sanity | 4 : Sanity & ~4);
        }
    }

    public bool HiddenAbility { get => (IV32 & (1u << 31)) != 0; set => IV32 = value ? IV32 | (1u << 31) : IV32 & ~(1u << 31); }
    public override int AbilityNumber
    {
        get => HiddenAbility ? 4 : 1 << (int)(PID & 1);
        set
        {
            HiddenAbility = value == 4;
            var slot = value == 2 ? 1u : 0u;
            if (!HiddenAbility && (PID & 1) != slot)
                RerollPid(Nature, slot);
        }
    }
    public override int Ability { get => PersonalInfo.GetAbilityAtIndex(HiddenAbility ? 2 : (int)(PID & 1)) is var a && a != 0 ? a : PersonalInfo.GetAbilityAtIndex(0); set { } }
    public override Nature Nature { get => (Nature)(PID % 25); set => RerollPid(value, PID & 1); }

    // Nature, ability slot, gender and shininess all come from the PID, so a new PID keeps the other three.
    private void RerollPid(Nature nature, uint abilitySlot)
    {
        var shiny = IsShiny;
        var gender = Gender;
        var ratio = PersonalInfo.Gender;
        var trainer = (uint)(TID16 ^ SID16);
        for (uint step = 0; step < 0x10000; step++)
        {
            var low = (PID + step) & 0xFFFF;
            if ((low & 1) != abilitySlot || EntityGender.GetFromPIDAndRatio(low, ratio) != gender)
                continue;
            for (uint candidate = 0; candidate < (shiny ? 16u : 0x10000u); candidate++)
            {
                var high = shiny ? trainer ^ low ^ candidate : ((PID >> 16) + candidate) & 0xFFFF;
                var pid = (high << 16) | low;
                if (pid % 25 == (uint)nature && (trainer ^ high ^ low) < 16 == shiny)
                {
                    PID = pid;
                    return;
                }
            }
        }
        throw new InvalidOperationException("No PID keeps this Pokémon's gender, ability and shininess with that nature.");
    }
    public override byte Gender { get => EntityGender.GetFromPIDAndRatio(PID, PersonalInfo.Gender); set { } }

    public override int Status_Condition { get => ReadInt32LittleEndian(Data[0x50..]); set => WriteInt32LittleEndian(Data[0x50..], value); }
    public override byte Stat_Level { get => Data[0x54]; set => Data[0x54] = value; }
    public override int Stat_HPCurrent { get => ReadUInt16LittleEndian(Data[0x56..]); set => WriteUInt16LittleEndian(Data[0x56..], (ushort)value); }
    public override int Stat_HPMax { get => ReadUInt16LittleEndian(Data[0x58..]); set => WriteUInt16LittleEndian(Data[0x58..], (ushort)value); }
    public override int Stat_ATK { get => ReadUInt16LittleEndian(Data[0x5A..]); set => WriteUInt16LittleEndian(Data[0x5A..], (ushort)value); }
    public override int Stat_DEF { get => ReadUInt16LittleEndian(Data[0x5C..]); set => WriteUInt16LittleEndian(Data[0x5C..], (ushort)value); }
    public override int Stat_SPE { get => ReadUInt16LittleEndian(Data[0x5E..]); set => WriteUInt16LittleEndian(Data[0x5E..], (ushort)value); }
    public override int Stat_SPA { get => ReadUInt16LittleEndian(Data[0x60..]); set => WriteUInt16LittleEndian(Data[0x60..], (ushort)value); }
    public override int Stat_SPD { get => ReadUInt16LittleEndian(Data[0x62..]); set => WriteUInt16LittleEndian(Data[0x62..], (ushort)value); }

    public override bool FatefulEncounter { get => false; set { } }
    public override ushort EggLocation { get => 0; set { } }
    public override byte CurrentHandler { get => 0; set { } }
    public override int Characteristic => -1;

    public override ushort MaxMoveID => LastMove;
    public override ushort MaxSpeciesID => LastSpecies;
    public override int MaxItemID => LastItem;
    public override int MaxAbilityID => LastAbility;
    public override int MaxBallID => (int)PKHeX.Core.Ball.Beast;
    public override GameVersion MaxGameID => GameVersion.CXD;
    public override int MaxIV => 31;
    public override int MaxEV => 255;

    public override string GetString(ReadOnlySpan<byte> data) => StringConverter3.GetString(data, (int)LanguageID.English);
    public override int LoadString(ReadOnlySpan<byte> data, Span<char> destBuffer) => StringConverter3.LoadString(data, destBuffer, (int)LanguageID.English);
    public override int SetString(Span<byte> destBuffer, ReadOnlySpan<char> value, int maxLength, StringConverterOption option) =>
        StringConverter3.SetString(destBuffer, value, Math.Min(maxLength, destBuffer.Length), (int)LanguageID.English, option);

    public void ClearNickname() => Nickname = SpeciesName.GetSpeciesNameGeneration(Species, (int)LanguageID.English, 9);
    public override int GetStringTerminatorIndex(ReadOnlySpan<byte> data) => TrashBytes8.GetTerminatorIndex(data);
    public override int GetStringLength(ReadOnlySpan<byte> data) => TrashBytes8.GetStringLength(data);
    public override int GetBytesPerChar() => 1;
}
