## 2026-07-08 · fix(seed): persist the live 3D demo layout in percent scale

Persists the Maria & José sample event's live 3D-demo reception layout into the
idempotent content seed so a fresh full re-seed reproduces it: the dance floor,
10 tables, and the 14-booth perimeter ring — all in the PERCENT (0..100) scale
that `apps/web/lib/seating-3d.ts` (`pctToWorld`) expects, fixing the earlier
world-unit/percent scale mismatch. Also carries the review-fix pass over that
seed change.

- **Scale-bug fix** — tables, booths, and the dance floor now store their
  positions in percent (x/y 0..100), matching `pctToWorld` (`xPct/100`). The
  live layout is mirrored (sweetheart at top-centre, two table clusters, the
  perimeter booth ring at flush wall positions, dance floor centred at 50/52,
  24×14).
- **Booth vendor-link correctness** (review finding, major — CONFIRMED &
  FIXED) — the booth resolver ordered event_vendors by contracted-first, so in
  categories that hold several vendors it mis-linked the booth its offering
  copy contradicts: `band_dj` holds **Saysay Live Band** (`live_band`) +
  Tugtog Collective + **DJ Indak** (`dj`, the only contracted one), so the
  'Live Band' booth (copy: "Saysay Live Band — 5-piece set") linked to DJ
  Indak; `mobile_bar` holds **Tagay Mobile Bar** (`mobile_bar`) + Inuman Tea
  Cart + **Barkada Bar** (Davao `mocktail_bar`, the only contracted one), so
  the 'Mobile Bar' booth (copy: "Tagay Mobile Bar") linked to Barkada Bar.
  Both cards rendered a vendor name that contradicted their own copy and the
  card-content businesses (Saysay / Tagay) seeded above. Fix: the booth VALUES
  table gains an explicit **vendor_name pin** column; the two ambiguous booths
  pin to Saysay Live Band / Tagay Mobile Bar (resolve by
  `(category, vendor_name)`), and the remaining 12 keep the
  category+contracted-status resolution (each has exactly one stamped vendor,
  so it is unambiguous).
- **Misleading comment fixed** (review finding, major — comment-only) — the
  room-magic comment claimed "the second serpentine" / "both serpentine tables
  read as real". There is only ONE serpentine `table_type` in this seed
  (Table 9). Comment corrected and the Barkada divergence documented (below).

### What a fresh re-seed now reproduces vs. remaining gaps

- **Reproduced:** dance floor (enabled, 50/52, 24×14), all 10 tables at live
  percent positions/types/capacities, the 14-booth perimeter ring with each
  booth linked to the vendor its copy names (via category+status, or the
  vendor_name pin for Live Band / Mobile Bar), the cold-spark entrance tunnel,
  and Table 9's 4-guest serpentine cast (4 of 5 seats).
- **Intentional divergence — "Friends — Barkada" table type:** live prod
  renders Barkada as a **serpentine**; this seed keeps it as **round_10** on
  purpose (Table 9 is the single serpentine demo). Recorded here so the next
  maintainer knows it is a deliberate choice, not a scale/type bug.
- **Known gap — Table 8 / Table 10 rosters:** Tables 8, 9, 10 exist only in
  live prod (never previously seeded). This seed creates all three, but seats
  a cast at **Table 9 only**; **Table 8 and Table 10 are seeded empty**. If
  live prod has real seat assignments at 8/10, the re-seed does not reproduce
  them — flagged as a seat-assignment omission, not a bug.
- **Possible gap — floor-plan entrance element (unverified against live):** the
  dance-floor UPSERT creates `event_floor_plan` with `entrance_enabled`
  defaulting FALSE, so no floor-plan **entrance** element is enabled by the
  re-seed. The demo's arrival treatment is the separate `reception_design`
  cold-spark **tunnel**, which the seed does set. If the live demo also shows a
  distinct enabled floor-plan entrance element, the re-seed leaves it off — not
  changed here because it could not be verified against live from the repo, and
  enabling it blind would risk the opposite divergence.

**Not re-applied to prod:** this layout is already live in prod; the seed only
makes a fresh/CI re-seed reproduce it. No prod migration was run.

SPEC IMPACT: None — sample-event data only; see DECISION_LOG 2026-07-08 3D-demo-layout row.
