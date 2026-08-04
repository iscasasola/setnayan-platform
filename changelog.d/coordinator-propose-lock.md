## 2026-07-18 · feat(vendors): coordinator "propose a lock" — money-adjacent guard (flag-off)

Restricts a coordinator from **directly locking/finalizing a vendor** and routes
it through a proposal the couple confirms. Locking commits the couple to a
vendor and seeds the payment schedule, so per the owner's "propose-not-execute /
money wall" principle it must be couple-approved.

**Correction to an earlier finding:** coordinators **can** lock vendors today.
`event_vendors` has an OR'd moderator write policy (`event_vendors_moderator_write`,
migration `20261129003000`) and the standard coordinator grant sets
`COORDINATOR_AREAS.vendors = 'edit'`, so `finalizeVendor`'s status write passes
for a coordinator (audit-logged via `log_delegate_write`). This PR gates that.

What landed:
- Migration `20270729130000_vendor_lock_proposals.sql` — proposal table, RLS at
  CREATE (read = couple+coordinator; insert = either host as self; resolve =
  couple only), one-pending-per-vendor partial unique index.
- `lib/coordinator-propose-lock.ts` — `NEXT_PUBLIC_COORDINATOR_PROPOSE_LOCK_ENABLED`
  flag, **default OFF** (flag OFF = coordinators still lock directly, current
  behavior).
- `finalizeVendor` — when the flag is on and the caller is a coordinator (not a
  couple member), records a pending proposal and returns a new `proposed`
  result instead of locking. When the **couple** locks a vendor that had a
  pending proposal, it auto-resolves to `confirmed`.
- `accordion-lock.tsx` — handles the `proposed` result (a "Proposed to the
  couple — locks once they confirm" note).
- `pending-lock-proposals.tsx` + page wiring — the couple sees a "your
  coordinator proposed locking X" strip (Lock now / Dismiss). "Lock now" fires
  the normal couple lock (one-tap for the common case; gate results — reservation
  terms / downpayment — nudge the couple to finish from the vendor's card).
  `dismissVendorLockProposal` server action (couple-only).

Behavior with the flag OFF (the default) is unchanged. This is a **behavior
change** (removes coordinators' direct lock) so it ships flag-off until the
owner flips it.

Deferred follow-ups: a DB trigger hard-blocking a coordinator's raw
status→contracted write (belt-and-suspenders beyond the app gate — left off so
flag-OFF stays exactly current behavior); a true inline one-tap confirm through
finalizeVendor's gate results from the strip.

SPEC IMPACT: Coordinator role. Canonical design + the "coordinators can lock
today" correction are in corpus `Coordinator_Role_Feature_Spec_2026-07-18.md`
§ 0/§ 4 and logged at the bottom of `DECISION_LOG.md`.
