---
name: PKSX
description: Offline-first Pokemon save management with a box-first, controller-friendly UI.
colors:
  parchment: '#f4ecdf'
  cream-paper: '#fbf6ec'
  sunken-paper: '#ebe2d2'
  ink: '#2a241c'
  ink-soft: '#5a4d3b'
  ink-mute: '#72634c'
  rule: 'rgba(42, 36, 28, 0.08)'
  rule-strong: 'rgba(42, 36, 28, 0.14)'
  rust: '#a14a2c'
  rust-wash: 'rgba(161, 74, 44, 0.1)'
  rust-ring: 'rgba(161, 74, 44, 0.55)'
  on-rust: '#ffffff'
  backdrop: 'rgba(42, 36, 28, 0.45)'
  brass: '#c89a3e'
  sage: '#4a7340'
  amber: '#8a5600'
  signal-red: '#b03232'
  night-ink: '#0e0f12'
  night-panel: '#181a1e'
  night-sunken: '#08090b'
  moonlight: '#f4f5f7'
  moonlight-soft: '#b8bcc4'
  moonlight-mute: '#959baa'
  night-rule: 'rgba(255, 255, 255, 0.08)'
  night-rule-strong: 'rgba(255, 255, 255, 0.18)'
  ember: '#ff8a5c'
  ember-wash: 'rgba(255, 138, 92, 0.14)'
  ember-ring: 'rgba(255, 138, 92, 0.7)'
  on-ember: '#1a120d'
  night-backdrop: 'rgba(0, 0, 0, 0.6)'
  night-brass: '#f0c060'
  night-sage: '#7ed99a'
  night-amber: '#e0a43a'
  night-red: '#ff6f6a'
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '24px'
    fontWeight: 800
    lineHeight: 1.05
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '16px'
    fontWeight: 800
    lineHeight: 1.1
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '12px'
    fontWeight: 750
    lineHeight: 1.15
  caption:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: '10px'
    fontWeight: 650
    lineHeight: 1.25
  editable:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '16px'
    fontWeight: 500
rounded:
  xs: '4px'
  sm: '8px'
  md: '11px'
  lg: '14px'
  xl: '18px'
  density-small: '4px'
  density-medium: 'calc(4px + clamp(2px, 0.9cqh, 6px))'
  density-large: 'calc(6px + clamp(3px, 1.35cqh, 9px))'
spacing:
  unit: 'clamp(2px, 0.9cqh, 6px)'
  space-2: 'clamp(4px, 1.8cqh, 12px)'
  space-3: 'clamp(6px, 2.7cqh, 18px)'
  space-4: 'clamp(8px, 3.6cqh, 24px)'
  shell: 'clamp(10px, calc(3.125cqw - 22px), 18px)'
  control: 'clamp(32px, 9.4cqh, 44px)'
  small-control: 'clamp(24px, calc(clamp(32px, 9.4cqh, 44px) * 0.75), 33px)'
  slot-minimum: '44px'
components:
  slot:
    backgroundColor: 'oklch(0.9 var(--slot-chroma) var(--slot-hue))'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '4px'
    size: '44px'
  slot-empty:
    backgroundColor: '{colors.sunken-paper}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.md}'
  menu-row:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.density-small}'
    height: '{spacing.small-control}'
  menu-row-focus:
    backgroundColor: '{colors.rust-wash}'
    textColor: '{colors.rust}'
  menu-row-unavailable:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-soft}'
  button-primary:
    backgroundColor: '{colors.rust}'
    textColor: '{colors.on-rust}'
    typography: '{typography.label}'
    rounded: '{rounded.density-small}'
    height: '{spacing.small-control}'
  button-primary-hover:
    backgroundColor: '{colors.rust-ring}'
  card-save-file:
    backgroundColor: '{colors.cream-paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.density-small} {rounded.density-large} {rounded.density-large} {rounded.density-small}'
    height: '112px'
    width: '240px'
  menu-panel:
    backgroundColor: '{colors.cream-paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.density-large}'
    width: '320px'
  takeover:
    backgroundColor: '{colors.cream-paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.density-large}'
    width: '760px'
    height: '560px'
  toast:
    backgroundColor: '{colors.cream-paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '9px 8px 9px 10px'
    width: '360px'
