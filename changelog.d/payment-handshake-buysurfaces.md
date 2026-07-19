## 2026-06-18 · feat(payments): "payment under review" on the remaining add-on buy pages (handshake PR2)

Follow-up to the admin-approval handshake (#1718). The add-on buy pages that weren't in the first PR now show the honest 3-state — **approved → "unlocked"/owned · pending → "payment under review" · none → buy-CTA** — so the dashboard no longer reads "owned" while the live feature is (correctly) withheld pending approval.

- **New shared `<PaymentUnderReview feature="…">`** (`dashboard/[eventId]/_components/payment-under-review.tsx`) — the amber "we'll unlock it once we confirm your payment" badge; no buy-CTA renders alongside (double-buy stays prevented).
- **Surviving buy surfaces** (reconciled 2026-07-19 to the post-`studio/` layout after a month of drift) compute `active` (`eventSkuActive` / `eventAnimatedMonogramActive`) alongside the pending-inclusive `owns`, querying only when owned: `studio/custom-qr-guest` · `studio/indoor-blueprint` · the Papic `live-wall-card` · the Animated-Monogram upgrade (ported to its new home `monogram/animated-monogram-upgrade.tsx` after the 2026-06-25 merge onto the Monogram Maker — its OwnedView claimed "plays on your wedding website" while the hero correctly gated on approval).
- **Superseded on main, dropped in the reconcile:** the old `add-ons/papic` + `add-ons/setnayan-ai` pages (both rewritten on main with their own approved/pending states — Papic v3's crew-pack badge, Setnayan AI's active/owns split) and the `lib/papic-sampler.ts` retention keep-check revert (the sampler module was retired with Papic v3; `eventSamplerIsKept` no longer exists).

No schema, no migration. Display-only — the feature gates (active-only, shipped in #1718) already enforce the handshake; this just makes the buy pages honest.

SPEC IMPACT: None (completes the handshake UX documented at the 2026-06-18 decision; no price/SKU/schema change).
