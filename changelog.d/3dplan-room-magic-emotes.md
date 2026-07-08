# Changelog fragment — 3dplan-room-magic (emote bubbles)

## 2026-07-08 · feat(plan3d): emote bubbles — pooled sprites from real RSVP/meal data

Fable dossier §3.6. Pooled SPRITE emote bubbles above heads on every 3D
seat-plan surface — never drei Html (nothing DOM in-scene; bubbles occlude,
billboard, and never steal a pointer).

- **`lib/emote-schedule.ts` (+tests)** — the PURE wall-clock rotation policy:
  six hash-assigned lanes (≤6 visible by construction), round-robin per-lane
  slots (per-guest cooldown from the id-hash phase), golden-ratio lane stagger,
  per-emitter glyph rotation (`appearance % glyphs.length`), back-out pop-in /
  smoothstep pop-out. Closed-form in elapsed seconds — a starved rAF frame
  consumes all owed progress (the arrival-fix law). 8 new unit tests.
- **`plan3d/kit/emotes.tsx`** — one CanvasTexture glyph ATLAS rasterized once
  (module singleton, booth-props discipline): confirmed-check · pending-? ·
  maybe-~ · meal plate · music note · chat dots — all DRAWN with canvas paths,
  no emoji fonts; fixed semantic inks, never palette-tinted. Pool of exactly 6
  `THREE.Sprite`s, one module-scope SpriteMaterial per glyph (atlas-windowed
  texture views; the frame loop only swaps `sprite.material`). Reduced motion:
  static bubbles, no tweens, still ≤6.
- **Couple lab (Play mode only; Build stays clean)** — bubbles from REAL data:
  `Lab3DGuest.rsvp` drives ✓/?/~ and a set meal adds the plate glyph to that
  guest's rotation. New LAB-ONLY `Lab3DGuest.mealChosen` boolean, mapped in the
  lab page from the couple-scoped `fetchGuestsByEvent` select (which already
  carried `meal_preference`; RLS-covered like every other guest field — only
  the boolean rides to the scene). Mid-walk/mover guests excluded like
  `seatedByTable`.
- **Homepage demo** — side/rsvp-GENERIC bubbles only (check ↔ chat rotation);
  the `Plan3DGuest` slice is NOT widened (stays name/seat/side+attire).
- **Public guest walk** — AMBIENT ONLY: music notes over the dance floor, chat
  dots over occupied tables (table-level occupancy is already public via chair
  tints) — never per-guest status (RA 10173 posture).

SPEC IMPACT: None (implements 0008 Fable dossier §3.6 as designed; no price,
SKU, schema or policy change — `mealChosen` is a client-slice boolean, not a
schema change).
