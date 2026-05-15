using System.Runtime.InteropServices.JavaScript;

namespace Pksx.Pkhex.Engine;

internal static partial class Program
{
    private static void Main()
    {
        ConsoleLog("PKSX PKHeX Engine loaded.");
    }

    [JSImport("globalThis.console.log")]
    private static partial void ConsoleLog(string message);
}
