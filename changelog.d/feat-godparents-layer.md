## 2026-07-12 · feat(people): ninong/ninang (godparent) edges on a dependent — flag-off

Phase 3 of the date-anchor family graph. A guardian can record a child dependent's
godparents (name · role ninong/ninang · optional email) so they can later be
reminded of the godchild's birthday and send a QR-display e-gift. Gated behind
`dependentPeopleEnabled()` (default OFF) — the `godparents` table stays EMPTY in
prod until the DPO clears counsel (G1) and flips the flag; merging stores nothing.

- New migration `20270802348062_godparents_ninong_ninang_edges.sql`: `godparents`
  table (owner-scoped RLS Pattern A · `role` CHECK ninong/ninang · `reminders_enabled`
  opt-out for the third-party godparent · `generate_public_id('G')`).
- `addGodparent`/`deleteGodparent` server actions (owner-verifies the dependent is
  the caller's own before insert; flag-gated).
- Per-child godparent capture + chips in the People → dependents section (only for
  a dependent in the child band).

SPEC IMPACT: None (corpus already carries the family-graph design in
`Faith_Aware_Person_Graph_2026-07-12.md` + `Family_Life_OS_Master_Build_Plan_2026-07-12.md`;
owner-actions gate tracked in `Family_Graph_Owner_Actions_2026-07-12.md`).
