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

export type StdRealisticBg = {
  id: string;
  label: string;
  src: string;
  /** Measured relative luminance (0=black…1=white) of the centre text region —
   *  drives Smart Auto's text tone. Computed once with sharp over the generated
   *  asset (centre 64% crop); see DECISION_LOG 2026-06-19. */
  lum: number;
};

/** The 10 generated photoreal scenes (public/std/backgrounds/*.webp). */
export const STD_REALISTIC_BACKGROUNDS: readonly StdRealisticBg[] = [
  { id: 'aurora', label: 'Aurora borealis', src: '/std/backgrounds/aurora.webp', lum: 0.512 },
  { id: 'golden-hour', label: 'Golden hour', src: '/std/backgrounds/golden-hour.webp', lum: 0.462 },
  { id: 'peonies', label: 'Peony field', src: '/std/backgrounds/peonies.webp', lum: 0.491 },
  { id: 'rose-archway', label: 'Rose archway', src: '/std/backgrounds/rose-archway.webp', lum: 0.360 },
  { id: 'seascape', label: 'Open seascape', src: '/std/backgrounds/seascape.webp', lum: 0.349 },
  { id: 'starlit', label: 'Starlit night', src: '/std/backgrounds/starlit.webp', lum: 0.547 },
  { id: 'sunrise', label: 'Misty sunrise', src: '/std/backgrounds/sunrise.webp', lum: 0.822 },
  { id: 'bridgerton', label: 'Bridgerton', src: '/std/backgrounds/bridgerton.webp', lum: 0.481 },
  { id: 'ballroom', label: 'Candlelit ballroom', src: '/std/backgrounds/ballroom.webp', lum: 0.382 },
  { id: 'fairy-lights', label: 'Fairy-light garden', src: '/std/backgrounds/fairy-lights.webp', lum: 0.385 },
];

/** Measured centre luminance of a realistic scene (Smart Auto). */
export function sceneLuminance(id: string): number | null {
  return STD_REALISTIC_BACKGROUNDS.find((b) => b.id === id)?.lum ?? null;
}

/** A photo this bright (or brighter) gets DARK text; below it, LIGHT text. Light
 *  text on a dark localized scrim is the robust premium default; only genuinely
 *  bright/airy scenes (e.g. misty sunrise) flip to dark text. */
export const LUM_DARK_TEXT_THRESHOLD = 0.7;

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

export function realisticBgSrc(id: string): string | null {
  return STD_REALISTIC_BACKGROUNDS.find((b) => b.id === id)?.src ?? null;
}

/**
 * Legibility mode — how the background is treated so the names/dates always
 * read on top (the film's text colour follows): 'lighten' washes a cream veil
 * over it (→ dark text), 'darken' drops a dark veil (→ light text), 'auto'
 * picks per background. Stored on std_background; defaults to 'auto'.
 */
export type StdLegibility = 'auto' | 'lighten' | 'darken';

/** The couple's chosen background (events.std_background JSONB). */
export type StdBackground = {
  kind: StdBackgroundKind;
  /** plain → hex · paper → paper id · realistic → scene id · upload → R2 key. */
  value: string;
  /** Readability treatment (default 'auto'). */
  legibility?: StdLegibility;
};

/** Resolved legibility: the veil to lay over the background + the text tone the
 *  film should use on top. The two ALWAYS pair so text is readable. */
export type StdVeil = 'none' | 'light' | 'dark';
export type StdTextTone = 'light' | 'dark';

/** Relative luminance (0=black … 1=white) of a #rgb/#rrggbb colour. */
function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return 1; // unknown → treat as light (dark text)
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Resolve the legibility treatment for a background → { veil, tone }.
 *
 *  - 'lighten' → a cream wash veil + dark text (airy / editorial).
 *  - 'darken'  → a dark veil + light text (reads over ANY busy photo).
 *  - 'auto'    → plain: by colour luminance (no veil, tone follows) ·
 *                paper: light surface → dark text, no veil ·
 *                realistic / upload: darken + light text (the safe universal
 *                choice over an unknown/busy photo).
 */
