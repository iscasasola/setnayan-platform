## 2026-07-22 · feat(papic-games): open custom challenges to Solo (₱400/event, owner)

Owner priced the custom vendor challenge at **₱400/event for Solo, Pro, Enterprise**
— extending eligibility DOWN to Solo (was Pro-and-up). `custom` (the bespoke top
tier) stays eligible. Flag-gated (`NEXT_PUBLIC_PAPIC_GAMES_V1`).

- **Migration** `20270906348207` — `CREATE OR REPLACE public.papic_create_vendor_challenge`
  (signature unchanged → grants preserved); the **only** change is the tier gate:
  `NOT IN ('solo','pro','enterprise','custom')` (was `'pro','enterprise','custom'`).
  Everything else (booked-gate, 1..280 copy bounds, `approved=false`) is verbatim.
- **`vendor-challenge-section.tsx`** — the UI eligibility set now includes `solo`
  (renamed `PRO_PLUS` → `PAID_CREATE_TIERS`); the non-eligible upsell reads
  "paid-plan feature — upgrade to Solo or higher".

⚠ COLLECTION DEFERRED: there is no vendor per-event payment primitive (tokens
retired), so this does **not** collect the ₱400 — during free-during-launch
creation is open to the paid tiers with ₱400 as the recorded price; a per-event
apply-then-pay gate (and whether Pro/Ent pay per-event or stay unlimited) is an
owner decision for when paying vendors exist.

SPEC IMPACT: Recorded in DECISION_LOG (2026-07-22) — custom challenge = ₱400/event
for solo/pro/enterprise, supersedes the Pro+-unlimited / Solo-deferral. `tsc` clean.
