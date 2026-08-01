## 2026-08-02 · fix(pricing): the 3D Plan is ₱1,500 per wedding — the catalog was still charging ₱2,999

**A live overcharge, not a stale doc.** The 3D Plan host price was owner-locked at **₱1,500** on 2026-07-23 (retiring the ₱2,999, the interim ₱1,000, and the #3526 couple-discount), and re-confirmed 2026-08-02 as *"1500 per wedding"*. The catalog was never moved to match, so `platform_retail_catalog_v2.SEATING_3D` has been billing **₱2,999** on an `is_active = TRUE` row ever since — a real charge, not a display bug.

Migration `20271032178949` moves it. **"Per wedding" needs no structural change:** the row is already `billing_period = 'one_time'` and `is_pax_priced = FALSE` — one flat charge per event, independent of guest count, which is exactly what the owner described. This migration moves the number and nothing else.

The `UPDATE` is guarded on the current value (`WHERE retail_price_php = 2999.00`) so a re-run is a no-op and it can never quietly stomp a later, deliberate reprice.

### ⚠ A ₱1,000 sibling price this narrows — flagged, not adjusted

`VENDOR_3D_PLAN_UNLOCK_PRICE_PHP` (`lib/vendor-3d-plan-unlock.ts`) is a **separate ₱1,000 price**: what a couple pays for the 3D Plan when a booked vendor with the booth add-on unlocks it for them. It is unchanged and still the cheaper of the two, so the discount stays coherent — but the gap it represents narrows from **₱1,999 off to ₱500 off**. That is a consequence of the owner's reprice, not a second decision taken here, so it is surfaced rather than silently re-tuned. If the unlock is meant to stay a headline perk, it needs its own owner call.

### ⚠ The trap this migration hit, for whoever writes the next reprice

The first draft asserted the row EXISTS (`IF NOT FOUND THEN RAISE EXCEPTION`) on the reasoning that a missing SKU should not pass silently. That was wrong, and expensively so: **`platform_retail_catalog_v2` is prod data, not migration data.** It is seeded outside the migration stream, so on a fresh database the row is simply absent — and every `tests/db/*` test builds its world by replaying migrations. The raise took the whole suite down: **727 of 729 tests failed**, none of them related to pricing.

Every sibling reprice (`20270712300000`, `20270710619774`) is a bare guarded `UPDATE` for precisely this reason. The post-condition now asserts the end state **only when the row exists** and returns quietly when it does not — keeping the safety value where it is real (prod) without breaking replay.

**Also corrected:** two test fixtures that hard-coded the old figure — `lib/llms-txt.test.ts` (the row moved to its correct sorted position at ₱1,500) and `lib/vendor-3d-plan-unlock.test.ts` (`STANDARD_CENTAVOS`, whose comment still cited migration `20270712300000` as the authority).

**Verification:** `test:db` 721/721 · `test:unit` 6135/6135 · `typecheck` clean · `lint` clean.

SPEC IMPACT: `Pricing.md § 00` — SEATING_3D / 3D Plan is ₱1,500 one-time per event (was ₱2,999). Owner-locked 2026-07-23, re-confirmed 2026-08-02.
