# Controller-driven UI without persistent chrome

Research for [#153](https://github.com/woahitsraj/PKSX/issues/153), a ticket on the map [Controller-first responsive shell redesign](https://github.com/woahitsraj/PKSX/issues/151).

**Question.** How do successful controller-driven interfaces handle section navigation, chrome-on-demand status, overlay presentation on short viewports, and discoverability of unlabelled button bindings?

**Sources.** Microsoft (UWP/Xbox design docs, public Xbox Requirements), Apple (tvOS HIG, UIKit/SwiftUI focus documentation, WWDC transcripts), Google (Android TV quality guidelines, design guides, AndroidX source javadoc), Valve (Steam Deck Verified criteria, Steam Input docs, Big Picture announcement via Valve's own news API), Sony (PS5 support docs), and the W3C Gamepad API spec.

**Trust marking is load-bearing.** Vendor guidance here is unevenly published: Microsoft and Google document extensively, Apple documents the focus engine precisely, Valve documents certification criteria, and Sony and Nintendo publish almost nothing (their developer UX requirements are NDA-gated). Claims are marked `[1P]` first-party, `[2P]` press/secondary, `[OBS]` observed convention with no published guideline. **Do not upgrade an `[OBS]` to a `[1P]` when citing this downstream.**

---

## 1. The headline finding: nav belongs on the sides, not the top and bottom

Google states this directly for landscape 10-foot UI `[1P]`:

> Put on-screen navigation controls on the left or right side of the screen and save the vertical space for content.
> — [Android TV layouts](https://developer.android.com/training/tv/start/layouts)

This is primary-source support for the hypothesis behind the redesign: in a wide, short viewport, chrome that spans the full width and consumes height is the wrong geometry. Nav that occupies horizontal space costs nothing on the scarce axis.

Microsoft adds a directly related layout rule `[1P]`: place navigation "against the scroll direction (for example, to the left or right of a vertically scrolling list, or the top or bottom of a horizontally scrolling list)", and

> Unless your initial focus is placed at the bottom of the page, UI elements placed above a long scrolling list are typically more easily accessible than if placed below.

**PKSX's `MobileTabbar` sits below a long scrolling grid — the configuration Microsoft names as worst.**

**Caveat that must travel with §1.** Android TV is landscape-only ("TV screens always display in landscape mode"), so this says _nothing_ about PKSX's first-class portrait requirement. It is one-sided evidence: in portrait the axis economics invert and side-nav becomes the expensive choice.

---

## 2. Chrome on demand: three distinct mechanisms

Every major controller platform has solved "show navigation and durable state without spending permanent pixels." They converge on three mechanisms, which are **not** equivalent in cost.

### Mechanism A — Focus-driven expand/collapse (no button, no gesture)

Strongest citation is AndroidX source `[1P]`. Both `NavigationDrawer` and `ModalNavigationDrawer`:

> displays content associated with the closed state when the drawer is not in focus and displays content associated with the open state when the drawer or its contents are focused on
> — [androidx.tv.material3 NavigationDrawer KDoc](https://github.com/androidx/androidx/blob/androidx-main/tv/tv-material/src/main/java/androidx/tv/material3/NavigationDrawer.kt)

Design guide `[1P]`: "In contrast to the mobile navigation drawer, the navigation drawer on TV has both expanded and collapsed states visible to the user." / "Each item in the navigation rail features a combination of an icon and text, with only the icon visible in the collapsed state."

Constraints: limit to 5–6 destinations (PKSX has 3); every item needs an icon, because the collapsed rail is icon-only; don't mix icon and non-icon items.

Leanback's `BrowseSupportFragment` is the older form `[1P]`: `HEADERS_HIDDEN` collapses the header column by default, selecting it expands it, and `setHeadersTransitionOnBackEnabled` makes Back return to it. (Leanback is deprecated; Compose for TV is current.)

**Why this matters most for PKSX:** it costs _zero buttons_. The mechanism is focus itself, which PKSX already models as a domain concept (**Controller Focus**, **Focus Zone**). It leaves the shoulder-button budget untouched, and it works on a bare phone with no gamepad at all.

### Mechanism B — Summoned overlay on a system-ish button

- **PlayStation 5** `[1P]`: "Press the PS button to display the control center." / "lets you quickly access various features of your PS5 console without leaving your game."
- **Valve** `[1P, via Valve's ISteamNews API]`: "New system menu, for quick navigation to different parts of the interface" (Guide button); "New quick access menu… notifications, friends list, quick settings" (Guide + A). Three surfaces distinguished purely by binding.
- **Microsoft** `[1P]`: the **View** button opens/closes the nav pane, with an explicit rationale:

  > While nav panes are very accessible with mouse and touch, gamepad/remote makes them less accessible since the user has to navigate to a button to open the pane.

  Microsoft's recommended belt-and-braces is **A and B together**: "have the **View** button open the nav pane, as well as allow the user to open it by navigating all the way to the left of the page."

### Mechanism C — Scroll the chrome away

Apple's tvOS tab bar `[1P]`:

> By default, people can scroll the tab bar offscreen when the current tab contains a single main view. […] The exception is when a screen contains a split view […] In this case, the tab bar remains pinned at the top of the view […] Regardless of a tab's contents, focus always returns to the tab bar at the top of the page when people press Menu on the remote.

The guaranteed return path is the **Menu/Back button**, not a persistent affordance. Apple also fixes the geometry: tab bar height 68pt, top edge 46pt from screen top, neither changeable.

### The rule that most directly licenses deleting chrome

Microsoft, verbatim `[1P]`:

> **Note:** If the B button is used to go back, then don't show a back button in the UI. If you're using a Navigation view, the back button will be hidden automatically.

Google agrees `[1P]`: "Unlike on handheld devices, the back button on the remote is used to navigate backward on a TV. It's not necessary to show a virtual back button on the screen."

**Generalised principle: chrome whose only function is already served by a physical button is redundant and should be removed.** That is the cleanest published justification for the redesign's central hypothesis.

---

## 3. The hard limits on "no chrome at all"

### Something must always be focusable

Microsoft `[1P]`:

> One focus visual should always be visible on the screen […] Similarly, **there should be a focusable item onscreen at all times** — for example, don't use pop-ups with only text and no focusable elements.
>
> An exception to this rule would be for full-screen experiences, such as watching videos or viewing images, in which cases it would not be appropriate to show the focus visual.

Apple concurs: "Avoid changing focus without people's interaction."

A focusable box grid satisfies this in the normal case. It bites hardest on **empty states** — no save loaded, empty library — which is precisely ADR 0009's "empty-library guidance" duty.

### A glyph is itself chrome

The structural point that the zero-chrome position has to confront: if a section-switch binding is taught by a persistent on-screen glyph, the header has not been deleted — it has been shrunk.

Microsoft can assume prior training ("Most customers should already be familiar with this accelerator"). **PKSX's users are not Xbox users, and that assumption does not transfer for free.** So [#155](https://github.com/woahitsraj/PKSX/issues/155) must either accept a minimal glyph allowance, or accept that a binding is taught once and thereafter relied on from memory. Mechanism A avoids the dilemma — a visible collapsed rail _is_ its own affordance and needs no glyph to explain it.

### Evidence bearing on ADR 0009 specifically

No vendor publishes "always keep a persistent status strip." Published patterns point the other way — status is summoned (PS5 control center, Valve QAM, Xbox nav pane) or revealed by focus (Android TV drawer). Two counterweights:

- Microsoft favours **always-visible labels** over hover-revealed ones at 10 feet `[1P]`: `CommandBar.DefaultLabelPosition = Right` "will also cause the labels to always be displayed, which works well for the 10-foot experience because it minimizes the number of clicks."
- Microsoft warns against tooltips as a substitute `[1P]`: "**Try to avoid using `Tooltip` when designing for TV.**"

Published consensus: _summon or reveal_ durable state, but when shown, show it plainly as text — not on hover, not in a tooltip. That is compatible with superseding ADR 0009's _persistent_ strip while preserving its _scanable, plain-text_ intent.

---

## 4. Section navigation: what each vendor actually binds

This is the evidence [#156](https://github.com/woahitsraj/PKSX/issues/156) needs, and it contains a genuine conflict for PKSX.

### Apple explicitly assigns shoulders to section navigation `[1P]`

From the HIG game-controls mapping table, for UI _outside_ gameplay:

| Button                | Expected behavior for UI                             |
| --------------------- | ---------------------------------------------------- |
| A                     | Activates a control                                  |
| B                     | Cancels an action or returns to previous screen      |
| **Left shoulder**     | **Navigates left to a different screen or section**  |
| **Right shoulder**    | **Navigates right to a different screen or section** |
| Left/right thumbstick | Moves selection                                      |
| Directional pad       | Moves selection                                      |
| Home/logo             | Reserved for system controls                         |
| Menu                  | Opens game settings or pauses gameplay               |

X, Y, and both triggers are listed with **no** assigned UI behaviour.

### Microsoft assigns bumpers to paging, not sections `[1P]`

Microsoft's accelerator table gives bumpers **Page left/right** for horizontally scrolling views and triggers **Page up/down**. Microsoft does _not_ say "use bumpers to switch tabs"; its documented section-switcher is the **View** button.

**Do not cite Microsoft as blessing bumper-based tab switching. It does not.**

### Valve, Sony, Nintendo

- Valve: L1/R1 tab switching in Big Picture is `[2P]`/`[OBS]` only — corroborated by a bug report in Valve's own tracker, never specified. Not a requirement.
- Sony `[1P]` declines to assign system meaning: L1/L2/R1/R2 are "Use for gameplay functions." Options button "Displays the options menu."
- Nintendo publishes a labelled Joy-Con diagram and nothing about semantics. A=confirm/B=back on Switch is `[OBS]`.

### The conflict PKSX has to resolve

`CONTEXT.md` already spends L1/R1: _"Shoulder navigation changes the active **Box** without changing the current **Focus Zone**."_ Apple's HIG assigns those same buttons to section navigation. Both are defensible; they cannot coexist without a modifier.

Three ways out, in rough order of published support:

1. **Focus-driven section nav (Mechanism A)** — costs no buttons, leaves box navigation untouched, works without a gamepad. Strongest on the evidence.
2. **Menu button summons a section switcher (Mechanism B)** — see §5; index 9 is the safest button on the pad.
3. **Move box navigation to the triggers, give sections the bumpers** — aligns with Apple's table, but Microsoft assigns triggers to Page up/down, and triggers are analog and easy to half-press. Weakest.

There is also a standing argument against inventing a binding at all, Apple `[1P]`: "Prefer using standard gestures to perform standard actions… Redefining or repurposing standard remote behaviors can cause confusion" and "Define new gestures only when it makes sense in your app." **Every non-conventional binding PKSX adds is a teaching cost it pays forever.**

---

## 5. Button reliability — which inputs actually exist

This **materially corrects** the earlier charting note on [#156](https://github.com/woahitsraj/PKSX/issues/156), which treated every unbound index as freely available.

### Gamepad presence is undetectable until first input `[1P]`

> To mitigate fingerprinting, `getGamepads()` returns an empty list before a gamepad user gesture has been seen.
> — [W3C Gamepad API](https://www.w3.org/TR/gamepad/)

A bare phone returns an empty list forever. A Backbone-attached phone returns an empty list **until the user presses something**. PKSX therefore cannot render controller glyphs on load — the default state must be input-agnostic, with legends appearing reactively after `gamepadconnected`.

The spec names buttons only positionally ("Bottom button in right cluster"), never "A" or "Start", and index meaning is portable only when `mapping === "standard"`. If `mapping === ""`, indices carry no meaning.

### Not all buttons exist on all controllers `[1P Apple]`

In `GCExtendedGamepad`, these are **optional/nullable**: `leftThumbstickButton`, `rightThumbstickButton`, `buttonOptions` (Select/View equivalent, ≈ index 8), `buttonHome`. `buttonMenu` (≈ index 9) is **non-optional**.

Microsoft `[1P]`: A/Select, B/Back, D-pad, **Menu**, **View** are on both gamepad and remote; X, Y, sticks, triggers, bumpers are **gamepad-only**. Its warning: using single-device buttons "for critical interactions may create a situation where the user is unable to interact with certain parts of the UI."

Google, quality requirement TV-DM `[1P]`: "The app does not depend on a remote control device having a Menu button," and "Not all game controllers provide Start, Search, or Menu buttons. Do not make your UI depend on these buttons." Google's minimum operable set is **d-pad + Select + Back + Home only**.

### Revised availability table

| Index  | Button        | Verdict for PKSX                                                                            |
| ------ | ------------- | ------------------------------------------------------------------------------------------- |
| 0, 1   | A, B          | Reliable. Already bound (`Enter`, `Escape`), matches every vendor.                          |
| 2, 3   | X, Y          | Reliable on gamepads, absent on remotes. Y is Microsoft's search accelerator. PKSX binds 3. |
| 4, 5   | L1/R1 bumpers | Reliable on gamepads. Currently spent on box navigation.                                    |
| 6, 7   | Triggers      | Present on Backbone and Deck; analog, easy to half-press.                                   |
| 8      | Select/View   | **Optional on iOS — never a sole path.**                                                    |
| 9      | Menu/Start    | **Most reliable non-face button.** Non-optional on iOS, on remotes per Microsoft.           |
| 10, 11 | Stick clicks  | Optional on iOS. Avoid for UI entirely.                                                     |
| 16     | Guide/PS/HOME | **Never bind.** OS-reserved; Backbone captures its own button.                              |

**Google and Apple genuinely contradict each other here** — Google says don't depend on Menu, Apple says Menu is the one guaranteed button. They address different hardware populations (TV remotes vs. game controllers). PKSX's population is closer to Apple's, but a mechanism needing _no_ button sidesteps the disagreement entirely.

---

## 6. Teaching an unlabelled binding

Published answers converge: **don't label persistently; make bindings queryable, context-scoped, and rendered per-device.**

- **Google Play Games Input SDK / Steam overlay** `[1P]`: declare a machine-readable action→control map, group it by context, let one always-available overlay render the _current context's_ bindings as glyphs (both use Shift+Tab).
- **Deck Verified makes matching glyphs a certification requirement** `[1P]`: "On-screen glyphs must match the inputs being used, whether it's Deck, Steam Controller, or Xbox glyphs. Mouse and keyboard glyphs should not be shown if they are not the active input." Valve also warns against prompts flickering between controller and keyboard icons.
- **Apple** `[1P]`: "Prefer using symbols, not text, to refer to game controller elements" (SF Symbols); "use the connected controller's labeling scheme."
- **Microsoft** `[1P]`: legends optional ("if you like"), but must use Segoe Xbox MDL2 Symbol for shell consistency — and an accelerator must never be the only path: "make sure to provide other methods of access to search."
- **Google** `[1P]`: bind by keycode (position-stable), render prompts per detected family; Switch-style pads swap A/B _labels_ at the same _positions_. Controller images must be branding-free (TV-GC). Never write copy the device can't honour: "Do not use language like 'Tap here to continue'."
- **Don't cache glyphs** `[1P Valve]`: re-gather origins each frame so prompts update when the user rebinds.

### Four rules this yields for PKSX

1. **Glyphs must be input-modality-aware.** Valve's rule forbids controller glyphs when the active input is keyboard/mouse and vice versa. PKSX already sets `data-input-modality` to `controller | keyboard | pointer`; the glyph layer should be driven off that attribute. **Already half-built.**
2. **Glyphs must match the connected pad, not a hardcoded Xbox layout.** Backbone ships Xbox-layout _and_ PlayStation-Edition SKUs with identical indices and different physical labels, and the `id` string is the only discriminator — so glyph family should be **a user setting with a sensible default**, not autodetection.
3. **On the touch path, show the action, not the button.** Apple `[1P]`: "Avoid using abstract shapes or controller-based naming like A, X, or R1 as artwork." A bare phone gets a labelled control, not an "L1" pill.
4. **The cheapest discoverability is not inventing a binding** — see §4.

---

## 7. Overlays on short viewports

### Apple is the most decisive: popovers are unavailable on tvOS

- Popovers `[1P]`: "**Not supported in tvOS or watchOS.**"
- Full-screen `[1P]`: "Apple TV and Apple Watch don't offer full-screen modes because apps and games already fill the screen by default." On TV, full-screen isn't a mode — it's the baseline.
- Sheets, alerts, action sheets: available, "No additional considerations for tvOS."
- Dismissal affordance, differing from mobile `[1P]`: "in iOS, iPadOS, and watchOS apps, people typically expect to find a button in the top toolbar or swipe down; **in macOS and tvOS apps, people expect to find a button in the main content view.**"

### Three Apple modality rules that indict PKSX's current overlay stack

`PokemonEditor.svelte` (2319 lines) opens from a **Slot Action Surface**, which opens from a **Slot**. Apple `[1P]`:

> **Take care to avoid creating a modal experience that feels like an app within your app.** In particular, presenting a hierarchy of views within a modal task can make people forget how to retrace their steps.

> **Let people dismiss a modal view before presenting another one.** […] People need to remember the context they were in before a modal view appears, so presenting multiple views adds to people's cognitive load, especially when a modal view hides another one by appearing on top of it.

> **Aim to keep modal tasks simple, short, and streamlined.**

`CONTEXT.md` encodes Slot → Slot Action Surface → Pokemon Editor as a chain with focus returning down it. Apple's guidance says a chain of modals is the thing to avoid. **A likely resolution: make the Pokemon Editor a route rather than a modal — which also removes it from the box surface's height budget entirely.** That is a live option for [#160](https://github.com/woahitsraj/PKSX/issues/160).

Google's canonical decision surface agrees in form: `GuidedStepSupportFragment` `[1P]` is full-screen and two-panel, and Google's listed use cases include "confirming a decision."

Microsoft adds the visual convention `[1P]`: `LightDismissOverlayMode` "defaults to `Auto`, meaning that it is enabled on Xbox and disabled elsewhere" — a dimming scrim is the controller-context default, not a stylistic choice.

**Honesty constraint:** neither Google nor Apple publishes a sentence saying "prefer full-screen over small dialogs on TV." That preference is a defensible _inference_ from component design plus the 10-foot rationale. The popover unavailability is explicit; the takeover preference is not.

---

## 8. Focus behaviour — how this maps onto `CONTEXT.md`

### Focus restoration after dismiss is the platform default, not a nicety

Apple `[1P]`, `UIViewController.restoresFocusAfterTransition`:

> When the value of this property is true, the item that was last focused automatically becomes focused when its view controller becomes visible and focusable. […] **The default value of this property is true.**

Google's Compose `focusRestorer` `[1P]`: "When focus leaves the focus group, focus stores a reference to the item that was previously focused. Then when focus re-enters the focus group, focus is restored to the previously focused item."

This validates two existing `CONTEXT.md` rules — Slot Action Surface and Pokemon Editor both returning **Controller Focus** to their launching control.

### The rule PKSX does not yet have: what happens when the focused item disappears

Apple `[1P]`, _Focus and selection_:

> Avoid changing focus without people's interaction. […] **The exception is when people are moving focus using an input device that lets them make discrete, directional movements — like a keyboard, remote, or game controller — and a previously focused item disappears. In this scenario, there are only a small number of items within one discrete step of the previously focused item, so moving focus to one of these remaining items ensures that the focus indicator is in a location people can easily find. When people aren't moving focus by using such an input device, you can't predict the item they'll target next, so it's generally best to simply hide the focus indicator when the focused object disappears.**

`CONTEXT.md`'s existing rules cover the case where the launching control still exists. Apple's rule covers the case PKSX **has not specified** — when the launching control is _gone_, which is exactly what a **Clear Slot**, a Move, or an orientation change produces. The answer splits by modality:

- **controller/keyboard** → move focus to a surviving item within one discrete step of the vanished one;
- **pointer** → don't guess; hide the focus indicator.

PKSX already tracks `data-input-modality`, so it has the signal for both branches. **This should become a new `CONTEXT.md` relationship.**

### Focus engagement: the pattern for a large grid in a short viewport

Microsoft's _focus engagement_ `[1P]` describes exactly PKSX's Box grid case. With `IsFocusEngagementEnabled="True"` a list becomes a _single_ focus target: A engages, directional input moves within, B disengages. Motivation:

> if the `ListView` contains a large amount of data, this could be inconvenient and not an optimal user experience […] This will allow the user to quickly skip over the `ListView` by simply pressing down.

This is a close analogue of PKSX's **Focus Zone**. `CONTEXT.md`'s "Back dismisses an open Slot Action Surface before it affects broader app navigation" is already engagement-shaped; the sources suggest generalising it so Back consistently pops one level of engagement.

### Directional navigation only reaches adjacent items

Apple `[1P]`: "directional focus navigation is based on adjacency relationships […] Since there's no focusable view adjacent to the login fields on the left, the button on the bottom is unreachable." Fixes are `UIFocusGuide` and SwiftUI `focusSection()`, with the caution "Use a focus guide only when absolutely necessary."

A trap worth recording — SwiftUI focus sections are **asymmetric** `[1P]`: "because the `VStack` containing buttons '1' - '3' does not declare itself as a focus section, it is impossible to direct focus back to the left from buttons 'A' - 'C'." PKSX already requires explicit Party↔Box transitions; this is why one-way transitions are a real failure mode.

### Microsoft's three named XY-navigation failure modes `[1P]`

1. `IsTabStop`/`Visibility` set wrong.
2. "the control getting focus is actually bigger than you think — XY navigation looks at the total size of the control, not just the portion that renders something interesting."
3. "One focusable control is on top of another — **XY navigation doesn't support controls that are overlapped**."

Plus the unreachable-centre problem: four corner elements and a centre element leaves the centre unreachable "because the vertical and horizontal navigation will be prioritized."

### Other applicable rules

- **Axis discipline** `[1P Google]`: "Give each direction a specific function" — categories vertical, items within a category horizontal. PKSX's Party/Box split already follows this.
- **Back must not toggle** `[1P Google]`: Back "must never act as a toggle" (must not both open and close a menu). PKSX's layered Back-dismissal ordering should be checked against this.
- **Avoid pointer emulation.** Microsoft `[1P]`: "**It is highly recommended that you turn this off and optimize your app for XY navigation**." Apple `[1P]`: "Avoid displaying a pointer." _(Microsoft gives no explicit rationale for why mouse mode is bad — don't attribute one it didn't write.)_
- **Total reachability** `[1P Apple]`: "you need to make sure that people can bring focus to every element in your app."

---

## 9. Hard numbers for the viewport budget ([#152](https://github.com/woahitsraj/PKSX/issues/152))

### Safe area — two vendors, same number

| Source           | Left/right | Top/bottom | Basis         |
| ---------------- | ---------- | ---------- | ------------- |
| Microsoft `[1P]` | 48 epx     | 27 epx     | 5% of 960×540 |
| Google `[1P]`    | 48 dp      | 27 dp      | 5% of 960×540 |

Google's design page also states 58dp for grid margins, contradicting its own 48dp — treat **48/27 as the authoritative 5%**.

Both agree on what should bleed past it. Microsoft `[1P]`: ScrollViewers, nav panes and CommandBars should "extend to the edges of the screen to provide more immersion," but "it's important to keep the focus visual and its associated item inside the TV-safe area." Google `[1P]`: "Don't adjust background screen elements that the user doesn't directly interact with."

**Disanalogy to note:** TV overscan is not phone safe-area insets. PKSX's landscape insets come from notches and home indicators on the _sides_ and are reported by `env(safe-area-inset-*)`. The 5% number is not transferable — but the _principle_ is: backgrounds bleed, focusable content and focus rings do not.

### Legibility floors

| Source                     | Floor                                | Context                                   |
| -------------------------- | ------------------------------------ | ----------------------------------------- |
| Valve Deck Verified `[1P]` | ≥ 9px at 1280×800                    | Smallest character; readable at 12in/30cm |
| Microsoft `[1P]`           | ≥ 15 epx main, ≥ 12 epx supplemental | 10-foot, 1080p @ 200% scale               |
| Microsoft `[1P]`           | ≥ 32 epx                             | Interactive element **height**            |
| Valve Big Picture `[1P]`   | ≥ 24px at 1920×1080                  | 10-foot                                   |

**Valve's Deck number is the relevant one** — a 7″ handheld at arm's length is PKSX's actual case, not a TV across a room. Steam Deck native resolution is 1280×800.

### A density budget worth stealing

Microsoft `[1P]`: "When the user is navigating from one edge of the TV screen to the other, it should take no more than **six clicks** to simplify your UI."

Concrete and testable for [#159](https://github.com/woahitsraj/PKSX/issues/159) — PKSX's current grid almost certainly violates it.

Microsoft's density principle `[1P]`: "The amount of information displayed on a TV should be comparable to what you'd see on a **mobile phone**, rather than on a desktop." This cuts _toward_ the mobile-first inversion.

One cost for density work `[1P Google]`: "provide sufficient padding within the focusable and selectable controls so that the highlights around them are clearly visible" — focus rings need room, and in a short viewport that room is expensive.

### Focus visuals

Microsoft `[1P]`: "the focus visual is displayed by default when using a gamepad or remote control, but _not_ a keyboard." PKSX already distinguishes these via `html[data-input-modality='controller']`.

Google `[1P]`: "use color, size, animation, or a combination […] Use a uniform scheme." Apple `[1P]`: focusable items "can have up to five different states, each of which is visually distinct"; "Rely on system-provided focus effects."

---

## 10. Gaps and non-findings

Recorded explicitly so nobody fills them from memory.

- **No vendor publishes "avoid persistent navigation chrome on TV."** The strongest supported claims are Apple's tab-bar scroll-away and Microsoft's "if B goes back, don't show a back button." The principle in §2 is an inference across sources, not a quote.
- **No numbered Android TV quality requirement mandates a visible focus indicator.** That lives in training/design docs only. There is no TV-FS/TV-FI — don't cite a fake requirement ID.
- **No explicit Google or Apple sentence prefers full-screen over dialogs on TV.** Inference.
- **No public Sony or Nintendo design guidance exists.** Both NDA-gated. Switch button semantics (A=confirm, +/- roles) are `[OBS]`.
- **No first-party Sony page states the PS5 regional confirm-button change as policy.** The outcome (Cross confirms, Circle cancels, uniformly) is `[1P]`; the historical narrative is `[2P]`.
- **Microsoft's Xbox Terminology List** (governing how buttons may be named/depicted) is partner-gated. XR-022 makes it cert-tested but the list isn't public.
- **Valve's L1/R1 library tab-switching is undocumented.** `[2P]`/`[OBS]`.
- **No first-party Valve documentation of QAM/system-menu geometry or focus-return on close.** Edge-anchoring is observed only.
- **Backbone One specifics could not be fetched directly** (backbone.com returns 403). Clickable L3/R3 and analog triggers are `[UNVERIFIED-FETCH]` from search snippets of Backbone's own FAQ.
- **Android TV guidance is landscape-only** and silent on PKSX's first-class portrait requirement. The most-cited finding in this document (§1) inherits that limitation.

---

## 11. What this changes on the map

| Ticket                                                                  | Effect                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#152 viewport budget](https://github.com/woahitsraj/PKSX/issues/152)   | Concrete numbers now available: 5% safe-area principle, ≥9px text at 1280×800, ≥32epx interactive height, six-clicks-edge-to-edge density budget, Deck native 1280×800.                                                                                                                                                                                                                                                         |
| [#155 chrome budget](https://github.com/woahitsraj/PKSX/issues/155)     | "If a button already does it, don't draw it" licenses removal. But something must always be focusable — biting hardest on empty states, exactly ADR 0009's "empty-library guidance" duty. And **a glyph is itself chrome**, so a taught binding may not actually save pixels. Consensus favours summon-or-reveal over persistent, while keeping plain text over tooltips.                                                       |
| [#156 section nav](https://github.com/woahitsraj/PKSX/issues/156)       | **Two corrections.** (a) Apple's HIG explicitly assigns shoulders to section navigation — colliding with `CONTEXT.md` spending L1/R1 on box navigation. (b) The earlier "lots of free buttons" note was too optimistic: index 8 and stick clicks are optional on iOS, index 16 must never be bound, and gamepad presence is undetectable until first input. Focus-driven expand/collapse costs zero buttons and sidesteps both. |
| [#158 overlay model](https://github.com/woahitsraj/PKSX/issues/158)     | Popovers unavailable on tvOS; dismiss affordance belongs in content, not a top bar; don't stack modals — bears directly on `LegalityReportDialog` over `PokemonEditor`. Scrim is the console default.                                                                                                                                                                                                                           |
| [#159 box-first surface](https://github.com/woahitsraj/PKSX/issues/159) | Six-clicks budget; Microsoft's three XY failure modes (oversized controls, overlapped controls, unreachable centre); nav belongs against the scroll direction and _above_ a scrolling list, not below; focus rings need padding.                                                                                                                                                                                                |
| [#160 Pokemon Editor](https://github.com/woahitsraj/PKSX/issues/160)    | Apple's "app within an app" rule indicts the Slot → Slot Action Surface → Editor modal chain. **Making the editor a route rather than a modal** is a live option that removes it from the box surface's height budget.                                                                                                                                                                                                          |
| `CONTEXT.md`                                                            | A new relationship is needed: what **Controller Focus** does when the focused **Slot** disappears (Clear Slot, Move, orientation change) — controller/keyboard moves one discrete step; pointer hides the indicator.                                                                                                                                                                                                            |