---

# Design System: PKSX

## Overview

**Creative North Star: "The Collector's Case"**

PKSX is a display case for a collection. Each Box is a tray, and each Slot is a small tinted cell that frames one specimen: a pixel sprite from the offline Sprite Catalog. Everything around the tray is quiet so that the Pokemon carry the color. The light theme is warm paper and dark ink with one rust accent. The dark theme is near-black with an ember accent. Both themes keep the same structure.

The mood is warm, tactile, and quiet. Surfaces feel like paper with a soft lift. A faint diagonal grain and two very soft radial washes give the canvas texture without pattern noise. Density follows the container, not the device: room grows with height, and the type scale stays fixed. The shell reserves no chrome, so the collection fills the Safe Canvas.

PKSX rejects the dense PKHeX-style desktop form. No screen is a wall of labelled fields. Editing happens in focused Takeovers, and the Box grid is always the home position.

**Key Characteristics:**

- Type-tinted Slots are the main source of color. Chrome stays neutral.
- One accent (Rust in light, Ember in dark) marks focus, the active item, and the primary action.
- Mono numerals for indexes, levels, stats, captions, and filenames.
- Soft structural shadows with a 1px inner highlight. No glows.
- Fixed type ladder; spacing and control height scale with container height.
- Every target is reachable by controller and shows a clear focus ring.

## Colors

A warm, low-saturation paper palette with one fired-clay accent, inverted to a cool near-black for dark mode.

### Primary

- **Rust** (light) and **Ember** (dark): the only accent. Use it for Controller Focus outlines, the active Save File, hover and focus text on Menu rows, the filled primary action, and the Toast mark. **Rust Wash** and **Ember Wash** fill hovered and selected rows. **Rust Ring** and **Ember Ring** draw focus outlines and stronger active borders.

### Secondary

- **Brass** (light) and **Night Brass** (dark): a warm highlight. Use it for the Carry source Slot ring and other "this is where it came from" marks. It is not a second action color.

### Tertiary (feedback)

- **Sage** / **Night Sage**: success and available state, valid Carry destinations, and the Pokemon Storage card tint.
- **Amber** / **Night Amber**: warning and stale state.
- **Signal Red** / **Night Red**: errors, invalid Carry destinations under focus, and destructive warnings.

### Neutral

- **Parchment** / **Night Ink**: the full-screen canvas.
- **Cream Paper** / **Night Panel**: raised surfaces: panels, cards, Menu panels, Takeovers, Toasts, Menu rows.
- **Sunken Paper** / **Night Sunken**: recessed fills: empty Slots, unavailable Menu rows, quiet wells.
- **Ink** / **Moonlight**: primary text.
- **Ink Soft** / **Moonlight Soft**: supporting labels and status text.
- **Ink Mute** / **Moonlight Mute**: metadata, counters, and the location caption in Menus.
- **Rule** / **Night Rule**: low-emphasis separators and card borders.
- **Rule Strong** / **Night Rule Strong**: grouped boundaries, empty Slot dashes, Takeover inner edge.

### Slot type tints

Slot fills are computed, not tokens. A filled Slot uses `oklch(0.9 chroma hue)` from the PKHeX-projected type of its Pokemon. A dual-type Slot splits two fills on a 135° diagonal at 55%. In dark mode the tint mixes 16% of `oklch(0.72 chroma×0.35 hue)` into Night Panel, so the tray stays dark and the sprite stays readable.

### Named Rules

**The Specimen Color Rule.** Pokemon carry the color. Chrome uses neutrals and the one accent. Do not add decorative hues to panels, headers, or buttons.

