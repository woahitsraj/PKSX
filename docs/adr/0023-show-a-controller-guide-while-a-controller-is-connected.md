# Show a Controller Guide while a controller is connected

PKSX shows a Controller Guide, a compact strip at the bottom of the screen, while a controller is connected. This is an approved exception to ADR 0012 and SHELL-1, which reserve no height for chrome at rest. The guide is the only persistent bar. It shows only while a controller is connected, and it goes away and gives back its space when the controller disconnects.

Button bindings are not visible on a controller, and the bindings change with the destination, the open Menu or Takeover, Carry and Select mode. Users on a handheld such as the Retroid always have a controller connected and cannot hover to find out what a button does. The guide lists the actions that are available now, including Back and Select where they apply. Touch or pointer input does not hide it, because the controller stays connected.

The guide adds its height to the bottom safe-area alias, `--pksx-safe-area-bottom`. The shell, Takeovers, Menus and Toasts already pad by that alias, so they stay above the guide and nothing covers Slots, confirmations or the focused control. The guide never takes Controller Focus, and connecting or disconnecting a controller does not close a workflow or discard a draft.

The cost is height. At the landscape floor the guide uses about one or two text rows, so Slots get smaller while a controller is connected. Issue #375, which lowers the mobile Slot minimum to 36px, is not a prerequisite. Glyphs, controller families and compact layouts belong to issue #454.
