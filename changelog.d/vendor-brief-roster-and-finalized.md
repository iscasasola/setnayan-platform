## 2026-09-08 · feat(vendor-brief): the Supplier's Desk widens — who else is locked, and whether the guest count is settled

`get_vendor_event_brief` (migration `20271213732174_vendor_event_brief_roster_and_finalized.sql`)
gains two additive fields, and loosens nothing already withheld:

- **`vendor_roster`** (BOOKED STAGE ONLY) — `{vendor_name, category}` for every
  OTHER vendor locked on the event. Reuses the exact locked-status vocabulary
  (`contracted`/`deposit_paid`/`delivered`/`complete`) this function already
  gates `booked_categories` on — the same one `LOCKED_STATUSES` in
  `apps/web/lib/vendors-plan-budget.ts` uses for the couple's own "N locked"
  chip. No new table; `event_vendors.category`/`.vendor_name` already carried
  this. The caller's own booking is excluded.
- **`pax.finalized`** (both stages) — mirrors `guestListIsClosed()`
  (`apps/web/lib/guest-list-closed.ts`) exactly: stamped
  `events.guest_count_locked_at`, or the deadline
  (`guest_list_edit_deadline`, else `event_date` − 14 days) has passed.
  Computed purely in SQL — this function is `STABLE` and must not stamp the
  lazy lock as a side effect of a supplier loading their desk.

No guest names, no per-guest RSVP/dietary detail, no seating layout, no exact
budget — all proven by new cases in
`apps/web/tests/db/the-vendor-brief-survives-its-own-schema-drops.db.test.ts`
(roster shape + exclusion of the caller and of a merely-`considering` vendor,
`pax.finalized` on both the stamp and the deadline arm — the stamp asserted via
an actual service-role write, since a plain UPDATE is silently reverted by
`guard_pax_finalize_columns_trg` — and a leak guard that serializes the whole
payload and asserts a planted guest name never appears).

Wired into `apps/web/app/[slug]/_components/supplier-desk.tsx` (a
finalized/still-moving line beside the headcount, and an "Also locked on this
celebration" plate) via `apps/web/app/[slug]/_lib/supplier-desk.server.ts`.
Both are additive to the desk's existing four-state shape and change nothing
about the capability gate or the booked-stage-only gating already in place.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-08 row. The task that requested this
cited a 2026-09-07 "FIVE OWNER RULINGS" entry as the owner's authorization;
that entry does not exist as described (the log's only "FIVE OWNER RULINGS"
row is 2026-08-13 and is unrelated). Built anyway as a well-scoped, additive
widening, but the disclosure-boundary decision itself is flagged for owner
sign-off rather than assumed — see the DECISION_LOG row for detail.
