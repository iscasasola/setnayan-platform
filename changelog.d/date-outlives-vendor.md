## 2026-08-04 · fix(dates): give the date back when the couple undoes the lock that forced it

Second and larger half of the date bug. The first half (telling a couple their date is locked when it isn't) is in the same branch.

**A couple was left married to a date derived from a supplier they no longer use.**

`finalizeVendor` finalises the event date when locking a vendor collapses the candidate set to one. `revertVendorToConsidering` undoes the lock, un-archives the picks it displaced and revives the inquiries it displaced — and leaves the **date** behind. Permanently: the date write is guarded `.is('event_date', null)`, so a later correct value can never replace a wrong one.

### The rule

**A date that exists only because a vendor lock forced it belongs to that lock.** Undo that lock and the date returns to undecided. **A date the couple chose is theirs** and no vendor exit touches it.

### Provenance is stamped, never inferred

New `events.date_forced_by_lock_of`, written in the **same statement** as the date, so the stamp lands if and only if that lock created it. A separate write would leave a window where a stamp outlives a date it did not cause.

Inference was tried and **refuted**: `event_date ∈ date_candidates AND date_status='locked'` is byte-identical for the couple's own `lockEventDate` pick, so it would erase deliberate choices.

⚠ **No foreign key, deliberately.** The obvious shape — a FK `ON DELETE SET NULL`, copying `event_vendors.archived_by_lock_of` — is wrong here: the exit paths hard-delete the row it would point at, so Postgres would null the stamp at the exact moment the clear needs to read it. Same shape as the `ON DELETE SET NULL` FK that silently re-armed erased people's Papic QR codes (#4032).

### Every condition is a refusal to guess

The date is released only when **all** hold:

- the stamp names **this** vendor — a NULL stamp means the couple chose it (onboarding, `lockEventDate`, the Save-the-Date backfill, the Locked-QR claim);
- **no other confirmed vendor remains** — they are booked on that day and erasing it would strand them;
- **it has not gone outward** — a launched Save-the-Date, a pending scheduled launch, or a public landing page all mean guests have seen it.

`.eq('date_forced_by_lock_of', vendorId)` re-states the check inside the UPDATE, so a concurrent re-lock cannot slip between read and write. `date_candidates` are untouched — that is what lands the couple back on their own shortlist. `date_status` needs no write: `sync_event_date_status()` demotes a `locked` status the moment `event_date` becomes NULL.

### Notes

- ⏭ Two other exit paths (`deleteVendor`, `cancelBookingAsHost` non-downpaid) carry the same shape and are **not** done here — one path, verified, beats three half-checked.
- ⏭ A **vendor**-side cancellation must prompt the couple rather than silently delete their date. Not built.
- ⚠ The exposure baseline diff in this PR is **not from this change** — it is a *narrowing* (`acquire_schedule_pools` loses `anon`) that landed on `main` without its regeneration. Picked up here because the freeze fails on narrowings too.

Verified: **773/773 db tests pass** with the migration replayed · zero typecheck errors in the changed file · every referenced column confirmed to exist in a migration.

SPEC IMPACT: None — implements the owner's 2026-08-04 date ruling ("the event can start with multiple dates until it becomes one date"). No SKU, price or route change.
