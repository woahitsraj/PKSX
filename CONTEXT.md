# PKSX

PKSX is an offline-first Pokemon save management app that uses PKHeX-compatible logic behind a controller-friendly Svelte UI.

## Language

**Save File**:
A Pokemon save file loaded into PKSX to inspect, back up, edit, and export.
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

**Box Name**:
A user-facing label for a Box, which may come from the Save File when the Save File supports custom box names.
_Avoid_: generated title when referring to a save-owned label

**Slot**:
A position in a party or box that may or may not contain a Pokemon Entity.
_Avoid_: card, tile

**Local Library**:
The collection of imported save files, backups, and future bank data that PKSX owns and keeps between sessions.
_Avoid_: cloud account, server library

**Pokemon Storage**:
The collection of Pokemon Entities that PKSX keeps between sessions and that no Save File owns. Pokemon Storage lives inside the Local Library and is meant for Bank or HOME style transfers.
_Avoid_: temporary storage, bank when referring to the app-level collection

**Storage Box**:
A numbered storage grid that PKSX owns inside Pokemon Storage.
_Avoid_: save box, PC box

**Box Source**:
The owner that supplies the numbered box grids shown in the box-first shell, a Save File or Pokemon Storage. Glossary-only: the user always sees the concrete Save File or Pokemon Storage name.
_Avoid_: storage source, container, source in any user-facing text

**Pokemon Origin**:
A record of where a Pokemon Entity entered PKSX, such as the source Save File, source game, source trainer, entry time, and whether it entered through move, copy, import, or transfer.
_Avoid_: ownership, current location

**Legality Check**:
A PKHeX Engine evaluation of whether a Pokemon Entity is valid for its species, game, encounter, moves, met data, and current format.
_Avoid_: validation when referring specifically to Pokemon legality

**Legality Report**:
The user-facing result of a Legality Check, including pass/fail status, warnings, and fixable problems.
_Avoid_: raw legality output

**Legality Fix**:
An engine-backed change that tries to repair one or more fixable problems from a Legality Report.
_Avoid_: auto-fix when implying a guaranteed or silent repair

**Pokemon Action**:
A user-invoked operation on a Pokemon Entity, such as move, copy, evolve, export, Legality Check, or Legality Fix.
_Avoid_: button when referring to the domain operation

**Pokemon Editor**:
A focused workflow for inspecting and staging edits to one Pokemon Entity.
_Avoid_: detail workflow, summary view

**Pokemon Editor Source**:
The current owner of the Pokemon Entity presented by a Pokemon Editor, and the place applied edits are written to.
_Avoid_: origin history, display location

**Staged Pokemon Edit**:
A Pokemon Editor change prepared for explicit apply but not yet written to its Pokemon Editor Source.
_Avoid_: saved field, stored Pokemon data

**Pokemon Edit Validation**:
A PKHeX Engine evaluation of whether Staged Pokemon Edits can be applied to a Pokemon Entity.
_Avoid_: Legality Check when referring only to edit applicability

**Unsupported Pokemon Edit**:
A Staged Pokemon Edit that PKSX or the PKHeX Engine cannot currently apply.
_Avoid_: failed edit when no expected supported operation failed

**Stale Pokemon Editor Source**:
A Pokemon Editor Source that no longer identifies the same Pokemon Entity that the Pokemon Editor opened.
_Avoid_: missing field, validation error

**Move Set Editing**:
A Pokemon Editor capability for changing the moves or move-related values of a Pokemon Entity.
_Avoid_: Move editing, Move when referring to editing a Pokemon Entity's moves

**Slot Action**:
A user-invoked operation on a Slot, whether or not that Slot contains a Pokemon Entity.
_Avoid_: Pokemon Action when the Slot may be empty

**Batch Slot Action**:
A user-invoked operation that applies to multiple source Slots as one workflow.
_Avoid_: normal Slot Action, multi action

**Create Pokemon**:
A Slot Action that creates a new Pokemon Entity in an empty Slot.
_Avoid_: new record, spawn

**Clear Slot**:
A Slot Action that removes a Pokemon Entity from an occupied Slot and leaves that Slot empty.
_Avoid_: release when naming the Slot Action

