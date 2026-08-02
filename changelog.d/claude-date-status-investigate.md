## 2026-08-02 · fix(events): make `date_status` honest at the table, not with a third one-shot backfill

`events.date_status` had **never** held `'locked'` in production. All 5 prod events read
`'undecided'`, including the 4 carrying a real `event_date` — and two of those are weddings with a
DAY-precise date **and a still-pending `set_date` checklist item**, so the app was telling a couple
to "set your wedding date" while displaying that same date everywhere else. That is the owner's
2026-05-22 Task #67 complaint, still live.

**Diagnosis — hypothesis (a), not (b).** The lock ceremony is not broken, just unexercised. The
three writers that DO maintain `date_status` (`date-selection/actions.ts` `lockEventDate`,
`wizard-actions.ts`, `vendors/actions.ts`) are exactly the three nobody has run. The writers that
actually landed the dated rows never touch it:

- `app/onboarding/simple/actions.ts` — INSERTs `event_date` + precision `'day'`, lets `date_status`
  take its DEFAULT.
- `app/dashboard/[eventId]/actions.ts` `updateEventDate` — writes `event_date` + precision only.
- `studio/save-the-date/actions.ts` — writes the film date, not the status.
- `public.vendor_claim_locked_qr()` — a **plpgsql** RPC writing `events.event_date` from a vendor's
  locked-QR contract.

It had already been "fixed" twice (`20260604020000`, `20260604140000`), both times as a one-shot
`UPDATE`. A one-shot promotes the rows that exist at apply time and then stops being a rule; every
prod event was created after both ran, so both are inert and the column drifted straight back.

**Fix — the invariant, then the backfill.** New migration `20271033121603` adds a
`BEFORE INSERT OR UPDATE` trigger, `sync_event_date_status_trg`. A shared TypeScript helper was
considered and rejected: one of the eleven writers is SQL, so no helper can cover it — nor a Studio
edit or a fixture `UPDATE`, both already named as observed causes in the 20260604140000 header.
The rule fills the column in **only when the writer states no intent**, and promotes to `'locked'`
**only for a day-precise date** (year/month modes store a first-of-range *placeholder* in
`event_date`, so `IS NOT NULL` there is not a commitment). Explicit writes always win, so
`lockEventDate`'s deliberate `'locked'` + year precision and `markDateUndecided`'s
`'undecided'`-with-a-date both survive untouched.

**Should it be DERIVED? No** — and the two states above are why: neither is recoverable from
`(event_date, event_date_precision)`. `date_status` stays stored; the trigger only supplies a
default. No migration proposed.

**Behaviour change, all 5 prod rows checked individually:** `044f7e64` and `947e7bab` (day-precise
weddings) flip to `'locked'` and their pending `set_date` checklist item auto-completes — the fix.
`3fe4441e` flips but has no `set_date` row → zero visible change. `0ccc7aa3` (precision `'year'`)
and `9b41095a` (null date) are **untouched**. The only code branching on `date_status` is
`checklist-actions.ts` → `lib/checklist-autocomplete.ts` → `set_date`;
`date-selection/page.tsx` SELECTs it but never reads it.

Also updated two comments that would otherwise assert the opposite of shipped behaviour
(`save-the-date/actions.ts`, `lib/event-brief.ts`). New guard
`tests/db/event-date-status-sync.db.test.ts` (10 cases incl. a neutralisation test).

Found but deliberately NOT fixed: `vendor_claim_locked_qr()` writes `event_date` without advancing
`event_date_precision` — the same class of bug fixed for the save-the-date writer on 2026-07-30, and
it keeps that path's dates at placeholder precision. Money-adjacent RPC, out of scope here.

SPEC IMPACT: None — no pricing, entitlement or SKU change. `date_status` semantics are unchanged;
this only makes the stored value match the semantics already documented in migration
`20260604020000`.
