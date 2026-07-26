## 2026-07-26 · fix(security): SEC-5 — lock the Setnayan AI price tier against host `event_type` edits

Setnayan AI is priced by event type (the owner-locked A ₱1,499 / B ₱999 / C ₱499 /
D ₱99 / E ₱0 load ladder). That stays exactly as designed — **no price was
flattened, no tier map removed.** The defect was narrower: the BUYER controlled
the input to the price and could keep changing it after paying.

**The hole.** `events.event_type` is column-GRANTed to `authenticated` (and
`anon`) by `20271005100000` — correctly, since the creation wizard writes it — so
a host can PATCH it straight through PostgREST with the public anon key,
bypassing every server action. The charge is resolved from that column read LIVE
at checkout (`resolveSetnayanAiTypeChargeCentavos`), and the delivered reach is
re-derived from the live type on every read, while the entitlement
(`events.setnayan_ai_active`) is a bare boolean that records THAT AI was bought
and never at WHICH TIER. So: set type to a cheap tier → buy Setnayan AI → set it
back to `wedding` → keep wedding-tier AI for ₱99. Under apply-then-pay the order
sits `submitted`/`awaiting_payment` for up to the 24-hr reconciliation SLA, so
the flip-back lands before an admin ever sees it.

**The fix — migration `20271007917549`, at the DATA layer** (a server-side check
is theatre against a direct PATCH):

- `public.setnayan_ai_price_tier(text)` — the A–E ladder in SQL, a mirror of
  `AI_TIER_BY_EVENT_TYPE`. Unmapped/NULL → `C`, so an untiered type is not an
  escape hatch.
- `trg_guard_events_ai_price_tier` (BEFORE UPDATE OF `event_type`) — a
  non-privileged writer may not move `event_type` across a price tier while the
  event holds a paid **or in-flight** (`submitted`/`awaiting_payment`/`paid`/
  `fulfilled`) `SETNAYAN_AI` order, or a comped `setnayan_ai_active`.
  Same-tier changes stay allowed; pre-purchase changes are untouched, so
  onboarding and "I picked the wrong type" still work. Cheaper→dearer is refused
  cleanly — **TODO(owner): an upgrade-charge flow is legitimate product
  behaviour but is deliberately not built here.** service_role / SECURITY
  DEFINER / `is_admin()` keep the escape hatch.
- `events.setnayan_ai_tier_at_purchase` + `trg_stamp_events_ai_tier_at_purchase`
  — the entitlement now records which tier it was bought at, stamped once on the
  `setnayan_ai_active` false→true transition and never re-baselined by a renewal.
  Not writable by `authenticated`/`anon` (grant *and* trigger). Backfilled for
  existing entitlements.

The guard additionally requires the arming order to have been placed by an
**event member**: `orders_owner_write` is only `WITH CHECK (user_id =
auth.uid())` and never checks that `event_id` is yours, so without that join any
stranger could POST a `SETNAYAN_AI` order at a victim's event and freeze their
event type. (The underlying orders-INSERT hole is SEC-4's deferred item; this
just keeps SEC-5 from becoming a lever for it.)

**Tests — `apps/web/tests/db/setnayan-ai-tier-lock.db.test.ts`** (20 cases, real
migrations replayed, `SET ROLE authenticated`): the full attack is replayed
(PATCH down → buy → PATCH back), plus a reachability pair (the identical
statement succeeds pre-purchase, fails post-purchase), a service_role
differential control, positive controls, the stranger-griefing case, and a
TS↔SQL tier-map parity check that also asserts every `event_type_vocab` row is
explicitly tiered.
MUTATION-CHECK: migration removed → **11/20 fail**; guard function neutered →
**4/20 fail**; snapshot stamp neutered → **4/20 fail**; membership join removed →
**1/20 fail**; restored → **20/20 pass**.
Full `test:db` 261/261, `test:unit` 3815/3815, typecheck + lint clean.

**Related exposure found, NOT fixed here (reported for a separate PR):** the
same "price derived from a host-writable column" shape exists at
`lib/v2-catalog.ts` · `resolvePaxPricedOrderCentavos`, which reads
`events.estimated_pax` live to price `is_pax_priced` SKUs — `estimated_pax` is
host-writable and deliberately left so. Currently latent (no catalog row has
`is_pax_priced = true` in prod today), and it re-arms the moment one does.

SPEC IMPACT: `DECISION_LOG.md` — row appended 2026-07-26 recording the tier-lock
invariant (same-tier changes allowed, tier-crossing refused after purchase,
upgrade-charge deferred to the owner).
