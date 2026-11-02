## 2026-07-11 · feat(plan3d): ghost booths render + tap + panel (slice 9 · Part A, PR 3/N — Part A complete)

Final phase of 3D Booth Ads Part A — the visible half. All behind
`NEXT_PUBLIC_PLAN3D_BOOTH_ADS` (off → byte-identical single-player).

- **`app/_components/plan3d/ghost-booth.tsx`** — `GhostBooths`: one dashed,
  translucent, palette-tinted placeholder per unbooked category (a floor ring + a
  soft volume + a lazy canvas-texture "STILL NEED · Caterer" placard). Tapping
  opens that category's marketplace grid (`/explore?tile=…`, Boosted/Pro first) in
  a new tab. Interactivity is gated off while a build placement is armed (mirrors
  `LabBoothHitTarget`). The WebGL look is owner-eyeballed; the selection +
  placement math is unit-tested.
- **Lab page** computes the placed ghost booths (flag-gated) from the couple's
  booked `event_vendors.category` + the `event_floor_plan` prefs, on free
  perimeter wall (never over real booths/tables), and threads them through the
  loader → `SeatingLab3D`. The fetch is SKIPPED when the flag is off → no
  new-column dependency until the flag flips.
- **`SeatingLab3D`** mounts `<GhostBooths>` in the Canvas (couple lab ONLY — the
  guest walk never receives them) and a "Still to book" HTML panel: the master
  toggle + a per-category dismiss "×", via the PR-2 server-action forms.

Suite 14/14 green (+ this PR's placement/compose tests from PR 2) · `tsc` clean ·
guards clean. `.env.example` documents the flag.

Part A is now COMPLETE (selection core · schema + placement + actions · render +
interaction), flag-gated off. Parts B (demo-room vendor rotation) and C (vendor
shareable booth showcase) are separate slices.

SPEC IMPACT: None (implements locked slice-9 Part A).
