# Height, aspect, and orientation-driven layout: what this stack actually supports

Research for [#154](https://github.com/woahitsraj/pksx/issues/154), under map [#151](https://github.com/woahitsraj/pksx/issues/151).

This answers "what can we build" only. It chooses no strategy and changes no app code.

> **Placement note.** The repo has no prior `docs/research/` directory; the nearest existing
> convention is `docs/architecture/` (e.g. `pkhex-engine-spike.md`). This file was placed under
> `docs/research/` because it is a wayfinder research artifact for a design spec rather than a
> record of an architectural decision. If the repo later consolidates, `docs/architecture/` is the
> natural home.

---

## 0. The stack, verified

Read from the repo, not assumed:

| Thing                 | Value                                                                 | Source                                  |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| Tailwind CSS          | **4.3.0** (`^4.2.2` specified)                                        | `pnpm-lock.yaml`, `package.json`        |
| Svelte                | **5.55.5** (`^5.55.2` specified)                                      | `pnpm-lock.yaml`                        |
| SvelteKit             | 2.57.x with `@sveltejs/adapter-static`                                | `package.json`, `svelte.config.js`      |
| Rendering             | **Fully prerendered at build time** — `export const prerender = true` | `src/routes/+layout.ts:1`               |
| Runes                 | Forced on for all non-`node_modules` files                            | `svelte.config.js`                      |
| Capacitor             | **8.4.2** (core, ios, android)                                        | `package.json`                          |
| iOS deployment target | **15.0**                                                              | `ios/App/App.xcodeproj/project.pbxproj` |
| Android               | `minSdk 24`, `compileSdk 36`, **`targetSdk 36`**                      | `android/variables.gradle`              |
| Viewport meta         | `width=device-width, initial-scale=1, **viewport-fit=cover**`         | `src/app.html:7`                        |
| Tailwind entry        | `@import 'tailwindcss'` — CSS-first, no `tailwind.config.js`          | `src/routes/layout.css:1`               |

Two of these matter more than the rest and are easy to skim past:

- **`prerender = true` means the HTML is generated at build time.** There is no server that sees a
  request, let alone a viewport. Any layout decision made in JS is _necessarily wrong_ in the
  shipped HTML and corrected only after hydration. This is not "SSR cost", it is "the HTML is a
  static guess."
- **`targetSdk 36`** puts the Android build squarely inside Android 15/16 enforced edge-to-edge.
  Safe-area handling there is not optional.

### Current usage inventory

- **30 `@media` blocks** across `src/`, all width-only. Breakpoints in use: 1180, 1120, 1024/1025,
  980, 720, 640, 620, 520, 420 px. The 1024/1025 pair is the structural one; the rest are local
  polish.
- **`dvh` is already in use in 9 places** (`layout.css:113-114,138`, `PokemonEditor.svelte:1573`,
  `PokemonActionDialog.svelte:189`, `SlotActionMenu.svelte:303`, `save-file/+page.svelte:863,1400`).
  One straggler still uses `100vh` (`LegalityReportDialog.svelte:135`).
- **`env(safe-area-inset-*)` appears in 10 places**, mostly as `max(Npx, env(...))` padding on
  `.app-shell`.
- **JS already drives one layout decision**: `src/routes/+page.svelte:441` declares
  `let viewportWidth = $state(1024)` and binds it via `<svelte:window bind:innerWidth>` at line 3530,
  feeding `mobileTabsAvailable = $derived(viewportWidth <= 1024)` at line 462. The prerendered HTML
  therefore hardcodes a **desktop** assumption. This is the existing precedent for a JS escape
  hatch, and its cost is visible below.

---

## 1. Media query axes

### 1.1 `height` / `min-height` / `max-height`

Supported everywhere relevant; these are original Media Queries Level 3 features
([MDN: `height`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/height)). No support risk.

The one thing to know: **`height` in a media query measures the viewport, and on mobile browsers
that is the _large_ viewport** — i.e. it behaves like `lvh`, not `dvh`. It does not track a
collapsing URL bar. That is a feature for us, not a bug: it means a `@media (height < 600px)` rule
does **not** thrash as the user scrolls. It also means a media query's notion of "height" and a
`100dvh` box's notion of "height" can disagree by the toolbar height in a _browser_ tab. Inside a
Capacitor WebView there is no such toolbar, so they agree (see §3).

**Evidence gap:** I did not find a normative spec sentence stating explicitly that `(height)`
resolves against the large viewport. It is the consensus behaviour and matches the design rationale
for `svh`/`lvh`/`dvh`, but treat it as _strongly-held convention, not cited spec_ until verified.

### 1.2 `aspect-ratio`

`@media (aspect-ratio: 16/9)`, `(min-aspect-ratio: ...)`, `(max-aspect-ratio: ...)`. Level 3
feature, universally supported. This is the cleanest expression of "landscape handheld" that
exists: `@media (min-aspect-ratio: 3/2)` says something width alone cannot.

### 1.3 `orientation` — read this definition carefully

MDN, verbatim
([source](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/orientation)):

> **portrait**: The viewport is in a portrait orientation, i.e., the height is greater than or equal
> to the width.
> **landscape**: The viewport is in a landscape orientation, i.e., the width is greater than the
> height.

And the note that matters:

> **Note:** This feature does not correspond to _device_ orientation. Opening the soft keyboard on
> many devices in portrait orientation will cause the viewport to become wider than it is tall,
> thereby causing the browser to use landscape styles instead of portrait.

Consequences for this effort:

- A **square viewport is portrait** (`height >= width`).
- `orientation` is **exactly** `aspect-ratio >= 1` vs `< 1`. It carries no extra information. If
  the spec wants "landscape handheld" to mean something narrower than "wider than tall" — and it
  should, since a 4:3 tablet in landscape is not a Backbone — then `aspect-ratio` with a real
  threshold is the correct feature and `orientation` is the wrong one.
- **A soft keyboard can flip `orientation` mid-session** on a phone held portrait. Any layout that
  restructures on `orientation` will restructure when the user focuses a text input in the Pokemon
  Editor. This is a real hazard for this app, which is full of text inputs.
- Desktop: a short, wide browser window reports `landscape`. Since desktop is the adapt-up case, a
  desktop window reporting the same axis value as a Backbone is a feature if the spec is genuinely
  budget-based — but it means `orientation` alone cannot separate them. Height can.

Baseline: widely available since July 2015 (MDN).

### 1.4 Range syntax

`@media (height >= 700px)` and `@media (400px <= height <= 700px)`.

- Chrome/Edge **104+**, Firefox **63+**, Safari **16.4+** (released 2023-03-28), Opera 91+,
  Samsung Internet 20+.
- Baseline **Newly Available 2023-03-27**; **Baseline Widely Available September 2025**.
- Sources: [caniuse / LambdaTest compat table](https://www.lambdatest.com/web-technologies/css-media-range-syntax),
  [Ahmad Shadeed, Media Queries Range Syntax](https://ishadeed.com/article/range-syntax/).

**Mapping to our floors:** Safari 16.4 corresponds to **iOS 16.4**. Our iOS deployment target is
**15.0**, so an iOS 15 or iOS 16.0–16.3 device would _not_ parse range syntax and would drop those
rules entirely. Android WebView is Play-updatable Chromium and is far past 104 in practice on
`minSdk 24` devices.

This is a genuine, if small, decision point: **either raise the iOS deployment target to 16.4+, or
write height/aspect queries in `min-`/`max-` form**, which has no support question at all. The
`min-`/`max-` form is uglier but costs nothing. Note Tailwind v4's own default breakpoints already
emit range syntax (`@media (width >= 40rem)`), so the range syntax is already in the shipped CSS
regardless — meaning the iOS 15 question is already live for existing Tailwind utilities, not new.

### 1.5 Is there a media feature for the small/large/dynamic viewport?

**No.** There is no `@media (small-height: ...)` or equivalent. The `sv`/`lv`/`dv` distinction
exists only in _units_, not in _media features_. If the spec needs to branch on "how much height do
I have when the browser chrome is expanded", that branch cannot be written as a media query — only
as a `calc()` against `svh`.

### 1.6 Do these re-evaluate on rotation?

Yes — media query re-evaluation on viewport change is the foundational behaviour of the feature and
requires no JS. **However**, I found no primary source that pins down _ordering_ between the media
query flip and the WebView reporting its new dimensions, and there are credible reports of a
transient intermediate layout on iOS during the rotation animation. See §6.

---

## 2. Container queries

### 2.1 What is queryable

The container query size features are **`width`, `height`, `inline-size`, `block-size`,
`aspect-ratio`, and `orientation`** — the same set the map cares about
([CSS Conditional 5](https://drafts.csswg.org/css-conditional-5/); container query text moved here
from css-contain-3, which is now an empty placeholder).

So `@container (orientation: landscape)`, `@container (aspect-ratio > 1.5)`, and
`@container (height < 500px)` are all _syntactically_ available. Support: Chrome **105** (2022-08-30),
Safari **16** (2022-09-12), Firefox **110** (2023-02-14)
([Chrome for Developers](https://developer.chrome.com/blog/cq-polyfill)).
Safari 16 → **iOS 16**, again above our iOS 15 floor.

### 2.2 The catch, and it is the whole ballgame

Per spec, `container-type: size`:

> Applies **style containment and size containment** to the principal box, and establishes an
> independent formatting context.

Size containment in both axes means **the element's own contents no longer contribute to its size**.
A `container-type: size` box that does not have an externally-determined height collapses. This is
not a bug to work around; it is the definitional price of being able to ask about your own height.
(`container-type: inline-size` avoids this by containing only one axis — which is exactly why
inline-size is the one everyone uses, and why it cannot answer a height question.)

**Therefore, answering the central question directly:**

> **Can a container query express a height budget for a component that does not control its own
> container? No.**

A child cannot opt into a height query unilaterally. Some ancestor must (a) set
`container-type: size` and (b) already have a definite height from somewhere else. For that height
to reflect the _viewport_, the chain has to be anchored at the top by something viewport-aware —
`100dvh` on the shell, or a `@media` query. Container queries **redistribute** a height budget that
something above them established; they **cannot originate** one.

This is a real constraint on the spec, not a technicality. It means:

- The height budget must be **declared once, at the shell**, and flow down.
- `PokemonEditor.svelte`, `DetailRail.svelte`, `SlotActionMenu.svelte` etc. cannot each
  independently ask "am I in a short viewport?" via container queries. They can ask "how much room
  did I get?", which is a different and arguably better question — but only if the shell cooperates
  by giving them a sized container.

### 2.3 Can a container query react to an orientation change?

Yes, _if_ the container's dimensions actually change. A container query is invalidated by layout,
and rotation changes layout, so `@container (orientation: landscape)` on a container that is sized
from the viewport will flip on rotation with no JS.

But note what that sentence smuggles in: "sized from the viewport." The container query is only
reporting a fact that some ancestor derived from the viewport. **A viewport-level `@media` (or a
`dvh`-sized shell) is unavoidable as the root of the cascade.** Container queries are the
distribution mechanism, never the source.

**Evidence gap:** I found no primary source describing container query invalidation _timing_ during
an orientation animation specifically. If a rotation animates the container's size, a container
query can plausibly flip partway through the animation and flip back — producing a visible flicker
that a viewport `@media` query would not produce. **Unverified; worth a prototype.**

### 2.4 Style queries — the useful escape hatch

`@container style(--foo: bar)`. Support: Chrome/Edge **111+**, Firefox **128** (mid-2024),
Safari **18+**
([Chrome for Developers: Getting Started with Style Queries](https://developer.chrome.com/docs/css-ui/style-queries),
[caniuse](https://caniuse.com/mdn-css_at-rules_container_style_queries_for_custom_properties)).

**Limited to custom properties in every shipping browser.** Style queries on regular CSS properties
are implemented nowhere.

The pattern this enables is exactly the one the map needs:

```css
/* one place decides the axis */
:root { --pksx-viewport-band: tall; }
@media (max-height: 600px) { :root { --pksx-viewport-band: short; } }

/* any descendant, at any depth, without owning its container */
@container style(--pksx-viewport-band: short) { .detail-rail { ... } }
```

This propagates a **named band** down the tree without any component needing to control its own
container, and without size containment. It is the CSS-only answer to the problem container _size_
queries cannot solve. Its cost is **Safari 18 → iOS 18**, a much higher floor than iOS 15.

### 2.5 Container units

`cqh`, `cqb`, `cqmin`, `cqmax` exist and are well supported alongside container queries.
Per [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/length), when no eligible container
exists they **fall back to the small viewport (`svh`)** — a sane default, but one that will silently
produce plausible-but-wrong sizes if a `container-type` is ever removed. Worth a lint rule.

---

## 3. `dvh` / `svh` / `lvh`

### 3.1 Support

Chrome **108+**, Firefox **101+**, Safari **15.4+**, Edge 108+. Baseline **Widely Available
June 2025**. Safari 15.4 → **iOS 15.4**, which is the one modern unit that is actually within reach
of our iOS 15 floor.

Per MDN, `vh` currently resolves equal to `lvh` in all browsers. Note `100lvh` can therefore _exceed_
the currently-visible area.

### 3.2 The spec's own warning

MDN, on dynamic viewport units:

> the dynamic viewport-percentage units are **not stable, even when the viewport itself is
> unchanged** … using viewport-percentage units based on the dynamic viewport size can cause the
> content to resize while a user is scrolling a page. This can lead to degradation of the user
> interface and cause a performance hit.

For a box-grid app that already sets `overflow: hidden` on the shell at ≥1025px, resize-while-
scrolling is less of a hazard than it would be for a scrolling document — but the performance note
stands for any `dvh`-sized element that is inside a scroller.

### 3.3 Does the problem `dvh` solves even exist in a Capacitor WebView?

**Largely, no — and this is a genuinely useful finding.** `dvh`, `svh`, and `lvh` differ from each
other only when the user agent has _retractable interface chrome_ (a collapsing URL bar). A
Capacitor WKWebView / Android WebView has no address bar and no collapsing toolbar. In that
environment `dvh`, `svh`, `lvh`, and `vh` all resolve to the same value, exactly as they do on
desktop.

**Confidence: moderate, and I want to be honest about why.** The reasoning is sound and follows
directly from the spec definitions (the units are defined in terms of UA interface expansion, and
there is none). But I found **no primary Capacitor or WebKit document that states this in so many
words** — the sources I found reason from the same definitions rather than measuring it. Treat it as
"almost certainly true, cheap to confirm with a one-line prototype in the iOS/Android acceptance
harness we already have (`scripts/run-ios-acceptance.sh`)."

**The exception is the keyboard.** A soft keyboard _can_ change the WebView's height, and whether it
does is platform- and configuration-dependent:

- The app **does not install `@capacitor/keyboard`**. That plugin's `resize` mode
  (`native` / `body` / `ionic` / `none`) is what controls whether the WebView is resized when the
  keyboard appears. Without it, the platform default applies.
- **I could not verify the exact default behaviour on each platform from a primary source.** This is
  a real gap and it matters, because the Pokemon Editor is a form: if the keyboard shrinks the
  WebView, then `dvh` shrinks, and a `dvh`-budgeted layout will restructure under the keyboard.
  Flagged in §7.

### 3.4 Do `dvh`/`svh`/`lvh` recompute on rotation inside the WebViews?

I found **no primary source and no bug report** indicating that viewport units fail to recompute on
rotation in WKWebView or Android WebView. Absence of bug reports for a heavily-used feature is weak
positive evidence, and viewport units are recomputed as part of normal layout, which rotation
forces.

**However** — and this is the honest version — the _safe-area_ half of the same problem is
documented to be flaky in WKWebView (§4), and viewport units and insets are computed at
approximately the same point in the pipeline. It would be unsurprising if a transient bad frame
affected both. **Stated gap: not verified, and I would not build the spec on the assumption that the
first frame after rotation is correct.**

### 3.5 Does `100dvh` include the safe-area regions?

With `viewport-fit=cover` — which we have — yes: the viewport extends under the notch and home
indicator, and `100dvh` is the full extent. Safe-area insets must be applied as _padding inside_
that box, which is what `.app-shell` already does at `layout.css:114-116`. This is correct today.

---

## 4. `env(safe-area-inset-*)` — the weakest link

### 4.1 Baseline behaviour

Four variables, `top`/`right`/`bottom`/`left`. Per
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/env):

> The values are `0` if the viewport is a rectangle and no features — such as toolbars or dynamic
> keyboards — are occupying viewport space; otherwise, it is a `px` value greater than `0`.

They are **dynamic** — they change as the visible content area changes. Baseline widely available
since January 2020. MDN also documents `safe-area-max-inset-*`, the **static** maximum of each
value "when all dynamic user interface features are retracted" — useful precisely when you want a
padding that does _not_ move.

`viewport-fit=cover` is required for the insets to be non-zero on a notched device; we set it.

### 4.2 Landscape vs portrait on iOS

On a notched/Dynamic Island iPhone:

- **Portrait**: `top` is large (status bar + notch), `bottom` is the home indicator, `left`/`right`
  are ~0.
- **Landscape**: `left` **or** `right` is large (whichever side the notch rotated to — it _swaps_
  depending on rotation direction), `bottom` is a smaller home-indicator inset, `top` ~0.

The practical consequence for a landscape-first controller layout: **the horizontal insets are
asymmetric and which side is inset depends on which way the user rotated.** A layout that puts
persistent controls hard against the left edge will be inset on one rotation and flush on the other.
Symmetric `max(Npx, env(left), env(right))` padding is the defensive form.

**Evidence gap:** I did not find an Apple or WebKit document giving the _numeric_ inset values per
orientation. The qualitative shape above is well established; the numbers should be measured on
device rather than assumed.

### 4.3 Across an orientation change — the documented problem

This is the finding that most constrains the spec.

**[WebKit bug 191872](https://bugs.webkit.org/show_bug.cgi?id=191872) — "WKWebView does not set the
`env(safe-area-inset-*)` CSS variables until some arbitrary time after page load" — status: NEW
(open).** Key points from the bug:

- The insets are **not available at initial load** in WKWebView — not at `DOMContentLoaded`, not at
  `window.load`. They appear "at some arbitrary time after the app is loaded."
- The delay is described in the thread as "sub-second, but noticeable."
- Multiple developers confirmed it **still reproduces through iOS 16**.
- The reported consequence is a visual **"jump"** in fixed UI when the values finally land.
- **iOS Safari does not have this problem** — it is specific to WKWebView, i.e. specific to our
  Capacitor builds.
- Commenters report the same symptom after the app has been **suspended and resumed**, suggesting
  it is a general state-transition problem rather than a load-only one.

The bug does not explicitly discuss rotation. But a rotation is a state transition of exactly the
kind implicated, and there is a
[separate historical radar](https://github.com/lionheart/openradar-mirror/issues/18415)
("safe area inset constants are not updated on rotation") reporting that after
portrait → landscape → portrait, `env(safe-area-inset-top)` can be **stuck at 0 until the next
layout pass**. That radar is against UIWebView and is reported as fixed in WKWebView, so it is
**not** direct evidence against current WKWebView — but combined with 191872 still being open, the
honest read is:

> **`env(safe-area-inset-*)` in a Capacitor WKWebView is reliable in steady state and unreliable
> across transitions.** Expect a sub-second window after launch, resume, and plausibly rotation, in
> which the values are stale or zero.

Widely-recommended mitigation, also from the WKWebView-gotchas material: set
`viewport-fit=cover` (done) **and** force
`WKWebView.scrollView.contentInsetAdjustmentBehavior = .never` so iOS does not add its own padding
on top. That is a native-side change in `ios/`, not a CSS one.

**Design implication:** a layout whose _structure_ depends on an inset value will visibly reflow on
launch and on rotation. A layout that uses insets only for _padding_ — the `max(18px, env(...))`
form already in `layout.css` — degrades to "slightly wrong padding for <1s", which is survivable.
**The spec should keep insets out of the structural decision and confine them to padding.**

### 4.4 Android

Android WebView **does** implement `env(safe-area-inset-*)`, but the history is rough:

- Long-standing incorrect behaviour when the status bar is overlaid
  ([capacitor#2840](https://github.com/ionic-team/capacitor/issues/2840),
  [capacitor#6823](https://github.com/ionic-team/capacitor/issues/6823)) — traced to Chromium, and
  the Capacitor thread notes the upstream Chromium bug sat unfixed for a long time. #2840 was locked
  in Nov 2022 while still affecting Capacitor 5.
- **Android WebView < 140 returns incorrect values** for the `safe-area-inset-*` env variables.
  This is stated in Capacitor's own docs.
- **Capacitor 8 ships an official answer**: the
  [**SystemBars plugin**](https://capacitorjs.com/docs/apis/system-bars), introduced in
  **Capacitor v8.0.0**. Its docs say, verbatim:

  > Due to a bug in some older versions of Android WebView (< 140), correct safe area values are not
  > available via the `safe-area-inset-x` CSS `env` variables.

  and it

  > will inject the correct inset values into a new CSS variable(s) named `--safe-area-inset-x` that
  > you can use as a fallback in your frontend styles.

- Ionic hit a _regression_ in the other direction after a recent Android System WebView update
  ([ionic-framework#30654](https://github.com/ionic-team/ionic-framework/issues/30654)) — header and
  footer insets stopped being respected. Evidence that this surface is still moving.

We are on Capacitor **8.4.2** with **`targetSdk 36`**, so edge-to-edge is enforced and the WebView
renders behind the system bars. **We do not currently install SystemBars.** The robust CSS form is
therefore:

```css
padding-bottom: max(10px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
```

i.e. prefer the plugin-injected variable, fall back to `env()`, fall back to zero.

**Evidence gap:** whether Capacitor 8.4.2 _already_ injects `--safe-area-inset-*` without explicitly
adding the SystemBars plugin, and whether those injected values are re-dispatched on rotation, I
could **not** confirm from a primary source. `@capacitor/android` 8.4.2 is installed; the SystemBars
plugin's packaging relative to it is unverified. Flagged in §7.

---

## 5. Tailwind v4 (4.3.0)

### 5.1 What ships natively

- **Default breakpoints are all `min-width`**, and v4 emits them as **range syntax**:
  `sm` 40rem → `@media (width >= 40rem)`, `md` 48rem, `lg` 64rem, `xl` 80rem, `2xl` 96rem
  ([Responsive design](https://tailwindcss.com/docs/responsive-design)).
  Note: `lg` is 64rem = **1024px**, numerically the same as the repo's hand-written breakpoint. That
  coincidence will make grep-based auditing during the redesign misleading.
- **`portrait:` and `landscape:` variants DO exist in v4**, compiling to
  `@media (orientation: portrait)` / `@media (orientation: landscape)`
  ([Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)).
  The docs' own example is a "please rotate your device" message — which tells you how much design
  intent Tailwind invested in the axis.
- **No height variants of any kind.** No `min-h-screen:`-style variant, no aspect-ratio variant.
  (The `aspect-*` _utilities_ exist; the _variant_ does not.)
- **Container query variants are core in v4** — no separate `@tailwindcss/container-queries`
  plugin needed. `@3xs`…`@7xl`, `@min-[…]`, `@max-3xs`…`@max-7xl`, `@max-[…]`. **All of them compile
  to `@container (width >= …)` / `(width < …)` — inline-size only.** There is **no built-in height
  or orientation container variant.**

**Net: Tailwind v4 gives us the orientation axis for free and gives us nothing on the height axis.**
Height is the scarce axis per the map, so the axis that matters is precisely the one with no
built-in support.

### 5.2 What needs a custom variant

`@custom-variant`, documented form
([Functions and directives](https://tailwindcss.com/docs/functions-and-directives)):

```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

and the block form with `@slot`:

```css
@custom-variant supports-grid {
	@supports (display: grid) {
		@slot;
	}
}
```

The block form is what a height variant needs — the media query wraps, and `@slot` is where the
utility lands. So the shape is:

```css
@custom-variant short {
	@media (max-height: 600px) {
		@slot;
	}
}
```

**I did not verify this exact media-query usage against a documented Tailwind example** — the docs
show `@supports`, not `@media`, in the `@slot` form. The mechanism is general and it should work,
but it is **worth compiling once before the spec depends on it.** Flagged in §7.

There is also **`@variant`**, for applying a Tailwind variant to hand-written CSS, and it works
nested inside a rule:

```css
.my-element {
	background: white;
	@variant dark {
		background: black;
	}
}
```

This is directly relevant: the repo's 30 `@media` blocks live in Svelte `<style>` blocks as
hand-written CSS. `@variant` is the bridge that would let those blocks use the same named bands as
the utility classes — _if_ Tailwind processes Svelte `<style>` blocks.

### 5.3 The `--breakpoint-*` namespace

```css
@theme {
	--breakpoint-xs: 30rem;
	--breakpoint-3xl: 120rem;
}
```

generates `xs:` / `3xl:` variants. **It generates `min-width` variants only** — there is no
`--height-breakpoint-*` namespace. A height scale cannot be expressed as theme tokens; it has to be
a set of hand-written `@custom-variant` declarations.

This is a small but real ergonomic finding: **the height axis will not look like the width axis in
authoring.** Width bands are theme data; height bands are code.

### 5.4 Arbitrary variants

The docs show arbitrary variants for selectors (`[&.is-dragging]:`) and explicitly say at-rules work
(`[@supports(display:grid)]:grid`), with underscores standing in for spaces. `[@media(height>=700px)]:`
should follow — **but the docs do not show a `@media` example**, and the `>=` characters inside a
class name are exactly the sort of thing that trips escaping. **Unverified.** Given `@custom-variant`
exists and produces a readable name, arbitrary height variants look like the wrong tool anyway.

### 5.5 Svelte `<style>` blocks

**This is the biggest unverified item in the Tailwind section.** Whether `@variant` / `@apply` work
inside a Svelte component `<style>` block under `@tailwindcss/vite` depends on whether those blocks
are run through Tailwind's processing context at all — Svelte compiles `<style>` blocks itself, and
Tailwind's theme/variant context comes from the `@import 'tailwindcss'` entry file, which a
component `<style>` block does not import.

Since **all 30 existing media queries live in component `<style>` blocks**, the answer determines
whether the redesign can share one band definition across CSS and utilities, or whether the bands
must be duplicated. **Flagged in §7 as the highest-value thing to test — it is a 10-minute
experiment.**

---

## 6. Svelte 5 options, and what they cost

Framed against the fact that this app **prerenders**: the shipped HTML is a build-time artifact with
no viewport knowledge whatsoever.

### 6.1 `<svelte:window>` does not exist on the server at all

This is sharper than "undefined during SSR". The Svelte **5.55.5** server-transform visitor
directory contains `SvelteHead.js`, `SvelteBoundary.js`, `SvelteElement.js`, `SvelteFragment.js`,
`SvelteSelf.js`, `SvelteComponent.js` — and **no `SvelteWindow.js`**
([source listing](https://unpkg.com/svelte@5.55.5/src/compiler/phases/3-transform/server/visitors/?meta)).
The element is **absent from SSR output entirely**, so a bound variable keeps its **initializer**
through the whole prerender.

Bindable: `innerWidth`, `innerHeight`, `outerWidth`, `outerHeight`, `scrollX`, `scrollY`, `online`,
`devicePixelRatio`; all readonly except `scrollX`/`scrollY`
([Svelte docs](https://svelte.dev/docs/svelte/svelte-window)). **There is no orientation or
aspect-ratio binding.**

**What today's precedent actually costs.** `+page.svelte` is rendered **once at build time** with
`viewportWidth === 1024`, and that value is baked into every static HTML file shipped. Therefore
`mobileTabsAvailable = viewportWidth <= 1024` is **`true` in the prerendered HTML for every user,
including desktop** — the build emits the mobile-tabs-available branch universally, and the real
width arrives only after hydration. On a 1440px desktop that is a guaranteed post-hydration DOM
correction on every cold load.

The failure mode is worth naming: `1024` is **a fake number that reads as a real measurement**.
Nothing in the code signals that it is a guess.

`innerHeight` is also the wrong number on mobile in a way `innerWidth` is not — it does not track the
on-screen keyboard (§6.6).

### 6.2 `MediaQuery` from `svelte/reactivity` — the best JS option

Available **since Svelte 5.7.0**, so present in 5.55.5. Documented signature:

```ts
class MediaQuery extends ReactiveValue<boolean> {
	constructor(query: string, fallback?: boolean | undefined);
}
```

> `fallback` — Fallback value for the server

The docs' own warning, verbatim ([svelte/reactivity](https://svelte.dev/docs/svelte/svelte-reactivity)):

> Use it carefully — during server-side rendering, there is no way to know what the correct value
> should be, potentially causing content to change upon hydration. **If you can use the media query
> in CSS to achieve the same effect, do that.**

That is the framework authors making the CSS-first argument for us.

Three implementation facts, read from the published 5.55.5 source, that the spec should know:

1. **`fallback` is server-only.** The server build is literally
   `constructor(query, matches = false) { this.current = matches; }`
   ([index-server.js](https://unpkg.com/svelte@5.55.5/src/reactivity/index-server.js)). The _client_
   constructor accepts `fallback` and never reads it. So the fallback governs the prerendered HTML
   only; after hydration the value is always the true `matchMedia` result.
2. **Queries are auto-parenthesized.** `new MediaQuery('min-height: 600px')` becomes
   `(min-height: 600px)`; bare keywords (`screen`, `not`, `and`, …) pass through. So
   `new MediaQuery('orientation: portrait')` works as written.
3. **Listeners attach lazily** — it is built on `createSubscriber` (also since 5.7.0), so no
   `change` listener exists unless something reads `.current` in a tracked context. Cost is one
   `matchMedia` object plus one listener, and only while in use.

**Verdict:** same _category_ of problem as `bind:innerWidth` (the server cannot know), but strictly
better: the guess is explicit, per-query, documented, and degrades to a boolean rather than a fake
pixel number. It does **not** eliminate the flash.

### 6.3 `svelte/reactivity/window`

Since **5.11.0**. Exposes `innerHeight`, `innerWidth`, `outerHeight`, `outerWidth`,
`devicePixelRatio`, `scrollX`, `scrollY`, `screenLeft`, `screenTop`, `online` as reactive singletons.

> `innerHeight.current` is a reactive view of `window.innerHeight`. **On the server it is
> `undefined`.**

Typed `ReactiveValue<number | undefined>`, and **no fallback parameter exists**. Worse than
`MediaQuery` for prerendered output (every read site must branch on `undefined`), but better than the
current `$state(1024)` pattern in one important respect: `undefined` is honest and greppable.

### 6.4 Element size bindings (ResizeObserver)

Verbatim from [svelte/bind](https://svelte.dev/docs/svelte/bind):

> All visible elements have the following readonly bindings, measured with a `ResizeObserver`:
> `clientWidth`, `clientHeight`, `offsetWidth`, `offsetHeight`, `contentRect`, `contentBoxSize`,
> `borderBoxSize`, `devicePixelContentBoxSize`

> `display: inline` elements do not have a width or height (except for elements with 'intrinsic'
> dimensions, like `<img>` and `<canvas>`), and cannot be observed with a `ResizeObserver`… Note
> that **CSS transformations do not trigger `ResizeObserver` callbacks.**

This is the only mechanism that measures a _real box_ rather than the viewport, so it is the honest
fallback if container size queries turn out unusable. Zero SSR value; the component paints once at
the wrong size, then corrects.

Per MDN, `ResizeObserver` callbacks run **before paint**, and the Resize Observer spec confirms they
are invoked as part of the HTML spec's _update the rendering_ step
([drafts.csswg.org/resize-observer](https://drafts.csswg.org/resize-observer/)). So the correction is
same-frame, not a visible second frame — provided the callback does not itself resize the observed
box.

⚠️ **Note the loop-error wording.** MDN currently documents the message as
**"ResizeObserver loop completed with undelivered notifications."** The older
_"ResizeObserver loop limit exceeded"_ is legacy Chrome wording. Both appear in the wild; if the spec
ends up asking CI to assert on this, match both.

### 6.5 `$effect` / `$effect.pre` and `{@attach}`

Verbatim from [svelte/$effect](https://svelte.dev/docs/svelte/$effect):

> Effects are functions that run when state updates … **They only run in the browser, not during
> server-side rendering.**

> Your effects run **after the component has been mounted to the DOM**, and in a microtask after
> state changes. Re-runs are batched … and happen **after any DOM updates have been applied.**

`$effect.pre` differs only in timing (before DOM update). Neither runs during prerender.

**Attachments** (`{@attach fn}`, since **5.29**) are the modern way to wire a `ResizeObserver`:

```ts
interface Attachment<T extends EventTarget = Element> {
	(element: T): void | (() => void);
}
```

> Attachments are functions that run in an effect when an element is mounted to the DOM or when
> state read inside the function updates. Optionally, they can return a function that is called
> before the attachment re-runs, or after the element is later removed from the DOM.

Because they run _in an effect_, they are client-only. Falsy values are no-ops
(`{@attach enabled && myAttachment}`), which gives clean conditional wiring. Reactivity trap:
`{@attach foo(bar)}` re-runs on any change to `foo` _or_ `bar`.

### 6.6 The keyboard: `visualViewport` is the only correct source

MDN, verbatim ([VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)):

> The mobile web contains two viewports, the layout viewport and the visual viewport… **User
> interface features like the on-screen keyboard (OSK) can shrink the visual viewport without
> affecting the layout viewport.**

Baseline widely available since **August 2021**. This is why `visualViewport.height !== innerHeight`.
Given the Pokemon Editor is a form and §3.3 leaves the Capacitor keyboard behaviour unresolved,
**`visualViewport` is the only API that correctly reports usable height with a keyboard up.** If the
spec needs a keyboard-aware height budget, this is a forced JS dependency — CSS has no equivalent.

### 6.7 Rotation: what fires, and in what order

**Fire reliably on rotation:** `matchMedia` `change`; `<svelte:window bind:innerWidth/innerHeight>`
(via `resize`); `ResizeObserver` on any element whose box changes; `visualViewport` `resize`;
`screen.orientation` `change`.

`screen.orientation.change` is the **only one that is semantically about rotation** — every other
mechanism also fires on a desktop window drag, a keyboard, or a pinch-zoom, and cannot distinguish
rotation from resize without comparing `screen.orientation.type`. `ScreenOrientation` is Baseline
widely available since **March 2023**; `type` is one of `portrait-primary`, `portrait-secondary`,
`landscape-primary`, `landscape-secondary`, plus `angle`.

Both older APIs are deprecated, confirmed on MDN:

- `window.orientation` — "**Deprecated** … Use the `Screen.orientation` property instead."
- `orientationchange` event — "**Deprecated** … Listen for the `change` event of the
  `ScreenOrientation` interface instead."

**Ordering: no primary source found for a cross-API guarantee.** What _is_ verified is that these all
land in the same frame, inside one _update the rendering_ pass, before paint. So the practical rule
is: **do not write a design that depends on their relative order.** Debounce to a single
`requestAnimationFrame`, or derive everything from one source of truth.

### 6.8 What this all means

Every JS mechanism has the same shape of cost: **the prerendered HTML is wrong, and gets corrected
after hydration.** They differ only in how large the correction is and how visible the guess is in
the source. A CSS-only solution has _zero_ correction, because the browser applies the media query
before first paint. On a build-time-prerendered app, that gap is the entire argument — and it is the
argument Svelte's own docs make.

---

## 7. Unresolved / needs verification

Listed in rough order of how much a wrong assumption would cost. Each is cheap to settle; none
should be settled by guessing.

1. **Do Tailwind v4 directives (`@variant`, `@apply`, custom variants) work inside Svelte component
   `<style>` blocks** under `@tailwindcss/vite`? All 30 existing media queries live there. Decides
   whether band definitions can be shared or must be duplicated. _~10 minutes to test._
2. **Does `@custom-variant` with a `@media` + `@slot` body compile correctly** in Tailwind 4.3.0?
   Docs only demonstrate `@supports`. _~5 minutes._
3. **Does Capacitor 8.4.2 inject `--safe-area-inset-*` without explicitly adding the SystemBars
   plugin**, and are the injected values re-dispatched on rotation? _Measure on device via the
   existing `scripts/run-android-acceptance.sh`._
4. **Does `env(safe-area-inset-*)` go stale across rotation in current WKWebView** (as opposed to
   across launch/resume, which WebKit 191872 documents as still broken)? The rotation-specific radar
   is against UIWebView and reported fixed. _Measure via `scripts/run-ios-acceptance.sh`._
5. **Do `dvh`/`svh`/`lvh` recompute correctly on the first frame after rotation in WKWebView and
   Android WebView?** No bug reports found, but no positive confirmation either, and the adjacent
   safe-area machinery is known-flaky. _Measure on device._
6. **Confirm `dvh == svh == lvh == vh` inside both WebViews.** Follows from the spec definitions but
   no primary source states it. If true, it simplifies the spec considerably — one unit, no
   branching. _One line of CSS + a screenshot._
7. **Keyboard resize behaviour without `@capacitor/keyboard`** on each platform. The Pokemon Editor
   is a form; if the keyboard shrinks the WebView, a `dvh` height budget restructures under it.
8. **Container query invalidation timing during a rotation animation** — can a container query flip
   and flip back mid-animation, producing flicker a viewport `@media` would not? No source found.
9. **Numeric safe-area inset values per orientation** on target devices. Qualitative shape is known;
   the numbers are not, and a height budget needs numbers.
10. **Does `@media (height)` resolve against the large viewport?** Consensus behaviour, no normative
    citation found.
11. **Cross-API event ordering on rotation** (`matchMedia` vs `resize` vs `ResizeObserver` vs
    `visualViewport` vs `screen.orientation`). Verified that they all land in the same pre-paint
    _update the rendering_ pass; **no source gives a relative order.** Do not depend on one.
12. **`document.documentElement` as a viewport-height proxy** — no primary source supports it, and
    mechanically it is not equivalent (it is the `<html>` box, and it does not reflect visual-viewport
    shrink from the keyboard). Do not use it without measuring.

---

## 8. Summary of what is and is not possible

**Available in pure CSS, no support risk:**

- `@media (min-height:)` / `(max-height:)`, `(min-aspect-ratio:)` / `(max-aspect-ratio:)`,
  `(orientation:)` — everywhere.
- `dvh`/`svh`/`lvh` — iOS 15.4+, so essentially our whole floor.
- `env(safe-area-inset-*)` — everywhere, with the WebView caveats above.
- Tailwind `portrait:` / `landscape:` — built in.
- Height bands via `@custom-variant` — mechanism exists, exact form unverified (§7.2).

**Available but raises the iOS floor:**

- Media query **range syntax** → iOS 16.4. Avoidable by using `min-`/`max-` form. _(Though Tailwind
  already emits range syntax for its own breakpoints, so the floor is arguably already raised.)_
- **Container size queries** → iOS 16.
- **Container style queries** → **iOS 18**. This is the one that buys the most (a named viewport
  band readable at any depth without owning a container) and costs the most.

**Not available in CSS at all:**

- A component asking about **viewport** height without an ancestor's cooperation. Container queries
  cannot originate a height budget; `container-type: size` requires an externally-determined height
  by definition. **The budget must be declared once at the shell and flow down.**
- Any media feature distinguishing small/large/dynamic viewport. Units only.
- Height-axis theme tokens in Tailwind. Height bands are hand-written variants, not `@theme` data.

**What would force JS, and what it costs:**

- **Nothing in the axis model itself requires JS.** Height, aspect ratio, and orientation are all
  expressible as media queries, and all re-evaluate on rotation without JS. A pure-CSS axis model is
  genuinely available.
- Three things _would_ force a JS escape hatch, in ascending order of likelihood:
  1. **Measuring a real element box** when no ancestor can be made a size container —
     `bind:clientHeight`, one pre-paint frame late.
  2. **Keyboard-aware height.** If the height budget must remain correct with the on-screen keyboard
     up, **`visualViewport` is the only correct source and CSS has no equivalent** (§6.6). Whether
     this bites depends on unresolved item §7.7. The Pokemon Editor is a form, so this is a real
     risk, not a hypothetical.
  3. **A layout fact that must also be known to JS** — e.g. Controller Focus needing to know which
     Focus Zones currently exist. This is the most likely forcing function in practice, and it is a
     **navigation-model** requirement, not a layout one. CSS can lay the shell out correctly while
     JS still needs to be told what the zones are.
- **The cost, in this app specifically, is unusually high.** `prerender = true` means the shipped
  HTML embeds whatever fallback we choose, for every user. `<svelte:window>` is not merely undefined
  on the server — it is **absent from SSR output entirely**, so today's `$state(1024)` initializer
  survives the whole build, and every prerendered page ships `mobileTabsAvailable === true`,
  desktop included. If a JS hatch is kept, `MediaQuery(query, fallback)` from `svelte/reactivity` is
  strictly better than the current pattern — same flash, but the wrong value becomes an explicit,
  reviewable decision instead of an invisible magic number. Svelte's own docs say to prefer CSS, and
  on a build-time-prerendered app that advice is load-bearing.

**The one finding that most constrains the spec:** `env(safe-area-inset-*)` is documented-unreliable
across state transitions in WKWebView ([WebKit 191872](https://bugs.webkit.org/show_bug.cgi?id=191872),
still open, confirmed through iOS 16, "sub-second but noticeable", causes a visible jump). Insets
should therefore be confined to **padding**, never to **structure**. A layout that merely gets its
padding wrong for under a second recovers invisibly; a layout that picks a different _structure_
based on a stale inset will visibly reflow on every launch, resume, and possibly every rotation.

---

## Addendum: two findings added after the initial write-up

### 1. WKWebView's layout viewport is transiently wrong _during_ rotation — open for 9 years

[WebKit bug 170595](https://bugs.webkit.org/show_bug.cgi?id=170595) — "window.innerWidth/innerHeight are bogus after resize/orientationchange in **WKWebView (but not MobileSafari)**". Status **NEW**, filed 2017-04-07, last activity 2025-03-21, P2/Major.

Simon Fraser's root cause (comments #14–17):

> We're sending a visible rect update with unobscuredContentRect (0,0) width=320 height=320) during rotation… that's because we haven't updated the contentView bounds for rotation yet… **but the layout viewport rect is still wrong because it also relies on state from the web process** (the documentRect). We really need to round-trip through the web process with the new size before we can reliably compute rects.

**Why this matters here specifically.** `height`, `width`, `aspect-ratio` and `orientation` media features are _all_ computed from the layout viewport. A transient **320×320** layout viewport evaluates `orientation` to **portrait** — because the spec defines portrait as `height >= width`, so a square viewport is portrait. Mid-rotation, a portrait/landscape binary switch can therefore evaluate to the wrong branch.

Two caveats, stated because the evidence does not go further:

- The bug is written entirely in terms of JS `innerWidth`/`innerHeight`. **No comment discusses CSS or media queries.** Whether this produces a _visible_ transient CSS flash, or is merely an internal intermediate state before final layout, is not determinable from the source.
- It is explicitly **not reproducible in Mobile Safari**. Browser-build testing will not catch it. It must be tested in the Capacitor iOS app.

**Design consequence:** prefer thresholds that degrade gracefully over a hard portrait/landscape binary that visibly restructures the DOM. A design that merely _adjusts_ across a square viewport is safe; one that _swaps layouts_ at exactly 1:1 is not.

### 2. There is no small/large/dynamic media feature, and the CSSWG knows

[w3c/csswg-drafts#7951](https://github.com/w3c/csswg-drafts/issues/7951) — "[mediaqueries] width/height/aspect-ratio need small/large/dynamic variants". Opened 2022-10-25, labelled `mediaqueries-5`, **still open with zero comments**.

> There are some more CSS values to handle the difference between the layout viewport and the visual viewport better… Media queries need to have a matching update. E.g. `large-width`/`small-width`/`dynamic-width`.

So `svh`/`lvh`/`dvh` exist as _units_ but have no _media-feature_ counterpart, and none is coming soon. `@media (height: …)` always means the **layout viewport** — in Chrome Android that equals the small viewport; it is never the dynamic viewport in either engine. The gap is acknowledged and unaddressed.

### 3. `dvh` is already load-bearing in this repo, below the iOS floor

`100dvh` requires **iOS 15.4**. The deployment target is **15.0**. `dvh` currently appears in 8 places, including the app shell's own height:

| File                                                 | Line                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| `src/routes/layout.css`                              | 113, 114, 138 (`.app-shell` height and min-height) |
| `src/lib/components/pksx/PokemonEditor.svelte`       | 1573                                               |
| `src/lib/components/pksx/SlotActionMenu.svelte`      | 303                                                |
| `src/lib/components/pksx/PokemonActionDialog.svelte` | 189                                                |
| `src/routes/save-file/+page.svelte`                  | 863, 1400                                          |

On iOS 15.0–15.3 those declarations are invalid and dropped, so `.app-shell` gets no height at all. **This is a present-day defect, not a consequence of the redesign** — it is evidence that the 15.0 deployment target is stale rather than a supported floor. See [Decide the minimum supported platform versions](https://github.com/woahitsraj/PKSX/issues/161).

---

## Addendum 2: native-shell viewport and safe-area behaviour

Verified against Capacitor 8.4.2 source and this repo.

### `dvh` buys nothing inside either native shell

WebKit only knows a host has retractable chrome if the host _tells_ it, via `minimumViewportInset` / `maximumViewportInset` on `WKWebView` ([Safari 15.5 release notes](https://webkit.org/blog/12669/new-webkit-features-in-safari-15-5/)). A grep of all 46 Swift files under `ios/Capacitor/Capacitor/` at tag `8.4.2` for `ViewportInset|obscuredContentInsets|safeAreaInsets|additionalSafeArea` returns **zero hits** — Capacitor never registers dynamic chrome.

[WebKit bug 255852](https://bugs.webkit.org/show_bug.cgi?id=255852) describes the consequence for hosts that don't call it: "100vh, 100svh, 100lvh and 100dvh are all updated to be the same height as the current viewport height."

**So inside Capacitor iOS and Android, `dvh` ≡ `svh` ≡ `lvh` ≡ `vh`.** The dynamic-viewport machinery only pays off in the **web** build. Keeping `100dvh` is harmless and correct for web — but no native behaviour should be built on the assumption that `dvh` tracks anything.

### Bare `env(safe-area-inset-*)` returns 0 on Android WebView < 140 — and this repo uses it 10 times

Chromium issue [40699457](https://issues.chromium.org/issues/40699457) ("safe-area-inset-\* values are always 0px in webview") was only fixed in **M140**. Capacitor 8's `SystemBars` (in `@capacitor/core`, not a separate install) works around it — from `SystemBars.java` @ 8.4.2:

- `WEBVIEW_VERSION_WITH_SAFE_AREA_FIX = 140`; `shouldPassthroughInsets = webViewMajorVersion >= 140 && hasViewportCover`.
- When **false** (WebView < 140), Capacitor pads the parent view and rewrites system-bar and cutout insets to `Insets.of(0,0,0,0)` — so **`env()` deliberately resolves to 0** and only Capacitor's injected `--safe-area-inset-*` custom properties carry the truth.
- Injection always runs (default `insetsHandling: css`), re-fired from `OnApplyWindowInsetsListener` (rotation, bar visibility, IME) and `onPageCommitVisible`.

Capacitor's own recommended pattern is therefore `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`.

**This repo uses bare `env()` in all 10 occurrences and `var(--safe-area-inset-*)` in none:**

| File                                            | Lines              |
| ----------------------------------------------- | ------------------ |
| `src/routes/layout.css`                         | 115, 116, 139, 140 |
| `src/lib/components/pksx/PokemonEditor.svelte`  | 2267, 2268         |
| `src/lib/components/pksx/MobileTabbar.svelte`   | 51                 |
| `src/lib/components/pksx/SlotActionMenu.svelte` | 303                |
| `src/routes/save-file/+page.svelte`             | 1636, 1637         |

`minSdkVersion = 24` puts pre-140 WebViews in scope, and `targetSdkVersion = 36` enforces edge-to-edge (Android 16 disabled `windowOptOutEdgeToEdgeEnforcement`), so content renders behind the system bars with **zero** safe-area padding on those devices. **A present-day defect, independent of the redesign.**

Good news: `src/app.html:7` already has `viewport-fit=cover` in the only `meta[name=viewport]`, which is what Capacitor string-matches — so the passthrough path works on WebView ≥ 140.

### Keyboard behaviour is asymmetric between the two native platforms

- **iOS, without `@capacitor/keyboard`** (not installed here): nothing resizes the WebView. The keyboard **overlays**; `visualViewport` shrinks; layout viewport, `innerHeight` and all `*vh` units are unchanged. This is exactly the case CSS Values 4 anticipates: on-screen keyboards "typically… have no effect on any of the viewport-percentage lengths."
- **Android, without any plugin**: Capacitor core **does** resize. `SystemBars.java` sets bottom padding on the WebView's parent to the IME height whenever the IME is visible, so `100vh`/`100dvh` change when the keyboard opens.

The only cross-platform signal for keyboard height is `window.visualViewport` — Safari does not support `env(keyboard-inset-*)`.

### Do not hard-code inset values

`100dvh` never subtracts safe-area insets. With `viewport-fit=cover` the layout viewport is "the circumscribed rectangle of the physical screen" ([css-round-display §4.1](https://drafts.csswg.org/css-round-display-1/#viewport-fit-descriptor)), and the viewport-unit definition in css-values-4 contains no safe-area term. `height: 100dvh` + `padding: env(...)` is the correct composition.

Apple publishes **no** table of inset values. The widely-quoted 34/21/44 constants come from unanswered developer-forum posts, and Capacitor issue #8361 reports a 62px top inset on iPhone 17. Compose with `max()` against a floor and design symmetrically.
