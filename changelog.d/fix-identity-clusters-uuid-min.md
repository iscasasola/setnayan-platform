## 2026-07-07 · fix(anti-fraud): identity_clusters min(uuid) migration bug

The Phase-2 `identity_clusters` migration (`20270516600000`) failed to apply to prod with
`ERROR: function min(uuid) does not exist (SQLSTATE 42883)` — Postgres has no `min()`/`max()`
aggregate for `uuid`, and `users.user_id` is uuid. This never surfaced in PR CI because
migrations only *apply* on merge (via `supabase-migrations.yml`), not during PR checks, so the
draft went green without its SQL ever running.

Two `MIN(<uuid>)` sites are fixed to MIN the canonical uuid **text** and cast back
(`MIN(x::text)::uuid`) — uuid canonical text sorts byte-identically to uuid, so the "smallest
user_id / cluster label" semantics are preserved exactly:

- the component-label `MIN(node) AS cluster_id` in `identity_clusters`
- the booking-cluster `MIN(COALESCE(ic.cluster_id, em.user_id))` in `vendor_public_completed_events_stats`

Unblocks the stranded anti-fraud migration chain (Phases 2→4: `20270516600000`,
`20270517644717`, `20270518682623`). No change to any already-applied object; the migration is
idempotent (leading `DROP ... IF EXISTS`), so a clean re-run applies the full chain.

SPEC IMPACT: None — bugfix to an unapplied migration; the `Anti_Fraud_Trust_Integrity_2026-07-05.md`
§ 6 Phase-2 design (cluster_id = smallest user_id of the connected component) is unchanged.
