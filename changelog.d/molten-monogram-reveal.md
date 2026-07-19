## 2026-06-22 · feat(std): real WebGL molten-gold monogram reveal opening

Owner 2026-06-22 ("real lava hardening to the monogram, not a powerpoint effect"):
a genuine GLSL shader opening, not a CSS animation. A new `molten-monogram` reveal
template where the couple's monogram pours in as glowing molten gold (domain-warped
fbm turbulence), then COOLS — the emissive drains, a crust skins over, and the metal
HARDENS into solid gold with a final foil glint — before handing off to the content
film.

- **`app/[slug]/_components/reveal/molten-monogram-reveal.tsx`** (new): a real
  `THREE.ShaderMaterial` on a full-screen quad, the first true custom GLSL in the
  reveal system (the veil only injects an onBeforeCompile fresnel). One normalized
  progress `p∈[0,1]` over ~5.2s drives `uFill`/`uCool`/`uHarden`; the fragment
  shader does the flow + heat ramp (crust → red → orange → white-hot) + cooling +
  crust growth + harden-to-gold. **Masked to the couple's mark** via the shared
  `svgToMonogramTexture` helper — uploaded bespoke SVG is pixel-exact; lettered
  initials build a plate-less silhouette so lava fills the LETTERS, not a badge.
  Mirrors `veil-reveal.tsx` verbatim: raw three.js mount-once `useEffect`,
  transparent canvas over a dark stage, DPR cap (1 under `lowRes`), manual rAF
  loop, ResizeObserver re-fit, full GPU dispose. Cinematic auto-play (no gesture —
  lava can't be "swiped"). `onDone()` is doneRef-guarded at `p≥0.985`; WebGL-init
  failure / reduced-motion → `finish()` immediately so the free film never hangs.
- **Lazy-loaded** via `next/dynamic(ssr:false)` from `reveal-overlay.tsx`,
  `reveal-preview.tsx`, and the admin `reveal-studio/studio.tsx` — three.js stays
  OUT of the main couple-site bundle (Lighthouse-safe), like the veil. (The CSS
  `GoldMonogramReveal` stays a static import; this one must not be.)
- **Registration**: added `'molten-monogram'` to the `RevealTemplate` +
  `RevealTemplateId` unions, `REVEAL_TEMPLATE_IDS`, `REVEAL_ALIASES`
  (`?reveal=molten` / `?reveal=lava` previews), `REVEAL_LIBRARY` (auto picker
  tile), and BOTH exhaustive `Record<RevealTemplateId>` maps
  (`DEFAULT_REVEAL_CONFIG.templates`, studio `TEMPLATE_LABELS`) — the known
  build-break trap. A studio preview branch + PREVIEW_TPLS tab for HQ calibration.
  Couple pick + persistence (`events.std_reveal_template`) and the ₱799
  `STD_PREMIUM_OPENINGS` gate are array-driven → auto-cover the new id (no
  migration, no new SKU).

It's a sibling WebGL opening (family `rigid`: parts and clears), NOT a build-up dial
of the CSS gold kit — the architecture the design pass recommended (mixing a WebGL
renderer into a CSS component would either bloat the main bundle or fork its render
path).

SPEC IMPACT: None (0024 STD openings). ⚠ OWNER: (1) molten is **cinematic
auto-play** (unlike the gold reveal's tap-to-open) — confirm that's the intent;
(2) it ships under the same ₱799 openings unlock, not a separate premium tier;
(3) lettered marks rasterize in a system serif (the documented font caveat — a
followup inlines the couple's @font-face). Progress in `DECISION_LOG.md`.
