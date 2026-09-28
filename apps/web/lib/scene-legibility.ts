/**
 * apps/web/lib/scene-legibility.ts — A SCENE'S WORDS FOLLOW ITS OWN GROUND.
 *
 * Owner, 2026-09-25 (DECISION_LOG, "TEXT COLOUR ADAPTS TO EVERY BACKGROUND,
 * AUTOMATICALLY, FOR EVERY COUPLE (free)"). Build plan § 3: built once in
 * Phase 3 as `lib/hub-legibility.ts`, applied to scene backgrounds in Phase 5 —
 * this is that application, and it adds no rule of its own.
 *
 * 🔑 THE GUEST PAGE PAINTS THROUGH CHANNEL TOKENS. Every widget writes its ink
 * as `text-ink` / `text-ink/80` (= `rgb(var(--color-ink) / a)`), its eyebrow
 * as `--color-terracotta`, its gilt as `--color-gild`. So the legibility answer
 * is laid onto THOSE tokens on the scene's own frame, and every word inside —
 * the couple's template scene or any shipped widget given a colour ground —
 * changes with it. No widget had to learn about backgrounds.
 *
 * ⛔ NO ENTITLEMENT IS READ HERE, AND NONE MAY BE. Free couples change
 * background colours, so readable words can never be a paid feature. The only
 * inputs are the theme (for its own two inks) and the colour.
 *
 * Pure. No I/O.
 */
import {
  AA_BODY,
  compositeOver,
  contrastRatio,
  hubLegibility,
  type HubLegibility,
} from '@/lib/hub-legibility';
import type { InviteTheme } from '@/lib/invite-themes';
import { ombreCss, ombreLegibility, ombreRamp } from '@/lib/ombre';

/**
 * The bar every search below aims at: AA, plus a sliver for the browser's own
 * 8-bit rounding when it composites a pane — measured: a floor that cleared
 * 4.50 here painted 4.48 on the page. The tests still assert plain AA.
 */
const AA_TARGET = AA_BODY + 0.1;

/** `#rrggbb` → the `r g b` triplet the Tailwind channel tokens hold. */
function channels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** The Phase 3 answer for a scene on a flat colour — exported for the tests. */
export function sceneLegibility(theme: InviteTheme, groundHex: string): HubLegibility {
  return hubLegibility(theme, { kind: 'color', hex: groundHex });
}

/**
 * The grounds a scene's words can sit on inside its own box: a flat colour,
 * opaque glass, frosted glass — and `media`, a photo or snippet under the
 * shipped light scrim. ("No background" has no box: the words sit on the page
 * ground and keep the page's own tokens.)
 */
export type SceneTintKind = 'color' | 'diagonal' | 'glow' | 'glass' | 'frost' | 'media';

/**
 * 🖼 THE LIGHTEST POINT OF THE PHOTO / SNIPPET SCRIM — the white veil
 * `globals.css` lays over a scene photo or clip (`.hub-has-media` /
 * `.hub-bg-snippet`, 0.72 → 0.84; was 0.86 → 0.94 until the owner's *"yes a
 * bit lighter"*, 2026-09-29 answer 4). Measured, not guessed: over a BLACK
 * pixel every theme's scene ink still clears AA down to a 0.64 veil (the
 * palest, Whimsical); 0.72 keeps that margin — `scene-upload-media.test.ts`
 * holds it per theme. The words are measured over it laid on the
 * darkest and the lightest pixel a photo can have, so the ink holds over ANY
 * photo — a dark theme's light page ink would otherwise sit on a white veil.
 * `scene-words-follow-the-ground.test.ts` reads this number back out of the
 * stylesheet, so the two cannot drift.
 */
export const SCENE_MEDIA_SCRIM = 0.72;

/**
 * 🪟 HOW SOLID EACH GLASS IS, AT THE LEAST (owner 2026-09-27: *"opaque glass,
 * frosted glass does not work"*). Opaque glass is a MILKY pane — mostly solid,
 * a little of the page blurred through it, a sheen across the top. Frosted
 * glass is a TRANSLUCENT pane over a real blur of whatever lies behind the
 * scene. Each is only ever made MORE solid than this, and only as far as the
 * words need (`sceneTintGround`).
 */
export const SCENE_GLASS_ALPHA_FLOOR: Record<SceneTintKind, number> = { color: 1, diagonal: 1, glow: 1, glass: 0.86, frost: 0.5, media: 1 };
/** The white light across the top of an opaque pane — dropped when the words need it gone. */
export const SCENE_GLASS_SHEEN = 0.22;

/**
 * WHAT LIES BEHIND A TRANSLUCENT PANE IS NOT KNOWN HERE — the page ground, a
 * theme loop, the couple's main-background photo. So a pane is measured over
 * BOTH extremes: words that hold over black and over white behind the pane
 * hold over anything a guest's page can put there.
 */
