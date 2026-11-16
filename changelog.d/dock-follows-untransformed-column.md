## 2026-11-16 · fix(thumb-row): the bottom row sits under its column after the page slides in

A regression from #7543, found by W1 on live 979ed2c (RW-337).
- At 768, People's "Find or invite" row sat 28 px to the right and touched the window's edge: the row ran 124→768 while
  its column ran 96→744.
- `followColumn` (`guests/_components/dock-follows-column.ts`) read the column's box while the segment slid in
  (`translateX(28px) → 0`, 320 ms). Nothing it watched changed when the slide ended (no size change, no resize), so
  the 28 px stayed.
- 1280 had the same flaw, hidden only because the pane happened to resize there.

The fix is at the root, in `followColumn`, so every row that uses it is fixed: People and Memories' `AccountThumbRow`,
the Samahan chatroom, the Guests dock, and Suppliers.
- It now waits out whatever moves the column — a CSS animation, a CSS transition or `element.animate`.
- `document.getAnimations()` finds the ones already running on the column or an ancestor, and the edges are read again
  when each finishes.
- `animationend` / `transitionend` (and cancel) catch moves that start later.
- After the page leaves, nothing is written.

Guards:
- **Measured: `apps/web/tests/e2e/the-thumb-row-follows-a-sliding-column.spec.ts`.** It mounts the REAL
  `AccountThumbRow` with the app's compiled CSS and slides its column in three ways. It starts the REAL `followColumn`
  while the column is still 28 px out, lets the slide end, then asserts the row's left and right equal the column's,
  at 768 and 1280.
- **On 979ed2c's code all 6 fail:** the row's left is 124 with the column at 96 (768), and 320 with it at 292 (1280).
- **`a-sliding-column-is-waited-out.test.ts`** checks the wiring and that both account rows still call it. Both checks
  were seen red on sabotage.

No migration and no new server action.

SPEC IMPACT: None
