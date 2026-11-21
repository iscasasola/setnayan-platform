## 2026-11-21 · feat(supplier): set two, part 4 — Booking fees (the list, one fee to pay) on the November look, with honest failed reads

Owner-approved drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html` (DECISION_LOG 2026-11-21 "STOP ADDING AFTER THE CAKE MAKER", point 2), page 1, built 1:1 on top of #8061 (the 20 Nov fee rulings). Every amount is the order's own and every fee sentence comes from the live schedule (`BookingFeeLine`, `qrWords`) — nothing is typed. The same reads, the same dispute action, the same payment page.

- **The list:** the pinned row (Back to Plan); the unpaid fees as a warn note; Due · Paid · Closed as rows (amount + reference, description · date, the status as a pill word — never colour alone); Waived — nothing owed, with the shared waived rows. The "Back to Plan" chip, the yellow bordered box, mono caps chips and the centred grey tiles are gone.
- **One fee to pay:** "Reference …" in the pinned row with its status pill; the bill's facts and the amount large in the top block, with Found you; a top-up as a warn/danger note; Note from Setnayan as a card; Copy amount (two decimals) and Copy reference as rows; Send your payment → the one payment page, the main button in the thumb zone (the shell's bar from 701); the dispute box with its own button; the payment log as rows. On a computer: facts on the left, paying and the dispute on the right.
- **Honest states · new:** the fee itself could not be read → "We couldn’t load this fee right now. This is on our side, not a sign you owe nothing." with Try again — it used to throw to the error page as if the fee did not exist. The waived fees could not be read → "We couldn’t load your waived fees just now. Your other fees above are correct." — the section used to vanish. The list's kept failed-read words gain Try again in place.
- Back map: `/vendor-dashboard/booking-fees/[orderId]` → the list ("Back to Booking fees").
- Guard: `set-two-reads-are-honest.test.ts` rule 5 (sabotage-checked). Lab: `/dev/supplier-set-two-lab?s=fees-list|fees-empty|fees-unread|fees-waived-unread|fee|fee-top-up|fee-paid|fee-failed`.

⏭ **Follows #8086** (the new-client free window as a setting): it adds a window line under the title and an in-app ⓘ on the empty state — merged in by hand when it lands.

SPEC IMPACT: None — builds an approved drawing; no decision changed.
