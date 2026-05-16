# pksx Local-First Architecture Design

## Purpose

This document defines the initial local-first data architecture for `pksx`, a browser/PWA/Capacitor-friendly Pokémon save editor inspired by PKHeX.

The primary goal is to ship a reliable local editor first:

- Import a save file.
- Parse and inspect save contents.
- Edit Pokémon/save data safely.
- Validate edits.
- Track dirty state and undo/redo.
- Export a valid modified save file.
- Persist local workspace state in the browser/PWA.
- Keep the architecture open to future backend sync without coupling v1 to a server.

The chosen v1 local data layer is **TinyBase**.

RxDB remains a possible future option if `pksx` evolves from a save editor into a larger Pokémon vault/database with heavy replication and multi-device sync needs.

---

## Decision Summary

### Use TinyBase for v1

TinyBase should be used as the primary local reactive data store for the editor workspace.

TinyBase is a good fit because `pksx` is initially more of an **editor workspace** than a traditional database application.

The v1 app flow is expected to be:

```txt
import save → parse save → inspect/edit → validate → export save
```

TinyBase maps naturally to this workflow because it provides:

- Reactive local state.
- Tabular data for parsed entities.
- Key-value values for UI/editor state.
- Relationships/indexes/queries for fast local views.
- Local persistence options.
- Undo/checkpoint support.
- A small API surface compared to heavier local database frameworks.
- Sync options that can be explored later without making v1 backend-dependent.

### Do not make the database the only source of truth

For `pksx`, the raw save file remains a first-class artifact.

The local database should store the editable workspace and derived projections, not replace the save file format as the canonical product artifact.

Important boundary:

```txt
Save file bytes = canonical import/export artifact
Local Library storage = durable platform-specific storage for save artifacts and backups
TinyBase = editable local workspace + parsed projections + UI/editor state
Parser/serializer = trusted conversion layer between artifacts and editable state
```

TinyBase should reference Local Library artifacts by stable IDs or blob references. It should not be the repository for raw save bytes or backup bytes.

### Keep RxDB as a later possibility

RxDB may become appropriate later if `pksx` evolves into a persistent Pokémon vault with:

- Many long-lived save files.
- Search across all saves and Pokémon.
- Tags and collections.
- Teams and presets.
- Cloud backup.
- Multi-device sync.
- Document-level replication.

For v1, RxDB is likely more database machinery than the editor needs.

---

## Current Project Context

The current project is an early SvelteKit app using a static adapter. This is compatible with a PWA/local-first deployment model.

The existing server database scaffold uses Drizzle/Postgres and appears to be generated starter code. The sample schema contains a simple `task` table with a serial integer primary key. That pattern should not drive the local-first architecture for Pokémon save data.

For local-first entities, avoid local auto-increment IDs. Use stable IDs such as UUIDs, ULIDs, deterministic IDs, or content-derived IDs where appropriate.

---

## Architectural Principles

### 1. The editor comes first

The hardest part of `pksx` v1 is not cloud sync. The hard parts are:

- Correct binary save parsing.
- Correct save serialization.
- Preventing save corruption.
- Good editor UX.
- Legality/validation feedback.
- Safe undo/redo.
- Reliable import/export.

TinyBase supports these goals with a lightweight, reactive local workspace model.

### 2. Raw save data and editable state are separate

Do not scatter raw binary mutation throughout UI components.

Use explicit layers:

```txt
Svelte UI
  ↓
Editor/domain services
  ↓
TinyBase workspace store
  ↓
Parser/serializer
  ↓
Raw save blob/file storage
```

The raw save file should be stored separately as a file/blob-like artifact.

TinyBase should store:

- Parsed Pokémon rows.
- Box rows.
- Trainer metadata.
- Validation issues.
- Editor selections.
- Dirty flags.
- Backups metadata.
- Recent file metadata.
- Preferences.

### 3. UI components should not directly own persistence logic

Svelte components should call domain/editor services, not directly mutate TinyBase tables everywhere.

Prefer:

