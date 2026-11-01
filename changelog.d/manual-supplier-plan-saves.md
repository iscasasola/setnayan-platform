## 2026-10-29 · fix(suppliers): the record sheet saves the payment plan as typed — or says why, beside Save

Owner, on a ₱395,000 stylist he added himself: *"i tried fixing the payment plans there but did not save properly"* · *"the payment scheme there should properly update and save."* Measured in production: that supplier had no plan row at all, although the sheet had been saved (its contact card's `updated_at` moved). Six ways a couple editing the plan on the record sheet ended with a plan that was not what they typed, each fixed where it starts:

- **A peso amount with commas was refused.** `Number("100,000")` is NaN, so the plan was refused "Every payment needs an amount above zero" and the running total skipped the row. `planAmountNumber` (lib/self-added-payment-plan.ts) reads `100,000` · `₱295,000` · `30%` the way they are written, for the server and the running total alike (`planPreviewTotal`); a typo ("100k") is still refused.
- **The refusal was out of view.** It was a paragraph above the pinned footer, under the claim-link panel — a screen below the Save button on a phone. It now sits inside the pinned footer, beside Save, and reads "Saved — except the payment plan. Your payments add up to ₱100,000 of ₱395,000 — ₱295,000 is unaccounted for." (`partialSaveSentence`), not "Saved — except Your payments…..".
- **Removing every payment kept the old plan.** The last payment can now be removed; the editor posts `plan_present`, so `planSaveStep` tells an emptied plan ('clear' → written as no payments) from a form that never carried one. A plan saved with none re-opens with none (`planSaved` on the prefill), not with the 50/50 starter.
- **The lock's 50/50 estimate re-opened with blank due dates**, so every later save of the sheet was refused. `planInstancesToRows(…, { defaultSeeded })` restores its known rule (50% after you book · 50% 14 days before); a legacy percent instance keeps its percent.
- **A plan typed over that estimate stayed flagged as the estimate** (`is_default_seeded = true`), so a re-lock replaced it and the Booked row skipped its instalments. The couple's write is now `couplePlanUpsert`, which says `is_default_seeded: false`.
- **A price with centavos re-opened as a hundred times itself** ("80000.5" → ₱800,005). `priceDigitsForSheet` starts the field from whole pesos.

The plan is still checked against the price typed in the same save (the price step runs first; pinned by the test). The marketplace path still refuses as before. Dev lab: `/dev/add-your-own-lab?s=record&price=395000` (`&booked=1` opens the lock's estimate) saves through a stand-in that runs the same pure functions.

Tests: `lib/the-record-sheet-saves-the-plan-as-typed.test.ts` (each cause sabotaged and seen to fail) · `tests/db/a-couples-plan-over-the-estimate-survives-the-relock.db.test.ts` (the real lock, the couple's own row under their role, the real re-lock).

SPEC IMPACT: None — no rule changed; the sheet now does what the 2026-09-20 / 09-21 plan decisions already say (a plan typed by the couple is theirs and is kept at lock).

- Fix (CI handles-have-gates): `event_vendor_payment_plan.is_default_seeded` is now read by `vendors/actions.ts` (the couple's upsert writes it false), so its "unread handle" baseline line is deleted — the ratchet only shrinks.
