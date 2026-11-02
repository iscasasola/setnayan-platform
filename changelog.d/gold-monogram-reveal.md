## 2026-06-22 · feat(std): gold monogram reveal — a rotating, light-catching Save-the-Date opening

A new couple-pickable Save-the-Date OPENING (owner picked the "Turn" style): the
couple's mark turns into view in flowing GOLD like a medallion (CSS-3D rotateY)
with a bright specular highlight that sweeps across exactly as it faces front —
"catches the light". Built as a reusable component for the other monogram surfaces
next.

- **New `app/_components/gold-monogram-reveal.tsx`** (client, pure CSS/SVG — no
  WebGL, stays in the main bundle). ONE render path for every mark type: a gold-
  gradient layer MASKED to the mark's shape — the couple's uploaded/Cipher SVG
  (`markSvg`) when present, else a generated initials SVG. A second masked layer is
  the foil glint (lifted from `bespoke-monogram-motion`), timed to peak face-on.
  TAP-triggered: the tap dispatches `std-go-fullscreen` SYNCHRONOUSLY so the content
  film keeps its iOS Fullscreen + audio user-activation, then the turn plays and
  `onDone()` → the overlay's `std-reveal-done`. Honors prefers-reduced-motion
  (static gold mark, still resolves `onDone` so the film never hangs).
- Registered as `RevealTemplateId` / `RevealTemplate` `'gold-monogram'` (rigid,
  non-veil family) in `lib/reveal-config.ts` + `reveal/reveal-templates.ts` (union,
  `REVEAL_TEMPLATE_IDS`, default-on map, `REVEAL_ALIASES` `gold`/`gold-monogram`,
  `REVEAL_LIBRARY` tile) — so it's couple-pickable, persists, and `?reveal=gold`
  previews. `reveal-overlay.tsx` routes it; `reveal-preview.tsx` shows it (autoplay+loop).
- Gating: inherits the existing **₱799 premium-openings** unlock
  (`eventStdOpeningsActive`) like the other 4 openings — no new pricing code, no new
  SKU. ⚠ PRICING (owner holistic pass): confirm the gold opening lives in the existing
  openings bucket (recommended) vs `ANIMATED_MONOGRAM`, and whether owning the
  monogram SKU should also unlock it as a bundle perk.

Followups (the "other monogram places"): drop the same component on the public
landing hero, recap hero, live wall (the resolver seam already feeds them).

SPEC IMPACT: None (0024 Save-the-Date openings + 0037 monogram). Rollout progress
in `DECISION_LOG.md`.