const BEHIND = ['#000000', '#ffffff'] as const;

/** Every colour the words can sit on, for one pane at one opacity. */
export function sceneGroundSamples(
  kind: SceneTintKind,
  tint: string,
  alpha: number,
  sheen: number,
  /** An ombré's veil (the Main background's rule) — laid over every step of its ramp. */
  veil?: { color: string; opacity: number } | null,
): string[] {
  if (kind === 'color') return [tint];
  /* 🌅 An ombré is every colour of its ramp — the one the CSS paints — under its veil. */
  if (kind === 'diagonal' || kind === 'glow') {
    return ombreRamp({ shape: kind, base: tint }).map((c) =>
      veil && veil.opacity > 0 ? compositeOver(veil.color, veil.opacity, c) : c,
    );
  }
  if (kind === 'media') return BEHIND.map((pixel) => compositeOver('#ffffff', SCENE_MEDIA_SCRIM, pixel));
  const out: string[] = [];
  for (const behind of BEHIND) {
    const pane = compositeOver(tint, alpha, behind);
    out.push(pane);
    if (sheen > 0) out.push(compositeOver('#ffffff', sheen, pane));
  }
  return out;
}

function worstContrast(ink: string, samples: readonly string[]): number {
  return Math.min(...samples.map((s) => contrastRatio(ink, s)));
}

export type SceneTintGround = {
  kind: SceneTintKind;
  tint: string;
  /** How solid the pane is (1 = the colour itself). */
  alpha: number;
  /** The sheen across the top of an opaque pane (0 = none). */
  sheen: number;
  /** The colours the words can sit on — measured, never assumed. */
  samples: string[];
  /** The body ink, holding AA over every sample. */
  ink: string;
  /** The accent as text (eyebrows, links, CTAs) — the theme's own where it holds AA, else the ink. */
  accent: string;
  /** Plates inside the scene (`veil`, `paper-deep`): the ground, a shade toward the ink. */
  plate: string;
  /** The faintest a muted word (`text-ink/50`) may be here and still clear AA. */
  muteFloor: number;
  /** The worst body-text contrast over every sample. */
  bodyContrast: number;
  /** An ombré's veil (the Main background's rule), or null. */
  scrim?: { color: string; opacity: number } | null;
};

/**
 * 🔤 THE WORDS FOLLOW THE GROUND THEY ACTUALLY SIT ON — a flat colour AND both
 * glasses. The ink is the Phase 3 answer for the tint; the pane is then made
 * just solid enough (from its floor up) that the ink clears AA over every
 * colour the pane can show, so a frosted pane is as clear as the words allow
 * and no clearer. Where the sheen alone would cost AA, the sheen goes.
 */
export function sceneTintGround(
  theme: InviteTheme,
  kind: SceneTintKind,
  tintHex: string,
  /**
   * 🪟 THE COUPLE'S OWN OPACITY for a glass (20–100, the Format → Opacity row;
   * owner answer 5, *"both"*). It REPLACES the glass's floor as where the
   * search starts — and the pane is still made more solid only if the words
   * need it (rails on: never unreadable). Absent = the glass's own floor.
   */
  opacity?: number | null,
): SceneTintGround {
  /* Under the scrim a photo reads as a light ground, whatever the photo. */
  const tint = kind === 'media' ? '#ffffff' : tintHex;
  const leg = sceneLegibility(theme, tint);
  let ink = leg.ink;
  let alpha = 1;
  let sheen = 0;
  let scrim: { color: string; opacity: number } | null = null;
  /* 🌅 AN OMBRÉ RUNS LIGHTER AND DARKER THAN ITS COLOUR, so its words follow the
     Main background's OWN rule (`ombreLegibility` — the theme's ink over every
     colour of the ramp, and a veil only when no ink holds): one rule for the
     page's ombré and a scene's, never a second one. */
  if (kind === 'diagonal' || kind === 'glow') {
    const o = ombreLegibility(theme, { shape: kind, base: tint });
    ink = o.ink;
    scrim = o.scrim;
  }
  if (kind === 'glass' || kind === 'frost') {
    const own = typeof opacity === 'number' && opacity >= 20 && opacity <= 100 ? opacity / 100 : null;
    const floor = own ?? SCENE_GLASS_ALPHA_FLOOR[kind];
    const sheens = kind === 'glass' ? [SCENE_GLASS_SHEEN, 0] : [0];
    search: for (const s of sheens) {
      for (let step = Math.round(floor * 100); step <= 100; step++) {
        if (worstContrast(ink, sceneGroundSamples(kind, tint, step / 100, s)) >= AA_TARGET) {
          alpha = step / 100;
          sheen = s;
          break search;
        }
      }
    }
  }
  const samples = sceneGroundSamples(kind, tint, alpha, sheen, scrim);
  /* The accent as text only where it clears AA over the pane; else the ink. */
  const accent = worstContrast(leg.accent, samples) >= AA_TARGET ? leg.accent : ink;
  /* A plate is the ground a shade toward the ink — never so far that the ink
     on it drops below AA. */
  let plate = tint;
  for (let p = 8; p >= 0; p--) {
    const candidate = compositeOver(ink, p / 100, tint);
    if (contrastRatio(ink, candidate) >= AA_TARGET || p === 0) {
      plate = candidate;
      break;
    }
  }
  /* 🔅 MUTED WORDS KEEP AA TOO. The widgets soften secondary words with an
     alpha (`text-ink/50` — the countdown's DAYS · HOURS, a schedule's times).
     On a pale page that alpha is a gentle grey; on a translucent pane with
     just enough ink contrast it is unreadable. So the scene carries the lowest
     alpha its ground allows (over every sample, and over a plate on each), and
     `globals.css` lets no muted word inside it go fainter. */
  const grounds = samples.flatMap((s) => [s, ...[0.4, 0.6, 1].map((a) => compositeOver(plate, a, s))]);
  let muteFloor = 1;
  for (let step = 0; step <= 100; step++) {
    const a = step / 100;
    if (grounds.every((s) => contrastRatio(compositeOver(ink, a, s), s) >= AA_TARGET)) {
      muteFloor = a;
      break;
    }
  }
  return { kind, tint, alpha, sheen, samples, ink, accent, plate, muteFloor, bodyContrast: worstContrast(ink, samples), scrim };
}

