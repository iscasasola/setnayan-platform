## 2026-09-26 · fix(event-hub): Restore · Undo · Apply are always visible, upper right of the Maker's top nav

Owner, on the live Maker: *"i thought there will be an action buttons
RESTORE/UNDO/APPLY on the upper right nav?"* → *"upper right of the top
nav"*. Production showed "Draft · No draft — the preview is what guests
see." and nothing else: the Phase 2 dock's "Draft" badge and Apply button
both returned nothing once `!summary.hasChanges`, and Undo/Restore/Reset
lived one tap deep inside a `<details>` menu.

`HubDraftToolbar` (`app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx`)
is restructured, same mechanism, `hubDraftAction` and `HubDraftDock`
unchanged:

- **Restore · Undo · Apply now always render**, in that order, Apply the one
  filled/primary button. A button with nothing to do is `disabled`, never
  hidden, and says why on tap or hover through an adjacent `InfoTip`
  (`app/_components/info-tip.tsx`) — the same pairing `maker-play-menu.tsx`
  already uses for "Play this scene" with nothing selected. Restore and Apply
  disable off `!summary.hasChanges` ("Guests already see this" / "No changes
  to apply"); Undo disables off `!summary.canUndo` ("Nothing to undo yet").
  Apply is no longer hidden when every pending change is Pro-gated
  (`onlyPro`) — it stays enabled so try-then-pay can run and report back.
- **Reset and the outcome of the last action move behind one ⋯** (a
  `MoreVertical` trigger, badge-counted) — both are read AFTER pressing
  something, never before, so nothing the owner asked to see is lost.
  Reset's confirmation flow, the Pro line ("Apply needs Event Hub Pro …",
  try-then-pay), the store-shell line ("… can be applied on the web" — no
  price, no pay path in the iOS/Android shell per `lib/store-shell.ts`), and
  the outcome report (`ResultLine`) are byte-identical in behaviour, just
  relocated.
- **`maker-shell.tsx`** mounts `applySlot` TWICE — once on its own
  right-aligned line for the phone top bar (there is no room left in the
  icon row below `md` for a third button cluster), once in the existing
  desktop row after the device switch. `lib/hub-draft-store.ts`'s
  `loadHubDraftBarData` is now `cache()`d (the same idiom as
  `lib/dashboard-shell.ts`), so the two mounts read the draft once per
  request, not twice.

**Tests:** `app/dashboard/[eventId]/website/_components/the-toolbar-never-hides-restore-undo-apply.test.ts`
(new) — mounts the shared `DraftButton` primitive for real (enabled and
disabled) and proves `HubDraftToolbar`'s wiring from its source (Next's
`useRouter()` throws outside a real App Router, the same reason
`hub-draft-wiring.test.ts` proves writers by source): the three buttons are
never behind a truthiness guard, each disables off the right field, Apply is
the one primary button, Reset stays inside `<details>`, and the Pro line /
store-shell line / outcome report all still render. `lib/store-shell.test.ts`
and the wiring/`hub-draft.test.ts` suites are untouched by this change (no
lib/action logic moved) and stay green.

SPEC IMPACT: None — this is a Maker Phase 2 UI restructure, not a new
mechanism or schema change.
