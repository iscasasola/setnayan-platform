## 2026-07-16 · feat(seating): route every mutation path through the placement oracle — weld model + metric walkway + honest Auto Arrange (verdict PR-2)

Wires the editor + server actions to the PR-1 oracle so the persisting table overlaps actually stop. Every mutation path now validates through the ONE oracle; nothing persists a pose it rejects; sanctioned contact = same `link_group_id` only (the weld model).

**The 7 root-cause fixes (verdict § 1):**
1. **Distance-only join exemption deleted.** `chainJoined` (the old `serpentinesJoined`/`rectRunsJoined` + `SERP_JOIN_TOL_PX=18` exemption) is gone — a snapped-but-unlinked pair now reads as a collision and heals. The only exemption is same-`link_group_id` membership (enforced inside `checkPlacement`).
2. **"Already stuck → drag free" disjunct deleted → monotone escape.** A clean table must stay fully legal (axis-separated slide); a table that starts violating may move only to a valid pose or one whose body penetration doesn't increase beyond ε = 2 cm (`penetrationDepth` compared frame-to-frame). Out always, deeper never.
3. **Rotation-agnostic AABB → OBB/SAT.** `overlapsAny` now builds a rotation-aware `WorldPose` (`poseAt`) and calls `checkPlacement`; a rotated banquet no longer interpenetrates or phantom-blocks.
4. **Every rotate path preview→check→commit.** `commitRotation`, `rotateTable` (±15/Flip single), `rotateGroupBy` (unit buttons), and both continuous-gesture releases (two-finger + rotate handle) refuse an angle that would collide with a non-joint neighbour (`rotationBlocked` / `groupRotationBlocked`, legal-joint + same-unit exempt so a chain-snapped angle still commits).
5. **Snap ghost oracle-checked + `linkTables` server validation.** The weld ghost runs through `checkPlacement` vs all third parties (the weld anchor excluded) before it's offered — collides elsewhere ⇒ "No room", no snap, no link. `linkTables` gains server-side same-family + legal-joint validation (metric, nominal-canvas scaling), closing the no-validation hole (a round could be "linked" to a serpentine; arbitrary-pose links accepted).
6. **`serpSnapRotRef` smear cleared with hysteresis.** The snap ref now carries the snap centre + catch radius; the drag releases the phantom chain angle once it leaves 1.4× the catch radius, so a free-position drop never persists a stale chain rotation.
7. **Read-only mount audit.** Saved anchors are still honoured verbatim (never rearranged on load); a `layoutViolations` pass flags real persisted overlaps (surfaced in the Arrange menu). Monotone-escape drag heals them organically.

**Weld/link model (§ 2):** snap is link — a drag that welds a compatible neighbour links the two on release ("group as one"). The chain icon is now pull-to-join: B animates to the nearest oracle-valid legal joint on A and links, or refuses with "No room at that end."

**Metric walkway (§ 3):** the Arrange ⚙ menu gains the global "Walkway width" — Tight 0.6 m / Service 0.9 m / Comfort 1.5 m presets + a 0.6–2.0 m fine stepper, with the PH banquet-aisle captions. Drives live collision + Auto Arrange. Defaults to **0.6 m** (legacy grandfather → zero violation wave, § 9.4) and is **session-scoped** — persisting needs an additive `event_floor_plan.aisle_m` column, out of this PR's no-schema-change scope (owner-open). Disabled on the free board with the honest hint.

**Auto Arrange as solver (§ 5):** `runAutoArrange` uses the verified `solveAutoLayout` — every placed slot passes the oracle (no silent stacking); booths become no-go zones; the metric walkway drives the gaps. Overflow is stated honestly ("N couldn't fit at X m — at 0.6 m N fit; try a narrower walkway / fewer tables / a bigger room") from a real second solver pass; the server action nulls overflow coordinates when handed an `unplaced` list.

Gates: typecheck + lint clean, full unit suite 1850 pass, production build ✔.

**Not runnable here (owner steps):** the mid-range-Android perf gate (§ 4 / PR-2) and live-UI verification — the collision now runs the SAT oracle per drag frame (broad-phase prefiltered, moving element only). Deferred sub-items surfaced in the PR body: `aisle_m` persistence (needs the additive column), the full drag-back Unplaced tray + per-table violation halos + Fix-overlaps ghost-diff (§ 6.2–6.4), and the centre-aisle toggle (§ 9.5).

SPEC IMPACT: Seat_Plan_Spacing_Linking_Council_Verdict_2026-07-16.md (§ 1 all 7 root causes, § 2 weld model, § 3 walkway, § 5 solver, § 6 mount audit — editor/actions wiring)
