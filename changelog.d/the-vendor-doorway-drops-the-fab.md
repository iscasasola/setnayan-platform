## 2026-09-22 · chore(vendor-nav): the vendor doorway drops its floating action button

Owner, 2026-09-22: **"delete fab"**.

`VendorNavFab` — the round floating button labelled **"Check inquiries"**, linking
to `/vendor-dashboard/bookings` — is deleted, and the vendor layout no longer
mounts it.

**Why now.** It was owner-picked on 2026-06-21 on sound reasoning: answering an
inquiry is a supplier's most time-sensitive job, so it earned the prominent
shortcut. That reasoning still holds; what moved is where the inquiries are.
Since the Today desk was renamed **"Needs your answer"** it *is* the list of
everything waiting on this shop, at the top of the page a supplier lands on. A
floating button that jumps to a subset of the list you are already reading is a
door into the room you are standing in.

**Scope — one wrapper, nothing shared.** The `NavFab` primitive at
`app/_components/nav/nav-fab.tsx` is untouched, and both sibling doorways keep
theirs: `AdminNavFab` ("Open the queue") and `CustomerNavFab` ("Add guest"). A
note at the old mount site in `vendor-dashboard/layout.tsx` says so, because the
vendor being the only doorway without one otherwise reads as an oversight and
invites a "restore for consistency" PR.

**Nothing is orphaned.** `/vendor-dashboard/bookings` is a redirect into
`/vendor-dashboard/customers…#bookings`, not a screen, and it keeps four other
in-app links (`clients/surface.tsx` ×2, `payday/surface.tsx`, and two
notification `relatedUrl`s). The inquiries surface itself is always-on inside the
My Customers hub, and every inquiry also has its own card on Today.

**Baseline.** `lint-port-no-lost-controls` correctly failed on the removal first
— that is the guard doing its job — and `scripts/port-control-baseline.json` was
regenerated in this PR as the script instructs. The removed lines are exactly the
four the FAB owned: the file, `VendorNavFab`, `NavFab`, and
`/vendor-dashboard/bookings`. ⚠ The baseline was stale (built from `3a04dab31`
against a head of `23a6b30b8`), so the regeneration also picks up unrelated
additions from main; additions never fail the guard, and the removals above are
the whole of the deletion side.

SPEC IMPACT: None. NAV-2 in `Responsive_and_Mobile_UI_Ruleset` describes the
broken-out action as available to a doorway, not required of every doorway; two
of the three still use it.
