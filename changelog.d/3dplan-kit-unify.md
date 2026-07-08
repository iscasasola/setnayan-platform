## 2026-07-08 · fix(plan3d): kit-unify review fixes for the public guest walk (Fable slice 7)

Review triage on the public guest venue walk's adoption of the shared figure kit
(`app/[slug]/venue/_components/guest-venue-3d.tsx`).

- **Stray self floor ring removed** (confirmed minor): `selfSpec` carried
  `statusColor: palette.accent`, which lit the kit's `!photoUrl && statusColor`
  branch and drew an accent `STATUS_RING_GEO` disc under the viewer's own moving
  avatar — a ring that slid across the floor tracking the auto-walk. The pre-kit
  capsule avatar never had one. `statusColor` is now the kit's `''` "no ring"
  sentinel; the accent-tinted mannequin (`outfitColor`) and the accent
  `pointLight` "you" glow are unchanged, so "you" still reads without the
  unintended floor disc.

- **Seated-crowd draw-call cost** (confirmed major, deferred — surfaced, not
  silently changed): each `<SeatedFigure>` submits ~14 non-instanced meshes, so a
  250-pax room (the Custom-QR-per-Guest cap) can push ~3.2k color-pass draws where
  the old cylinder tokens cost ~250. This is the **owner-locked "one articulated
  figure everywhere" direction** and is already shipped identically on the couple
  lab (per-seat `<Figure pose="sit">`, `seating-lab-3d.tsx`) and homepage demo —
  this PR is parity, not a new regression. The only real remedy (an instanced /
  LOD seated crowd, or a hard figure cap) is a cross-surface architecture change
  that alters the locked look and needs owner sign-off, so it is flagged as a
  follow-up rather than jammed into a consolidation PR. `quality='low'` already
  drops the crowd's shadow casters + per-frame joint updates.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice 7 shipped — one figure implementation; public walk stays anonymization-locked)
