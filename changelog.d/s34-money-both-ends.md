## 2026-09-18 · fix(money): five money-tier orphans get their missing end, or lose the end nobody needs (S34)

From S26's both-ends baseline (`ugat-both-ends.baseline.txt`, PR #5625), money tier. Each was
re-measured against `origin/main` and prod before choosing.

- **`component-no-mount app/admin/pricing/_components/fee-form.tsx` → (b) DELETED.** It is NOT the
  owner's booking-fee form. It edited the *customer-side* Setnayan Pay platform fee
  (`setnayan_pay_fee_pct`), which the owner took off the screen on 2026-08-29. His booking fee
  (5% / ₱100,000 / 1%) is `BookingFeeForm`, mounted on `/admin/pricing` via `pricing-surface.tsx`,
  so it's editable. Its callerless save action `saveFeeSetting` is deleted too, and the
  command palette stops offering a job that led to a screen with no form. ⚠ `getSetnayanFeeBps`
  still reads the column as the payout-dispatch fallback. The stored value (or 5.0%) holds, but no
  screen edits it now.
- **`rpc-no-caller verify_and_activate_manual_payment` → (b) DROPPED.** Activation runs through
  `orders.status` (`lib/entitlements.ts`). Prod: `manual_payment_logs` 0 rows ever and
  `event_software_activations_v2` 0 rows, so it never activated anything. It was also
  EXECUTE-granted to anon with an unpinned search_path.
- **`table-no-writer event_vendor_3d_plan_unlocks` → (b) DROPPED.** Its product (the vendor-unlocks-
  a-discounted-3D-Plan) was retired end to end on 2026-09-05 when the 3D Plan became free for
  couples. 0 rows. `anon-table-grants-closed.db.test.ts` gains `DROPPED_SINCE`: the table keeps its
  batch-7 line (the floor is not lowered) and is asserted ABSENT.
- **`notice-no-emitter gift` → (a) JOINED.** The enum value has existed since 2026-06-23 for PR #2027,
  which closed unmerged. `issueCompGrant` now tells the couple "A gift from the Setnayan team"
  (in-app only, as #2027 designed it). `lib/comp-gift-notice.ts` holds the sentence, and
  `lib/a-gift-tells-the-couple.test.ts` pins it.
- **`component-no-mount …/subscription/_components/price-position-card.tsx` → (a) MOUNTED** on
  `/vendor-dashboard/performance` inside the Pro market-intel section. That section's teaser had
  always promised "Demand Radar & Price-Position", and the home page sells the meter. The card moved to
  `performance/_components`, its stale "Soon" pill is gone, and a failed read now says "couldn't load"
  instead of "not enough market data yet" (the fetcher's four reads each check their error).

**LEFT FOR THE OWNER, not fixed:** `table-no-writer vendor_ad_subscriptions`. Boosting is paused
("we add it later"), but `vendor_market_stats.ad_rank` still reads the table and orders the
marketplace in five places. Rebuilding the purchase or removing the rank is his call.

SPEC IMPACT: None. The decisions this applies (platform-fee removal 2026-08-29, 3D Plan free
2026-09-05, boost paused 2026-05-28) are already in `DECISION_LOG.md`.
