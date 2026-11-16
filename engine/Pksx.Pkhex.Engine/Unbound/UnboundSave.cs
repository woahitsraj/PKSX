using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

public static class UnboundSave
{
    private const uint Signature = 0x01121999;
    private const int SaveSize = 0x20000;
    private const int SaveSizeWithFooter = 0x20010;
    private const int SectorSize = 0x1000;
    private const int SignatureOffset = 0xFF8;
    private const int SlotSectors = 28;
    private const int MinSignedSectors = 8;

    public static bool IsUnbound(ReadOnlySpan<byte> data)
    {
        if (data.Length is not (SaveSize or SaveSizeWithFooter))
            return false;

        var signed = 0;
        for (var sector = 0; sector < SlotSectors; sector++)
        {
            if (ReadUInt32LittleEndian(data[(sector * SectorSize + SignatureOffset)..]) == Signature)
                signed++;
        }
        return signed >= MinSignedSectors;
    }
}
