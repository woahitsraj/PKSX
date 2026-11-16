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
}