**The One Accent Rule.** Rust (or Ember) means "here" or "do this". If two things on screen are rust, one of them is wrong.

**The Readable Contrast Rule.** Every text token passes WCAG AA (4.5:1) on Parchment, Cream Paper, and Sunken Paper, and the dark equivalents. Text on a Rust or Ember fill uses On Rust or On Ember, never a fixed white.

**The Shared Token Rule.** Components read `--pksx-color-*` tokens, or the shell aliases (`--paper`, `--ink`, `--rust`, and so on) that map to them. Dark mode swaps the tokens on `:root`. Never hard-code a theme color in a component.

## Typography

**Body Font:** Inter when the device has it, then the system UI stack (`-apple-system`, `Segoe UI`, `system-ui`). PKSX ships no web font.
**Label/Mono Font:** `ui-monospace`, `SFMono-Regular`, Menlo.

**Character:** A plain, sturdy sans for words, and a mono for every number a collector compares. The pairing reads like a specimen label.

### Hierarchy

- **Display** (800, 24px, 1.05): screen headings.
- **Title** (800, 16px, 1.1): card headings such as the Save File name, and Takeover section titles.
- **Body** (500, 13px, 1.25): running text and descriptions.
- **Label** (650 to 750, 12px, 1.15): Menu rows, buttons, Toasts, and field labels.
- **Caption** (mono, 700, 10px, 1.25): numerals only, such as Slot indexes. Never words.
- **Editable** (16px minimum): every `input`, `select`, `textarea`, combobox input, and `contenteditable`. The floor is unconditional.

At an allocated container of at least 900×700, the ladder steps once to 11 / 13 / 15 / 18 / 28px. Both dimensions must meet the threshold.

### Named Rules

**The Fixed Ladder Rule.** Use only the semantic type tokens (`--pksx-type-caption` to `--pksx-type-display`). Raw font sizes fail the design-contract lint.

**The Sentence Case Rule.** No `text-transform: uppercase` and no added letter-spacing. Labels are sentence case in the source. Words are at least 12px (Label).

**The No Kicker Rule.** No eyebrow label above a heading and no section numbers (01, 02, 03). The heading carries its own weight.

**The Mono Numerals Rule.** Numbers that a user compares (indexes, levels, stats, counts, IDs) use the mono family.

## Layout

The shell reserves zero height and width for chrome. No persistent header, tab bar, or status strip. The Main Menu control overlays content at rest. Shell padding is the larger of `clamp(10px, 3.125cqw - 22px, 18px)` and the safe-area inset on each side, with a 10px gap between regions.

Layout has two Height Bands, selected only by raw viewport height: Short below 560 CSS px and Tall at or above it. The band stays fixed while an editable control has focus. Width, aspect, and orientation media queries are not permitted in shipping code; use container queries.

Density comes from container height. Each screen or Takeover owns a `pksx-density` container. The spacing unit is `clamp(2px, 0.9cqh, 6px)`, and the spacing scale is one to four units. A standard control is `clamp(32px, 9.4cqh, 44px)` tall, and a small control is 0.75 of that, clamped to 24 to 33px.

Bounded sizes on large canvases:

- One Box Pane: 800px maximum. Active Slot Detail Rail: 260px maximum.
- Two-pane composition (opened only by the user): 640px per pane around the same rail.
- Saves: 1200px and four columns maximum, top-aligned.
- Tall Takeover: 760×560 maximum. Short Takeover fills the Safe Canvas.

Box Slots never shrink below 44px; the pane scrolls first. Slot labels drop as the Slot gets smaller: name and level above 66px, index above 46px, then the sprite fills 78 to 92% of the Slot.

### Named Rules

**The Zero Chrome Rule.** If a region repeats on every route, it is chrome. Remove it, or summon it.

**The One Surface Rule.** A panel, rail, Menu, or Takeover is the only card. Groups inside it have no fill, border, or shadow of their own; they separate by spacing, a heading, and at most a 1px Rule. Option lists are rows, not boxes.

