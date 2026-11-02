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

## 2026-07-08 · feat(plan3d): cinematic Tier B — bloom + DoF, dynamically imported, auto-degrade

Tier B of the cinematic Play pass (Fable dossier § 3.5): TRUE postprocessing
via the Fable program's ONLY owner-approved new dependency —
**`postprocessing@6.39.2` + `@react-three/postprocessing@3.0.4`** (pinned:
r-p-p v3 is the react-19/fiber-9 major, peers `react ^19` · `@react-three/fiber
^9` · `three >= 0.156`; postprocessing 6.39.2 peers `three >= 0.168 < 0.186` —
both satisfied by react 19 / fiber 9.6.1 / three 0.184).

- **`kit/cinematic.tsx`** (NEW — deliberately NOT in the kit barrel) —
  `<CinematicPass>`: EffectComposer (HalfFloat buffer, multisampling 4) with
  **DepthOfField** (target = room centre at 1.05 m, easing wall-clock-damped
  (4 s⁻¹) onto the followed walk-in via the Walker's `posRef`; in-focus band
  `span×0.6`, bokehScale 2.2) → **Bloom** (mipmapBlur, intensity 0.55,
  **luminanceThreshold 1.2**, smoothing 0.1, radius 0.72 — the composer
  renders un-tone-mapped HDR, so ONLY the ≥2.0-emissive `toneMapped={false}`
  stars clear the floor: string bulbs, firing spark cores, LIVE lamp, mirror
  bulbs; lit albedo/whites stay ≤ ~1) → **ToneMapping ACES** (the composer
  forces `gl.toneMapping = NoToneMapping` while mounted, so the shared
  RECOMMENDED_TONEMAP curve is re-applied post-bloom; restored on unmount =
  bit-identical Tier A) → **Noise** (premultiplied grain, opacity 0.25) →
  **Vignette** (offset 0.3, darkness 0.55 — Tier A's DOM div promoted into the
  composer on this tier). Plus a drei **PerformanceMonitor**: 2 consecutive
  decline windows with no incline between → `onDegrade` fires once
  (console.info), the call site latches Tier B OFF for the session, and the
  composer unmounts to Tier A — one-way latch, no thrash by construction.
- **`seating-lab-3d.tsx`** — `React.lazy` mounts the pass ONLY when
  `mode==='play' && quality 'high' (the lab's tier) && !reduced && !degraded`;
  the DOM vignette now serves only the Tier A fallbacks (reduced motion + the
  perf latch). The single `Walker` gained an optional `posRef` sink (root
  world position, written per frame, nulled on unmount) feeding the DoF
  follow-focus. The phone guest walk (`quality 'low'`) NEVER references the
  module — the chunk is lab-Play-only.
- **`kit/booth-props.tsx`** — the two designated bloom stars that sat under
  the HDR floor got lifted onto the string-bulb pattern: mirror `bulbMat`
  1.1 → **2.0** emissive + `toneMapped:false`; LIVE lamp 0.75 → **2.8**
  (red carries little luminance — needs the headroom to clear 1.2).
- **Bundle proof** — `postprocessing` lands in one async chunk loaded on Play
  entry only; shared-bundle check green (see PR body for the chunk id).

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (§ 3.5 Tier B shipped — the postprocessing-dep owner question is CLOSED: approved, Play-mode-only, dynamically imported)

## 2026-07-08 · chore(plan3d): cinematic Tier B review fixes — memoized composer, selective bloom, grade-scoped star materials

Post-ship review pass on the cinematic Play slice (7 findings triaged; 2 major
+ 1 major-dup confirmed and fixed, 3 minors fixed, none skipped):

- **`kit/cinematic.tsx` — `CinematicPass` is now `React.memo`** (major). The
  r-p-p EffectComposer rebuilds its EffectPasses (full merged-shader
  reassembly + undisposed EffectMaterial churn, a multi-ms hitch) whenever its
  `children` JSX identity changes — i.e. on every lab re-render while Tier B
  was mounted: walk-in start/arrival, toasts, movers, booth sheets — exactly
  the beats the mascot-smooth law protects. All props are referentially stable
  at the call site, so the memo keeps the composer subtree render-free.
