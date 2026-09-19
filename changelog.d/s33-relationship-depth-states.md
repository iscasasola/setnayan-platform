## 2026-09-19 · feat(standing): the "where you stand" line also says deposit paid, meeting confirmed, guest count changed (SUP-2 · CPL-1)

The standing sentence (`lib/supplier-standing.ts`) on the shortlist bench card,
the couple's thread page and the supplier's thread page said only the rung and
who spoke last — "Booked · Replied yesterday" for a supplier whose deposit is
paid and whose tasting is tomorrow, and for a caterer who quoted 150 guests to
a couple now planning 170.

It now appends three facts, each derived from rows the product already writes
(no schema change, nothing typed by hand):

- **Deposit paid** — `event_vendors.status = 'deposit_paid'`
- **Meeting confirmed for today / tomorrow / in N days** — the next
  `event_appointments` row with `status = 'confirmed'` (past meetings are not news)
- **Guest count changed: 150 → ~170** — `chat_threads.pax_at_inquiry` vs the live
  count, worded once in `guestCountChangeLabel` (`lib/guest-count-provenance.ts`)

One batched reader, `readStandingExtras` (`lib/conversation-list.ts`), feeds all
three surfaces, so a bench card and the thread it opens cannot disagree. Closed
rungs (completed / cancelled) say none of them. The register's mechanism
(`relationship_depth`, the /explore badge) was not the surface the row
describes — ONE_REGISTER's SUP-2 names the bench's standing line, which is
what this extends. Guarded by new cases 9b/9c in
`apps/web/lib/the-bench-says-where-you-stand.test.ts` (mutation-checked: letting
a cancelled rung say the facts turns 9c red).

SPEC IMPACT: None — implements existing register row SUP-2 (CPL-1); register status left for the controller.
