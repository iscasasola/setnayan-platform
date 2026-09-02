## 2026-09-02 · feat(guests): one person across a cluster of celebrations, not three rows

Item 7b on top of 7a's `event_clusters`. Diagnosis first: the person spine
(`public.people`, `guests.person_id`, `resolve_or_claim_person`) was already
sound and already wired — measured in prod, 36 guests, 0 with an email, 0
linked. The resolver deliberately refuses to auto-link a guest from a name
alone; the guest-add UI never asks for email, so that signal never arrives.
Zero linked guests was the resolver working as designed, not a defect in it.

- Extends `resolve_or_claim_person()` with an opt-in `p_allow_name_only` flag
  (additive; every existing caller is unaffected).
- Adds `resolve_cluster_guest_person()`: a name match bounded strictly to
  guests within the SAME `event_cluster` — never a global name index. Two
  same-named guests in unclustered celebrations do not merge.
- Wires it into `set_guest_person()` as the fallback when email is absent,
  and adds a backfill trigger on `event_cluster_members` insert so linking a
  cluster before or after its guest lists exist converges the same way.
- Adds `cluster_guest_roster()` — one row per resolved person, their
  per-celebration guest rows nested underneath. SECURITY INVOKER; inherits
  the existing RLS on `guests` and `event_cluster_members` (no new pattern).
- Found and fixed a latent gap while extending the resolver's signature: the
  original `resolve_or_claim_person` had no REVOKE and was callable by any
  authenticated user directly over PostgREST despite being SECURITY DEFINER
  and doing no authorization of its own. All four functions touched here are
  now explicitly revoked from PUBLIC/anon/authenticated except the new
  RLS-scoped roster read, which stays authenticated-only.
- New guard: `apps/web/tests/db/a-cluster-mate-is-the-same-person.db.test.ts`
  proves the unify-in-both-orders behaviour, the unclustered non-merge, that
  the 7a shot-pot guard is untouched, and roster RLS parity with 7a.
- `supabase/security/exposure-surface.baseline.txt` regenerated: the old
  `resolve_or_claim_person` exposure line is removed (narrowed), and
  `cluster_guest_roster` is added as a deliberate, RLS-scoped exposure.

SPEC IMPACT: None — this is Phase 7b of the already-locked "the year" build
order (`WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 7), no screen, no
server action; the read shape is a function only, matching 7a's own
"schema, not a rendered page" scope.
