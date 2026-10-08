/**
 * lib/scene-media-shade.ts — 🌗 DARKER ↔ LIGHTER ON ONE SCENE'S PHOTO OR CLIP
 * (owner 2026-10-07, DECISION_LOG "STAGES PANEL REDRAW APPROVED … THREE
 * FOLLOW-UPS AS ONE STEP"; prototype Style › Background `SHADE` — Darker · As is
 * · Lighter, *"never below the readable floor"*).
 *
 * THE SHIPPED RULE, NOT A NEW ONE — `lib/main-ground-shade.ts` (#6395) for the
 * main background, applied to a scene's own picture:
 *
 *   · As is    the scene's shipped light scrim (`SCENE_MEDIA_SCRIM`), unchanged —
 *              and an absence (`HubSectionCanvas.shade` unset).
 *   · Lighter  more of the same paper veil — the words stay the ink. Its floor is
 *              above As is, so it is only ever MORE legible.
 *   · Darker   a veil of the theme's dark ink, as strong as `requiredScrim` says
 *              the theme's LIGHT ink needs over the darkest AND the lightest pixel
 *              a picture can have (black and white) — started from the step's own
 *              floor, never under AA. The words then flip light: the scene's
 *              legibility tokens are the shipped `sceneLegibilityVars` for the
 *              lightest colour the veil can leave (the worst case for light words).
 *
 * Pure. Held by `lib/scene-media-shade.test.ts`.
 */
import { AA_BODY, compositeOver, contrastRatio, requiredScrim } from '@/lib/hub-legibility';
import type { HubSceneShade } from '@/lib/hub-canvas';
import type { InviteTheme } from '@/lib/invite-themes';
import { SCENE_MEDIA_SCRIM, sceneLegibilityVars } from '@/lib/scene-legibility';

/** The pixels a picture can hold at its extremes — a veil that holds over both holds over any photo. */
const EXTREMES = ['#000000', '#ffffff'] as const;

/** Each step's veil and the least of it the step always lays (readability may need more). */
const STEP: Readonly<Record<HubSceneShade, { veil: 'dark' | 'paper'; floor: number; to: number }>> = {
  darker: { veil: 'dark', floor: 0.55, to: 0.12 },
  lighter: { veil: 'paper', floor: 0.86, to: 0.08 },
};

export type SceneMediaShade = {
  /** The veil's colour and its strength at the top (0…1); the foot is `opacityEnd`. */
  veil: string;
  opacity: number;
  opacityEnd: number;
  /** The colour the words take over it. */
  text: string;
  /** The worst body contrast over the extremes, with the veil on. */
  bodyContrast: number;
};

export function sceneMediaShade(step: HubSceneShade, theme: InviteTheme): SceneMediaShade {
  const s = STEP[step];
  const dark = theme.palette.darkInk;
  const light = theme.palette.lightInk;
  const veil = s.veil === 'dark' ? dark : '#ffffff';
  /* Over the paper veil the words are the theme's dark ink (what the shipped scrim's legibility picks over white);
     over a dark veil, its light ink. */
  const text = s.veil === 'dark' ? light : dark;
  const opacity = requiredScrim(text, veil, EXTREMES, Math.max(s.floor, step === 'lighter' ? SCENE_MEDIA_SCRIM : 0), AA_BODY);
  const opacityEnd = Math.min(1, opacity + s.to);
  const bodyContrast = Math.min(...EXTREMES.map((px) => contrastRatio(text, compositeOver(veil, opacity, px))));
  return { veil, opacity, opacityEnd, text, bodyContrast };
}

/** `#rrggbb` → `r g b`. */
function channels(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * The frame's custom properties for one step: the veil `globals.css` paints
 * (`--hub-scrim-top` / `--hub-scrim-end`, read with the shipped white scrim as
 * their fallback) and the words' tokens over it.
 */
export function sceneMediaShadeVars(step: HubSceneShade, theme: InviteTheme): Record<string, string> {
  const r = sceneMediaShade(step, theme);
  const c = channels(r.veil);
  const veil = {
    '--hub-scrim-top': `rgb(${c} / ${r.opacity.toFixed(2)})`,
    '--hub-scrim-end': `rgb(${c} / ${r.opacityEnd.toFixed(2)})`,
  };
  if (step === 'lighter') return { ...sceneLegibilityVars(theme, '#ffffff', 'media'), ...veil };
  /* The words were measured over the LIGHTEST the veil can leave (a white pixel, `sceneMediaShade`); the
     scene's tokens — its light ink, and the plates inside it — are drawn for the veil over a mid-tone photo,
     so a plate reads as a darker pane of the picture, not a grey box. */
  const ground = compositeOver(r.veil, r.opacity, '#4a4540');
  return { ...sceneLegibilityVars(theme, ground, 'color'), ...veil };
}
