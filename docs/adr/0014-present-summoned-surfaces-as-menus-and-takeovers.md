# Present summoned surfaces as menus and takeovers

PKSX presents every summoned surface in one of two forms, plus toasts. A **Menu** is a short command list that attaches to a screen edge over a dimmed **Backdrop**; a confirmation is a two-entry Menu with a question. A **Takeover** presents one focused workflow, such as the **Pokemon Editor** or the **Backup Browser**; it owns the full safe canvas in the Short **Height Band** and presents as a centered bounded panel in Tall. There is no middle tier, because no centered surface with real content fits the 336px landscape floor canvas.

At most one summoned surface is open at a time. A Takeover draws its own confirmations inline, and a surface opened from another surface replaces it, with **Controller Focus** returned along the chain. Tapping the Backdrop acts as exactly one Back press, so light dismissal inherits every Back guard. The **Active Slot Detail Rail** is shell layout, never a summoned surface.

Considered and rejected: per-surface presentation, which is the status quo of four stacking tiers whose visual order disagrees with the Back order; a third centered dialog form, which cannot fit the floor; and stacked overlays, which every platform vendor's controller guidance warns against. Decided on the shell redesign map, issue #158.
