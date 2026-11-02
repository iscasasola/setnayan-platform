## 2026-07-29 · feat(papic): the TWO-TYPE model — Pool top-ups + Papic One as a genuinely dedicated camera

**The lock (owner, 2026-07-29).** Papic is two products, not one ladder:

- **Papic Pool** — unlimited cameras, **shared** shots. Free 50 pts (already armed in prod);
  paid rungs are **additive and repeatable**: +3,000 ₱1,000 · +6,000 ₱2,000 · +10,000 ₱3,000
  (≈ ₱0.30–0.33 / photo).
- **Papic One** — **one** camera, its own QR, its own **unshared** balance. **One free** One
  camera per event with **5 dedicated points** (new mechanic); paid **50 pts ₱50 · 100 pts ₱100**,
  per camera, no cap on how many, and **reloadable** — the same rungs top up a camera that already
  exists (including the free one), so no new QR mid-event. ₱1.00 / photo, flat.
- **Currency: 1 photo = 1 pt · one 10-second clip = 8 pts** (was 7).

**What was actually missing.** Everything drew ONE shared pool. `papic_event_point_grants` rows
carried `event_id` + `order_id` only, and usage was a single per-event counter with no seat
attribution, so "this camera has its own 50 points" was **underivable** — `lib/papic-pool-meter.ts`
said as much in its own header ("Modelling dedication is a ledger change owned by a later,
supervised PR"). This is that ledger change.

**The shape.** `papic_event_point_grants.seat_id`: NULL = shared (Free pool · Pool top-ups ·
admin/comp), NOT NULL = dedicated to one camera. `papic_event_pool_status` now sums only the
NULL-seat rows, so a One camera's shots can neither inflate the shared pool nor be spent by
anyone else; per-seat lifetime spend lands in the new `papic_seat_point_usage`.

The three shipped per-seat RPCs (`papic_reserve_camera_points` / `papic_camera_points_remaining` /
`papic_release_camera_points`) keep their names and signatures and learn a dedicated branch, so
neither enforcement seam changes its call shape or its fail-CLOSED posture. Only the **event-pool**
half needed new names (`*_for_seat`) — a dedicated capture must not also spend the shared pool, and
the shipped signature has no seat to branch on. `papic_reserve_event_points_for_seat` returns a
**tri-state** (1 booked · 0 refused · −1 not applicable) rather than a boolean, because the caller
uses that distinction to decide whether a later failure has pool points to unwind; releasing points
that were never booked would silently refund the shared pool on every aborted dedicated upload.

**Catalog.** `PAPIC_GUEST` / `_6K` / `_10K` reactivated at ₱1,000 / ₱2,000 / ₱3,000 and retitled as
top-ups; all three cleared of the `is_topup` gate (every rung is repeatable now).
`PAPIC_GUEST_TOPUP` stays **inactive** — with additive rungs it is a duplicate of the 10,000 rung —
and its `papic_pass_tiers` row is deactivated too, because `resolveRetailChargeCentavos()` prices by
`service_code` **without** checking `is_active`, so catalog-dark alone is not a fence.
`PAPIC_CAMERA_MINI_DAY` is **repriced** ₱100 → ₱50 (50 pts) rather than replaced — it is the tier
`mini` rate row and the code the buy flow prices from, so minting a substitute would orphan the
doorway *and* leave a retired code the charge path could still price at the old value; only the
₱100 rung (`PAPIC_ONE_100`, 100 pts) is new. **The 250-pt conversion is gone**:
`papic_event_pool_config.camera_grant_points` is held at 0 and no longer read (One points come from
the new `papic_one_tiers`, the single admin-editable source, mirroring `papic_pass_tiers` for Pool).

**Free One camera.** `papic_ensure_free_one_camera()` mints one seat at fixed index 110 plus its
5-point dedicated grant, idempotent twice over (the `(event_id, seat_index)` UNIQUE and a partial
unique index on un-ordered camera grants). Wired into all five event-commit paths and the Papic
studio self-heal, mirroring `ensureFreePapicPoolGrantAdmin`; the migration backfills existing
events. Tier stays `free` so the paid gate — which refuses a paid-tier seat with an unsettled order
— lets it shoot; its budget comes from its grant, not its tier.

**Reload path.** `papic_one_orders` maps order → (camera, rung, snapshotted points), because an
order alone cannot say "reload camera #3". `purchasePapicOneCamera` covers both modes; a seat id
that is not one of the event's own is **refused**, never demoted to "new camera" (that would charge
for something the couple did not ask for) and never honoured (that would top up a stranger's camera
on their money). A minimal `PapicOneCard` on the Papic studio page is the doorway — the polished
card ships with the onboarding cards.

**Security.** Three new tables ship with RLS + explicit `REVOKE ALL` and service-role-only grants;
all four new functions are `REVOKE`d from PUBLIC/anon/authenticated before being granted to
`service_role` (a new function grants EXECUTE to PUBLIC by default — creating it is publishing it,
and one of them **mints points**). `papic_event_point_grants` and `papic_event_pool_config` are
additionally REVOKEd from anon/authenticated: both were always service-role-only by design yet
still carried the default `SIUD`. Net effect on the committed exposure baseline is **21 narrowings,
0 widenings**, so no regeneration is needed.

**Deliberate test updates.** `papic-cameras.test.ts` / `papic-event-pool.test.ts` pinned the clip
weight at 7 → now 8. `papic-pool-metering.test.ts` pinned "250 pts per paid mini camera into the
shared pool" → now asserts the rung is read from `papic_one_tiers`, lands seat-scoped, and leaves
the shared pool total unmoved.

**Not in this PR:** onboarding/pricing UI for either type, and the legacy multi-rung camera picker's
₱6,000 wedding cap (`events.papic_mini_cap_php` fallback) — the tier-config cap is nulled here so
copy reads "no cap", but that picker keeps its own ceiling until it is replaced.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — the 2026-07-29 two-type rows
are the source for this change; `0012_papic/Papic_One_Pool_Model_Spec_2026-07-22.md` § 0 is
superseded on two points (clip = 8 not 7; Papic One is dedicated per camera, not pooled at 250 pts
per ₱100 camera), and `Papic_Pricing_Lock_2026-07-20.md` § 2.3's Pool rung prices are superseded by
₱1,000 / ₱2,000 / ₱3,000.
