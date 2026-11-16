namespace Pksx.Pkhex.Engine.Unbound;

// CFRU ball ids, from include/new/catching.h, mapped to PKHeX Ball values.
internal static class UnboundBalls
{
    private const byte Park = 16;
    private const byte Beast = 25;
    private const byte Dream = 26;

    public static byte ToPkhex(byte ball) => ball switch
    {
        < Park => (byte)(ball + 1),
        Park => (byte)PKHeX.Core.Ball.Poke,
        < Beast => ball,
        Beast => (byte)PKHeX.Core.Ball.Beast,
        Dream => (byte)PKHeX.Core.Ball.Dream,
        _ => (byte)PKHeX.Core.Ball.Poke,
    };

    public static bool IsMapped(byte ball) => ball is >= 1 and <= 24 or (byte)PKHeX.Core.Ball.Beast or (byte)PKHeX.Core.Ball.Dream;

    public static byte FromPkhex(byte ball) => ball switch
    {
        >= 1 and <= 16 => (byte)(ball - 1),
        >= 17 and <= 24 => ball,
        (byte)PKHeX.Core.Ball.Beast => Beast,
        (byte)PKHeX.Core.Ball.Dream => Dream,
        _ => throw new ArgumentException($"Pokémon Unbound has no ball {ball}."),
    };
}
