# Spatial backdrop themes

Layered scene imagery for the RSVP "spatial backdrop" (`lib/spatial-backdrop.ts`
registry · `app/_components/spatial-backdrop.tsx` renderer). Each theme is
`a-*` (scene A) → `b-*` (scene B); `-far` images are full scenes, `-near`
images are lights-on-black glow layers composited with `mix-blend-mode: screen`
(the alpha-free layering trick — Recraft outputs opaque WebP).

**Provenance:** generated 2026-06-11 with Recraft v3 (`realistic_image`,
1820×1024 scenes / 1024×1024 glow layers), recompressed to lossy WebP q62–68
via sharp. Recraft's commercial terms grant the generating account full
ownership/commercial rights to outputs. Human-reviewed: no people, no text,
no watermarks (capiz-glow a-far is top-cropped to the sky band to exclude
background figures from the raw generation).

To add a theme: generate layers with the same conventions (dusk-leaning scenes
so `screen` glow layers composite well; center-weighted; "camera looking
upward" framing structurally avoids generated people), drop files here, and
register the theme in `SPATIAL_THEMES` — the editor picker and renderer pick
it up from the registry; no other code changes.
