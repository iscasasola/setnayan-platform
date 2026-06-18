/**
 * Save-the-Date background library (iteration 0024 · 2026-06-19).
 *
 * Step 1 of the builder. Four kinds of background, all 1:1 / center-safe so they
 * crop cleanly into any screen (portrait phone ↔ landscape desktop):
 *
 *   - plain     → a solid Mood-Board colour. Depth = content floats above it +
 *                 a soft vignette + optional drifting particles. (CSS, no asset.)
 *   - paper     → a subtle textured stationery surface. PROCEDURAL CSS/SVG (grain
 *                 + tint), NOT a generated image — Recraft's realistic model only
 *                 ever produced styled product flat-lays, and procedural texture is
 *                 the right tool anyway: truly seamless, recolourable, weightless.
 *   - realistic → a photoreal scene (Recraft `realistic_image`, generated 2026-06-19)
 *                 that gets the full multi-layer / depth parallax. Assets live in
 *                 public/std/backgrounds/. Composed empty + center-safe so the
 *                 couple's names overlay cleanly and edges crop without losing focus.
 *   - upload    → the couple's own photo → auto depth-parallax (depth-map pipeline,
 *                 wired in a later PR).
 *
 * Realistic + upload get full parallax; paper gets a whisper; plain floats content.
 */

export type StdBackgroundKind = 'plain' | 'paper' | 'realistic' | 'upload';

export type StdRealisticBg = { id: string; label: string; src: string };

/** The 10 generated photoreal scenes (public/std/backgrounds/*.webp). */
export const STD_REALISTIC_BACKGROUNDS: readonly StdRealisticBg[] = [
  { id: 'aurora', label: 'Aurora borealis', src: '/std/backgrounds/aurora.webp' },
  { id: 'golden-hour', label: 'Golden hour', src: '/std/backgrounds/golden-hour.webp' },
  { id: 'peonies', label: 'Peony field', src: '/std/backgrounds/peonies.webp' },
  { id: 'rose-archway', label: 'Rose archway', src: '/std/backgrounds/rose-archway.webp' },
  { id: 'seascape', label: 'Open seascape', src: '/std/backgrounds/seascape.webp' },
  { id: 'starlit', label: 'Starlit night', src: '/std/backgrounds/starlit.webp' },
  { id: 'sunrise', label: 'Misty sunrise', src: '/std/backgrounds/sunrise.webp' },
  { id: 'bridgerton', label: 'Bridgerton', src: '/std/backgrounds/bridgerton.webp' },
  { id: 'ballroom', label: 'Candlelit ballroom', src: '/std/backgrounds/ballroom.webp' },
  { id: 'fairy-lights', label: 'Fairy-light garden', src: '/std/backgrounds/fairy-lights.webp' },
];

export type StdPaperBg = { id: string; label: string };

/** The 5 procedural paper textures (rendered in CSS at the picker/render layer). */
export const STD_PAPER_BACKGROUNDS: readonly StdPaperBg[] = [
  { id: 'ivory-linen', label: 'Ivory linen' },
  { id: 'cotton-deckle', label: 'Cotton deckle' },
  { id: 'champagne-marble', label: 'Champagne marble' },
  { id: 'kraft', label: 'Kraft' },
  { id: 'vellum', label: 'Vellum' },
];

export const STD_REALISTIC_IDS = STD_REALISTIC_BACKGROUNDS.map((b) => b.id);
export const STD_PAPER_IDS = STD_PAPER_BACKGROUNDS.map((b) => b.id);
