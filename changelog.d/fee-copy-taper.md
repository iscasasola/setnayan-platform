## 2026-07-27 · docs(vendor-fee): every surface now says "5%, then 1% beyond ₱100,000" — the flat-5% claim is gone

Owner ruling 2026-07-27, verbatim: *"we have the 5% +1% beyond 100,000 document this. i don't want you asking again. remove all older information."*

The taper shipped on 2026-07-25 (`lib/booking-fee.ts` — 5% on the first ₱100,000, 1% above, ₱50 floor, no cap), but the **copy never followed it.** Eight vendor-facing surfaces and five code comments still asserted a **flat 5%**, which is false at every peso above ₱100,000 — a ₱1M booking is billed ₱14,000 (1.4%), not ₱50,000. The same un-swept claim is what propagated into a money document earlier this week (the vendor's booking-fee `orders.description` hard-coded "(5%)", fixed in #3805/#3809). This is the copy half of that fix.

**Vendor-facing copy (8 sites).** `app/_components/home/vendor-benefits.ts` · `app/vendors/page.tsx` (SEO `description`, OG `description`, Solo-tier schema.org Offer blurb) · `app/vendors/_components/vendor-grow-sections.tsx` (thesis strip + "Fair by design" lede, `<b>` emphasis preserved) · `app/vendors/_components/vendor-tier-matrix.tsx` (matrix footnote) · `app/vendor-dashboard/booking-fees/page.tsx` (masthead lede). Each sentence keeps its existing voice and its surrounding promises intact (0% while we launch · first 5 sourced bookings free · your own and repeat clients always free) — only the RATE CLAIM inside it moved. The two length-pressured SEO/OG strings use the tight form "5% + 1% beyond ₱100,000".

**The ₱50 minimum is stated on the fee EXPLAINER only** — `/vendor-dashboard/booking-fees`, which the vendor reads beside their actual bills. It is true but it is noise in a pitch, and it already appears on the bill itself, so it stays out of marketing copy.

**Stale code comments (5 files).** `lib/booking-fee-lock.ts` ("Rate = flat 5% / no cap" → the taper) · `lib/chat-lock-booking.ts` · `app/_components/negotiation-actions.ts` (×2) · `app/dashboard/[eventId]/vendors/actions.ts` · plus two test NAMES that read pre-taper (`lib/booking-fee.test.ts`, `lib/booking-fee-lock.test.ts`). **No assertion changed** — `BOOKING_FEE.rate === 0.05` is correct, it is the head-band rate.

**Deliberately NOT touched — this is history, not drift.** `lib/booking-fee.ts` docblocks explicitly narrate what the taper superseded ("supersedes the 2026-07-24 flat 5%"); `lib/booking-fee.test.ts:66` asserts the taper never charges MORE than the flat rate it replaced; `lib/booking-fee-schedule-summary.test.ts:93` quotes the old literal to explain why its guard exists. Deleting any of it would destroy why the taper exists.

**New guard — `lib/booking-fee-copy.test.ts` (14 assertions).** Reads the swept files as source text and asserts (a) no flat-rate shape (`/flat\s+5\s*%/i`, and "5% booking fee" with no `then`/`and`/`+` tail), (b) the 1%-beyond-₱100,000 tail is actually PRESENT — a sweep that merely deleted the rate would otherwise pass, (c) the explainer still states the ₱50 minimum, and (d) an **anti-erasure** check that the superseded flat 5% still survives in the three files that document it, so a future repo-wide regex sweep cannot strip the lineage. Scoped to named files by design; never a repo-wide regex. Neutralisation-verified: reverting one copy site to "flat 5%" fails the guard.

Reported, not changed: `lib/vendor-earnings.ts:12` `SETNAYAN_PAY_FEE_PCT = 5.0` is the **Setnayan Pay convenience fee**, a different feature — retired to 0% per the corpus with every `setnayan_pay_methods` row `is_active = FALSE`. Stale in its own way; changing a fee constant is not a copy sweep.

Full unit suite green, `tsc --noEmit` clean, `next lint` clean, `lint-retired-strings` clean.

SPEC IMPACT: Applied — the corpus statement of the vendor booking fee is 5% then 1% beyond ₱100,000 (owner-ruled 2026-07-27).
