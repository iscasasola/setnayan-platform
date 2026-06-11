/**
 * Spatial RSVP backdrop — pure logic (no React, no server imports).
 *
 * The couple's RSVP page can sit on an AI-generated "world": layered scene
 * imagery rendered FIXED behind the page content. As the guest scrolls, each
 * layer transforms at a different rate (push-in scale + parallax rise), so the
 * scroll reads as a camera moving THROUGH the generated space — and, for
 * two-scene themes, traveling across a seam INTO a second space (scene A
 * scales up + fades past the camera while scene B settles in beneath it).
 * That seam is the "spatial transition" the owner asked for (2026-06-11):
 * explicitly NOT a Keynote-style slide/dissolve between flat images, and NOT
 * the couple's love-story clips — an ambient generated backdrop for the whole
 * RSVP phase, with the page content floating on a translucent vellum panel.
 *
 * Spec: corpus `Wedding_Website_Effects_and_Editing_Spec_2026-06-11.md` §2.1b.
 *
 * WHY this file is pure TS: the math invariants (opacity bounds, monotonic
 * push-in, no blank gap across the seam) are asserted by
 * `tests/e2e/spatial-backdrop-math.spec.ts`, which imports this module
 * directly in node — keeping React/Next out makes that import trivial and the
 * math independently testable.
 *
 * Theme assets are static files under `public/spatial/<theme>/` (generated
 * with Recraft, the configured image backend — see the asset README there).
 * The DB stores ONLY `{ theme, intensity }` (events.rsvp_backdrop JSONB,
 * migration 20261105000000) — never asset URLs, so a hostile row can't inject
 * arbitrary image sources into the public page.
 */

export type SpatialIntensity = 'subtle' | 'standard' | 'lavish';

export type RsvpBackdropConfig = {
  theme: SpatialThemeKey;
  intensity: SpatialIntensity;
};

export type SpatialLayer = {
  /** Static asset path under /public. */
  src: string;
  /**
   * 0..1 — how close the layer is to the camera. Far scenery ≈ 0.15 (moves
   * little), near glow/bokeh = 1 (moves fast, passes the camera). Drives the
   * per-layer parallax + push-in coefficients.
   */
  depth: number;
  /**
   * CSS blend for compositing the layer over the one beneath it. The near
   * bokeh/glow layers are generated as lights-on-black and composited with
   * 'screen', which keeps only the glow — no alpha-channel assets needed
   * (Recraft outputs opaque WebP; this is the alpha-free layering trick).
   */
  blend: 'normal' | 'screen';
};

export type SpatialScene = {
  layers: SpatialLayer[];
};

export type SpatialTheme = {
  label: string;
  description: string;
  /** Thumbnail for the editor's theme picker. */
  thumb: string;
  /** 1 or 2 scenes; 2-scene themes travel across the seam as you scroll. */
  scenes: SpatialScene[];
};

/**
 * Theme registry. Asset convention: /spatial/<key>/{a,b}-{far,near}.webp.
 * Far layers are 1820×1024 scenes; near layers are 1024×1024 lights-on-black
 * composited with 'screen' (see SpatialLayer.blend).
 */
export const SPATIAL_THEMES = {
  'gilded-dusk': {
    label: 'Gilded Dusk',
    description:
      'A twilight garden strung with champagne lights — scrolling carries you deeper under the canopy.',
    thumb: '/spatial/gilded-dusk/a-far.webp',
    scenes: [
      {
        layers: [
          { src: '/spatial/gilded-dusk/a-far.webp', depth: 0.15, blend: 'normal' },
          { src: '/spatial/gilded-dusk/a-near.webp', depth: 1, blend: 'screen' },
        ],
      },
      {
        layers: [
          { src: '/spatial/gilded-dusk/b-far.webp', depth: 0.15, blend: 'normal' },
          { src: '/spatial/gilded-dusk/b-near.webp', depth: 1, blend: 'screen' },
        ],
      },
    ],
  },
  'capiz-glow': {
    label: 'Capiz Glow',
    description:
      'Capiz parol lanterns at dusk give way to a starlit sea as you scroll.',
    thumb: '/spatial/capiz-glow/a-far.webp',
    scenes: [
      {
        layers: [
          { src: '/spatial/capiz-glow/a-far.webp', depth: 0.15, blend: 'normal' },
          { src: '/spatial/capiz-glow/a-near.webp', depth: 1, blend: 'screen' },
        ],
      },
      {
        layers: [
          { src: '/spatial/capiz-glow/b-far.webp', depth: 0.15, blend: 'normal' },
          { src: '/spatial/capiz-glow/b-near.webp', depth: 1, blend: 'screen' },
        ],
      },
    ],
  },
} as const satisfies Record<string, SpatialTheme>;

export type SpatialThemeKey = keyof typeof SPATIAL_THEMES;

export const SPATIAL_THEME_KEYS = Object.keys(SPATIAL_THEMES) as SpatialThemeKey[];

/**
 * Scroll-distance multiplier per intensity. The couple picks a word, never a
 * number — these are the only knobs (UX lock: no easing/keyframe editing).
 */
export const INTENSITY_FACTOR: Record<SpatialIntensity, number> = {
  subtle: 0.6,
  standard: 1,
  lavish: 1.45,
};

const INTENSITIES: SpatialIntensity[] = ['subtle', 'standard', 'lavish'];

