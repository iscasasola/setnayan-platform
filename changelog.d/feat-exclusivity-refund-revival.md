## 2026-07-11 · feat(vendors): exclusivity fairness — token refund on displacement + inquiry revival on un-lock (flag-gated)

Closes the two fairness gaps in the shipped exclusivity flow (#3091). Both behind
`NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (same flag) — ship dormant. ADDITIVE to
the exclusivity block + the revert path only; the hard-gate code is untouched.

- **Refund on displacement.** When `finalizeVendor`'s exclusivity block displaces a
  losing vendor whose thread was `accepted`, that vendor had burned 1–3 tokens
  (`unlock_vendor_event`) to answer. New SECURITY DEFINER RPC
  `refund_displaced_inquiry_unlock(vendor, event)` credits those tokens back — the
  couple is the actor, the losing vendor is credited, so DEFINER + couple-scoped
  auth (`current_couple_event_ids`, mirroring `chat_threads_member_write`). It
  mirrors the burn's holder branch (founder → `vendor_wallets` store wallet, member
  → `vendor_member_token_wallets`, resolved from the `INQUIRY_UNLOCK` redemption
  row's `metadata.holder_user_id`) and credits back as **purchased** (non-expiring —
  the simplest never-adverse reversal; matches `approve_vendor_token_purchase`).
  Only `accepted` vendors are refunded (`pending` spent nothing). **Idempotent**
  via a new `vendor_event_unlocks.refunded_at` guard — a re-displace after a revive
  never double-refunds. **Fail-soft** — a refund hiccup never rolls back the lock.
- **Revival on un-lock.** `revertVendorToConsidering` now revives the inquiries the
  reverted hard-single lock had displaced: restores each `displaced` thread to the
  status it held before (new nullable `chat_threads.displaced_from_status`, stamped
  by the displace, read back + cleared on revive), scoped to this event + the
  group's categories. Couple-RLS write, fail-soft, same flag gate. `displaced` is
  the documented REVIVABLE state — this closes the loop.
- **Refund ↔ revival decision:** the refund is **permanent** and revival **never
  re-charges**. The refunded `vendor_event_unlocks` row is left in place, so a
  vendor keeps event access and answers a revived inquiry for free — a
  displace→revive flip-flop is the couple's indecision and must never bill the
  vendor twice nor double-refund (the `refunded_at` guard enforces the latter).
- **Migration `20270723145233`** (additive, idempotent, RLS unchanged): three
  columns (`vendor_event_unlocks.refunded_at/refunded_tokens/refund_reason`,
  `chat_threads.displaced_from_status`) + the refund RPC. NOT yet applied to prod.

SPEC IMPACT: Adds token-refund-on-displacement + inquiry-revival-on-unlock to the
payment-gated lock exclusivity flow (Vendor_Customer_* plans). Migration
`20270723145233` NOT yet applied to prod (owner will apply). Gated by
`NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (OFF). Logged in DECISION_LOG.md 2026-07-11.
