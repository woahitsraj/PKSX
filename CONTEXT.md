# PKSX

PKSX is an offline-first Pokemon save management app that uses PKHeX-compatible logic behind a controller-friendly Svelte UI.

## Language

**Save File**:
A Pokemon save artifact loaded into PKSX for inspection, backup, editing, and export.
_Avoid_: ROM, game file

**Supported Save File**:
A Save File that the current PKSX milestone intentionally accepts as in scope.
_Avoid_: any save, all generations

**Pokemon Entity**:
A single Pokemon data object contained in a save file, party, box, bank, or import file.
_Avoid_: monster, creature, record

**Party**:
The active Pokemon collection stored by a save file for in-game use.
_Avoid_: team, roster

**Box**:
A numbered storage grid inside a save file.
_Avoid_: bank box, PC page

**Slot**:
A position in a party or box that may or may not contain a Pokemon Entity.
_Avoid_: card, tile

**Local Library**:
The app-managed durable collection of imported save file artifacts, backups, and future bank data.
_Avoid_: cloud account, server library

**Backup**:
A restorable snapshot of save file bytes created before a risky operation.
_Avoid_: copy, version, checkpoint, undo

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
The app-level navigable UI target used by keyboard and gamepad input, independent of browser DOM focus.
_Avoid_: hover, cursor

**Focus Zone**:
A controller-navigable region whose targets share directional movement rules before transitioning to another region.
_Avoid_: panel, section

**Slot Action Surface**:
A focused command surface opened from the current party or box slot.
_Avoid_: popup, context menu

**Navigation Action**:
A normalized movement or command intent produced by keyboard, gamepad, or pointer input.
_Avoid_: key event, button event

## Relationships

- A **Save File** contains zero or one **Party** and zero or more **Boxes**.
- A **Supported Save File** is a **Save File** that can be loaded through the **PKHeX Engine** for the current milestone.
- For the first tracer bullet, the committed Pokemon Emerald fixture is the only required **Supported Save File**.
- A **Save File** is accepted into the **Local Library** only after the **PKHeX Engine** recognizes it as a **Supported Save File**.
- Until PKSX has a **Local Library** browser, the most recently imported **Save File** is the active **Save File** after reload.
- Importing the same user-controlled file more than once creates separate **Save File** artifacts in the **Local Library**.
- A **Party** contains one or more **Slots**.
- A **Box** contains zero or more **Slots**.
- A **Slot** contains zero or one **Pokemon Entity**.
- The **Local Library** stores imported **Save File** artifacts, **Backups**, and app-managed Pokemon collections.
- The **PKHeX Engine** exposes a **Facade** consumed by the Svelte app.
- **Export** writes data from the **Local Library** back to user-controlled storage.
- **Export** names should keep a recognizable connection to the imported **Save File** while distinguishing the exported artifact from the source file.
- **Controller Focus** belongs to exactly one **Focus Zone** at a time.
- Mouse and pointer input may move **Controller Focus**, but hover alone is not **Controller Focus**.
- Clicking a **Slot** moves **Controller Focus** to that **Slot** without opening its **Slot Action Surface**.
- Browser tab navigation moves between major interactive regions; directional input moves **Controller Focus** inside the active party or box grid.
- Party and box slot collections present as grids to assistive technology.
- Keyboard and gamepad input produce the same **Navigation Actions** before changing **Controller Focus**.
- Held directional **Navigation Actions** repeat after an initial delay; confirm, back, and shoulder actions require a fresh press.
- The visible slot highlight represents **Controller Focus**; PKSX does not track a separate selected slot in the box-first shell.
- **Controller Focus** clamps at a **Focus Zone** edge unless that edge defines an explicit transition to another **Focus Zone**.
- The **Party** and the active **Box** are separate **Focus Zones** with explicit directional transitions between them.
- A **Slot Action Surface** opens from the current **Controller Focus** and returns to it when dismissed.
- Back dismisses an open **Slot Action Surface** before it affects broader app navigation.
- Shoulder navigation changes the active **Box** without changing the current **Focus Zone**.
- Shoulder navigation preserves the active **Box** slot coordinate when **Controller Focus** is inside a **Box**.
- The box-first shell may use placeholder **Slot** contents, but placeholders must remain visibly distinct from parsed save data.
- The box-first shell can prove navigation with local fixture **Slots** before loading **Save File** data through the **PKHeX Engine**.
- After a **Supported Save File** is loaded, visible **Party** and **Box** **Slots** represent parsed save data instead of placeholder contents.
- Box-first navigation rules are domain interaction rules and should be testable outside the Svelte view.
