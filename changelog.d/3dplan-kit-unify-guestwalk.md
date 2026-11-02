## 2026-07-08 · refactor(seating-3d): public guest venue walk adopts the shared figure kit (Fable slice 7)

The last of the three seat-plan surfaces to still ship its OWN human figure — the
public guest venue walk (`app/[slug]/venue/_components/guest-venue-3d.tsx`) — now
renders through the shared `plan3d/kit` `<Figure>`/`<SeatedFigure>`, so the
codebase has exactly ONE human-figure implementation and the guest walk stops
looking like a different product from the lab/demo. Pure consolidation onto code
already shipping on the homepage demo + couple lab; **the `public_venue_scene` RPC
payload is UNCHANGED** (no widening — the anonymisation contract is intact).

- **Seated occupants** — the local `GuestToken` cylinder is retired for the kit
  `<SeatedFigure>`. Anonymous strangers are NEUTRAL untinted mannequins (the
  `#ffffff` kit default — the 2026-06-26 "their table named, rest anonymous"
  privacy lock; NO per-guest attire/hair, dossier §6 Q5 unanswered → stay
  neutral). The viewer's own seat is accent-tinted (self semantics) and keeps its
  separate gold ring. Seated facing uses the couple lab's exact `SeatedAvatar`
  convention (π flip + −0.04 `FIGURE_NUDGE_M`), quality `'low'` (phone crowd
  budget bakes the seated pose).
- **The viewer's own avatar** — the local `GuestAvatar` capsule+sphere is retired
  for a walking kit `<Figure>` (accent-tinted self), gait driven by a phase clock
  that advances ~9 rad/s while walking and freezes on arrival (pose eases
  walk → stand); the rig carries its own pelvis bob, so the group no longer hops.
  The accent "you" glow (pointLight) is kept.
- **Cinematic Tier A at `'low'`** — the walk now runs the palette-warm golden-hour
  grade (`SceneLighting grade="play"`) + kit `StringLights` (ceiling-decor-gated
  via `ceilingDecorOccupied`), matching what the phone demo walk
  (`plan3d-guest-view.tsx`) already does. Tier A ONLY — no Tier B postprocessing,
  no dust motes on the public surface (public walk is `'low'`).
- **Stage-color divergence resolved** — the walk drew its stage in `palette.table`
  while the couple lab (`seating-lab-3d`) and homepage demo (`plan3d-scene`) both
  use `palette.accent` @ roughness 0.5 / metalness 0.1. Canonical = the lab/demo
  accent slab; the walk now matches, so the same stage reads across all three
  surfaces.
- **Host-opt-in selfies preserved** — where the RPC returns a per-seat photo (token
  holder + the couple's `venue_photo_visibility`), it is routed through the kit
  figure's `photoUrl` path (the SAME `GuestPhotoAvatar` billboard disc as before),
  so this is a behaviour-preserving consolidation, not a feature change. ⚠ See the
  owner-flag below re: the "public walk never renders guest photos" wording.

Docs: `kit/index.ts` + `kit/figure.tsx` headers updated — all three surfaces now
consume the kit (no longer "in a later integration stage").

Dead-code removal (same slice): the never-used `paletteHexes` prop chain is gone —
`seating/lab/page.tsx` (+ its now-orphaned `event_moodboard_saves` palette_snapshot
fetch), `seating-lab-loader.tsx`, and `seating-lab-3d.tsx` (declared + destructured,
never read in the body). The canonical scene palette comes from `events.role_palette`
(`rolePalette`), untouched.

Validated: `pnpm typecheck` clean, `pnpm test:unit` 1197/1197 pass, lint clean on
touched files. No `lib/` or geometry math changed, so no new unit tests were needed.

SPEC IMPACT: None (render-layer consolidation of the throwaway/flag-gated 3D spike;
no schema, RPC payload, SKU, or pricing change).
