using System.Runtime.InteropServices.JavaScript;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

internal static partial class Program
{
    private static void Main()
    {
        RuntimeCryptographyProvider.Aes = new ManagedAesProvider();
        RuntimeCryptographyProvider.Md5 = new ManagedMd5Provider();
        ConsoleLog("PKSX PKHeX Engine loaded.");
    }

    [JSImport("globalThis.console.log")]
    private static partial void ConsoleLog(string message);
}