```ts
await updatePokemon(pokemonId, patch);
await movePokemon(pokemonId, { box: 2, slot: 14 });
await exportCurrentSave();
```

Avoid:

```ts
store.setCell('pokemon', pokemonId, 'species', species);
store.setCell('pokemon', pokemonId, 'level', level);
store.setCell('saveFiles', saveFileId, 'dirty', true);
```

TinyBase mutations should be centralized behind services so that validation, dirty-state updates, checkpoints, and future persistence/sync changes remain manageable.

### 4. Design for future sync without implementing sync now

v1 should not require a backend.

However, the schema should avoid choices that make sync painful later:

- Use globally stable IDs.
- Track timestamps where useful.
- Track parser/schema versions.
- Keep raw artifact references explicit.
- Avoid local-only integer primary keys for durable entities.
- Keep a clean repository/service boundary.

### 5. Preserve save-file fidelity

The app must be able to reconstruct a valid save file.

The parser/serializer layer should preserve unknown or currently unsupported binary regions where possible.

TinyBase should not become a lossy representation of the save file.

---

## Proposed Source Layout

Suggested structure:

```txt
src/lib/pksx/
  parser/
    parseSave.ts
    serializeSave.ts
    formats/
      index.ts
      scarletViolet.ts
      swordShield.ts
      legendsArceus.ts

  domain/
    types.ts
    ids.ts
    validation.ts
    legality.ts

  store/
    tinybase.ts
    schema.ts
    tables.ts
    values.ts
    persistence.ts
    checkpoints.ts
    selectors.ts

  services/
    importSave.ts
    exportSave.ts
    updatePokemon.ts
    movePokemon.ts
    validatePokemon.ts
    backupSave.ts
    loadWorkspace.ts

  storage/
    blobs.ts
    opfs.ts
    indexedDbBlobs.ts
```

The names can change, but the boundary should remain:

- `parser/`: binary parsing/serialization.
- `domain/`: app types and pure business logic.
- `store/`: TinyBase setup and local state schema.
- `services/`: mutations/workflows used by the UI.
- `storage/`: raw save/blob persistence.

---

## TinyBase Store Design

TinyBase has two useful concepts for this project:

1. **Tables** for structured entities.
2. **Values** for global editor/UI state.

### Tables

Initial candidate tables:

```txt
saveFiles
pokemon
boxes
trainerProfiles
validationIssues
backups
presets
recentFiles
```

### Values

Initial candidate values:

```txt
currentSaveFileId
selectedPokemonId
selectedBox
activePanel
isDirty
isImporting
isExporting
autosaveEnabled
lastOpenedAt
```

---

## Table: saveFiles

Stores metadata about imported save files and local workspaces.

Suggested columns:

```txt
id: string
name: string
game: string
originalFileName: string
importedAt: string
updatedAt: string
rawBlobRef: string
checksum: string | null
checksumStatus: 'valid' | 'invalid' | 'unknown'
parserVersion: string
schemaVersion: number
dirty: boolean
```

Notes:

- `rawBlobRef` points to the raw save artifact in blob/file storage.
- `dirty` indicates TinyBase workspace data has unsaved changes relative to the export artifact.
- `parserVersion` helps invalidate/rebuild parsed projections after parser updates.
- `schemaVersion` helps migrate local workspace data.

---

## Table: pokemon

Stores parsed Pokémon entities from a save file.

Suggested columns:

```txt
id: string
saveFileId: string
box: number | null
slot: number | null
partySlot: number | null
species: string
form: string | null
nickname: string | null
level: number
shiny: boolean
nature: string | null
ability: string | null
heldItem: string | null
moves: string
ivs: string
evs: string
legalityStatus: 'valid' | 'invalid' | 'unknown'
rawOffset: number | null
updatedAt: string
```

Notes:

- `moves`, `ivs`, and `evs` can start as serialized JSON strings if TinyBase cell constraints make nested structures awkward.
- If nested data becomes heavily queried, split them into separate tables later.
- `rawOffset` can help the serializer map a row back to a binary location when applicable.
- Do not assume every Pokémon is in a box; party, daycare, battle teams, or other game-specific storage may need different location metadata.

