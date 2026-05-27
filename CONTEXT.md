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

**Pokemon Storage**:
The app-managed durable collection of Pokemon Entities that are not currently owned by a Save File. Pokemon Storage lives inside the Local Library and is intended for Bank/Home-style transfer workflows.
_Avoid_: temporary storage, bank when referring to the app-level collection

**Storage Box**:
A numbered app-owned storage grid inside Pokemon Storage.
_Avoid_: save box, PC box

**Pokemon Provenance**:
Historical metadata describing where a Pokemon Entity entered PKSX, such as the source Save File, source game, source trainer, entry time, and whether it entered through move, copy, import, or transfer.
_Avoid_: ownership, current location

**Legality Check**:
A PKHeX Engine evaluation of whether a Pokemon Entity is valid for its species, game, encounter, moves, met data, and current format.
_Avoid_: validation when referring specifically to Pokemon legality

**Legality Report**:
The user-facing result of a Legality Check, including pass/fail status, warnings, and fixable problems.
_Avoid_: raw legality output

**Legality Fix**:
An engine-backed mutation that attempts to repair one or more fixable problems from a Legality Report.
_Avoid_: auto-fix when implying a guaranteed or silent repair

**Pokemon Action**:
A user-invoked operation on a Pokemon Entity, such as move, copy, evolve, export, Legality Check, or Legality Fix.
_Avoid_: button when referring to the domain operation

**Slot Action**:
A user-invoked operation on a Slot, whether or not that Slot contains a Pokemon Entity.
_Avoid_: Pokemon Action when the Slot may be empty

**Create Pokemon**:
A Slot Action that creates a new Pokemon Entity in an empty Slot.
_Avoid_: new record, spawn

**Sprite Catalog**:
The offline app-packaged mapping from Pokemon display identity to local visual assets used in party, box, and Pokemon Storage views.
_Avoid_: remote sprites, CDN images

**Peer Transfer**:
A live connection between two PKSX instances for sending Pokemon Entities or Storage Boxes without requiring cloud sync.
_Avoid_: cloud sync, account sync

**Backup**:
A restorable snapshot of save file bytes created before a risky operation.
_Avoid_: copy, version, checkpoint, undo

**Workspace**:
The in-app editing state for a loaded Save File before it is exported back to user-controlled storage.
_Avoid_: open file, session when referring to editable save state

**Dirty Workspace**:
A Workspace containing user-applied changes that have not yet been exported.
_Avoid_: unsaved file

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
- The **Local Library** stores imported **Save File** artifacts, **Backups**, and **Pokemon Storage**.
- A **Workspace** belongs to one loaded **Save File**.
- A **Dirty Workspace** belongs to one **Workspace**.
- A **Backup** is created before risky changes to a **Workspace**.
- **Pokemon Storage** contains **Pokemon Entities** that are outside any **Save File**.
- **Pokemon Storage** contains one or more **Storage Boxes**.
- A **Storage Box** contains zero or more **Slots**.
- A **Storage Box** is owned by PKSX, not by any **Save File**.
- A **Pokemon Entity** may have **Pokemon Provenance** even when its original **Save File** is no longer in the **Local Library**.
- **Pokemon Provenance** records historical origin; it does not determine the current owner or location of a **Pokemon Entity**.
- A **Legality Check** evaluates one **Pokemon Entity**.
- A **Legality Report** is produced by a **Legality Check**.
- A **Legality Fix** is based on a **Legality Report** and must be explicitly applied by the user.
- A **Pokemon Action** applies to one **Pokemon Entity**.
- A **Slot Action** applies to one **Slot**.
- **Create Pokemon** applies to an empty **Slot**.
- The **Sprite Catalog** provides offline visual assets for **Pokemon Entities**.
- A **Peer Transfer** sends **Pokemon Entities** or **Storage Boxes** between PKSX instances.
- A **Pokemon Entity** received through **Peer Transfer** enters **Pokemon Storage** before it can be moved into a **Save File**.
- The **PKHeX Engine** exposes a **Facade** consumed by the Svelte app.
- **Export** writes data from the **Local Library** back to user-controlled storage.
- Moving a **Pokemon Entity** from a **Save File** to **Pokemon Storage** removes it from the source **Slot**.
- Copying a **Pokemon Entity** from a **Save File** to **Pokemon Storage** leaves the source **Slot** unchanged.
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
