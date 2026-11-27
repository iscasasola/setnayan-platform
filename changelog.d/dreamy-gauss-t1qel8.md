## 2026-11-27 · fix(papic): the free first-event Papic grant leaves the code

Owner ruling 16 Nov (DECISION_LOG "Free 50 Papic credits REMOVED"): every booking carries a Setnayan gift, so the platform's free first-event Papic grant goes. The owner set `papic_event_pool_config.free_grant_points` to 0 in prod on 28 Nov; this removes the code half.

- **No grant runs.** `lib/papic-free-grant.ts` (`ensureFreePapicPoolGrantAdmin`) is deleted with all eight call sites (every create path, next-year clone, Your info → Papic on, the Papic self-heal). The free-grant readers (`fetchPapicFreeGrantPoints`, `fetchPapicFreeGrantRead`, `readPapicFreeGrant*`, the 50 fallback) and `papicCreditsHeld` go too.
- **No copy names it.** `/papic` loses the hero badge, the fact, the closing line, the structured-data line and the dial's ₱0 "buy nothing" rung and "free" stacking line; the onboarding Papic card, plan cards (event services, front door), help answers, About, the Hub metadata, the Papic tour finale, the pay page and the Papic add-on chip stop naming free credits. Where a line is needed: "Many bookings come with free Papic photos as a Setnayan gift." (`PAPIC_BOOKING_GIFT_LINE`, `lib/setnayan-gift.ts`).
- **Admin.** The "Free credits on a first event" block leaves the Papic shot prices tab, and the Free plan view stops reading the column.
- **Kept.** Credits already granted stay (no clawback). `papic_claim_free_pool`, `papic_free_grant_claims` and the trigger stay (erasure coverage reads them); no migration.
- **Guard.** `lib/the-free-first-event-papic-grant-is-gone.test.ts` (mutation-checked: a planted RPC call and a planted free-credit line each turn it red). Existing Papic tests updated, none deleted.

SPEC IMPACT: None — implements DECISION_LOG 16 Nov "Free 50 Papic credits REMOVED"; no product decision changes.