Possible future normalization:

```txt
pokemonMoves
pokemonRibbons
pokemonMemories
pokemonMetLocations
```

Start simple. Normalize only when needed.

---

## Table: boxes

Stores box metadata.

Suggested columns:

```txt
id: string
saveFileId: string
index: number
name: string | null
wallpaper: string | null
```

Suggested ID strategy:

```txt
box:{saveFileId}:{index}
```

---

## Table: trainerProfiles

Stores trainer/save metadata.

Suggested columns:

```txt
id: string
saveFileId: string
trainerName: string
trainerId: string | null
secretId: string | null
game: string
language: string | null
money: number | null
playTime: number | null
updatedAt: string
```

---

## Table: validationIssues

Stores validation/legal checking output.

Suggested columns:

```txt
id: string
saveFileId: string
pokemonId: string | null
severity: 'info' | 'warning' | 'error'
code: string
message: string
createdAt: string
```

Notes:

- Validation issues should be derived and replaceable.
- The validation service can clear and recompute issues for a Pokémon or entire save.

---

## Table: backups

Stores metadata for raw save snapshots.

Suggested columns:

```txt
id: string
saveFileId: string
createdAt: string
reason: string
rawBlobRef: string
summary: string | null
```

Use cases:

- Backup before import transformation.
- Backup before export.
- Manual checkpoint.
- Recovery after risky edits.

---

## Table: presets

Stores user-created editing presets.

Suggested columns:

```txt
id: string
kind: 'pokemon' | 'move-set' | 'ev-spread' | 'trainer' | 'other'
name: string
payload: string
createdAt: string
updatedAt: string
```

`payload` can be JSON.

---

## Table: recentFiles

Stores recent local workspaces/imports.

Suggested columns:

```txt
id: string
saveFileId: string
name: string
lastOpenedAt: string
```

---

## Values

Suggested values:

```txt
currentSaveFileId: string | null
selectedPokemonId: string | null
selectedBox: number | null
activePanel: string
isDirty: boolean
isImporting: boolean
isExporting: boolean
autosaveEnabled: boolean
```

Values are ideal for editor state that does not deserve its own durable table row.

---

## Service Layer

All UI-facing workflows should go through service functions.

### importSave

Responsibilities:

1. Accept a `File` or binary buffer.
2. Store the raw file as a blob artifact.
3. Parse the save.
4. Populate TinyBase tables.
5. Set editor values.
6. Create an initial checkpoint.
7. Mark the workspace clean.

Example API:

```ts
export async function importSave(file: File): Promise<{ saveFileId: string }>;
```

### exportSave

Responsibilities:

1. Read current workspace rows from TinyBase.
2. Apply edits to the parsed save model.
3. Serialize a valid save binary.
4. Validate checksum/format.
5. Return a downloadable `Blob` or `File`.
6. Optionally create a backup.
7. Mark workspace clean if export is considered saved.

Example API:

```ts
export async function exportCurrentSave(): Promise<Blob>;
```

### updatePokemon

Responsibilities:

1. Validate the patch shape.
2. Create checkpoint if needed.
3. Update the `pokemon` row.
4. Mark the associated save dirty.
5. Recompute validation issues for that Pokémon.

Example API:

```ts
export async function updatePokemon(pokemonId: string, patch: PokemonPatch): Promise<void>;
```

### movePokemon

Responsibilities:

1. Validate source and target locations.
2. Create checkpoint.
3. Update affected Pokémon rows.
4. Mark save dirty.
5. Refresh indexes/views as needed.

Example API:

```ts
export async function movePokemon(
	pokemonId: string,
	target: { box: number; slot: number }
): Promise<void>;
```

### validatePokemon

Responsibilities:

1. Run legality/consistency checks.
2. Replace validation issues for the Pokémon.
3. Update `legalityStatus` on the `pokemon` row.

Example API:

```ts
export async function validatePokemon(pokemonId: string): Promise<void>;
```

---

## Persistence Strategy

### v1 persistence

