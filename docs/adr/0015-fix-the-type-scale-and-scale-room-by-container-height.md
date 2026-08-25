# Fix the type scale and scale room by container height

PKSX uses one type ladder in every **Height Band**: caption 10, label 12, body 13, title 16 and display 24px, and text never changes size with the viewport. Spacing, control height, radius and the focus ring scale with the height of the container a screen or **Takeover** establishes, clamped between the floor minima (32px controls, 2px unit) and their caps (44px, 6px). Density never reads the Height Band, which stays a composition switch only.

Two facts drove this. The portrait floor (360×640 raw) sits in the Tall band, so any density stepped by band gives the smallest phone the largest tokens and overflowed the **Pokemon Editor** there. Fluid type keyed on height overshot the 393px portrait target on width, because width is the scarce axis in portrait while height is scarce in landscape; a fixed ladder holds both. **Slots** never shrink below 44px, then the pane scrolls; Slot text keys on the Slot's own size and degrades in the order name and level, index, then the sprite fills the Slot.

Considered and rejected: two ladders stepped by Height Band, and one fluid ladder derived from a height-keyed body size. Decided on the shell redesign map, issue #196.
