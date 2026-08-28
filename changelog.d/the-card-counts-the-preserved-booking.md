## 2026-08-27 · fix(vendor-card): the public service card counts the booking the delete already preserved

Commissioned as a CHECK (`papic2`), not a build: *does a supplier really keep what they took part in when a couple deletes a celebration?* It became a one-function fix.

**The register's framing — "22 things survive and 141 die" — is the wrong instrument, and measuring it that way is what hid this.** Counting `ON DELETE` rules on the 163 foreign keys pointing at `public.events` (measured in prod: 141 CASCADE · 22 SET NULL, exactly as the brief said) answers a question nobody asked. **Six `BEFORE DELETE` triggers rewrite the outcome before a single FK rule fires.** `event_vendors` reads CASCADE and *survives* (slice 2 nulls `event_id` and stamps `event_type_at_delete` / `event_date_at_delete`); `vendor_reviews` reads SET NULL and a *self-dealt* one is destroyed; `event_vendor_payments` carries its own `event_id → events` CASCADE yet survives, because the composite FK to `event_vendors` is `ON UPDATE CASCADE` and the payment follows the preserved booking. The FK census over- and under-states survival in both directions at once.

**So it was measured by deleting things instead.** Seeded in PRODUCTION inside a rolled-back transaction — one arm's-length marketplace job carrying everything a supplier takes part in, then the couple deletes the celebration (before → after):

| booking | contract | confirmed payment | review | line items | own photographs | gallery handover | meetings |
|---|---|---|---|---|---|---|---|
| 1 → **1** | 1 → **1** | 1 → **1** | 1 → **1** | 1 → **0** | 1 → **0** | 1 → **0** | 1 → **0** |

The rows the owner named on 2026-08-21 — contracts, payments, completed bookings — are all kept. **The defect is not in what survives. It is in what the supplier's PUBLIC CARD is willing to read.**

**`service_card_records` inner-joins `public.events` in every CTE, and a preserved booking has no event to join to.** Measured in prod, three finished jobs on one card, then ONE couple deletes:

    booked_count       3 → 2
    type_mix           [birthday x3] → []
    ledger             3 dated rows  → []

The last two do not lose a row — they are **emptied entirely**, because falling from 3 to 2 drops the card under the minimum-N floor. **One stranger's deletion erases a supplier's whole published track record.** The preserved row read back `status=complete · event_id IS NULL · event_type_at_delete=birthday · event_date_at_delete=2026-05-27` — everything needed to keep counting it, stamped on the row for exactly that purpose, unread.

🔑 **THE FIFTH COSTUME OF "STORED DOES NOT MEAN SURVIVES."** The three matviews were taught to tolerate an orphan by `the_public_numbers_keep_the_record` (verified in prod: all three carry the orphan predicate). This function was written the same week, reads the same preserved row, and never was. **A fix applied to one reader of a preserved row is not a fix — enumerate the readers.**

**The fix (`20271174846565`), one `CREATE OR REPLACE`, no schema change and no `ON DELETE` change:** the `booked` CTE LEFT-JOINs `events`, admits a row that is either a live unarchived celebration *or* an orphan carrying the deletion stamp, and reads `event_type` / `event_date` from `COALESCE(live, *_at_delete)`. `COUNT(b.event_id)` becomes `COUNT(b.sid)` — **a preserved booking has a NULL `event_id`, and `COUNT` of a NULL column silently skips it**, which would have left the fix counting nothing while every other CTE saw the row.

⚖ **WHY THIS CANNOT LAUNDER SELF-DEALT WORK, and the coupling is load-bearing.** The anti-self-dealing guard reads `event_members`, which cascades, so it returns TRUE **vacuously** for an orphan — measured: `vendor_booking_is_arms_length(vp, NULL, ev)` = `true`. That is safe for exactly one reason: the preserve trigger applies the same tests while `event_members` still exists and refuses to preserve a self-dealt booking. Measured in prod: a shop booking its own celebration leaves **no** surviving row. *Orphan ⇒ arm's-length* holds by construction — the same argument the review slice already rests on. **If that trigger's predicate is ever weakened, this function starts publishing self-dealt work.** Pinned by a test that goes red when it is.

🔒 **GRAIN.** An orphan has no event identity, so the DISTINCT collapses orphans by (card, type-at-delete, date-at-delete). That UNDER-counts if two separate deleted events shared a type and a date, and never OVER-counts. A public trust number fails toward the smaller figure.

⛔ **DELIBERATELY NOT CHANGED — named, not oversights.** `documented_events` still falls (3 → 2), because captures cascade with the celebration under the owner's own photos-are-deleted ruling, so the evidence really is gone and "no photo, no proof" is honoured. **That is a collision between two of his 2026-08-21 rulings and it is his call.** `option_mix` / `option_sample_n` still fall, because `event_vendor_packages` cascades whole — there is no preserved row to read, so that would be a NEW preserve, not a read fix.

**Verified.** New `tests/db/the-card-counts-the-preserved-booking.db.test.ts` (3 tests) run RED before the migration and GREEN after (`# tests 3` non-zero both times — a zero-test pass is byte-identical to success). Full db suite **1647 pass / 0 fail**; typecheck `TSC_EXIT=0` with an empty log (the first run aborted at **134 with `ERROR_LINES=0`** — an OOM at the 4 GB default heap, not a clean result). **4 mutations, every one printed before → after and every one red:** inner JOIN restored · `COUNT(b.sid)` → `COUNT(b.event_id)` · the orphan arm deleted · the trigger's self-dealt refusal excised (that last one turns the laundering pin red). 🪤 **Two sabotages of my own did not land and reported GREEN** — one targeted the wrong file (`grep -rl | tail -1` picked *this* migration, whose header merely names the trigger) and one *added* a vacuous clause while leaving the real predicate standing. **When a well-formed sabotage reports green, suspect the sabotage.** The migration was dry-run against production inside a rolled-back transaction (owner `postgres`, replace permitted); prod re-read afterwards still carries the OLD definition, 5 events, 45 bookings, 0 probe rows.

🔢 **Inert on merge: prod holds 0 orphaned bookings and 0 orphaned reviews today**, so nothing published moves. It is the next deletion this protects.

SPEC IMPACT: `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` + `VENDOR_DATA_SURVIVES_DELETION_2026-08-21.md` + `DECISION_LOG.md` — the register's "THE VENDOR CANNOT ANSWER" claim is STALE (`vendorAgreeToDeletion` / `vendorDeclineDeletion` are wired into `vendor-dashboard/page.tsx`), and its "a review cannot outlive its event / NOT NULL + CASCADE" claim is stale (`vendor_reviews.event_id` is SET NULL in prod). Both corrected in the corpus.
