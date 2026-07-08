## 2026-07-08 · feat(plan3d): cinematic Tier A — golden-hour grade, string lights, motes, vignette

Tier A of the cinematic Play pass (Fable dossier
`0008_3DPlan_Fable_Design_2026-07-08.md` § 3.5): the DEP-FREE film look that
ships everywhere, phones included. Zero new npm dependencies — light knobs,
one static InstancedMesh, one drei `<Sparkles>` volume, and a CSS gradient.

- **`scene-lighting.tsx`** — the palette-warm key: the `'#fff6ea'` overhead
  wash + `'#fff3e2'` directional key hardcodes (the theming read's flagged
  extension point) now mix toward the mood board's **dominant warm swatch**
  (`dominantWarmSwatch`: warmest of accent → ambient → table → wall by linear
  r−b bias, warm-only threshold 0.04 — a cool/absent palette falls back to the
  legacy colours bit-for-bit). Mix is capped subtle: **12% standard · 20%
  play**. New `grade?: 'standard' | 'play'` prop (default `'standard'` — every
  existing call site unchanged): play lowers ambient 0.28 → 0.22, lifts the
  directional key 1.35 → 1.5 and the key Lightformer 2.2 → 2.45, eases the
  cool fill 0.9 → 0.72. The one-shot `frames={1}` env bake re-runs via a
  React key on grade+wash — still one PMREM pass per look, never per frame.
  Exports `playGradeFog` (base fog warmed 8% toward the key, far plane pulled
  d×3.2 → d×2.9) and `<DustMotes>` (~40 warm drei Sparkles drifting in the key
  shaft over the dance floor; call-site gated: Play + 'high' + motion-OK).
- **`kit/string-lights.tsx`** (NEW) — cinematic string lights: 3–5 catenary
  strands spanning the room at 3.45 m (sag 0.85 m → bottoms ≈2.6 m, above
  every head), ALL bulbs one static InstancedMesh (matrices written once — the
  instanced-chairs discipline) + one polyline wire per strand. `'low'` halves
  the strand count. Bulbs are **warm-white only** (palette slides them along
  the 3000 K ↔ 2700 K amber axis via the warm swatch's r−b bias — NEVER
  palette-RGB); `toneMapped={false}` marks them as the Tier B bloom stars.
  Distinct from venue-decor's `fairy_lights` design treatment (which stays
  couple-chosen and Build-visible); open-air archetypes keep them per the
  venue-decor "strung, not slab-hung" precedent.
- **`seating-lab-3d.tsx`** — Play mode flips the whole grade ON (Build stays
  the neutral editing studio): `grade='play'`, `playGradeFog`, string lights
  ('high'), dust motes over the dance floor (room centre when no dance floor;
  NOT mounted under prefers-reduced-motion — house law: reduced = static
  grade, no motes), and a dep-free screen-space vignette (radial-gradient DOM
  overlay, `pointer-events-none`, z-10 under the z-20/z-30 walk controls).
- **`plan3d-scene.tsx` / `plan3d-scene-loader.tsx`** — new `cinematic?:
  boolean` prop (default false): golden-hour grade + string lights only (no
  motes, no vignette on this surface). **`plan3d-guest-view.tsx`** (the phone
  demo walk) passes it at `quality="low"`.

Budgets: string lights = 1 instanced draw (≈60–130 bulbs) + 3–5 line draws,
static after mount (zero per-frame cost); motes = 1 Sparkles draw, 40
particles, 'high'-only; vignette = 1 DOM div, zero GPU; grade = light knobs +
one extra env re-bake per Build↔Play flip. Verified in the lab preview: Play
mounts all four, Build unmounts them; typecheck + 1184 unit tests green.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (§ 3.5 Tier A shipped — Tier B postprocessing dep remains the open owner question)
