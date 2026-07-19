## 2026-07-16 · fix(tokens): creator-offer reach token — escrow at send, refund on expiry (closes the swallowed-consume leak) + influencer-spend tag

Closes the CONFIRMED revenue leak and the two reservation-integrity flaws in
the merged P1 collab loop (PR #3318), per the Creator Economy Readiness Council
verdict § 3 B1–B3 (`Creator_Economy_Readiness_Council_Verdict_2026-07-16.md`) —
council-preferred, owner-ratified ESCROW-AT-SEND design.

- **Migration `20270819350491_creator_offer_reach_token_escrow_at_send.sql`**
  (supersedes the RPCs in `20270817214733`, never mutates it):
  - **B1 (leak):** `offer_creator_reach_hold` now DEBITS the reach token at
    offer-send via the same `consume_vendor_assets_per_voucher` /
    `consume_member_purchased_tokens` burn — raise-and-rollback, never
    swallowed. `respond_creator_offer` no longer consumes: accept AND decline
    settle the already-spent token (owner lock — a decline still costs the
    vendor); the `EXCEPTION WHEN OTHERS THEN RAISE NOTICE` block is REMOVED,
    and it now raises `OFFER_EXPIRED` on a stale response.
  - **B2 (cross-ledger double-reserve):** structurally moot post-escrow — a
    pending offer's tokens have already left the balance every other spend
    path reads (`unlock_vendor_event_hold` needs no change; verified against
    its latest definition in `20270818135217`). The reach path stops counting
    pending offers as "held" and still subtracts outstanding lead holds.
  - **B3 (race):** the reservation read locks the wallet row `FOR UPDATE`,
    mirroring the hardened lead path (`20270727563372` FIX 1).
  - **Refund on expiry:** `sweep_expired_creator_offers` refunds the escrow on
    pending→expired as PURCHASED (non-expiring) tokens to whoever paid,
    mirroring `refund_displaced_inquiry_unlock` (`20270723145233`); exactly-once
    via the row lock + `refunded_at` stamp. Per-voucher restore is impractical
    (FIFO burn spans vouchers whose balances have moved) — documented in-file.
  - **Influencer-spend tag (owner req):** new `spend_source` column on the
    existing `token_redemptions_log` burn ledger, stamped
    `'creator_offer'` in the same transaction as every reach debit (keyed on
    the unique `metadata.offer_id`); historical `CREATOR_REACH` rows
    backfilled. PR-C adds `'lead_unlock'`.
  - One-time backfill converts legacy held-not-debited pending offers to
    escrow (un-coverable holds are voided/expired, never resolved unpaid).
  - Header documents the four required walkthroughs: (a) mid-window drain →
    accept just settles; (b) concurrent sends w/ 1 token → second refused at
    reserve; (c) expiry → exactly-once refund; (d) respond-after-expiry →
    OFFER_EXPIRED.
- **`lib/creator-offers.ts` + `app/dashboard/(account)/creator/offer-actions.ts`
  + `app/vendor-dashboard/creators/actions.ts`:** honest return-value handling
  (`tokens_charged` at send / `tokens_settled` at respond — no more
  `tokens_consumed` reported for a debit that never happened), OFFER_EXPIRED
  humanized for the creator, escrow semantics documented at every seam.

SPEC IMPACT: `Creator_Economy_Readiness_Council_Verdict_2026-07-16.md` § 3
B1–B3 are now FIXED in code (escrow-at-send, the council's preferred fix, as
ratified atop `Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md`);
DECISION_LOG.md row appended in the corpus.
