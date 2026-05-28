# PKSX Design System

This document records the current UI language extracted from the Svelte route styles. It is descriptive: tokens should preserve the existing app appearance unless a product decision changes the design direction.

## Token Sources

Shared tokens live in `src/routes/layout.css` as CSS custom properties. Route components should consume these tokens directly or map them through local aliases when existing component CSS already uses shorter names.

### Typography

- `--pksx-font-sans`: app UI font stack.
- `--pksx-font-mono`: compact metadata, box indexes, stats, keyboard hints, and labels.

Observed weights are 500 for body copy, 600-700 for metadata and controls, and 800 for primary headings and marks.

### Color

- `--pksx-color-surface-canvas`: full-screen application canvas.
- `--pksx-color-surface-panel`: raised panels, top bar, controls, and rails.
- `--pksx-color-surface-subtle`: recessed control backgrounds and quiet fills.
- `--pksx-color-text-primary`: primary app text.
- `--pksx-color-text-secondary`: supporting labels and status text.
- `--pksx-color-text-muted`: metadata, counters, and subdued chrome.
- `--pksx-color-border-subtle`: low-emphasis separators.
- `--pksx-color-border-strong`: focused or grouped boundaries.
- `--pksx-color-accent-primary`: active section, focus ring, and primary accent.
- `--pksx-color-accent-wash`: selected and hover washes.
- `--pksx-color-accent-ring`: stronger active borders.
- `--pksx-color-accent-gold`: warm highlight accents.
- `--pksx-color-feedback-success`: positive or available status.
- `--pksx-color-feedback-danger`: error status.

Dark mode overrides are defined with `:root:has(.app-shell.dark)` so global surfaces and app-local aliases stay synchronized with the active theme.

### Shape And Elevation

- `--pksx-radius-xs`: small keyboard hints and meter bars.
- `--pksx-radius-sm`: pills, list rows, and compact chips.
- `--pksx-radius-md`: buttons, brand mark, and primary controls.
- `--pksx-radius-lg`: medium cards and portrait placeholders.
- `--pksx-radius-xl`: app panels and rails.
- `--pksx-shadow-subtle`: buttons and small chips.
- `--pksx-shadow-raised`: brand mark and emphasized controls.
- `--pksx-shadow-panel`: top bar, panels, menus, and rails.

## Extracted Usage

`src/routes/+page.svelte` maps its app-local aliases (`--paper`, `--ink`, `--rust`, `--shadow`, etc.) to shared `--pksx-*` tokens. Route-level CSS is now limited to app shell, workspace layout, and zone layout rules.

Reusable template and scoped CSS live under `src/lib/components/pksx/`:

- `TopBar.svelte`: brand lockup, section pills, search affordance, import/export actions, save chip, offline badge, and theme toggle.
- `StatusStrip.svelte`: status and error message strips.
- `BoxSidebar.svelte`: box navigation list and active/occupied state rows.
- `StorageSlot.svelte`: party and box slot gridcell rendering, sprite/empty states, focus, and dual-type treatment.
- `SlotActionMenu.svelte`: repeated slot action popover.
- `DetailRail.svelte`: Active Slot Detail Rail with a large portrait card, filled or empty state, optional Pokemon details such as type, nature, ability, item, stats, moves, and compact storage metadata. Unavailable fields are omitted rather than rendered as placeholders.
- `MobileTabbar.svelte`: mobile section navigation.
- `types.ts`: shared presentational data shapes for PKSX components.

## Follow-Up Candidates

- Extract the party/box zone headers into components if more routes reuse the storage workspace shell.
- Move the remaining box-grid layout into a `StorageGrid.svelte` component once drag/drop or multi-select behavior is designed.
- Replace any new hard-coded radius, spacing, or font values with shared tokens during future UI work.
