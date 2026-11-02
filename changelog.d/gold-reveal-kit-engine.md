## 2026-06-22 · feat(std): composable gold-monogram reveal kit — engine + dials (PR1)

Generalizes the shipped single "Turn" gold opening (#2079) into a mix-and-match KIT
across three dials (owner 2026-06-22): BUILD-UP (trace · assemble · grow · float-land)
× MOVE (turn · hover · swing · pop) × ACCENT (shimmer · sparkle · ember-rise ·
foil-flash · light-rays · engrave). PR1 = the engine + data model + reveal
integration; the couple-facing 3-dial builder UI is PR2.

- **`lib/std-reveal-effects.ts`**: new `GoldBuildUp`/`GoldMove`/`GoldAccent`/
  `GoldRevealDials` types + the allowed-set arrays + `DEFAULT_GOLD_DIALS`
  (trace · turn · shimmer) + `coerceEnum` + `resolveGoldDials`; `RevealEffects`
  gains a `gold` field, defaulted + merged in `resolveRevealEffects`. Persists in
  the existing `events.std_reveal_effects` JSONB — **no new column/migration/gate**
  (the ₱799 premium-openings unlock still gates the opening; dials are styling
  inside it). Legacy/null rows resolve to the defaults.
- **`gold-monogram-reveal.tsx`**: rewritten into the dial-driven layered kit.
  Nested wrappers each own ONE channel so the three never collide — `.grk-move`
  (the 3D move), `.grk-build` (mark-level grow/float, neutral for per-element),
  `.grk-el` glyphs (per-element trace/assemble), accent overlay/masked layers.
  Two mark tiers: **inline per-glyph gold `<text>`** for initials (TRUE per-element
  trace/assemble/sparkle) and the **masked gold silhouette** for an uploaded SVG
  (per-element dials gracefully fall back to whole-mark). Per-instance scoped CSS +
  gradient ids (useId) so multiple instances never collide. `settleMs` derived from
  the chosen build-up + move (hover stays ambient after onDone). The gesture →
  `std-go-fullscreen` (synchronous) → onDone → `std-reveal-done` contract and the
  prefers-reduced-motion static fallback are preserved verbatim.
- **Integration**: `reveal-overlay.tsx` + `reveal-preview.tsx` pass
  `dials={…?.gold}` to the component. Defaults reproduce a premium reveal for
  every event with no dials saved yet.

Pure CSS/SVG (main bundle). Real per-letter trace in the couple's chosen lockup FONT
is the PR3 fidelity follow-up (today lettered marks trace in an elegant serif).

SPEC IMPACT: None (0024 STD openings + 0037 monogram). ⚠ OWNER: default build-up =
`trace` (the premium headline); the gold opening is hours old so blast radius ≈ 0 —
confirm in the pricing/holistic pass. Progress in `DECISION_LOG.md`.
