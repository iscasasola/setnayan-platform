## 2026-07-12 · feat(anti-fraud): Phase A — couple inquiry velocity gate

First slice of fake-inquiry protection (corpus design: `Vendor_Fake_Inquiry_Protection_Build_Plan_2026-07-11.md`). Adds a flag-gated velocity limit on the couple's manual "Inquire" path so a spam/bot flood — or a competitor's sock-puppet farm — can't bury a vendor's inbox (and, downstream, drain the token they burn to answer).

- `apps/web/lib/inquiry-gate.ts` — pure decision logic (mirrors the `lib/fraud-detection.ts` pure-scorer split): `inquiryGateEnabled()` (env `NEXT_PUBLIC_INQUIRY_GATE_ENABLED`, default OFF) + `evaluateInquiryVelocity({dailyCount, concurrentOpenCount})`. Caps are deliberately generous — `INQUIRY_DAILY_CAP=25` (rolling 24h, all events) and `INQUIRY_CONCURRENT_OPEN_CAP=40` (non-declined threads per event) — sized to catch scripted volume, never a thorough real couple (the presumption-of-a-real-couple invariant). Friendly, non-accusatory copy on block.
- `apps/web/app/v/[slug]/inquiry-actions.ts` — `startServiceInquiry` gains an optional `source: 'manual' | 'system'` (default `'manual'`) and runs the gate ONLY for a brand-new, manual inquiry (resumed threads and `source:'system'` batch flushes are exempt). Two `head:true` count queries feed the pure evaluator.
- `apps/web/app/dashboard/_components/pending-vendor-inquiry-dispatcher.tsx` — the saved-pick batch flush passes `source:'system'` so a legitimate shortlist flush never trips the cap. (Onboarding's "Your Plan" fan-out uses `unlockCategoryWithInquiry`, which never calls this action, so it is untouched.)
- `apps/web/lib/inquiry-gate.test.ts` — 6 `node:test` cases incl. a guardrail asserting the caps stay in bot-catching territory.

Merging changes nothing until the owner flips `NEXT_PUBLIC_INQUIRY_GATE_ENABLED=true`. No schema change. Follow-ups (later phases): dedicated calm rate-limit UI (currently surfaced via the composer's message channel), token hold-and-release (Phase B), report-fake + cluster refund (Phase C), lead trust badge (Phase D), and wiring inquiry-spam/concentration signals into the existing `fraud_signals`/`identity_clusters`/`/admin/fraud` engine (Phase E).

SPEC IMPACT: None (flag-gated, no schema, no pricing/SKU change). Design + phase sequence already live in the corpus at `Vendor_Fake_Inquiry_Protection_Build_Plan_2026-07-11.md` and the 2026-07-11 DECISION_LOG rows.
