## 2026-10-29 · feat(admin): Categories drawer panels as approved — folds, save in place, and the One per event switch

Owner 2026-10-29: "Approve panels" … "build them, with the One per event switch" (prototype
`carry-2026-10-29/admin-categories-proto`, capture `captures/LIVE-DRAWERS.md`); on #7052's drawer, "Does not follow
our design template". Builds on #7052 (the drawer on the shared `Sheet`) — merge after it.

- **The frame.** `Sheet` gains `pinned` (‹ · the level word over the item's name, wraps · a ⋯ of rare actions —
  Copy key · Delete category… / Combine… · Open the shop) and `full` (on a phone the drawer is the whole screen).
- **The panels** (Group · Category · Service · Part · Service card) keep every live field and write, re-drawn as
  the guest card's folds: a tappable breadcrumb, the name, one count line with the developer key in an ⓘ, then
  folds in the prototype's order — one open at a time; the open head PINS slim under the pinned row (`Fold pin`,
  new); Delete / Combine last, red, with a confirm.
- **Save in place.** Every text field saves on blur/Enter, switches on press, pickers on pick, the photo the moment
  it is chosen — each "Saved — <what> · Undo" in the house toast; the black "Save" pill is gone. The redirect-back
  forms answer JSON through `mapWriteForm` (one more `kind` per shipped action; +0 exported server actions).
- **One per event** is a switch on the category (`service_categories.one_per_event`, migration
  `20271296971721_one_per_event_is_a_category_switch`): ON for ceremony venue · reception · officiants ·
  coordinator · host / MC, OFF for LED (owner: "we can book multiple for that as well"). `HARD_SINGLE_PICK_GROUPS`
  is gone; the app (`lib/one-per-event.ts`) and the database lock guard (`event_vendors.hard_single_group`, now
  trigger-written) read the switch. Guards: `lib/one-per-event-has-one-source.test.ts`,
  `tests/db/one-per-event-is-a-category-switch.db.test.ts`.
- ⚠ Surfaced, not silently decided: the `officiants` category is filed under `officiant` (it was unfiled, so its
  switch could not bite); church-fee rows are no longer held to one per event (no category is filed under
  `church_fees`; 0 such rows in prod on 2026-10-29).

SPEC IMPACT: DECISION_LOG.md row "ONE PER EVENT IS A CATEGORY SWITCH" (2026-10-29) — the hard-coded one-per-event
list becomes an admin switch per category; LED becomes multi.