**The Height Owns Density Rule.** Read height, never width, to decide how much room things get.

## Elevation & Depth

Depth is structural. A soft, warm shadow with a 1px inner highlight on the top edge marks each layer: Slots and cards sit lowest, panels and Menus above them, and Takeovers and Toasts on top. In dark mode the highlight drops to 5 to 7% white and the shadows go to black. Summoned surfaces sit over the Backdrop token (warm ink at 45% in light, black at 60% in dark), and the content behind stays visible but inert.

### Shadow Vocabulary

- **Subtle** (`--pksx-shadow-subtle`): Slots, cards, and small chips at rest.
- **Raised** (`--pksx-shadow-raised`): hovered Slots and emphasized controls.
- **Panel** (`--pksx-shadow-panel`): Menu panels, Takeovers, and rails. A Takeover adds a 1px inset Rule Strong edge.
- **Toast** (two large black drops at 12 to 18%): Toasts only, so they read above everything without a Backdrop.

### Named Rules

**The Soft Lift Rule.** Shadows say "this layer is above that one". Never use a shadow as a glow, a color, or decoration.

**The One Summoned Surface Rule.** At most one Menu or Takeover is visible, over one Backdrop.

## Shapes

Corners are gently rounded and scale a little with density. Small radius is 4px. Medium is 4px plus one spacing unit. Large is 6px plus 1.5 units. The fixed global scale (4 / 8 / 11 / 14 / 18px) is used for Slots and Toasts (11px).

Two shape signatures repeat:

- **The tab corner.** Save File and Pokemon Storage cards use a small radius on the leading edge and a large radius on the trailing edge, like an index tab.
- **The attached edge.** A Menu panel has no radius on the edge it attaches to. It docks to the trailing edge (320px wide) when the screen is wider than tall, and to the bottom edge when it is square or taller.

Sprites are never rounded or clipped. They render pixelated with `image-rendering: pixelated`. Empty Slots use a 1.5px dashed Rule Strong border, which turns solid Rust on focus.

## Components

### Slots

The signature component: a tinted tray cell that frames one sprite.

- **Shape:** square, medium radius (11px), 4px padding, 44px minimum.
- **Filled:** type tint fill, Subtle shadow, pixelated sprite centered on a stable stage. Mono caption index top-left when room allows.
- **Hover:** lifts 1px, gains a 2px inset Rust ring and the Raised shadow. Transitions run 120ms.
- **Focus:** a 2px Rust outline, inset so it never covers the sprite.
- **Empty:** recessed Sunken Paper fill and a dashed border with only the index. No placeholder box and no "Empty" text; the accessible name says it.
- **Label:** a flush band along the bottom edge (Label size, Ink), not a floating pill.
- **Missing sprite:** same size, a bordered square with a mono "?".
- **Carry states:** valid destination gets a Sage inset ring. The source gets a Brass inset ring. An invalid destination goes 60% grayscale at 46% opacity, and a Signal Red ring when focused.

### Menu rows

Pressable and plain.

- **Shape:** small control height, small radius, full width, left-aligned label typography.
- **Default:** no fill, Ink text, no shadow.
- **Hover / Focus:** Rust Wash fill and Rust text. Controller Focus adds the shared inset ring.
- **Current item:** Rust text (plus a dot in the Main Menu). No side stripe, no extra ring.
- **Press:** scales to 0.97 over 120ms with the ease-out curve.
- **Unavailable:** no fill, text at 68% opacity, with the reason under it in Ink Mute at Label size.

### Primary action

- **Style:** filled Rust with white label text, small control height, small radius.
- **Hover / Focus:** fill moves to Rust Ring.
- **Use:** one per surface, such as Close in a Slot Menu or the Pokemon Editor. Other actions on the same surface are quiet buttons: no fill, 1px Rule border, Ink text.

### Cards (Save File, Pokemon Storage)