Use TinyBase persistence for the workspace state.

Use separate blob/file storage for raw save files and backups.

Recommended initial browser storage targets:

```txt
TinyBase data: IndexedDB or OPFS-backed persistence
Raw files/backups: OPFS preferred where available, IndexedDB blob fallback
```

The app should support graceful fallback because PWA/browser environments vary.

### Platform storage split

The Local Library storage boundary should hide platform-specific durability choices:

```txt
Web/PWA Local Library adapter: IndexedDB initially, OPFS later where useful
Capacitor Local Library adapter: native-capable storage, likely SQLite metadata plus filesystem or SQLite-backed bytes
TinyBase workspace persister: chosen separately from raw artifact storage
```

Do not assume the web IndexedDB adapter is the final native Capacitor storage implementation. WebView-managed IndexedDB is acceptable for the browser/PWA skeleton, but native builds need a storage adapter with mobile durability expectations. Track that work separately from the TinyBase workspace setup.

### Why separate raw blobs from TinyBase rows?

Raw save files are binary artifacts and can be large. They should not be forced into tabular cells unless there is a strong reason.

TinyBase should reference them with `rawBlobRef`.

This keeps the workspace tables fast and keeps binary export/import logic explicit.

---

## Undo and Checkpoints

TinyBase checkpoint/undo support should be used for editor operations.

Suggested checkpoint moments:

- After import.
- Before editing a Pokémon.
- Before moving Pokémon between slots.
- Before bulk edits.
- Before applying presets.
- Before export.

Do not create a checkpoint for every keystroke unless UX requires it. Prefer debounced or operation-level checkpoints.

Suggested API:

```ts
createCheckpoint('before-update-pokemon');
undo();
redo();
```

---

## Derived Views, Indexes, and Queries

TinyBase should be used to create fast local views for editor UI.

Candidate indexes:

```txt
pokemonBySaveFileId
pokemonByBox
pokemonBySpecies
validationIssuesByPokemonId
validationIssuesBySaveFileId
backupsBySaveFileId
```

Candidate UI selectors:

```ts
getCurrentSaveFile();
getSelectedPokemon();
getPokemonInBox(saveFileId, boxIndex);
getValidationIssuesForPokemon(pokemonId);
getInvalidPokemon(saveFileId);
getRecentFiles();
```

---

## ID Strategy

Use stable string IDs.

Recommended options:

```txt
UUID: general-purpose IDs
ULID: sortable IDs
Deterministic IDs: for structural entities like boxes
Content-derived IDs: only where deduplication matters
```

Avoid auto-increment integer IDs for durable local-first entities.

Examples:

```txt
saveFile id: uuid/ulid
pokemon id: uuid/ulid generated on import
box id: box:{saveFileId}:{index}
validation issue id: issue:{pokemonId}:{code} or uuid
backup id: uuid/ulid
```

---

## Schema Versioning

Track versions explicitly.

Suggested version fields:

```txt
saveFiles.schemaVersion
saveFiles.parserVersion
```

Use cases:

- Rebuild parsed projections when the parser improves.
- Migrate local TinyBase table shapes.
- Detect stale validation output.

---

## Sync: Not in v1

Backend sync should not be implemented in v1.

For v1, the product should work fully offline and should not require accounts.

Future sync possibilities:

1. File-based manual export/import.
2. Encrypted backup service.
3. TinyBase sync/persister integrations.
4. RxDB migration if the app becomes a document database/vault.
5. PowerSync/Electric if the app becomes backend/Postgres-centered.

---

## Why Not RxDB for v1?

RxDB is still a strong option, but it is likely heavier than needed for the first version of `pksx`.

RxDB is best when the app is fundamentally a long-lived local database with document collections and replication.

That may fit a future `pksx` if it becomes:

- A Pokémon vault.
- A multi-save archive.
- A searchable cross-game collection manager.
- A synced cloud product.
- A document-oriented offline-first app with serious replication needs.

For v1, the more urgent needs are editor-state reactivity, undo/redo, import/export fidelity, and safe workspace persistence. TinyBase fits those needs with less ceremony.