**Slot Swap**:
A Move outcome where two occupied Slots exchange their Pokemon Entities.
_Avoid_: overwrite, replace

**Sprite Catalog**:
The offline table that maps a Pokemon display identity to the images PKSX ships with, used in party, box, and Pokemon Storage views.
_Avoid_: remote sprites, CDN images

**Sprite Identity**:
The display identity that the PKHeX Engine reports, used to find a Pokemon Entity in the Sprite Catalog.
_Avoid_: nickname, slot position, UI state

**Shiny State**:
Whether a Pokemon Entity has its alternate shiny coloration, as the PKHeX Engine reports it for display identity.
_Avoid_: rarity, sparkle effect

**Sex Difference**:
A visible species-specific sprite difference based on a Pokemon Entity's sex, as the PKHeX Engine reports it for display identity.
_Avoid_: gender label when referring only to sprite appearance

**Display Sex**:
The sex-difference state used by Sprite Identity for visual asset selection: default, male, or female.
_Avoid_: raw gender value when no visible sprite difference exists

**Peer Transfer**:
A live connection between two devices running PKSX, for sending Pokemon Entities or Storage Boxes without cloud sync.
_Avoid_: cloud sync, account sync

**Backup**:
A restorable snapshot of save file bytes created before a risky operation.
_Avoid_: copy, version, checkpoint, undo

**Backup Reason**:
A recorded reason for why a Backup was created, such as manual creation or a kind of Risky Change.
_Avoid_: free-form note when referring to the primary backup category

**Risky Change**:
A user action that changes Save File bytes or Pokemon Entity bytes in a Workspace.
_Avoid_: navigation, inspection, export, Legality Check

**Backup Restore**:
A user-confirmed recovery action that opens a Backup as the active Workspace.
_Avoid_: overwrite, rollback, import when referring to opening backup bytes for recovery

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
The C# WebAssembly runtime that runs PKHeX.Core-backed parsing, validation, legality, and editing logic.
_Avoid_: backend, server

**Facade**:
The small C# API layer exposed by the PKHeX Engine to the Svelte app.
_Avoid_: wrapper when referring to the public boundary

**Viewport Budget**:
The fixed raw-viewport floor and target constraints that every PKSX layout is designed and verified against.
_Avoid_: device matrix, supported device list

**Safe Canvas**:
The drawable rectangle remaining after platform safe-area insets are removed from the raw viewport. Shell and screen padding are design spend inside it.
_Avoid_: raw viewport, screen size

**Height Band**:
One of PKSX's two app-wide layout modes, Short below 560 CSS px and Tall at or above it, selected solely by raw viewport height. The current Height Band remains fixed while an editable control has focus.
_Avoid_: orientation, mobile breakpoint, desktop breakpoint

**Controller Focus**:
The app-level navigable UI target used by keyboard and gamepad input, independent of browser DOM focus.
_Avoid_: hover, cursor

**Focus Zone**:
A controller-navigable region whose targets share directional movement rules before movement crosses into another region.
_Avoid_: panel, section

**Menu**:
A short, fixed list of commands that takes Controller Focus when opened and gives it back when closed.
_Avoid_: command surface, action surface, popup, context menu, sheet

**Slot Menu**:
The Menu for the Slot under Controller Focus.
_Avoid_: Slot Action Surface

**Box Menu**:
The Menu for the Box Source whose boxes hold Controller Focus.
_Avoid_: Box Source menu, source menu, pane menu

**Main Menu**:
The Menu of app destinations.
_Avoid_: global command surface, navigation menu, tab bar

**Backup Browser**:
A list of the Backups for the active Save File, from which the user can create, restore, and delete Backups.
_Avoid_: Local Library browser when referring only to the active Save File's backups

**Active Slot Detail Rail**:
A rail that shows the Slot under Controller Focus, whether that Slot contains a Pokemon Entity or is empty.
_Avoid_: selected Pokemon panel, editor rail

**Navigation Action**:
A movement or command intent that keyboard, gamepad, and pointer input all produce in the same form.
_Avoid_: key event, button event

**Preference**:
A choice about how PKSX looks or behaves that belongs to the app rather than to any Save File or Pokemon Entity, and is kept between sessions.
_Avoid_: setting, option, config

## Relationships

