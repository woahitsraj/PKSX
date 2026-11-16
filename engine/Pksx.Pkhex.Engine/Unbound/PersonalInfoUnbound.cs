using PKHeX.Core;

namespace Pksx.Pkhex.Engine.Unbound;

// Read-only species data from the Unbound ROM. Row: id, national, form, gender, growth, six stats, two types, three abilities.
internal sealed class PersonalInfoUnbound(int[] row) : PersonalInfo
{
    private int Column(int index) => index < row.Length ? row[index] : 0;

    public override byte[] Write() => [];
    public override int HP { get => Column(5); set { } }
    public override int ATK { get => Column(6); set { } }
    public override int DEF { get => Column(7); set { } }
    public override int SPE { get => Column(8); set { } }
    public override int SPA { get => Column(9); set { } }
    public override int SPD { get => Column(10); set { } }
    public override int EV_HP { get => 0; set { } }
    public override int EV_ATK { get => 0; set { } }
    public override int EV_DEF { get => 0; set { } }
    public override int EV_SPE { get => 0; set { } }
    public override int EV_SPA { get => 0; set { } }
    public override int EV_SPD { get => 0; set { } }
    public override byte Type1 { get => (byte)Column(11); set { } }
    public override byte Type2 { get => (byte)Column(12); set { } }
    public override int EggGroup1 { get => 0; set { } }
    public override int EggGroup2 { get => 0; set { } }
    public override byte CatchRate { get => 0; set { } }
    public override byte Gender { get => (byte)Column(3); set { } }
    public override byte HatchCycles { get => 0; set { } }
    public override byte BaseFriendship { get => 70; set { } }
    public override byte EXPGrowth { get => (byte)Column(4); set { } }
    public override int EscapeRate { get => 0; set { } }
    public override int BaseEXP { get => 0; set { } }
    public override int Color { get => 0; set { } }
    public override int AbilityCount => 3;
    public override int GetAbilityAtIndex(int abilityIndex) => abilityIndex is >= 0 and < 3 ? Column(13 + abilityIndex) : 0;

    public override int GetIndexOfAbility(int abilityID)
    {
        for (var i = 0; i < 3; i++)
        {
            if (GetAbilityAtIndex(i) == abilityID)
                return i;
        }
        return -1;
    }
}
