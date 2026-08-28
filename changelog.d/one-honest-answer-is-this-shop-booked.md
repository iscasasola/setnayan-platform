## 2026-08-27 · fix(vendor): one honest answer to "is this shop booked?"

Every day-of screen asked the schedule pool. Measured against production
(`pg_proc`, not a migration file and not a comment): `vendor_schedule_pool_bookings`
has exactly ONE writer — `acquire_schedule_pools` — with exactly ONE caller,
`acquire_service_time_slot`. **Two shipped booking paths never reach it, and both
suppliers were invisible on the morning of the celebration they were booked for:**

- **`vendor_agree_to_lock`** — the supplier pressed Agree. Writes
  `lock_request_state='agreed'` + `status='contracted'` and acquires nothing. A
  supplier waiting on the couple to record the downpayment was told "No event today".
- **`vendor_claim_locked_qr`** — the couple scanned the shop's Locked QR. Writes
  `status='deposit_paid'`, records a downpayment **already received off-platform**,
  and acquires nothing. **Money had moved and the supplier was still invisible.**

New `lib/vendor-room-access.ts` exports `fetchVendorRoomEvents(client, vendorProfileId)`
— three arms, one answer. **Ten call sites swapped in six files** (all day-of);
**twelve readers deliberately left on the raw pool read, each with a stated reason.**

🚨 **THE SPECIFIED FIX WOULD HAVE MISSED HALF THE BUG.** The build note prescribed
one new arm — `marketplace_vendor_id` + `lock_request_state='agreed'`. Reading the
live `vendor_claim_locked_qr` body out of production shows it **never writes
`lock_request_state` at all**, so that arm cannot match a Locked-QR booking. A
filter that cannot match is not a fix. Hence **arm 3**: a *claimed* Locked QR token
issued by this shop (`vendor_locked_qr_tokens`, whose only non-admin policy is
`vendor_profile_id IN current_vendor_profile_ids()`, and whose
`claimed_event_vendor_id` is stamped only by the SECURITY DEFINER claim RPC).

🔑 **THE TEST IS ALWAYS "DID THE SHOP ITSELF SAY YES?"** `event_vendors_couple_write`
is `FOR ALL` with no column list, so a couple can type any shop's name and set
`contracted` — status alone proves nothing. Arm 2 is unforgeable because
`guard_event_vendor_lock_handshake` raises `42501` when `authenticated`/`anon` writes
`'agreed'`, on INSERT **and** UPDATE (read out of prod). Arm 3 is unforgeable because
a couple cannot write a token row — **and because a shop CAN write its own token rows,
arm 3 additionally requires the `event_vendors` row to name this shop.** Two sides,
one booking.

⛔ **THE PUBLIC SHOP PAGE (`app/v/[slug]`) MUST NEVER ADOPT THE ROOM READ**, and a
test enforces it: the room read admits an AGREED-but-unpaid booking, and publishing
those tells strangers about weddings nobody has paid a downpayment on. Same reason
`real-stories` / `shop` stay on the pool read — their event ids become the shop's
**public** "Featured editorials" picker.

🪤 **A PLACEHOLDER DATE IS NOT A BOOKING DAY.** An `event_vendors` row carries no
date, so arms 2 and 3 take it from `events.event_date` — which holds a value even at
`event_date_precision='year'`. **Production holds such a row today (4 events at
'day', 1 at 'year').** Without the precision filter a supplier gets a full day-of
console on a date nobody has agreed to. `vendor_agree_to_lock` already gates its own
same-date rules on `precision='day'`; this matches it rather than inventing a rule.
Dates are compared as strings throughout — never `new Date('2026-12-12')`, which is
the 11th in Manila.

🔒 **RLS IS NOT THE FENCE HERE, AND CANNOT BE.** `event_vendors` has four policies and
**none is vendor-side** — a supplier reading it through their own session gets zero
rows, silently, forever. Arms 2 and 3 are therefore service-role reads **scoped in SQL
by the `vendorProfileId` the caller proved**. This is an AUTHORIZATION read and returns
no event content; event content keeps going through `get_vendor_event_brief` under the
supplier's own session.

🔑 **ID IN, CLIENT IN — no session resolution inside**, and that is not style:
`on-the-day/live/[eventId]` has a GRANTEE path passing an admin client and an id
derived from an access grant. A helper resolving the shop from the session would break
that role silently. A test asserts the module never calls `auth.getUser` /
`fetchOwnVendorProfile`.

`BOOKED_VENDOR_STATUSES` is **imported from `lib/vendors`** (the typed copy; a second
untyped copy lives in `lib/event-deletion-gate.ts`) and a test fails if any of the
four strings is retyped here.

**Safe by arithmetic at merge:** production holds 45 `event_vendors` rows — **1** with
a `marketplace_vendor_id`, **0** at `lock_request_state='agreed'`, **0** claimed Locked
QR tokens. Arms 2 and 3 match nothing today; behaviour is byte-identical until a real
booking arrives.

**Guard:** `lib/vendor-room-access.test.ts` — 18 tests. The admission rule is pure
(`admitRoomBookings` in `lib/vendor-room-access-rule.ts`) so it is proved without a
database; the wiring half counts the ten swapped sites, pins the two readers that must
never widen, and fails if any of the twelve leave-behinds loses its stated reason.
**14 mutations, every one with its occurrence count printed before → after, all RED.**
One of them reported a red result on the first attempt with its count UNCHANGED at
0 → 0 — the pattern was case-wrong and the sabotage had never landed. It was re-run
until the count moved (1 → 0). *An unmeasured mutation proves nothing, and a red
result is not evidence the sabotage applied.*

🪤 **THE RULE IS SPLIT OUT INTO `lib/vendor-room-access-rule.ts`, and that is not
tidiness.** `vendor-room-access.ts` is `server-only`, and **`server-only` is not an
installed package in this repo** — Next aliases it at build time, plain node throws
`MODULE_NOT_FOUND` — so a `server-only` module cannot be imported by a `node:test`
file at all. Eight lib modules already solve this the same way
(`papic-uploads-open-rule.ts` is the closest precedent). ⚠
`scripts/lint-server-only-boundary.mjs` asserts the opposite in its own docblock —
*"the unit tests import modules directly in node, where server-only resolves
happily"*. **That sentence is false**, and it is recorded here rather than edited
because the lint itself is correct and passes.
🔑 And the first cut of this PR dropped `server-only` outright on the strength of a
check that reported "no lib module importing server-only has a sibling test" — the
grep was capped at `head -20` of 183 files. **Eight do.** *A search that cannot reach
the answer is not a negative result.*

⏭ **Named, not fixed:** `lib/vendor-overview.ts` stays on the pool read because its
upcoming list keys React ids on `poolBookingId`, which an agreed booking has none of;
widening it needs a stable id first. `recaps` / `proposals` are the same room question
one screen over and are deliberately outside this piece's day-of scope.

SPEC IMPACT: None — no locked decision, price, SKU or schema changes. The two booking
paths and the pool writer are described as they are in production today.
