## 2026-07-08 · feat(plan3d): articulated figure kit — rig math, outfits, hair, faces

Core of the shared "Sims-like" 3D figure kit for the 3D Plan surfaces (owner-locked
direction). New, not yet wired into any surface — the cylinder+sphere tokens in
`plan3d-scene.tsx` / the lab's `SeatedAvatar` are replaced in a later integration stage
that codes against `app/_components/plan3d/kit/index.ts`.

- `lib/figure-rig.ts` — PURE pose math (stand / walk-cycle / sit / idle-sway as plain
  `{ joint: radians }` records) + `resolveFigureLook` deterministic per-guest looks
  (6-tone Filipino skin ramp, 6 hairstyles, dark hair ramp, 3 face variants — stable
  id hash, same guest always looks the same). Unit-tested (`lib/figure-rig.test.ts`:
  determinism, gait antiphase symmetry, sit-pose sanity, sway envelopes, damp
  frame-rate independence).
- `app/_components/plan3d/kit/outfits.ts` — shared shell geometries at module scope
  (lab GOWN/SUIT proportions reused verbatim) + barong (near-white, procedural
  vertical-embroidery bump, slight sheen) + filipiniana (gown shell + butterfly
  sleeves) + keyed material caches.
- `kit/hair.ts` — 6 procedural hairstyles (crop / bun / ponytail / side-part /
  short-spike / long-fall) as 1–2 placed shared primitives each.
- `kit/face.ts` — 3 drawn face decal variants (CanvasTexture on a polar-capped sphere
  segment); selfies keep going through the EXISTING `GuestPhotoAvatar` refcounted
  texture cache (not re-implemented).
- `kit/figure.tsx` — the articulated rig (`pelvis → torso → head`, 2-segment arms +
  legs), pose blending frame-rate-independent via the shared `damp` pattern, reduced
  motion → static pose (flows still complete), `quality='low'` → baked pose with no
  per-frame joint updates. `SeatedFigure` / `WalkingFigure` wrappers.

SPEC IMPACT: None (rendering-only kit; no schema, no actions, no PII; guest surface
data stays name/seat/side).
