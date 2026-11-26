using PKHeX.Core;

namespace Pksx.Pkhex.Engine.Unbound;

// Checks a Pokémon against Unbound's own tables. Encounters and locations wait for Unbound's encounter tables.
internal static class UnboundLegality
{
    public static readonly (string Id, string Label)[] Fixes =
    [
        ("form", "Form"),
        ("move-set", "Move Set"),
        ("ability", "Ability"),
        ("held-item", "Held Item"),
        ("level-exp", "Level and EXP"),
    ];

    public static LegalityReport CreateReport(PK3Unbound pokemon, StorageSlotType slot)
    {
        var problems = Check(pokemon, slot);
        var legal = problems.Count == 0;
        return new LegalityReport(
            legal,
            legal ? "Legal" : "Illegal",
            (legal ? "This Pokemon follows the Pokémon Unbound rules." : "This Pokemon breaks the Pokémon Unbound rules.")
                + " Encounters and locations are not checked.",
            [.. Fixes.Where(fix => problems.Any(problem => problem.FixId == fix.Id)).Select(fix => fix.Label)],
            problems,
            problems);
    }

    public static List<LegalityReportLine> Check(PK3Unbound pokemon, StorageSlotType slot)
    {
        var problems = new List<LegalityReportLine>();
        void Add(string identifier, string message, string? fixId) =>
            problems.Add(new LegalityReportLine(nameof(Severity.Invalid), identifier, message, fixId));

        if (pokemon.Species == 0)
        {
            Add("Species", $"Species {pokemon.UnboundSpeciesId} is not a Pokémon Unbound species.", null);
            return problems;
        }

        var species = SpeciesName.GetSpeciesName(pokemon.Species, (int)LanguageID.English);
        if (FormInfo.IsBattleOnlyForm(pokemon.Species, pokemon.Form, 8))
            Add("Form", $"{species} has this form only in battle.", OutOfBattleSpecies(pokemon) == 0 ? null : "form");

        var moves = Enumerable.Range(0, 4).Select(pokemon.GetUnboundMove).ToArray();
        if (moves.All(move => move == 0))
            Add("CurrentMove", "This Pokemon knows no moves.", "move-set");
        for (var index = 0; index < 4; index++)
        {
            var move = moves[index];
            if (move == 0)
                continue;
            var name = UnboundTables.Moves.Name(move);
            if (!UnboundTables.Moves.Has(move))
                Add("CurrentMove", $"Move {index + 1}: {name} is not a Pokémon Unbound move.", "move-set");
            else if (Array.IndexOf(moves, move) != index)
                Add("CurrentMove", $"Move {index + 1}: {name} is a duplicate.", "move-set");
            else if (!UnboundTables.CanLearn(pokemon.UnboundSpeciesId, move))
                Add("CurrentMove", $"Move {index + 1}: {species} cannot learn {name} in Pokémon Unbound.", "move-set");
        }

        if (pokemon.HiddenAbility && pokemon.PersonalInfo.GetAbilityAtIndex(2) == 0)
            Add("Ability", $"{species} has no Hidden Ability in Pokémon Unbound.", "ability");

        var item = pokemon.UnboundHeldItem;
        if (item != 0 && !UnboundTables.Items.Has(item))
            Add("HeldItem", $"Held Item {UnboundTables.Items.Name(item)} is not a Pokémon Unbound item.", "held-item");
        // Pockets 2 and 4 are TMs and HMs, and key items.
        else if (UnboundTables.Items.Extra(item) is 2 or 4)
            Add("HeldItem", $"{UnboundTables.Items.Name(item)} cannot be a Held Item.", "held-item");

        var growth = pokemon.PersonalInfo.EXPGrowth;
        var maxExp = Experience.GetEXP(Experience.MaxLevel, growth);
        if (pokemon.EXP > maxExp)
            Add("Level", $"EXP {pokemon.EXP} is above {maxExp}, the EXP of level {Experience.MaxLevel}.", "level-exp");
        else if (slot == StorageSlotType.Party && pokemon.Stat_Level != Experience.GetLevel(pokemon.EXP, growth))
            Add("Level", $"Party level {pokemon.Stat_Level} does not match level {Experience.GetLevel(pokemon.EXP, growth)} from EXP.", "level-exp");

        return problems;
    }

    // Repairs the problems of one fix, or of every fix when fixId is null.
    public static void Fix(PK3Unbound pokemon, StorageSlotType slot, string? fixId)
    {
        var problems = Check(pokemon, slot).Select(problem => problem.FixId).ToHashSet();
        bool Wanted(string id) => (fixId is null || fixId == id) && problems.Contains(id);
        var restat = false;

        if (Wanted("form"))
        {
            pokemon.UnboundSpeciesId = OutOfBattleSpecies(pokemon);
            restat = true;
        }

        if (Wanted("move-set"))
        {
            var kept = new List<(ushort Move, int Pp, int PpUps)>();
            for (var index = 0; index < 4; index++)
            {
                var move = pokemon.GetUnboundMove(index);
                if (move != 0 && kept.All(entry => entry.Move != move) && UnboundTables.CanLearn(pokemon.UnboundSpeciesId, move))
                    kept.Add((move, PpOf(pokemon, index), PpUpsOf(pokemon, index)));
            }
            if (kept.Count == 0 && UnboundTables.LevelUpMoves(pokemon.UnboundSpeciesId) is [var first, ..])
                kept.Add((first, UnboundTables.GetPp(first), 0));
            for (var index = 0; index < 4; index++)
            {
                var (move, pp, ppUps) = index < kept.Count ? kept[index] : default;
                pokemon.SetUnboundMove(index, move, pp, ppUps);
            }
        }

        if (Wanted("ability"))
            pokemon.HiddenAbility = false;

        if (Wanted("held-item"))
            pokemon.UnboundHeldItem = 0;

        if (Wanted("level-exp"))
        {
            var growth = pokemon.PersonalInfo.EXPGrowth;
            pokemon.EXP = Math.Min(pokemon.EXP, Experience.GetEXP(Experience.MaxLevel, growth));
            restat = true;
        }

        if (restat && slot == StorageSlotType.Party)
        {
            pokemon.Stat_Level = Experience.GetLevel(pokemon.EXP, pokemon.PersonalInfo.EXPGrowth);
            pokemon.ResetPartyStats();
        }
    }

    private static ushort OutOfBattleSpecies(PK3Unbound pokemon) =>
        UnboundTables.GetSpeciesId(pokemon.Species, FormInfo.GetOutOfBattleForm(pokemon.Species, pokemon.Form, 8));

    private static int PpOf(PK3Unbound pokemon, int index) =>
        index switch { 0 => pokemon.Move1_PP, 1 => pokemon.Move2_PP, 2 => pokemon.Move3_PP, _ => pokemon.Move4_PP };

    private static int PpUpsOf(PK3Unbound pokemon, int index) =>
        index switch { 0 => pokemon.Move1_PPUps, 1 => pokemon.Move2_PPUps, 2 => pokemon.Move3_PPUps, _ => pokemon.Move4_PPUps };
}
