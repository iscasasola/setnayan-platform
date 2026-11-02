## 2026-07-24 · feat(chat): customer "Lock this deal" — freeze the agreed price

Owner + council verdict 2026-07-24: the customer commits with one Lock tap. Completes the negotiation rework (Deal + Meeting, "+" entry, and now Lock).

- Migration `20270927781343`: `proposal_amendments.locked_at` (drives the card's Locked state) + `chat_threads.agreed_price_centavos` / `locked_at` / `locked_by_user_id` (the frozen price = the handoff to the PAYMENT session; that flow is not built here).
- `lockDeal` action (`negotiation-actions.ts`): COUPLE-only, on an ACCEPTED Deal → stamps `proposal_amendments.locked_at` + writes the Deal's new total onto `chat_threads.agreed_price_centavos` + `locked_at` + `locked_by_user_id`. RLS-scoped; single-winner (only an accepted, not-yet-locked Deal).
- `ChatAmendmentCard`: a **"🔒 Lock this deal — ₱X"** button (couple, accepted, not-yet-locked) and a **"🔒 Deal locked"** state once locked; the vendor sees "waiting for the couple to lock." `locked_at` threaded through the stream's amendment fetch.

Behind `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF). typecheck 0 · full lint clean · radius clean · RA-10173 guardrail green · full suite 3029 green.

SPEC IMPACT: completes the 2026-07-24 council-verdict rework (iteration 0019). The **5% fee + finalize/pay/approve/SOLD spine = the separate payment session**, which reads `chat_threads.agreed_price_centavos`.