- **Corner Style:** tab corner (small leading, large trailing).
- **Background:** Cream Paper with a 1px Rule border and the Subtle shadow. Minimum 240×112px.
- **Active Save File:** Rust border at 75% and a Rust Wash gradient at the top.
- **Pokemon Storage:** Sage-tinted border and a faint Sage gradient at the top.
- **Focus:** focus-ring-width outline in Rust Ring, inset.

### Menus

- **Style:** Cream Paper panel with the Panel shadow, large radius on the free corners, over a Backdrop.
- **Placement:** docks to the trailing edge when wider than tall, else to the bottom edge.
- **Content:** a mono location caption, a Rule separator, then the stack of Menu rows.

### Takeovers

- **Style:** Cream Paper with the Panel shadow and a 1px inset Rule Strong edge.
- **Short band:** fills the Safe Canvas with no radius.
- **Tall band:** up to 760×560, centered, large radius.
- **Command variant:** 680px wide, top-aligned, sized by row count.

### Toasts

- **Position:** bottom-trailing, above safe-area insets, 360px maximum. Never takes focus or blocks input.
- **Style:** Cream Paper lifted 8% toward white, 1px Ink border at 12%, 11px radius, label typography.
- **Mark:** an 8px dot with a 4px halo. Rust for info, Sage for success, Signal Red for errors.

### Focus

When input is from a controller, every focused control except Slots and the Location grid gets a 3px Rust Ring outline drawn inside the control (`outline-offset: -3px`), so it never covers neighbouring rows or text. Grids that use `aria-activedescendant` keep the ring transparent and paint focus on the active item. Exactly one focus indicator per control: never stack an outline, a border change, and an underline. Every focusable element keeps at least 5px between its text and its edge (the 3px ring plus 2px of air). Rows and buttons get this from padding. Headings and disclosures that take focus get 8px of inline padding, with a matching negative margin so their text stays aligned. Inline text links are the one exception: they ring outside the text (`outline-offset: 2px`). Buttons filled with Rust set `--pksx-color-accent-ring` to the on-accent color, so the ring stays visible on the fill.

### Motion

- **Ease out** (`cubic-bezier(0.23, 1, 0.32, 1)`): state changes and route transitions.
- **Drawer ease** (`cubic-bezier(0.32, 0.72, 0, 1)`): Menus that slide from an edge.
- **Route transition:** old view fades out in 140ms with a 4px slide, new view fades in over 180ms with an 8px slide, in the direction of travel. Reduced motion removes it.
- **Micro feedback:** 120ms for Slot hover and press.

## Do's and Don'ts

### Do:

- **Do** let Slot type tints and sprites carry the color. Keep chrome on Parchment, Cream Paper, and Ink.
- **Do** use the semantic type tokens and the mono family for numbers.
- **Do** size controls with `--pksx-control-height` or the small control token, and mark custom controls with `data-pksx-control-category`.
- **Do** render sprites pixelated and unclipped at 78 to 92% of the Slot.
- **Do** keep the 16px floor on every editable control.
- **Do** show unavailable commands with a reason, not by hiding them.
- **Do** use container queries for layout, and the Height Band for the one Short/Tall switch.

### Don't:

- **Don't** build dense PKHeX-style desktop forms. Put editing in a focused Takeover.
- **Don't** reserve space for headers, tab bars, or status strips.
- **Don't** use width, aspect, or orientation media queries in shipping code.
- **Don't** use a second accent color for actions. Brass marks a source, not an action.
- **Don't** use shadows as glows or color effects.
- **Don't** show more than one Menu or Takeover at a time.
- **Don't** use Nintendo, Game Freak, or The Pokemon Company marks, or look-alike official game UI.
- **Don't** hard-code theme colors in components. Read the shared tokens.
- **Don't** put a card inside a card, or a colored side stripe on a card, row, or field.
- **Don't** uppercase or letter-space text, or set words below 12px.
- **Don't** add an eyebrow label or section numbers above a heading.
