# Drive responsive layout from one height band

PKSX has two app-wide **Height Bands** selected in CSS from raw viewport height: Short below 560px is the constrained-first base, and Tall at or above 560px is the only global enhancement. The app-level stylesheet is the sole viewport authority and exposes the inherited band as a custom property. Screens and overlays consume it through container style queries or a `tall:` Tailwind variant, then refine their own layout with size queries against allocated containers. Viewport width, aspect, and orientation never select an app-wide mode, and components do not classify the viewport in JavaScript.

A **Height Band** changes presentation only. Destinations, semantic structure, **Focus Zones**, and **Controller Focus** transitions remain stable across bands. While an editable control has focus, PKSX locks the current band so an Android keyboard resize cannot relayout the app mid-edit; normal CSS classification resumes when editing ends. Rotation receives no special stabilization.

The responsive contract is enforced statically and behaviorally: linting rejects unauthorized viewport classification, browser acceptance covers the fixed floor, target, and 559px/560px boundary viewports, and native acceptance verifies that opening the keyboard does not change the band.
