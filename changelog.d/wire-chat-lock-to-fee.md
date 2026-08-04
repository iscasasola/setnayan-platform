## 2026-07-24 · feat(booking): chat "Lock this deal" IS the booking — 5% on the negotiated price (Option A)

Owner "Option A" (2026-07-24): the couple's chat **"🔒 Lock this deal"** action IS the booking — the price agreed in chat must be the price the 5% Booking Fee charges on, so the chat lock and the vendor-page finalize can no longer diverge. Both `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` and `NEXT_PUBLIC_BOOKING_FEE_ENABLED` are LIVE in prod, so this goes live on merge — shipped as a **DRAFT** PR for owner review, NOT auto-merged.

**Before:** `lockDeal` (`apps/web/app/_components/negotiation-actions.ts`) only froze the price — it stamped `proposal_amendments.locked_at` + wrote `chat_threads.agreed_price_centavos` and charged nothing. The 5% lived only on the vendor-page `finalizeVendor` path, so the two locks were separate mechanisms that could carry different numbers.

**After — `lockDeal` advances the REAL booking at the negotiated total, through the SAME core the vendor-page finalize uses:**

- New shared lock primitive `bookVendorAtChatLock` (`lib/chat-lock-booking.server.ts`) + its pure decision `planChatLockBooking` (`lib/chat-lock-booking.ts`). It reuses the **exact** two pieces `finalizeVendor` already imports — `isMarketplaceVendorBookable` (verified-gate) and `collectBookingFeeAtLock` (5% / free-5 / idempotent QR-order). Not a second fee/verify path.
- On chat lock we resolve the `event_vendors` row for the thread's (event, `vendor_profile_id`), set `total_cost_php = the accepted Deal's negotiated total`, flip `status → 'contracted'` (same money-status precondition + `selection_match_rank` / `linked_vendor_profile_id` stamps as finalize's generic write), then call `collectBookingFeeAtLock`. Because the fee RPC `booking_fee_open_lock_charge` computes 5% off `event_vendors.total_cost_php`, and the thread freezes `round(total × 100)`, the **charge base == the frozen chat price by construction**.
- **Verified-gate applies:** an unverified marketplace vendor can't be chat-locked — friendly pre-check plus the `event_vendors_require_verified_before_lock` DB trigger as the hard backstop (a `check_violation` maps back to a friendly message; no lock, no charge).
- **Idempotent across both entry points:** if the vendor-page finalize already locked, chat lock sees an already-`contracted` row → `refresh_fee_only` (no rewrite of the frozen price) and the fee RPC returns the same live charge; conversely a later `finalizeVendor` short-circuits on `already_locked`. The booking-fee ledger's one-live-charge-per-(vendor×event) guard means no double-book, no double-charge.
- **Off-platform / no-marketplace-link threads:** still record the agreed price on the thread, fire no fee, never crash.
- Hard-single-category collision (a second venue/coordinator/etc.) surfaces a friendly "switch from the vendor page" message instead of a raw `23505`.

Tests — `lib/chat-lock-booking.test.ts` (5 pure-decision cases: link/verified/already-booked branches, canonical status set) + `tests/db/chat-lock-booking.db.test.ts` (4 end-to-end SQL cases against replayed migrations: the verified trigger blocks a chat lock on an unverified vendor; **price parity** — 5% bills the negotiated total not the stale one; cross-entry-point re-lock → one charge never doubled; off-platform lock flips but never bills). Full unit suite green (3141), existing booking-fee-lock DB suite green (6), typecheck clean.

Coordination: a parallel session is editing the negotiation Deal-card UI — this change is confined to the `lockDeal` server action + new `lib/chat-lock-booking*` files; the UI is untouched.

SPEC IMPACT: Resolves the two-lock fork — the chat "Lock this deal" is now the booking, and the 5% fee charges on the couple-negotiated price (single source: `event_vendors.total_cost_php`). Aligns with the 2026-07-24 fee-at-LOCK model already in `lib/booking-fee.ts` + `AS_BUILT_GROUND_TRUTH`. No pricing-number change; no schema change.
