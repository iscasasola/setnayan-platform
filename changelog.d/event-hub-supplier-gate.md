## 2026-08-17 · fix(event-hub): a booked supplier can open a PRIVATE event's page — the gate refused them ~200 lines before the doorway's gate ran

**What a person gets.** A supplier the couple has booked opens that wedding's web address and sees *"You are booked here — open your tools"*, instead of a lock screen telling them to scan an invitation QR nobody ever sends a supplier. And a couple opening their OWN event page is no longer addressed as a stranger.

### The defect was ORDERING, not absence

The supplier doorway (`app/[slug]/_components/vendor-doorway.tsx`), its gate (`resolveVendorCapability`) and its read (`loadVendorBooking`) have all shipped since 2026-08-03, mounted in `site-body.tsx` above the tier fork. None of it could ever run on a private event: `app/[slug]/page.tsx` resolves visibility at ~line 414 and returns `<PrivateLanding>` at ~line 493 unless the viewer is a redeemed guest (Path A), a signed-in host (B), a seat-holder (C) or an invited account (D). **A booked supplier is none of those four**, and `resolveVendorCapability` is not called until ~line 652. **4 of the 6 production events are private.**

`linked_vendor_profile_id` is stamped automatically — there was no writer to build. Grepping the COLUMN (never a remembered list) found **three** writers, not the one the brief named: the couple's lock, the chat lock, and `lib/reusable-bookings.server.ts`.

### 🔒 BOOKED, not merely LISTED — the third writer is why

`acceptReuseRequest` mints a **LINKED row at `'shortlisted'`** that the couple has still to lock. So a link alone does not mean the couple chose anybody, and admitting on the link would have let a supplier the couple is *still considering* read a private celebration — the same boundary PR-H draws when it refuses an ASKED supplier the venue address and the run-of-show.

The gate therefore asks the row's **status**, via `vendorBookingIsCommitted`, derived from the shared `COMMITTED_BOOKING_STATUSES` (pinned by a drift test to the booking-fee RPC's own list, so "booked enough to read the page" cannot drift from "booked enough to be charged for"). Unknown or absent statuses **fail closed**.

`loadVendorBooking` now returns that status, and its old `.limit(1)` is gone: a supplier can hold several rows on one event (the package-booking shape — one anchor plus a `covered` row per line, which the partial unique index deliberately permits), and the read now prefers the committed row instead of taking whichever Postgres returned first.

### 🔒 It admits them to the PAGE and nothing else

Path C's stated rule, unchanged: no guest session is minted (a render cannot write cookies), so the supplier falls through to `renderAnonymous`, whose identity is built by the key-pick firewall and is structurally incapable of carrying a guest name, seat or RSVP. Asserted as **what the payload does NOT contain**, on an event seeded WITH guest names, and against a booking read deliberately poisoned with guest data.

⚠ `'invited_accounts'` is untouched and is **not** folded into any `!== 'public'` test — the new branch is added alongside the existing four, per the warning in that file.

### The host's own page

A signed-in host with no guest cookie hits `if (!session) return renderAnonymous(...)` and got the stranger's body: *"This is a Setnayan invitation page. Scan your personal QR or open the link the couple sent you"* — addressed to the couple, about their own wedding, while the read-only owner ribbon sat on top saying "your event". The body now has a host variant (copy only) keyed on the same server-verified capability the ribbon already uses. **Read-only stays read-only** — every real control remains in `/dashboard/[eventId]` and nothing links anywhere the ribbon does not already link.

### Also corrected

- `page.tsx` called both capabilities *"declared-but-unconsumed foundation"* long after both had consumers.
- The existing source guard `an-invited-person-is-recognised.test.ts` was **extended, not loosened** — it now also refuses a gate that admits on the link alone, and one that folds the supplier into the guest's `isSeatHolder` flag.

### Proof

- **Test-proved** (prod has no linked supplier, so the live site cannot show this): 9 unit tests + 5 db tests against replayed migrations. Every assertion mutation-checked with occurrence counts printed before → after — 7 sabotages, all verified to have landed, each turning the suite red: predicate always-true (3 fail) / always-false (1) · dropped account guard (1) · leaked guest keys into the capability (2) · guest name added to the supplier read (1) · `!isBookedSupplier` removed from the refusal (1) · admit-on-link-alone (1).
- Full suite: **8462 unit tests pass**, typecheck clean, all 24 lint scripts pass.

### 🔴 FOUND WHILE VERIFYING — NOT FIXED HERE, AND IT BLOCKS THE PR-H FLAG FLIP

`app/dashboard/[eventId]/vendors/actions.ts` states: *"The agree RPC stamps both alongside 'contracted', exactly as `acquire_service_time_slot` already does, so a real booking is unchanged."* **Read out of production by the object, that is false.** `vendor_agree_to_lock`'s one agree UPDATE sets `lock_request_state`, `lock_agreed_at`, `lock_answered_by_user_id` and `status → contracted` — and neither `linked_vendor_profile_id` nor `selection_match_rank`. (`acquire_service_time_slot` does stamp both; that half of the sentence is true.)

So the moment `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` is switched on, a booking made by Lock → supplier agrees produces a `contracted` row with a **NULL link** — and everything keyed on that column silently loses it: this doorway, the editorial first-pick credit, Real Stories vendor credit, Papic vendor attribution, stage-note recipients, showcase credits, the verified median, fraud detection and the plausibility scanner. Inert today (0 linked rows, 0 asks in flight, flag off). **Deliberately left for its own PR** — it is a change to an owner-gated PR-H function, not this ordering fix.

SPEC IMPACT: None. No migration, no schema change, no pricing or SKU change. The `vendor_agree_to_lock` gap above is reported, not actioned.
