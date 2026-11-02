## 2026-07-10 · feat(seating): 2D linked-serpentine chairs respace evenly (match the 3D lab)

Owner: "bring 2D to match 3D." When serpentine wedges are LINKED into a chain,
the 3D lab already respaces their chairs at uniform density across the sweep so
they flow continuously across a junction (no seam pile-up). The 2D editor still
drew each wedge's chairs endpoint-anchored, so a linked S-curve read as several
separate tables with gaps at every join.

- `tableGeometry(shape, capacity, even?)` — new opt-in `even` flag. When set, the
  serpentine branch distributes chairs at slot centres (`-sweep/2 +
  (sweep/count)·(i+0.5)`), the exact mirror of the 3D `serpentineChairs` even
  mode. Standalone tables keep the endpoint+inset spread (end chairs hug the
  tips, seam stays chair-free). No effect on any non-serpentine shape.
- The chair-render site passes `even = table.link_group_id != null`, so only
  linked serpentines respace; standalone wedges are byte-identical.
- **Footprint stays even-invariant:** the `box` is computed from the standalone
  (widest) chair spread — the even chairs sit inside it — so `footprintPx`, snap
  tolerances and overlap checks stay consistent with the render regardless of
  link state. (Unit-proven: `box` deep-equals across even/plain.)

Tests (`lib/seating.test.ts`, +3): even outer pair is tighter than the endpoint
spread (slot-centred) · `box` unchanged by the flag · flag is a no-op for
round/banquet/family-head.

### Deliberately NOT changed (documented parity decisions, not gaps)
- **Auto-link on snap** stays a manual "link-mode" gesture in 2D — because 2D
  doesn't auto-link ANY shape on snap (rects included). Adding serpentine-only
  auto-link would make serpentines behave differently from rects *within* 2D.
  With seat-plan live-sync shipped, a 3D auto-link already propagates to 2D.
- **SERP_RI/RO ratio** left as-is (2D 80/120 vs 3D 0.95/1.55). The surfaces are
  never overlaid (2D is a %-space schematic, 3D is metres), so the ~8% band-
  thickness difference isn't user-visible; realigning it would move every
  existing 2D serpentine for no visible gain.

SPEC IMPACT: None (2D render parity for the existing linked-serpentine model).
