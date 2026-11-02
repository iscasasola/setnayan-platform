## 2026-06-26 · feat(papic): Kwento paywall is NEW-EVENTS-ONLY (grandfather existing couples)

Kwento shipped as a paid SKU gated for ALL events (PRs #2267/#2268). Owner's
locked rollout (2026-06-26) is NEW EVENTS ONLY — every couple live at the
2026-06-27 cutover keeps Kwento free; only events created after need the KWENTO
entitlement (direct, or via a bundle that grants it, e.g. PAPIC_UNLOCK). No
current couple loses a shipped free feature.

- New `events.kwento_free_grandfathered` column + re-run-safe fixed-cutover
  backfill (every event created before 2026-06-27 → TRUE; new events default
  FALSE). Migration NOT auto-applied — owner runs `supabase db push`.
- New `lib/kwento-access.ts` `eventKwentoEnabled()` = grandfathered OR
  eventSkuActive(KWENTO), fail-open. Replaces the bare eventSkuActive('KWENTO')
  OWNERSHIP check at all three Kwento gates (guest POST route, guest composer,
  couple moderation queue). The separate "Kwento is a Papic add-on → Papic must
  be active" rule (eventPapicActive) is unchanged and still AND-ed where present,
  so a grandfathered event behaves exactly as pre-paywall (free Kwento whenever
  Papic is active).

⚠ Owner sign-off flagged: this reverses the locked "every service free to use"
positioning, but ONLY for events created after the cutover — existing couples are
grandfathered. Kwento price left at the shipped ₱500 (provisional · admin-managed).

SPEC IMPACT: Kwento paywall scoped to new-events-only via a grandfather flag.
Logged at the bottom of corpus `DECISION_LOG.md` (2026-06-26).
(migration: 20270304413872_kwento_grandfather_column.sql)
