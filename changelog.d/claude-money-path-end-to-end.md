## 2026-09-20 · test(money): the whole revenue path is proven on every PR, not once by hand

The booking fee — owner, 2026-09-20: *"this is the most important part for us. because this is
where we get money."* — had been driven end to end exactly once, by a person clicking, on
2026-09-19/20. `apps/web/tests/db/the-money-path-end-to-end.db.test.ts` drives the same ten
transitions against the replayed production schema in PGlite and asserts the money at each one.

**What was already covered and is NOT re-drawn** (RULE 0): the taper table, the free-5 boundary,
idempotent re-lock and the settle bridge (`booking-fee-lock.db.test.ts`); the real
`collectBookingFeeAtLock`'s order/payment postconditions (`booking-fee-order-postconditions.db.test.ts`);
the amendment re-price (`booking-fee-rederive.db.test.ts`).

🔑 **What nobody covered is the CONTINUITY.** Every one of those files starts from a row it minted
itself — a `contracted` booking with a `total_cost_php` typed into a fixture. So each JOINT was
tested and the CHAIN never was. Here the number a step asserts is the number the previous step
actually wrote: the ₱837.50 fee is 5% of the figure `respond_vendor_proposal` derived from the
quote the supplier sent, and the ₱3,350 deposit minimum is read back out of that same quote's
frozen `payment_schedule` through the two functions `recordDeposit` delegates to.

Proven, in one run: marketplace inquiry → `inquiry_source='shortlist'` resolves to `sourced` ·
a ₱16,750 quote whose schedule pays to ₱0 (20% ₱3,350 on lock, ₱13,400 at −14 days, resolved by the
production `resolveSchedule`) · accept carries ₱16,750 onto the booking to the centavo and does NOT
book it · the couple's ask · `vendor_agree_to_lock` → contracted + linked · the first payment, with
a ₱1-short deposit refused by `decideDepositAmount` and a ₱0 one refused by the ledger CHECK ·
`confirm_vendor_payment` + `acknowledge_vendor_deposit`, each idempotent · the fee opening at
₱837.50, ordinal 6, pending, 7-day expiry, schedule version stamped · the bill on the manual QR rail
addressed to the SUPPLIER, whose `service_key` round-trips back to its charge · approval settling
the charge and moving ₱837.50 into `fee_paid_total_centavos`. Plus the waived case (first five bill
₱0, mint no bill, and still book), the skip arms, and three doors that must not bill twice.

Sabotage-proven: the fee rate (5%→4%), the free-five boundary (`v_ordinal <= 5` → `<= 6`), the
deposit minimum, the attribution set (`shortlist` dropped) and the one-bill-per-charge unique index
were each broken in turn and each turned the file red — with the failure naming the money.

Also: the supabase-js-shaped PGlite adapter and the `server-only` shim moved out of
`booking-fee-order-postconditions.db.test.ts` into `apps/web/tests/db/supabase-over-pglite.ts`, so
both files share one copy. A second copy of an adapter that decides how money is written is a second
copy of a money rule.

⚠ **Two steps are NOT claimed as proven, deliberately.** `recordDeposit` and `approvePaymentCore`
are Next.js server actions that open with `cookies()` and end in `revalidatePath`; what executes
here is the pure decision each delegates its money rule to plus the row state each leaves behind.
No pixel is asserted — this file proves the money, not that a screen prints it.

Cost: one migration replay (~10 s, the same replay every other `*.db.test.ts` already pays) plus
~0.3 s of assertions, inside the required `test:db:ci` check.

SPEC IMPACT: None — no product decision changes; this adds coverage of the shipped path.
