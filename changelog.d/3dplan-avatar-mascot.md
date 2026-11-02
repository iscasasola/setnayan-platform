## 2026-07-08 · feat(plan3d): mascot-smooth avatar pass — expressive eyes, polished surfaces

Owner-locked look (2026-07-08 Q&A, refining the C-body/B-face hybrid pick): **mascot-smooth 3D style** — rounded, polished, expressive.

- `kit/face.ts`: faces rebuilt from timid ink dots to mascot-expressive — white sclera + warm iris + catchlight, upper lash line, soft brows, fuller smile, a whisper of blush; 256px textures for Play-mode close-ups; wider face patch.
- `kit/figure.tsx`: head 0.12→0.13 m (friendlier read), high-segment head/limb geometry (no visible facets), skin now uses a dedicated sheen material.
- `kit/outfits.ts`: new `skinMaterial` cache (roughness 0.45 — vinyl-figure polish without plastic), lathe shells at 28 segments.
- `kit/hair.ts`: caps rescaled to the new head, smoother spheres, subdivided crop.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (avatar look addendum — mascot-smooth locked)
