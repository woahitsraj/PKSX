# Box-first surface prototype

This throwaway route answers issue #159's spatial question. It compares three box-first compositions at the fixed safe-canvas floor and target sizes from map #151.

Run `pnpm prototype:box-first`, then open `/prototype/box-first?variant=A`. Use the switcher or the left and right arrow keys to compare variants. Add `controls=0` when measuring the layout without the prototype switcher.

## Variants

- `A`, Sidecar. The Box keeps its 6x5 shape. Party and the Active Slot Detail Rail share the sidecar, and the collection chip sits above them.
- `B`, Bookends. The Box keeps its 6x5 shape between a vertical Party rail and the Active Slot Detail Rail.
- `C`, Reflow. Party and details share a deck. The Box becomes 10x3 in a wide container and 5x6 in a narrow one.

## Measured fit

Measurements use the rendered Slot border box in CSS pixels. Every result shows all 30 Box Slots, all six Party Slots, the collection chip, and the Active Slot Detail Rail without document overflow.

| Safe canvas              | A Sidecar | B Bookends | C Reflow |
| ------------------------ | --------: | ---------: | -------: |
| 616x336 landscape floor  |        64 |         59 |       59 |
| 640x480 landscape target |        76 |         64 |       61 |
| 360x544 portrait floor   |        57 |         48 |       56 |
| 393x852 portrait target  |        61 |         52 |       74 |

Sidecar is the strongest fixed-grid candidate. It reaches the map's 63px landscape floor and 76px target while preserving 6x5 Box coordinates. Reflow buys much larger Slots in tall portrait, but changes the Box's row and column map across aspect refinements. Bookends cannot justify its separate Party rail because it drops the portrait floor to 48px.

## Candidate Focus Zone transitions

These are candidates for the decision after a variant is chosen. The prototype does not implement controller movement.

### A, Sidecar

- The collection chip remains a target in the Box Focus Zone. Left moves to the top-right Box Slot. Down enters the Party at P1.
- Right from a Box row enters the nearest Party Slot by vertical position. Left from Party returns to the rightmost Box Slot on the nearest row.
- In the narrow stack, Down from the Box's bottom row reaches the collection chip. Down again enters Party at the same column. Up reverses that path.

### B, Bookends

- Down from the collection chip enters the top Box row. Up from that row returns to the chip.
- Left from the Box enters Party by vertical position. Right from Party returns to the first Box column.

### C, Reflow

- Down from Party enters the top Box row by horizontal position. Up from the top Box row returns to the nearest Party Slot.
- Down from the collection chip enters the top Box row. Up reverses that path.
- Rotation keeps Controller Focus on Slot identity even though its displayed row and column change.

The Active Slot Detail Rail is never a Focus Zone in any variant. It only reflects the Slot under Controller Focus.
