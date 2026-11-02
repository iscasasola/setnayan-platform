## 2026-06-23 · feat(monogram): the studio "Animate the reveal" panel is the REAL reveal (gold/molten added)

Owner 2026-06-23 ("improve THIS animate the reveal … make it real + add Gold/Molten").
Unifies the two disconnected reveal systems onto the Vector Studio's "Animate the
reveal" panel as the single designed source, and makes what a couple designs there
PLAY on their live pages.

**Phase 1 — panel widened to 5 kinds.** `ANIM_KINDS` (monogram-studio-shared.ts) gains
`gold` + `molten` (exported as the one allowlist + `StudioAnimKind`); the studio markup
adds **Gold Turn** + **Molten Gold** buttons and drops the "Preview ·" framing (this panel
IS the reveal now). The engine (`play()`) hands gold/molten to a new `onPreviewKind`
callback instead of the paper.js loop; `studio.tsx` portals the REAL shipping component
(GoldMonogramReveal / MoltenMonogramInline) over the canvas → the studio preview is WYSIWYG
with the live render. The choice persists in the existing `monogram_studio_config.anim`
(no migration).

**Phase 2 — the live player.** New `app/_components/studio-reveal-player.tsx`: one
dispatcher over the 5 kinds — handwriting/trace/droplet as a DOM-SVG draw-on (a port of the
engine's stroke-dashoffset reveal, driven by the chosen dur/delay/smooth; per-path), gold via
GoldMonogramReveal, molten via MoltenMonogramInline. SSR-renders the static mark (no-JS / no
flash), animates on mount, honors reduced-motion. `resolveEventMonogram`
(hero-monogram-data.ts) now reads `monogram_studio_config.anim` and returns `studioAnim`
(defaulted to a 6s handwriting draw-on).

**Phase 3 — wired to the live surfaces.** `HeroMonogram` plays a BESPOKE mark's reveal via
`StudioRevealPlayer` (when ANIMATED_MONOGRAM is owned), replacing the gold/molten-via-
monogram_motion_key branch; `studioAnim` threaded through the public hero + Save-the-Date
**film** (FilmMonogram, the dramatic monogram beat — `allowWebgl={active}` keeps molten to one
WebGL context) + recap + wall + editorial. Un-threaded secondary placements keep the legacy
bloom (no regression). Molten stays one-context: live only on the film beat / studio preview,
degrading to the CSS Gold Turn everywhere else.

**Phase 4 — one source, split cleanly by mark family.** BESPOKE (studio/uploaded) marks read
`config.anim` (the studio panel · 5 kinds incl. gold/molten); LETTERED lockups keep
`monogram_motion_key` + AnimatedMonogramHero (the **6** glyph-level CSS signatures). No second
picker — the studio panel is the chooser for the marks it produces. gold/molten are studio-only:
`MONOGRAM_MOTIONS`/`MonogramMotionKey` reverted to 6 keys (matching the live, never-widened
`events_monogram_motion_key_check`), and the unapplied gold/molten CHECK-widen migration
(`20270219143725`, 0 rows, not in the ledger) was DELETED — no migration needed.

(Phase 5 — exact per-letter draw-on parity — deferred; the per-path approximation matches most
marks.)

SPEC IMPACT: None (0037 monogram studio + 0024 STD film). ⚠ OWNER: lettered lockups currently
have no in-product reveal chooser (they default to draw) now that the standalone picker is
retired — a thin lettered chooser can be added later if wanted.
