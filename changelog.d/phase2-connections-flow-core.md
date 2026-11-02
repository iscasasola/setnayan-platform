# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(people): Phase 2 connections flow — server-action core + flag (STAGED)

Owner "complete phase 2 now" (2026-07-05) → the suggest→confirm flow, built **flag-off/inert**. ⚠ Phase 2 is counsel-gated: every action hard-guards on the flag (default OFF), so it stores **no relationship data** in production until PH counsel signs off and the owner sets `NEXT_PUBLIC_PEOPLE_CONNECTIONS=1`.

- **`lib/people-connections.ts`** — flag `peopleConnectionsEnabled()` (default off) + `layerForRelation()` + `DECLARABLE_RELATIONS` (first-degree family + godparent + friend).
- **`app/dashboard/(account)/people/actions.ts`** — `proposeConnection` (declare a first-degree edge FROM your person to a target resolved by email via the Phase-1 `resolve_or_claim_person` RPC → pending edge), `confirmConnection` / `declineConnection` (only the recipient — `to_person = me` + still pending — may act; **mutual confirmation**). All three no-op when the flag is off. RLS on `person_connections` is the safety net (insert requires from_person claimed by you).

**Paired sub-slice (deliberately NOT here):** the interactive People UI that *displays* a connection's name needs a **cross-person name-visibility RLS decision** (letting mutually-connected people see each other's names) — that's a Phase-2 privacy call that belongs with the counsel review, so it ships alongside the flag flip, not before.

Verified: `tsc` clean · `next lint` clean. Actions are inert until the flag + counsel; the production build (CI) exercises the 'use server' file.

SPEC IMPACT: None new — Phase 2 flow core of the locked plan; flag-off, adults-first, not live until PH counsel.
