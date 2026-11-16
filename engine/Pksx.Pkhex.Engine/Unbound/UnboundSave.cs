using static System.Buffers.Binary.BinaryPrimitives;

namespace Pksx.Pkhex.Engine.Unbound;

public static class UnboundSave
{
    public const uint Signature = 0x01121999;
    private const int SectorSize = 0x1000;
    private const int SignatureOffset = 0xFF8;
    private const int SaveSectors = 28;

    public static bool IsUnbound(ReadOnlySpan<byte> data)
    {
        if (data.Length is not (0x20000 or 0x20010))
            return false;

        var signed = 0;
        for (var sector = 0; sector < SaveSectors; sector++)
        {
            if (ReadUInt32LittleEndian(data[(sector * SectorSize + SignatureOffset)..]) == Signature)
                signed++;
        }
        return signed >= 8;
    }
}