export function isSpatialThemeKey(v: unknown): v is SpatialThemeKey {
  return typeof v === 'string' && v in SPATIAL_THEMES;
}

/**
 * Parse the events.rsvp_backdrop JSONB into a safe config, or null.
 * Forgiving on intensity (unknown → 'standard') so a future intensity rename
 * degrades instead of killing the backdrop; strict on theme (unknown → null)
 * because an unknown theme has no assets to render.
 */
export function parseRsvpBackdropConfig(raw: unknown): RsvpBackdropConfig | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (!isSpatialThemeKey(obj.theme)) return null;
  const intensity = INTENSITIES.includes(obj.intensity as SpatialIntensity)
    ? (obj.intensity as SpatialIntensity)
    : 'standard';
  return { theme: obj.theme, intensity };
}

/* ───────────────────────────── scroll math ───────────────────────────── */

export type LayerVisualState = {
  /** CSS scale — the push-in. */
  scale: number;
  /** vh units, negative = rises toward/past the camera. */
  translateYvh: number;
  /** 0..1 — scene fades × near-layer pass-the-camera falloff. */
  opacity: number;
};

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Hermite smoothstep on [0,1] — all fades use it so seams have no kinks. */
export function smoothstep(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export type SceneWindow = { enter: number; exit: number };

/**
 * Where each scene lives on the 0..1 scroll track. Two-scene themes overlap
 * on [0.45, 0.62] — the spatial seam where A exits past the camera while B
 * settles in. Single-scene themes own the whole track. (N>2 generalizes with
 * even segments + fixed overlap, kept total so a future 3-scene theme can't
 * crash the renderer.)
 */
export function sceneWindows(count: number): SceneWindow[] {
  if (count <= 1) return [{ enter: 0, exit: 1 }];
  if (count === 2) {
    return [
      { enter: 0, exit: 0.62 },
      { enter: 0.45, exit: 1 },
    ];
  }
  const seg = 1 / count;
  const half = 0.075;
  return Array.from({ length: count }, (_, i) => ({
    enter: Math.max(0, i * seg - half),
    exit: Math.min(1, (i + 1) * seg + half),
  }));
}

/** Fraction of a scene window spent fading in/out at the seams. */
const FADE = 0.3;
/** How long an arriving scene takes to settle from its small entry scale. */
const SETTLE = 0.35;

/**
 * The whole effect, as one pure function: given page scroll progress p (0..1),
 * which scene a layer belongs to, the layer depth, and the intensity factor,
 * return the layer's transform + opacity.
 *
 * Camera model:
 *  - Within a scene, everything scales UP as you scroll (push-in); deeper
 *    (near) layers scale and rise faster — that differential is the parallax
 *    that makes the flat layers read as a 3D space.
 *  - A non-first scene enters slightly small (0.86) and settles to 1 over the
 *    first SETTLE of its window — you arrive INTO it.
 *  - A non-last scene fades out over its last FADE while still scaling up —
 *    it passes the camera. The overlap with the next scene's fade-in is the
 *    spatial seam; sceneWindows guarantees they overlap so the backdrop never
 *    goes blank (asserted in the math spec).
 *  - Near layers (depth > 0.8) additionally lose 85% opacity over the back
 *    half of their scene — bokeh that drifts past your shoulder.
 */
export function computeLayerState(args: {
  p: number;
  sceneIndex: number;
  sceneCount: number;
  depth: number;
  intensity: SpatialIntensity;
}): LayerVisualState {
  const { sceneIndex, sceneCount, depth } = args;
  const k = INTENSITY_FACTOR[args.intensity];
  const p = clamp01(args.p);
  const windows = sceneWindows(sceneCount);
  // Total even on out-of-range indices (a future theme bug degrades to the
  // full-track window instead of crashing the public page).
  const w = windows[Math.min(sceneIndex, windows.length - 1)] ?? { enter: 0, exit: 1 };
  const span = Math.max(0.0001, w.exit - w.enter);
  const t = clamp01((p - w.enter) / span);

  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex === sceneCount - 1;

  // Scene-level fades.
  const fadeIn = isFirst ? 1 : smoothstep(t / FADE);
  const fadeOut = isLast ? 1 : 1 - smoothstep((t - (1 - FADE)) / FADE);
  let opacity = fadeIn * fadeOut;

  // Hard zero outside the window (so lazy scenes are fully hidden).
  if (p < w.enter || p > w.exit) {
    opacity = isLast && p > w.exit ? 1 : isFirst && p < w.enter ? 1 : 0;
  }

  // Near layers pass the camera within their scene.
  if (depth > 0.8) {
    opacity *= 1 - 0.85 * smoothstep((t - 0.5) / 0.5);
  }

  // Push-in scale: entry settle (arriving scenes) + monotonic push.
  const settle = isFirst ? 1 : 0.86 + 0.14 * smoothstep(t / SETTLE);
  const scale = settle + t * (0.15 + 0.45 * depth) * k;

  // Parallax rise; arriving scenes start a touch low and drift up into place.
  const entryDrift = isFirst ? 0 : (1 - smoothstep(t / SETTLE)) * 6;
  const translateYvh = -t * depth * 26 * k + entryDrift;

  return { scale, translateYvh, opacity: clamp01(opacity) };
}
