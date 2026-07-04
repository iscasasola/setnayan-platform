## 2026-07-05 · feat(people): staged Phase-2 event-created connection edges (flag-off)

The "ceremony creates the edge" mechanism (locked person-graph model). New
idempotent SECURITY-DEFINER SQL fn `generate_event_connections(event_id, creator)`
derives connection proposals from data a host already filled in:

- **Wedding only (adults-first):** spouse edge (bride ↔ groom guests) + godparent
  edges (each accepted principal sponsor → each principal). Non-wedding events
  return 0 — binyag/kumpil (minor godchild) are Phase 3.
- **No fabrication:** an edge needs both sides to resolve to a person (a guest
  with a linked account/email, or an accepted sponsor with an email); name-only
  rows produce nothing. Graph builds forward, not an ancestry backfill.
- Edges land as `pending` proposals, still mutually confirmed by the other side.
  Idempotent (ON CONFLICT on the edge index) — safe to re-run after roster edits.

Paired server action `generateEventConnections(eventId)` in `people/actions.ts`:
host-only (couple member or accepted moderator — the SQL fn bypasses RLS, so this
gate is load-bearing), flag-guarded on `NEXT_PUBLIC_PEOPLE_CONNECTIONS`.

Auto-wired into the two live host flows, each flag-guarded + best-effort (never
breaks the host action on failure): accepting a **principal sponsor** (`markResponse`
in `sponsors/actions.ts`) → godparent proposal; naming a **bride/groom** guest
(`updateGuest` in `guests/[guestId]/actions.ts`, via `after()`) → spouse proposal.
Both are dead branches in production while the flag is off, so ceremonies begin
generating proposals automatically the moment the flag flips — no backfill needed.

Validated in a rolled-back prod transaction: a fabricated wedding (2 principals +
1 accepted principal sponsor) produced spouse=1, godparent=2, total=3, and a
second call returned 0 (idempotent); the txn was aborted so nothing persisted.

Counsel gate honored: production-inert while the flag is off; no relationship data
is written until PH counsel signs off. Plan: `People_Graph_and_Lifelong_Identity_2026-07-04.md` §11.

SPEC IMPACT: None (mechanism for the already-locked event-created-edges model).