/**
 * The custom properties a scene frame with a colour or glass ground carries —
 * the legibility answer on the channel tokens the words are actually painted
 * with, and the pane itself. Only tokens a rule READS.
 *
 *   · `--color-ink` (and the plate ink) → the readable ink; `--color-terracotta`
 *     (`-600`, `-700`), `--color-gild`, `--color-mulberry` (`-600`, `-700`) →
 *     the accent as text. Every `text-ink/…`, eyebrow, link and CTA inside.
 *   · `--color-cream` / `--color-paper` → the ground itself, and `--color-veil`
 *     / `--color-paper-deep` → the plate. A widget's own chips, plates and
 *     cards (`bg-cream`, `bg-veil/60`, `.pahina-plate`) become shades of THIS
 *     ground, so no light card is left holding light words on a dark scene,
 *     and `text-cream` on a `bg-ink` button stays a readable pair.
 *   · `color` → the ink, so words that set no colour of their own (the
 *     countdown's numerals) follow too, instead of keeping the page's.
 *   · `--hub-mute-floor` → the faintest a softened word (`text-ink/50`) may
 *     be on this ground; `globals.css` holds every muted word to it.
 *   · `--hub-glass-fill` / `--hub-glass-sheen` → the pane `globals.css` paints.
 *
 * ⛔ `--color-ink-on-light` is NOT touched: it is the ink for a surface that
 * stays light whatever the ground (a map tile), and it must stay dark.
 */
export function sceneLegibilityVars(
  theme: InviteTheme,
  groundHex: string,
  kind: SceneTintKind = 'color',
  /** A glass's own opacity (20–100) — see `sceneTintGround`. */
  opacity?: number | null,
): Record<string, string> {
  const g = sceneTintGround(theme, kind, groundHex, opacity);
  const ink = channels(g.ink);
  const accent = channels(g.accent);
  const ground = channels(g.tint);
  const plate = channels(g.plate);
  return {
    '--color-ink': ink,
    '--color-ink-on-plate': ink,
    '--color-terracotta': accent,
    '--color-terracotta-600': accent,
    '--color-terracotta-700': accent,
    '--color-gild': accent,
    '--color-mulberry': accent,
    '--color-mulberry-600': accent,
    '--color-mulberry-700': accent,
    '--color-cream': ground,
    '--color-paper': ground,
    '--color-veil': plate,
    '--color-paper-deep': plate,
    color: `rgb(${ink})`,
    '--hub-mute-floor': g.muteFloor.toFixed(2),
    /* 🌅 An ombré that needed a veil wears it in its own gradient. */
    ...((kind === 'diagonal' || kind === 'glow') && g.scrim && g.scrim.opacity > 0
      ? { '--hub-bg-image': ombreCss({ shape: kind, base: g.tint }, g.scrim) }
      : {}),
    ...(kind !== 'glass' && kind !== 'frost'
      ? {}
      : {
          '--hub-glass-fill': `rgb(${ground} / ${g.alpha.toFixed(2)})`,
          '--hub-glass-sheen': g.sheen.toFixed(2),
        }),
  };
}