- A **Save File** contains zero or one **Party** and zero or more **Boxes**.
- A **Supported Save File** is a **Save File** that can be loaded through the **PKHeX Engine** for the current milestone.
- For the first end-to-end slice, the Pokemon Emerald test save committed to this repository is the only required **Supported Save File**.
- A **Save File** is accepted into the **Local Library** only after the **PKHeX Engine** recognizes it as a **Supported Save File**.
- Until PKSX has a **Local Library** browser, the most recently imported **Save File** is the active **Save File** after reload.
- Importing the same user-controlled file more than once creates separate imported **Save Files** in the **Local Library**.
- A **Party** contains one or more **Slots**.
- A **Box** contains zero or more **Slots**.
- A **Box** always has a number and may also have a **Box Name**.
- A **Slot** contains zero or one **Pokemon Entity**.
- The **Local Library** stores imported **Save Files**, **Backups**, and **Pokemon Storage**.
- The **Local Library** may keep the active **Dirty Workspace** without overwriting the imported **Save File**.
- A **Preference** is owned by the app and never by a **Save File** or a **Pokemon Entity**.
- A **Backup** belongs to one **Save File**.
- A **Backup** has one **Backup Reason**.
- Manual and automatic **Backups** are both restorable **Backups**.
- **Backups** are presented newest first when recovery context matters.
- A **Workspace** belongs to one loaded **Save File**.
- A **Dirty Workspace** belongs to one **Workspace**.
- A saved **Dirty Workspace** is restored after reload, before the imported **Save File** is opened.
- A **Backup** is created before **Risky Changes** to a **Workspace**.
- At most one automatic **Backup** is created before the first **Risky Change** in a **Workspace**.
- A manual **Backup** preserves the current **Workspace** state.
- A manual **Backup** requires a loaded **Save File**.
- A **Backup Restore** opens a **Backup** as the active **Workspace** only after explicit user confirmation.
- A **Backup Restore** can only make a **Supported Save File** state active.
- A **Backup Restore** keeps the restored **Workspace** associated with the **Save File** that owns the **Backup**.
- A **Backup Restore** creates a **Dirty Workspace** when the restored state differs from the current imported **Save File**.
- A **Backup Restore** does not overwrite the original imported **Save File**.
- A **Backup Restore** must warn before replacing a **Dirty Workspace**.
- A **Backup Restore** is not a **Risky Change**.
- A **Backup Restore** may identify the source **Backup** for recovery context.
- A **Backup Restore** does not change **Pokemon Origin**.
- Keeping restored backup bytes as a separate **Save File** requires an explicit user action.
- Keeping restored backup bytes as a separate **Save File** ties the active **Workspace** to that new **Save File**.
- Keeping restored backup bytes as a separate **Save File** clears the **Dirty Workspace** when the active **Workspace** matches the new **Save File**.
- A **Slot Action** that changes nothing is not a **Risky Change**.
- **Pokemon Storage** contains **Pokemon Entities** that are outside any **Save File**.
- **Pokemon Storage** contains one or more **Storage Boxes**.
- A **Storage Box** contains zero or more **Slots**.
- A **Storage Box** is owned by PKSX, not by any **Save File**.
- A **Box Source** supplies either **Boxes** from a **Save File** or **Storage Boxes** from **Pokemon Storage**.
- A **Box Source** is presented to the user only when the collection behind it is available in PKSX.
- The **Box Source** whose boxes hold **Controller Focus** is the active **Box Source**; there is no separate focused **Box Source**.
- The active **Save File**'s **Box Source** cannot be switched or closed while that **Save File** is active.
- A future **Slot Action** may use source and destination **Slots** from different **Box Sources**.
- A **Pokemon Entity** may have **Pokemon Origin** even when its original **Save File** is no longer in the **Local Library**.
- **Pokemon Origin** records where a **Pokemon Entity** came from; it does not determine its current owner or location.
- A **Legality Check** evaluates one **Pokemon Entity**.
- A **Legality Report** is produced by a **Legality Check**.
- A **Legality Fix** is based on a **Legality Report** and must be explicitly applied by the user.
- A **Pokemon Action** applies to one **Pokemon Entity**.
- A **Pokemon Editor** presents one **Pokemon Entity**.
- A **Pokemon Editor** may present a **Pokemon Entity** from a **Save File** or from **Pokemon Storage**.
- A **Pokemon Editor** has one **Pokemon Editor Source**.
- A **Pokemon Editor Source** determines where applied edits are written.
- A **Pokemon Editor Source** describes current ownership, not **Pokemon Origin**.
- A **Stale Pokemon Editor Source** cannot receive applied **Staged Pokemon Edits**.
- A **Pokemon Editor** stages edits before they become **Risky Changes**.
- A **Pokemon Editor** may contain zero or more **Staged Pokemon Edits**.
- A **Staged Pokemon Edit** is not written to its **Pokemon Editor Source** until the user explicitly applies it.
- **Pokemon Edit Validation** evaluates **Staged Pokemon Edits** before they are written to a **Pokemon Editor Source**.
- **Pokemon Edit Validation** is distinct from a **Legality Check**.
- **Pokemon Edit Validation** does not determine whether a **Pokemon Entity** is legal.
- An **Unsupported Pokemon Edit** does not change its **Pokemon Editor Source**.
- Applying no **Staged Pokemon Edits** is not a **Risky Change**.
- Applying **Staged Pokemon Edits** writes all accepted edits for that **Pokemon Entity** together or writes none of them.
- Applying **Staged Pokemon Edits** to a **Save File**-owned **Pokemon Entity** is a **Risky Change**.
- Applying **Staged Pokemon Edits** to a **Save File**-owned **Pokemon Entity** writes through that **Pokemon Entity**'s **Slot** in the **Save File**.
- Applying **Staged Pokemon Edits** to a **Pokemon Storage**-owned **Pokemon Entity** does not change a **Workspace**.
- Applying **Staged Pokemon Edits** to a **Pokemon Storage**-owned **Pokemon Entity** writes through **Pokemon Storage**.
- Successfully applied **Staged Pokemon Edits** are no longer staged.
- Rejected or failed **Staged Pokemon Edits** remain staged until the user changes or cancels them.
- A **Pokemon Editor** may remain open after applied **Staged Pokemon Edits** update its **Pokemon Editor Source**.
- Cancelling a **Pokemon Editor** discards unapplied **Staged Pokemon Edits** and dismisses the **Pokemon Editor**.
- **Move Set Editing** applies to one **Pokemon Entity**.
- A **Slot Action** applies to one **Slot**.
- A **Batch Slot Action** applies to multiple source **Slots**.
- **Create Pokemon** applies to an empty **Slot**.
- **Clear Slot** applies to an occupied **Slot** and requires explicit user confirmation.
- Moving or copying a **Pokemon Entity** between **Save File** **Slots** has a source **Slot** and a destination **Slot**.
- A Move into an occupied **Slot** performs a **Slot Swap**.
- Copying a **Pokemon Entity** into a **Save File** **Slot** requires an empty destination **Slot**.
- The **Sprite Catalog** provides offline visual assets for **Pokemon Entities**.
- A **Sprite Identity** belongs to one **Pokemon Entity** as the **PKHeX Engine** reports it for display.
- A **Sprite Identity** includes the **Shiny State** of its **Pokemon Entity**.
- A **Sprite Identity** may include a **Sex Difference** through **Display Sex** when that difference changes the displayed sprite.
- A **Sprite Identity** describes visible Pokemon characteristics, not save format or current location.
- A **Sprite Catalog** may or may not contain an asset for a **Sprite Identity**.
- A **Peer Transfer** sends **Pokemon Entities** or **Storage Boxes** between two devices running PKSX.
- A **Pokemon Entity** received through **Peer Transfer** enters **Pokemon Storage** before it can be moved into a **Save File**.
- The **PKHeX Engine** provides a **Facade** that the Svelte app uses.
- **Export** writes data from the **Local Library** back to user-controlled storage.
- Moving, copying, or clearing a **Slot** in a **Save File** is a **Risky Change** to the **Workspace**.
- Moving a **Pokemon Entity** from a **Save File** to **Pokemon Storage** removes it from the source **Slot**.
- Copying a **Pokemon Entity** from a **Save File** to **Pokemon Storage** leaves the source **Slot** unchanged.
- **Export** names should keep a recognizable connection to the imported **Save File** while keeping the exported file distinct from the source file.
- **Controller Focus** belongs to exactly one **Focus Zone** at a time.
- Mouse and pointer input may move **Controller Focus**, but hover alone is not **Controller Focus**.
- Clicking a **Slot** moves **Controller Focus** to that **Slot** without opening its **Slot Menu**.
- Browser tab navigation moves between major interactive regions; directional input moves **Controller Focus** inside the active party or box grid.
- Party and box slot collections present as grids to assistive technology.
- Keyboard and gamepad input produce the same **Navigation Actions** before changing **Controller Focus**.
- Held directional **Navigation Actions** repeat after an initial delay; confirm, back, and shoulder actions require a fresh press.
- The visible slot highlight represents **Controller Focus**; PKSX does not track a separate selected slot in the box-first shell.
- The **Active Slot Detail Rail** reflects the **Slot** under **Controller Focus** and does not define a second selected **Slot**.
- A **Slot** may be under **Controller Focus** even when it is not a valid destination for a pending **Slot Action**.
- **Controller Focus** targets a **Slot** or a control, never a **Pokemon Entity**; emptying the focused **Slot** leaves **Controller Focus** on it.
- A completed **Slot Action** with a destination moves **Controller Focus** to the destination **Slot**; one without a destination leaves it on the source **Slot**.
- A pending **Slot Action** binds its **Pokemon Entity** to **Controller Focus** until it completes or is cancelled; cancelling returns **Controller Focus** to the source **Slot**.
- When the **Focus Zone** under **Controller Focus** disappears, **Controller Focus** moves to the active **Box** at the same **Slot** coordinate, clamped to the grid.
- A command surface returns **Controller Focus** to its launching **Slot** or control by identity, even when that **Slot** is now empty; if the launching **Pokemon Action** no longer exists, its **Slot Action Surface** closes too and **Controller Focus** returns to the **Slot**.
- **Controller Focus** is never hidden when its target disappears, for any input kind; it always moves to a surviving target.
- A **Height Band** change or rotation never moves **Controller Focus**, because it binds to **Slot** identity rather than screen position.
- **Controller Focus** clamps at a **Focus Zone** edge unless that edge defines an explicit transition to another **Focus Zone**.
- The **Party** and the active **Box** are separate **Focus Zones** with explicit directional transitions between them.
- A **Menu** opens from the current **Controller Focus** and returns to it when dismissed.
- At most one **Menu** is open at a time; a **Menu** cannot open while another **Menu**, a **Pokemon Editor**, or the **Backup Browser** is open, or while a **Slot Action** is in progress.
- A **Menu** shows the same entries in the same order every time; an entry that does not apply stays visible, cannot be chosen, and explains why.
- The **Slot Menu** acts on the **Slot** under **Controller Focus**.
- The **Box Menu** acts on the active **Box Source**: **Export**, create a **Backup**, switch it, open another, or close it.
- The **Box Menu** opens from the control that names the active **Box Source**, which is a **Controller Focus** target.
- **Export** from the **Box Menu** writes the **Workspace** bytes.
- The **Main Menu** lists every destination, including the **Backup Browser**, in a fixed order and never hides or dims one.
- A **Pokemon Editor** opened from a **Slot Menu** returns **Controller Focus** to its launching **Pokemon Action** when dismissed.
- Back dismisses an open **Menu** before it affects broader app navigation.
- Back dismisses an open **Backup Browser** before it affects broader app navigation.
- A **Backup Browser** returns **Controller Focus** to its launching control when dismissed.
- Shoulder navigation changes the active **Box** without changing the current **Focus Zone**.
- Shoulder navigation preserves the active **Box** slot coordinate when **Controller Focus** is inside a **Box**.
- Changing the active **Box Source** preserves the active box number and focused **Slot** coordinate when the new **Box Source** has matching coordinates, and clamps to the nearest available box otherwise.
- The box-first shell may use placeholder **Slot** contents, but placeholders must remain visibly distinct from parsed save data.
- The box-first shell can prove navigation with local fixture **Slots** before loading **Save File** data through the **PKHeX Engine**.
- After a **Supported Save File** is loaded, visible **Party** and **Box** **Slots** represent parsed save data instead of placeholder contents.
- Box-first navigation rules are domain interaction rules and should be testable outside the Svelte view.
