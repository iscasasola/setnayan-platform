## 2026-09-22 · feat(loop): CTRL-B2 — the loop that never closes

### 7 — paying the booking fee holds the date

Owner 2026-09-18: a lock on the supplier's schedule happens *upon the vendor paying their booking
fee.* Until now a supplier could pay us to hold a date and stay bookable — his own calendar and
every couple's availability search both said he was free. `vendor_calendar_blocks` is **0 rows** in
production.

🛑 **The brief's diagnosis was wrong, and the truth is worse.** It blames
`event_vendor_autoblock_on_booking`'s `deposit_paid` condition. That trigger has **three** guards,
and prod's three `deposit_paid` rows all carry `marketplace_vendor_id IS NULL` — manual suppliers
with no shop — so they fail guard **one**, correctly. The two marketplace bookings sit at
`contracted` and fail guard two. **The trigger's happy path has never once run in production.**

🔑 **Additive, not a re-pointing.** `recordDeposit`'s docblock says the HOST advances `deposit_paid`
separately. Re-pointing the trigger would move a status the host owns as a side effect of a payment.
This adds a second, independent reason for a date to be held and leaves the trigger untouched.

⚠ **Both ends, or neither.** A new reason to CLOSE a date is a defect on its own unless the release
side learns it: `vendor_unblock_booked_date` refused to reopen a day another *status-live* booking
held, and now also refuses when another booking holds it by a **settled fee**. Without that,
releasing booking A reopens a date booking B has paid to hold.

⚠ `waived_free5` / `waived_import` count as settled, as they do in `event-access-stage.ts`. Reading
"settled" as `paid` alone would leave every supplier's **first five bookings** unable to hold a date.

Guard `tests/db/the-paid-fee-holds-the-date.db.test.ts` — 6 tests on a replayed schema. Three
sabotages, each hitting only its own test: migration parked → all 6 red; the new release arm removed
→ only the both-ends test; "settled" narrowed to `paid` → only the waived test.

SPEC IMPACT: None — applies the 2026-09-18 ruling; makes no new one.

### 1 — the supplier is told their event is over

`coupleConfirmReceived` requires `service_marked_complete_at`. Measured 2026-09-22: **51 bookings,
that column set on 0, `vendor_reviews` empty.** No couple has ever been able to confirm delivery, so
the review door has never opened, so no shop has a track record. **The retention loop has never
closed once.**

🛑 **RULE 0 caught this build mid-flight, and the correction shrank it.** The first version wrote a
new `vendorMarkServiceComplete`. **It already existed** — in the same file — and was better: it also
sets `completion_status: 'vendor_marked'`, which the new one missed. The duplicate was deleted and
the desk now posts to the shipped action.

🔑 **The measurement that missed it was a `grep … | head`.** The writer was real and simply below the
cut, so a truncated non-zero result read as a complete one. The register's actual claim — *"no
`mark_complete` kind exists on the answers desk"* — was correct. **The starter motor was the card,
not the writer.**

- New `readBookingsAwaitingCompletion` (paged, like its four siblings).
- New `needsCompletionMark` in `answers-desk.ts` — pure, so it is executed rather than grepped. It
  **fails closed**, against that module's usual direction: an over-eager row asks a supplier to
  assert something not yet true, and that assertion unlocks a review.
- The date is parsed at PH midnight. A bare `new Date('YYYY-MM-DD')` is UTC midnight = **8am the same
  day in Manila**, which would ask a supplier eight hours into their own event.
- `createdAt` is the day after the event, not `now` — on an oldest-waiting-first desk, `now` would
  pin every completion row to the bottom forever.

Guard `the-event-is-over-and-somebody-says-so.test.ts` — 8 tests, 8 sabotages confirmed red.
🪤 One of those guards had the very bug it was written to catch: its
`/function MarkCompleteBody\([\s\S]*?\n}/` window stopped at the **destructuring's** closing brace —
60 characters, containing no form — so the assertion could never fail. Now sliced to the next
top-level function, with a length floor so a collapsed window fails loudly.

SPEC IMPACT: None.

### 2 — the couple is told who they are waiting on

RULE 0: `coupleConfirmReceived` **already existed and was already mounted** on the couple's
workspace. The gap was one state — the page's own comment read *"`awaiting_vendor` renders nothing
(nothing to do yet)"*. Nothing to DO is not nothing to SAY: after the celebration a couple opened
this page looking for their review and found a blank, indistinguishable from a product that had
forgotten them. Now: **"Waiting on {supplier}"**, with why.

🔑 It is only honest because build 1 shipped. Before it the supplier was never asked for the mark
either, so this card would have promised a step nobody would take — a worse lie than the blank.

### 3 — admin metrics stop filtering on a status nothing writes

`completion_status = 'auto_confirmed'` had readers in eight files and **no writer in TypeScript or
SQL**; prod holds 0 rows at it. The choice was "write it or stop reading it", and writing it needs a
scheduler this repo deliberately does not have — `reviewState` derives auto-confirmation from
elapsed time and is correct. So the metric now derives completion the same way, off the **same
exported `M_CONFIRM_DAYS`**, and the head count and the per-row buckets share one definition.

### 4 — going live is no longer silent

`transitionVendorVisibility` wrote an audit row and a tier-history row and called **no notifier**
(`grep -c notify` → 0). "Couples can now find you" reached a supplier only if they happened to log
in. Now emits `vendor_status_change`, which was **already on `EMAIL_ENABLED_TYPES`** — checked, not
assumed, and the guard asserts both halves, because having one is indistinguishable from neither.

### 5a — the v1 API answers with the derivation, not a vestigial column

`/api/v1/vendor/profile` returned the legacy `is_published`, which is **false on SetnaProd while the
shop is verified and findable** — so a supplier reading their own API was told "not published" about
a live shop. It now returns `is_live`, from the same `isShopLive` the marketplace uses.

### 6 — an agent's phone offers what their desktop grants

`VENDOR_SCOPED_NAV_ITEM_KEYS` has granted staff **My Customers** since the 5-page IA landed
(2026-07-12); `VENDOR_SCOPED_BOTTOM_NAV_KEYS` was never updated and held one key. The phone was the
**stricter** list, so an agent had no route to the one operational surface their role exists for.
Fixed, plus the stale comment in `vendor-bottom-nav.tsx` that still said "Phase 1: Home + More"
while the same file says twice that there is no More tab. New `canonicalVendorNavKey` lets the guard
compare the lists **by meaning**, since Overview is deliberately `profile` on the phone.

Guard `the-loop-closes-and-says-so.test.ts` — 5 tests, 6 sabotages confirmed red.
🪤 **Four guards in this bundle convicted their own documentation before they worked.** A comment
saying *"this used to filter on auto_confirmed"* is the opposite of the defect. They now read
stripped source through the repo's single `stripComments`.

### 5b — DROPPED from the end

The permanently-empty payout section on `/vendor-dashboard/earnings` is untouched. The brief calls
it last and safe to drop, and its neighbouring lie — the blurb promising "scheduled payouts" — was
already fixed in PR #5849. Removing a whole section from a shipped money page deserves its own
change with someone watching.
