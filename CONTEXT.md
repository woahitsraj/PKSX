# PKSX

PKSX is an offline-first Pokemon save management app that uses PKHeX-compatible logic behind a controller-friendly Svelte UI.

## Language

**Save File**:
A game save loaded into PKSX for inspection, backup, editing, and export.
_Avoid_: ROM, game file

**Pokemon Entity**:
A single Pokemon data object contained in a save file, party, box, bank, or import file.
_Avoid_: monster, creature, record

**Party**:
The active Pokemon collection stored by a save file for in-game use.
_Avoid_: team, roster

**Box**:
A numbered storage grid inside a save file.
_Avoid_: bank box, PC page

**Local Library**:
The app-managed offline collection of imported save files, backups, and bank entries.
_Avoid_: cloud account, server library

**Backup**:
A restorable snapshot of a save file or Pokemon entity created before a risky operation.
_Avoid_: copy, version

**Export**:
An explicit user action that writes a save file or Pokemon entity out of PKSX.
_Avoid_: sync, save-as-default

**PKHeX Engine**:
The C# WebAssembly runtime that executes PKHeX.Core-backed parsing, validation, legality, and mutation logic.
_Avoid_: backend, server

**Facade**:
The small C# API layer exposed by the PKHeX Engine to the Svelte app.
_Avoid_: wrapper when referring to the public boundary

**Controller Focus**:
The current navigable UI target used by keyboard and gamepad input.
_Avoid_: hover, cursor

## Relationships

- A **Save File** contains zero or one **Party** and zero or more **Boxes**.
- A **Box** contains zero or more **Pokemon Entities**.
- The **Local Library** stores **Save Files**, **Backups**, and app-managed Pokemon collections.
- The **PKHeX Engine** exposes a **Facade** consumed by the Svelte app.
- **Export** writes data from the **Local Library** back to user-controlled storage.