export function resolveStdLegibility(bg: StdBackground): { veil: StdVeil; tone: StdTextTone } {
  const mode = bg.legibility ?? 'auto';
  if (mode === 'lighten') return { veil: 'light', tone: 'dark' };
  if (mode === 'darken') return { veil: 'dark', tone: 'light' };
  // auto — measured: plain by its hex, realistic by its baked luminance, paper is
  // a light surface, upload defaults to the robust light-text choice. Photos get
  // NO global veil — the film's localized text scrim (which always pairs with the
  // tone) does the work, so the photo stays vivid.
  if (bg.kind === 'plain') {
    return hexLuminance(bg.value) >= LUM_DARK_TEXT_THRESHOLD
      ? { veil: 'none', tone: 'dark' }
      : hexLuminance(bg.value) < 0.5
        ? { veil: 'none', tone: 'light' }
        : { veil: 'none', tone: 'dark' };
  }
  if (bg.kind === 'paper') return { veil: 'none', tone: 'dark' };
  if (bg.kind === 'realistic') {
    const lum = sceneLuminance(bg.value) ?? 0.4;
    return { veil: 'none', tone: lum >= LUM_DARK_TEXT_THRESHOLD ? 'dark' : 'light' };
  }
  // upload — luminance unknown server-side; light text + the localized dark scrim
  // reads over ANY photo (the safe universal). Manual Lighten flips it for taste.
  return { veil: 'none', tone: 'light' };
}

export const DEFAULT_PLAIN_COLOR = '#f3ece1';

/** Elegant plain-colour presets (the couple can also use the native picker). */
export const STD_PLAIN_PRESETS: readonly string[] = [
  '#f3ece1', // alabaster
  '#efe7d6', // champagne
  '#e7dcce', // sand
  '#f0e7ec', // blush
  '#e9eee7', // sage mist
  '#3a2e26', // espresso
  '#26213a', // midnight
  '#5c2542', // mulberry
];

type PaperSpec = { baseColor: string; tint: string };
const PAPER_SPECS: Record<string, PaperSpec> = {
  'ivory-linen': { baseColor: '#f1e9da', tint: '#e3d8c2' },
  'cotton-deckle': { baseColor: '#f6f1e8', tint: '#e9e0cf' },
  'champagne-marble': { baseColor: '#efe7d6', tint: '#d8c9a8' },
  kraft: { baseColor: '#d8c4a0', tint: '#c2a877' },
  vellum: { baseColor: '#eef0e9', tint: '#dde2d6' },
};

// Shared procedural grain — a tiny tiling SVG fractal-noise data-URI. Seamless,
// recolourable, weightless — the right tool for subtle paper texture (Recraft's
// realistic model only ever produced product flat-lays; see DECISION_LOG 2026-06-19).
const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

/** Procedural CSS for a paper style — base tone + grain + a subtle per-style weave/veining. */
export function paperBackgroundStyle(id: string): {
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
} {
  const spec = PAPER_SPECS[id] ?? PAPER_SPECS['ivory-linen']!;
  let pattern: string;
  let size: string;
  switch (id) {
    case 'ivory-linen':
      pattern = `repeating-linear-gradient(0deg, ${spec.tint}22 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${spec.tint}22 0 1px, transparent 1px 3px), `;
      size = 'auto, auto, 140px 140px';
      break;
    case 'champagne-marble':
      pattern = `radial-gradient(120% 80% at 28% 18%, ${spec.tint}38, transparent 55%), radial-gradient(100% 70% at 76% 82%, ${spec.tint}2c, transparent 50%), `;
      size = 'auto, auto, 140px 140px';
      break;
    case 'kraft':
      pattern = `radial-gradient(${spec.tint}26 1px, transparent 1px), `;
      size = '4px 4px, 140px 140px';
      break;
    case 'cotton-deckle':
      pattern = `radial-gradient(${spec.tint}1c 1px, transparent 1px), `;
      size = '5px 5px, 140px 140px';
      break;
    default:
      pattern = `linear-gradient(135deg, ${spec.tint}16, transparent 60%), `;
      size = 'auto, 140px 140px';
  }
  return {
    backgroundColor: spec.baseColor,
    backgroundImage: `${pattern}${PAPER_NOISE}`,
    backgroundSize: size,
  };
}

/** Parse + validate events.std_background → a safe StdBackground (falls back to plain). */
export function resolveStdBackground(raw: unknown, fallbackColor = DEFAULT_PLAIN_COLOR): StdBackground {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const value = typeof o.value === 'string' ? o.value : '';
    const legibility: StdLegibility =
      o.legibility === 'lighten' || o.legibility === 'darken' ? o.legibility : 'auto';
    if (o.kind === 'plain' && /^#[0-9a-fA-F]{3,8}$/.test(value)) return { kind: 'plain', value, legibility };
    if (o.kind === 'paper' && STD_PAPER_IDS.includes(value)) return { kind: 'paper', value, legibility };
    if (o.kind === 'realistic' && STD_REALISTIC_IDS.includes(value)) return { kind: 'realistic', value, legibility };
    if (o.kind === 'upload' && value) return { kind: 'upload', value, legibility };
  }
  return { kind: 'plain', value: fallbackColor, legibility: 'auto' };
}