- **`kit/cinematic.tsx` — Bloom → depth-masked `SelectiveBloom`** (major). The
  1.2 luminance threshold only separated emissives from diffuse albedo, not
  from SPECULAR: the play-grade key panel bakes at 2.45 un-tone-mapped, so
  grazing-angle Fresnel env reflections on the glossy white mannequins
  (roughness 0.18) and the chrome/glass booth props cleared any floor the
  stars could also clear — seated figures and booth trim grew rim/specular
  halos, violating the pass's own "ONLY the designated stars glow" contract.
  Now the stars enrol on a reserved scene layer (`CINEMATIC_BLOOM_LAYER` 11 +
  `CINEMATIC_BLOOM_LAYERS_MASK`, dep-free consts in `scene-lighting.tsx`;
  enrolled: string-light bulbs, cold-spark cores, LIVE lamp face,
  vanity-mirror + glass-case bulbs) and SelectiveBloom depth-masks its
  luminance pass to that layer — non-star geometry can never halo. Threshold
  re-tuned 1.2 → 0.55 for its one remaining job (gating a star's own dim
  texels: idle spark cores ≈0.43 stay out, the red LIVE dot ≈0.69 — small
  luminance, 0.2126·r — finally blooms as designed). Costs one small depth
  render of the star meshes + one fullscreen mask pass.
- **`kit/booth-props.tsx` — bloom-star HDR values are now composer-scoped**
  (major dup of the minor). The Tier B retune had edited the module-singleton
  materials shared by EVERY surface — but Build, the phone walk and both
  Tier A fallbacks have no tone mapping rescue, so the vanity bulbs' 2.0
  emissive clipped to flat pale discs (warm-gold read lost exactly where the
  heritage-warmth rules apply) and the ON-AIR lamp ran ~3.7× hot everywhere.
  New `setBoothBloomStarsHDR()`: `CinematicPass` flips the singletons HDR on
  mount (bulbs 1.1 tone-mapped → 2.0 `toneMapped:false`; lamp 0.75 → 2.8) and
  restores the shipped SDR look on unmount — one material recompile per flip,
  HDR numbers exist only where they bloom.
- **`kit/cinematic.tsx` — degrade counter got a wall-clock adjacency window**
  (minor). The counter only reset on a drei incline round, which needs fps AT
  the refresh-rate bound — a healthy machine steady at e.g. 55 fps @60 Hz
  never inclines, so two one-off stalls minutes apart latched Tier B off for
  the session. Two declines now only count as "consecutive" within
  `DECLINE_ADJACENT_MS` (8 s; genuine sustained declines fire ~2.5 s apart).
- **`seating-lab-3d.tsx` — upstream composer-lifecycle cost documented at the
  mount site** (minor): r-p-p@3.0.4 never calls `composer.dispose()` (MSAA-4
  HalfFloat buffers → GC timing) and flips `gl.toneMapping` per mount/unmount
  (scene-wide program-variant switch); `enabled` toggling is NOT a safe
  mitigation. Deps stay exact-pinned; note flags re-verify-on-bump.
- **`string-lights.tsx` + `venue-decor.tsx` — ceiling-band coordination**
  (minor). Cinematic strands (y ≈ 2.5–3.45 m) mounted unconditionally in Play,
  threading through VenueDecor's hanging florals/chandelier crystals/lanterns
  and doubling a chosen `fairy_lights` design with a second near-identical
  string system. New `ceilingDecorOccupied()` (mirrors VenueDecor's exact
  mount conditions, open-air suppression included) gates the strand mount in
  the lab + the phone walk: when the couple's own ceiling decor renders, it IS
  the film look's ceiling layer.

Gates: typecheck ✓ · 1184 unit tests ✓ · lint ✓ · shared-bundle budget ✓
(199.6KB / 200KB — postprocessing stays in its async Play-only chunk).

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice 6 shipped — the program's only new dep, Play-only)
