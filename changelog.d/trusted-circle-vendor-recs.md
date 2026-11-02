## 2026-07-05 · feat(people): Phase 2 trusted-circle vendor recommendations — signal computation (STAGED / flag-off)

Person-spine Phase 2 marketplace payoff: a private trusted-circle vendor signal
that scores a vendor as **NEAR + TRUSTED + CONNECTED** from the host's own
person graph. Extends the existing engine (does not fork it): `vendor_recommendations`
(opt-in endorsements) + `vendor_reviews` (explicit reviews) + `vendor_coverages`/
`vendor_profiles.hq_region` (coverage) + `person_connections` (the confirmed circle).

- **New SQL fn** `public.trusted_circle_vendor_signal(event_id, vendor_profile_id)`
  — `SECURITY DEFINER`, deny-by-default, scoped to the caller's own claimed person
  + owned event. Migration `20270515629151_phase2_trusted_circle_vendor_signal_fn.sql`
  (idempotent `CREATE OR REPLACE`; validated in a rolled-back prod txn with DO-block
  asserts — SECURITY DEFINER, 8 OUT cols, unauth caller → 0 rows).
- **New TS wrapper** `apps/web/lib/trusted-circle-recs.ts` — `getTrustedCircleVendorSignal()`
  + `trustedCircleRecsEnabled()`, mirroring `peopleConnectionsEnabled()` (PR #2823) on
  the SAME `NEXT_PUBLIC_PEOPLE_CONNECTIONS` flag. **Defaults OFF; returns `null` without
  querying the DB while off** — fully inert in production.
- **Locked constraints enforced in the query, not just docs:** TRUSTED = explicit
  endorsement or review ≥ 4 only, NEVER booking co-occurrence (`event_vendors` deliberately
  not read); degree ≤ 2 (3rd never traversed; 1st named only via opt-in vouch, 2nd anonymized
  aggregate); every aggregate min-N-gated via shipped `public.min_n_ok()` (floor 5, mirrors
  `FUNNEL_MIN_N`); trust never purchasable (reads no subscription/boost/ad data); private to
  the host, never a browsable graph.
- **Packaging (locked principle):** the signal is FREE; Setnayan AI sells the orchestration
  on top. No new SKU/price invented (rides the holistic pricing review).
- **Gate:** counsel-gated. No circle-based rec surfaces in prod until PH counsel signs off
  and the owner flips `NEXT_PUBLIC_PEOPLE_CONNECTIONS=1`.

SPEC IMPACT: None — the plan (`03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`
§11) + `DECISION_LOG.md` 2026-07-04 "trusted-circle vendor recommendations" already lock this
design; this ships the staged, flag-off implementation exactly to spec (no decision changed).
