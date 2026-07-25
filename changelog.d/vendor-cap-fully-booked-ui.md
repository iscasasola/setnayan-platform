## 2026-07-26 · feat(vendors): free-tier "Fully booked" state + graceful lock-cap error handling (flag-dark)

Vendor monetization model § 4 (owner-locked `Vendor_Monetization_Model_LOCKED_2026-07-25.md`): a **Free** vendor may hold **3 concurrent active bookings**. At the cap they stay **discoverable** and their **inbox + chat stay wide open** — only the couple's **Lock/Book** action is gated.

The cap logic (`lib/vendor-free-tier-booking-cap.ts`) and the hard DB guard (migration `20271001120000` · `enforce_free_tier_booking_cap`, gated on `platform_settings.free_tier_booking_cap_enabled`, default FALSE) already shipped. What was missing — and what **blocked flipping the switch** — is the couple's side: at the cap the trigger raises a raw Postgres `check_violation`, which would have reached a couple as a database sentence in a red toast. This ships that missing half.

### ONE switch, read where it lives

The couple-facing pre-check reads **`platform_settings.free_tier_booking_cap_enabled` directly** — the same row the trigger reads — so the pre-check and the trigger agree **by construction**. `NEXT_PUBLIC_VENDOR_FULLY_BOOKED_UI` decides only whether this couple-facing *layer* exists, never whether a booking is refused.

An earlier revision of this branch used a second env flag (`isVendorFullyBookedPreCheckEnabled` / `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP`) as a stand-in for the DB switch. **Both** are deleted here, because an env var cannot track a DB column and each direction of drift was a real defect:

- env off + DB switch on (the previously *recommended* flip order) → the couple was asked for a downpayment, paid out-of-band, and the lock was then refused at the write, past the ledger insert. Money moved, nothing recorded.
- env on + DB switch off → every free vendor holding 3 rows was refused while the trigger sat inert. Lost bookings against a cap that was not enabled.

`lib/vendor-free-tier-booking-cap-flag.ts` (the dead `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP` module, zero call sites) is **deleted** so it cannot be wired later and reintroduce the same mismatch.

### One booking = one EVENT, not one service row

`event_vendors` carries **one row per service**, so the shipped trigger's `COUNT(*)` counted rows where the model counts **bookings**.

