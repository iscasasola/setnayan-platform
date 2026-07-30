## 2026-07-30 · chore(marketplace): retire the orphaned budget-subnav slots, and finish the "plan" → "event" rename the aria-labels were left out of

The two halves of `Explore_Integration_BUILD_SPEC_2026-07-29.md` §4.4 that
#3878 explicitly left out of scope, plus one defect it introduced.

**1 · The `customer.budget-subnav.*` registry area removed** (4 slots: shortlist
· build · budget · compare). They described the mobile takeover dock, which
PR-3 (#3877) removed — and an orphan slot is worse than a missing one, because
`/admin/menus` offers it as renameable and the rename appears to do nothing.
**Checked prod before deleting**, as the handoff's §4.4 warning requires:
`nav_slot_override` held **zero** rows for `customer.budget-subnav.%`, so no
admin customisation was discarded.
⚠ With the replan flag OFF the dock returns and an unknown `slotKey` falls
through to the child's **code default** label/icon — so it renders identically;
it just stops being admin-editable. Intended trade: the dock is not coming back.

**2 · The rename now covers the copy it missed.** #3878 moved
`ADD_TO_PLAN_HEADING` and `EXPLORE_INFO_STRIP` to "event" but left three
siblings on "plan", so on `main` right now a screen reader announces *"Add
Catering to your plan"* over a pool the eye reads as **"＋ Add to your event"**,
and the empty-folder line — **visible copy** — still says "plan":

| string | was | now |
|---|---|---|
| `addToPlanChipLabel` (aria) | Add X to your **plan** | Add X to your **event** |
| `removeFromPlanButtonLabel` (aria) | Remove X from your **plan** | Remove X from your **event** |
| `folderEmptyInPlan` (visible) | Nothing from X in your **plan** yet | Nothing from X in your **event** yet |

Its test assertions move with them, with a comment naming the heading-vs-aria
drift they now pin together. The reserved-word rule (§2: a *plan* is a saved,
named alternative team you compare — never the category set) is written at the
top of that copy block so the next edit doesn't reintroduce it. Export names keep
`…PLAN…` on purpose: they are also `explore-in-plan.ts`'s internal vocabulary,
which is a concept, not copy. Eleven comments quoting the old label updated so a
grep still finds the element.

Rebased onto #3878 rather than merged: this branch originally carried that PR's
work too (the two sessions overlapped), and re-applying it would have reverted
their `build-anchors-actions.ts` deletion. Only the delta ships here.

Tests: full unit suite green (5393), `tsc --noEmit` clean, nav-icon / bottom-nav
/ retired-strings guards pass.

SPEC IMPACT: None. §4.4 of the owner-approved build spec, now complete.
