## 2026-07-20 · feat(papic): event-scoped capture fence for a flat per-event pass

Phase 0c. A flat per-event Papic pass (PAPIC_UNLOCK ₱15,000 · PAPIC_UNLOCK_LTD
₱9,000 today; the ₱1,499 flat pass the monetization council proposed tomorrow)
bypassed metering **entirely** — both enforcement seams wrapped the capture-points
gate in `if (!unlocked)`, so a pass event was an unbounded capture free-for-all.
This adds the missing bound: one **event-lifetime capture-points pool**, consulted
alongside the existing per-camera-per-day budget, with the **tighter of the two
winning**, fail-closed at both seams.

**The formula (guest-count derived, NOT flat — admin-tunable):**
`pool = clamp(guests × 150, 5,000, 30,000)` points · 1 photo = 1 pt · 1 clip = 3 pts.

The council's flat-10,000-point proposal was a **3× tightening**: the shipped
model is 150 credits *per guest* (`lib/papic-guest.ts`), so a flat 10,000 is only
66 pts/guest at 150 pax — tighter than today above 66 pax. Re-deriving from guest
count at the shipped 150/guest makes the fence **non-tightening at or below 200
pax** (unit-tested invariant); the 30,000 ceiling is set exactly at today's
200-pax equivalent and binds only in the fat tail, where an unbounded pass takes
the flat-pass margin under water. Every parameter (points/guest, floor, ceiling,
soft-stop %, and the list of pass SKUs the fence governs) lives in the new
admin-editable `papic_event_pool_config` — pricing-relevant, so nothing is a
hardcoded constant.

- **Migration `20270826385580_papic_event_capture_pool.sql`** (additive,
  idempotent, inert on apply): `papic_event_pool_config` (Pattern H · public
  SELECT, no write policy) · `papic_event_point_grants` (top-up ledger) ·
  `papic_event_pool_usage` (event-lifetime counter) · RPCs
  `papic_event_has_flat_pass` · `papic_event_pool_status` ·
  `papic_event_points_remaining` (presign probe) · `papic_reserve_event_points`
  (atomic conditional reserve) · `papic_release_event_points` +
  `papic_release_camera_points` (unwind, so a refused capture never leaves points
  spent when the two gates disagree).
- **`apps/web/lib/papic-event-pool.ts`** — the pure formula (`computeEventPool`),
  the tighter-wins combiner (`combinePointsGates`), the status shaper, and the
  display read.
- **Both seams wired:** `app/api/upload/route.ts` (presign — refuses the URL, so
  no orphan R2 bytes, 409 `camera_points_exhausted`) and `app/papic/actions.ts`
  (record — authoritative atomic reserve, `camera_points_exhausted` /
  `points_check_failed`). Fail-CLOSED on every RPC error except function-not-found
  (the existing seam-cutover carve-out).
- **Soft stop:** every successful capture returns the pool's live state; the seat
  camera warns at 85% ("running low — about N shots left for this event") before
  the hard stop.
- **Top-up plumbing only** — grants ledger sums into the pool total. The top-up
  SKU is deliberately **not** created or priced (owner action).
- **Non-pass events are unaffected** — every function returns "unlimited" unless
  the event holds an ACTIVE pass order. The per-camera ladder shipped in
  #3407/#3422 is untouched.

Verification: `pnpm --filter @setnayan/web run typecheck` clean ·
`lint` clean (pre-existing warnings only) · `test:unit` **2314/2314 pass**
(20 new event-pool tests) · `migration:check` ✓ 816 migrations ·
`lint:entitlement-gates` ✓.

SPEC IMPACT: `0012_papic/` — the flat per-event pass now carries a documented,
guest-derived capacity bound instead of "unlimited". Note for the pricing corpus:
the ~24% gross-margin figure for an unbounded 300-pax pass is a **model, not a
measurement** — Papic is pre-revenue (all-time: 1 PAPIC_GUEST, 2 PAPIC_SEATS,
2 add-on orders; **zero** PAPIC_CAMERA_* orders), so there is no attach rate to
protect and no grandfathering owed to any existing camera buyer.