**Honest scope.** The review described this as "one 4-item package booking exhausts the cap". That exact scenario does **not** reproduce: `event_vendors_unique_marketplace_pick_per_event` (20260625050739) already forbids two active, non-archived rows per `(event_id, marketplace_vendor_id)` — the second row throws `23505` first. (Proven in the new DB test; it also means `lockPackage`'s multi-item cascade cannot commit today at all — a **separate, pre-existing defect**, flagged below, not fixed here.) The window that **is** real: that index is *partial* — archived rows sit outside it and keep their `contracted`/`deposit_paid`/`delivered` status — so a couple who archives and re-locks the same vendor leaves two active-status rows in one event, and `COUNT(*)` burned a second concurrent slot every other couple was then refused. `COUNT(DISTINCT)` is the correct expression of "3 concurrent bookings" either way. Fixed in **both** places:

- migration `20271004541679_free_tier_booking_cap_count_distinct_events.sql` — `CREATE OR REPLACE` of `enforce_free_tier_booking_cap` with `COUNT(DISTINCT ev.event_id)`. Nothing else changes: same trigger, same `platform_settings` gate (still default FALSE = inert), same `free_tier_booking_cap:` token, same `check_violation`. The RAISE also **no longer carries `marketplace_vendor_id`** (some paths rethrow that text verbatim).
- `lib/vendor-free-tier-booking-cap.server.ts` — reads `event_id` rows and counts distinct via `countDistinctBookedEvents()`; paid tiers skip the count entirely.

### The money path aborts loudly, not silently

The pre-check sits **above** the downpayment gate, so a couple is never asked to pay for a lock the cap will refuse. For the residual race (the vendor's last slot goes between the pre-check and the write), `finalizeVendor` now returns `depositNotRecordedMessage` whenever the refused attempt carried a downpayment, and logs an ops `console.error`. The couple reads, in as many words, that **nothing was booked and the downpayment was NOT recorded**, with a pointer to the thread. Setnayan never holds this money (it is paid to the vendor directly and only *logged* here), so no refund or hold is implied. The ledger insert is **not** moved — writing a payment row against a booking that does not exist would be worse than saying so.

### Wired at every couple-facing Lock/Book path

- `finalizeVendor` — `vendor_fully_booked` result from the pre-check plus translation of the trigger's error at **both** write sites (the generic lock UPDATE and the `acquire_service_time_slot` RPC). Not a fault log: an expected refusal, not a failure.
- `wizard-actions.ts` — **both** wizard lock paths (`completeVendorPickFromMarketplace` and the Card-14 booth lock) previously did `throw new Error(insertErr.message)`, rethrowing the trigger's raw Postgres sentence — including Setnayan's internal vendor id — straight at the host. Both now get the pre-check **and** the error translation.
- `accordion-lock.tsx` — `fully_booked` state: the Lock CTA goes **disabled** and reads "Fully booked", amber `role="status"` (not `alert`).
- `pending-lock-proposals.tsx` — previously funnelled a cap refusal into the generic "needs a few details to lock — open its card below to finish" nudge, pointing the couple at a card whose CTA is disabled and where there are no details to finish. Now shows the capacity copy (or the deposit warning).
- `lockPackage` + `lock-modal.tsx`, `bookVendorAtChatLock` + `lockDeal` — same pre-check/translation. **The thread is never gated**: the couple keeps chatting, they just can't close the booking yet.

Couple-facing copy never mentions the vendor's plan or tier and always says the couple can still message them.

### Tests — `lib/vendor-free-tier-booking-cap-ui.test.ts`, 23 cases

Round one shipped a test that *claimed* to pin the trigger message but only compared two TypeScript constants to each other; rewording the RAISE left it green. Replaced with **migration pins that read the SQL file itself** — the newest migration defining `enforce_free_tier_booking_cap` — and assert the token, the `check_violation` ERRCODE, `COUNT(DISTINCT ev.event_id)`, the `platform_settings` gate, and the absence of the internal vendor id. Plus: the detector across `message`/`details`/code-less RPC re-raise, negatives for the verified-gate `23514` and hard-single `23505`, `countDistinctBookedEvents` (4 rows in 1 event = 1 booking), the deposit-not-recorded copy, the refusal payload, the copy invariants, the CTA state over every tier × 0–5 bookings, and a guard asserting the flag module exports **exactly one** function and that no source file reads `process.env.NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP`.

### Tests — `tests/db/free-tier-booking-cap.db.test.ts`, 12 cases (NEW, `test:db`)

The trigger now has real end-to-end coverage on the PGlite migration replay: the `platform_settings` default is FALSE and the cap is provably inert while it is; three distinct events cap the 4th; the `free`/`verified` tiers cap and `solo`/`pro`/`enterprise` never do; the raised message carries the detector's token and **not** the vendor_profile_id; an archived duplicate in one event cannot burn a second slot; the couple's own event is excluded; a lifecycle advance of an already-active row is not re-counted; a completed event frees a slot; off-platform vendors are never capped. One case pins the `event_vendors_unique_marketplace_pick_per_event` constraint the scope note above depends on.

### Falsification

Every behavioural fix was reverted and re-run: `COUNT(*)` in the migration → 1 unit fail; reworded RAISE → 1; vendor-id back in the RAISE → 1; second flag re-added → 1; distinct→row counting in TS → 3; money copy neutered → 1; refusal payload neutered → 1. Removing the migration file entirely → **2 DB-test fails** (the archived-duplicate slot and the vendor-id leak).

**Not covered by an automated test** (no server-action harness in this repo): the `finalizeVendor` / `lockPackage` / `wizard-actions` call sites themselves, and `isMarketplaceVendorFullyBooked`'s DB reads (`server-only`, so it cannot load under `tsx --test`). The pure decision logic each of them calls is tested; the trigger they defer to is tested against real SQL.

### Found in passing, NOT fixed here

`lockPackage`'s cascade (`packages/actions.ts`) inserts one `event_vendors` row per kept package item, all carrying the same `marketplace_vendor_id` in the same event — which `event_vendors_unique_marketplace_pick_per_event` rejects with `23505` on the second row. Any multi-item package lock therefore fails today, independent of this cap and of any flag. Pre-existing on `main`; out of scope for this branch.

**Flag OFF = byte-identical to today**: no extra read, no new result branch, no copy change. The migration is inert while `platform_settings.free_tier_booking_cap_enabled` is FALSE (its default) — this change does **not** flip it.

SPEC IMPACT: None — implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 4 as written (3 concurrent · discoverable at cap · inbox/chat never gated). The "3 concurrent bookings" wording is now enforced as 3 concurrent *events*, which is what the spec text says; no spec edit needed.
