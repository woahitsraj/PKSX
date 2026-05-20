# Store Pokemon Entities as engine-owned bytes

Pokemon Storage will store each Pokemon Entity as PKHeX-compatible entity bytes plus app metadata, while parsed fields such as nickname, species, level, legality status, and sprite keys remain projections produced through the PKHeX Engine. This keeps stored Pokemon byte-faithful and aligned with PKHeX.Core behavior, instead of asking TypeScript field models to become a second source of truth for reconstructing Pokemon data.
