## 2026-07-26 · fix(vendors): two live data-loss defects + one misleading pricing header

Unlike the package defects in the previous wave, **these two are live on production data
today** — not flag-dark, not waiting on a package to exist.

### 1. 🔴 Undoing a lock left the couple's shortlist archived forever

`finalizeVendor` archives every other `considering` / `shortlisted` pick in the category the
couple just locked. Correct — they chose. But `revertVendorToConsidering` contains **no
reference to `archived_at` at all** (verified: zero occurrences in the function). So undoing
a lock restored the winner and repaired displaced chat threads, while every displaced pick
stayed archived permanently.

A couple who locks the wrong caterer and immediately undoes it loses every other caterer they
had researched, with no path back but re-adding each by hand.

Un-archiving the whole category on revert would be a different bug — it would resurrect rows
the host archived deliberately. So the sweep now stamps `event_vendors.archived_by_lock_of`
with the winning `vendor_id`, and the revert un-archives exactly that set and clears the
stamp. Rows archived before the column existed carry NULL and are deliberately left alone —
they are indistinguishable from a manual archive.

### 2. 🔴 Deleting a service erased which service a couple had BOOKED

`deleteVendorService` is a hard `.delete()` scoped only by ownership. `event_vendors.service_id`
references `vendor_services` **ON DELETE SET NULL** (confirmed against the prod catalog, along
with `thread_service_interests` and `vendor_locked_qr_tokens`) — so the delete does not fail
loudly, it silently blanks the link on the couple's row, **including a `contracted` one.**

A service anyone has ever picked is now RETIRED (`is_active = false`) instead of deleted. It
disappears from the vendor's public page exactly as before, and the couple keeps the record of
what they bought. A service nobody has touched is still deleted outright. Returns `?retired=1`
so the UI can say what happened.

### 3. 📝 `booking-fee.ts` claimed "(final)" for a superseded rate

The header described the 2026-07-24 flat-5%-no-cap schedule as *owner-directed (final)*. The
owner-locked model dated **2026-07-25** is a taper — 5% to ₱100,000, then 1% above. Reading
the header as authoritative already cost one session an hour. The rate is **unchanged** (the
taper is scoped to the payment session by owner directive); only the header now says which
decision it describes and where the current model lives.

- `supabase/migrations/20271007380000_event_vendors_archived_by_lock_of.sql` (new)
- `apps/web/app/dashboard/[eventId]/vendors/actions.ts` — sweep stamps, revert reverses
- `apps/web/app/vendor-dashboard/services/actions.ts` — retire-instead-of-delete
- `apps/web/lib/booking-fee.ts` — header only, no behaviour change

SPEC IMPACT: `Vendor_Card_Actions_Findings_2026-07-26.md` §3 — clears two of the listed
"important" findings.
