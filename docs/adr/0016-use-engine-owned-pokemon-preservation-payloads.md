# Use engine-owned Pokemon preservation payloads

PKSX preserves a Pokemon Entity in an opaque, versioned payload created and validated by the PKHeX Engine. The payload has a unique app-generated Record ID, an Identity Fingerprint derived from base-evolution species, raw Trainer ID, raw Secret ID, and PID, and an unchanged format-tagged copy of the first native entity bytes. A projected native entity may change as PKHeX.Core converts between formats, while the original bytes and fingerprint continue to identify the preserved individual.

Copying creates a new Record ID but may retain the same Identity Fingerprint. The fingerprint is evidence that records may represent the same individual and is never a database uniqueness constraint or an ownership decision. Pokemon Origin records entry history, while the current Slot or Pokemon Storage record determines ownership.

The PKHeX Engine remains the only serialization authority. TypeScript may store and transport payload bytes and consume engine projections, but it must not build Pokemon Entity bytes from those projections. This decision extends ADR 0006 without weakening its engine-owned-byte boundary.