### Keep migration optional

To preserve the option to migrate to RxDB later:

- Keep Svelte components isolated from TinyBase internals.
- Use domain services for mutations.
- Keep parser/serializer independent from TinyBase.
- Keep raw save blobs separate from TinyBase rows.
- Use stable IDs.
- Avoid TinyBase-specific types leaking across the app.

If a future migration happens, the app can replace the storage implementation behind the service layer.

---

## Implementation Checklist for Codex

### 1. Add TinyBase

Install TinyBase and relevant Svelte/persistence packages as needed.

### 2. Create store module

Create:

```txt
src/lib/pksx/store/tinybase.ts
src/lib/pksx/store/schema.ts
src/lib/pksx/store/values.ts
src/lib/pksx/store/selectors.ts
src/lib/pksx/store/persistence.ts
src/lib/pksx/store/checkpoints.ts
```

### 3. Define table/values schema

Add initial tables:

```txt
saveFiles
pokemon
boxes
trainerProfiles
validationIssues
backups
presets
recentFiles
```

Add initial values:

```txt
currentSaveFileId
selectedPokemonId
selectedBox
activePanel
isDirty
isImporting
isExporting
autosaveEnabled
```

### 4. Add domain types

Create:

```txt
src/lib/pksx/domain/types.ts
src/lib/pksx/domain/ids.ts
```

Define core types:

```txt
SaveFileSummary
PokemonSummary
BoxSummary
TrainerProfile
ValidationIssue
BackupSummary
PokemonPatch
```

### 5. Add service layer

Create:

```txt
src/lib/pksx/services/importSave.ts
src/lib/pksx/services/exportSave.ts
src/lib/pksx/services/updatePokemon.ts
src/lib/pksx/services/movePokemon.ts
src/lib/pksx/services/validatePokemon.ts
src/lib/pksx/services/backupSave.ts
```

Services should own TinyBase writes and side effects.

### 6. Add raw blob storage abstraction

Create:

```txt
src/lib/pksx/storage/blobs.ts
```

Expose APIs:

```ts
export async function putBlob(bytes: Uint8Array): Promise<string>;
export async function getBlob(ref: string): Promise<Uint8Array>;
export async function deleteBlob(ref: string): Promise<void>;
```

Implementation can start with IndexedDB byte storage for web/PWA and later add OPFS. Capacitor should get a separate native-capable implementation; see issue #15.

### 7. Add parser/serializer stubs

Create:

```txt
src/lib/pksx/parser/parseSave.ts
src/lib/pksx/parser/serializeSave.ts
```

Even if real parsing is incomplete, keep the interface stable:

```ts
export async function parseSave(buffer: ArrayBuffer): Promise<ParsedSave>;
export async function serializeSave(input: SerializeSaveInput): Promise<ArrayBuffer>;
```

### 8. Wire minimal UI

Replace the starter page with a minimal flow:

- Import file input.
- Show current save metadata.
- Show boxes.
- Show Pokémon list for selected box.
- Show selected Pokémon details.
- Allow a small edit.
- Mark dirty.
- Export.

### 9. Add tests

Prioritize tests for:

- ID generation.
- Import service behavior.
- Update service behavior.
- Dirty-state behavior.
- Validation issue replacement.
- Blob put/get/delete.
- Parser/serializer round-trip when available.

---

## Non-Goals for v1

Do not implement yet:

- Backend sync.
- User accounts.
- Collaborative editing.
- Server-hosted save storage.
- Full cloud backup.
- ElectricSQL/PowerSync integration.
- RxDB migration.
- Deep relational normalization of every Pokémon substructure.

---

## Final Decision

Use TinyBase for v1 because `pksx` is first and foremost a local save editor.

TinyBase gives the project the right initial shape:

```txt
small local-first reactive workspace
+ safe import/export boundaries
+ undoable editor mutations
+ local persistence
+ future sync optionality
```

RxDB remains a valid future option if the product grows into a larger persistent Pokémon database/vault with heavier sync and replication requirements.
