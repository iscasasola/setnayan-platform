/**
 * lib/adaptive-theme.ts — THE THEME FOLLOWS THE COUPLE'S OWN BACKGROUND.
 *
 * Owner, 2026-09-25 (DECISION_LOG "ADAPTIVE THEME"): *"if they follow a theme and
 * decide to change the background video to their own, how can we adapt everything
 * else to it. is that possible?"* → *"we can do this at no cost"*. And, on the
 * Event Hub Pro list: *"Adaptive theme is for PRO – i like this"*.
 *
 * So when the page behind every scene is the couple's OWN media instead of their
 * theme's loop — by default their HERO (owner 2026-09-25: "whatever they make on
 * the hero scene will be their cover and the main background"), or an opt-in
 * override clip or photo (`lib/hub-canvas.ts` `resolveMainGround`) — the theme's
 * accent, its button and its ornament tint move toward the colours of THEIR
 * footage. Fonts, ornaments' shapes, the reveal, the transitions and the motion
 * do not move.
 *
 * ── WHAT IS STORED, AND WHY IT IS THE FRAME AND NOT THE ANSWER ─────────────
 * `canvas.tint` holds the couple's toggle and the MEASURED FRAME (a handful of
 * hex colours read off their clip in the browser), never the tinted hexes. The
 * tint is derived here, at render, from the frame AND THE THEME — because a
 * couple can change theme after they upload. A stored "#8b3a2a button" worked
 * out against Modern's paper would be wrong on Luxe's, and nothing would say so.
 * The frame is a fact about their footage; the tint is an opinion about how that
 * footage meets a theme, so it is recomputed every time.
 *
 * ── WHAT IS FREE AND WHAT IS PRO ─────────────────────────────────────────────
 * The SCRIM (`mainGroundLegibility`) is legibility, and legibility is free for
 * every couple (owner 2026-09-25, `lib/hub-legibility.ts`): it is computed from
 * the frame whatever the toggle says. The TINT (`adaptiveTint`) is the Pro
 * part — but the gate is not here. A couple can only have an own-media Main
 * background by Applying it, and Apply refuses a Pro key without Pro
 * (`lib/hub-draft.ts` `planHubDraftApply`). This file reads no entitlement.
 *
 * ── THE CONTRACT EVERY TINTED COLOUR KEEPS ───────────────────────────────────
 *   · button fill   — its label is the page paper (`text-cream`), so the fill
 *                     clears 4.5:1 against the paper, or the theme's own button
 *                     stays (`hubThemePageTokens`' own rule for `cta`);
 *   · accent text   — eyebrows and gilt lines: 4.5:1 against the paper AND over
 *                     the couple's frame once the scrim is laid on it, or the
 *                     theme's own accent stays;
 *   · ornament      — decoration (rules, frames, the material's `--accent`):
 *                     hue follows, lightness keeps the theme's.
 * A colour that cannot keep its contract is not tinted. It never gets harder to
 * read than the theme made it.
 *
 * ⚠ WHY NOT `extractPaletteFromFile` (`lib/extract-palette.ts`) for the frame.
 * It is the Mood Board's six-swatch picker and does that job well, but for THIS
 * job it hides exactly what matters: it skips every near-black and near-white
 * pixel, and when a frame has fewer than six colours it PADS the list with fixed
 * cream tones. The darkest and lightest pixels are the ones words fail over, and
 * a cream pad would read a grey clip as warm — a tint invented by the picker, not
 * found in the footage. `measureFrame` reads every pixel, keeps the extremes, and
 * never pads. The Mood Board extractor is unchanged.
 *
 * Pure. No I/O. No DOM. Client-safe — the Maker panel and the guest render call
 * the same functions, so the preview and the page cannot disagree.
 */
import { oklchOfHex, hexOfOklch } from '@/lib/color-space';
import { AA_BODY, compositeOver, contrastRatio, relativeLuminance, requiredScrim } from '@/lib/hub-legibility';
import { HOUSE_INK, HOUSE_PAPER, channels, hubThemePageTokens } from '@/lib/hub-theme-tokens';
import type { InviteTheme } from '@/lib/invite-themes';

/* ═══════════════════════════════════════════════════════════════════════════
   THE STORED SHAPE — `canvas.tint`
   ═══════════════════════════════════════════════════════════════════════════ */

/** How many measured colours a frame keeps: five dominant + the lightest + the darkest, and a spare. */
export const HUB_TINT_FRAME_MAX = 8;

export type HubTint = {
  /**
   * "Match my video's colours" (true — the default) or "Keep the theme's
   * colours" (false). Off restores the theme's own accent, button and ornament;
   * the frame stays, so switching it back on needs no second upload.
   */
  match: boolean;
  /**
   * The frame as measured (`measureFrame`): `#rrggbb`, dominant colours first,
   * then the lightest and the darkest. 1 … `HUB_TINT_FRAME_MAX`.
   */
  frame: string[];
};

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Anything → a `HubTint`, or null. Drops rather than repairs (the canvas rule):
 * a frame with one bad colour is not a frame — keeping the rest would silently
 * change which colour reads as "dominant".
 */
export function sanitizeHubTint(raw: unknown): HubTint | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  if (!Array.isArray(src.frame) || src.frame.length === 0 || src.frame.length > HUB_TINT_FRAME_MAX) return null;
  const frame: string[] = [];
  for (const v of src.frame) {
    if (typeof v !== 'string') return null;
    const hex = v.trim().toLowerCase();
    if (!HEX.test(hex)) return null;
    frame.push(hex);
  }
  // Absent `match` is the default, ON — the owner's "default on".
  return { match: src.match !== false, frame };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEASURING A FRAME — pixels in, a handful of colours out
   ═══════════════════════════════════════════════════════════════════════════ */

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;

/** Relative luminance of one 0–255 pixel — the same curve `hub-legibility.ts` uses. */
function lumOf(r: number, g: number, b: number): number {
  const ch = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/**
 * A frame's pixels (RGBA, as `getImageData` returns them) → the colours that
 * describe it: the five most common colours (4-bit buckets, averaged), then the
 * mean of the lightest 5 % and of the darkest 5 % of pixels — the "measured
 * lightest and darkest clusters" the theme loops already carry, so a couple's
 * own clip is judged exactly the way ours were.
 *
 * Transparent pixels are skipped. Duplicates collapse. Never padded: a flat
 * frame returns one colour, and one colour is the truth about it.
 */
export function measureFrame(pixels: ArrayLike<number>, width: number, height: number): string[] {
  const n = Math.min(Math.floor(pixels.length / 4), Math.max(0, width * height));
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const lums: Array<{ l: number; i: number }> = [];
  for (let p = 0; p < n; p += 1) {
    const i = p * 4;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const a = pixels[i + 3] ?? 255;
    if (a < 128) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else buckets.set(key, { count: 1, r, g, b });
    lums.push({ l: lumOf(r, g, b), i });
  }
  if (lums.length === 0) return [];

  const out: string[] = [];
  const push = (hex: string) => {
    if (!out.includes(hex) && out.length < HUB_TINT_FRAME_MAX) out.push(hex);
  };
  const dominant = [...buckets.values()].sort((x, y) => y.count - x.count).slice(0, 5);
  for (const d of dominant) push(toHex(d.r / d.count, d.g / d.count, d.b / d.count));

  lums.sort((x, y) => x.l - y.l);
  const tail = Math.max(1, Math.round(lums.length * 0.05));
  const mean = (slice: Array<{ i: number }>) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const { i } of slice) {
      r += pixels[i]!;
      g += pixels[i + 1]!;
      b += pixels[i + 2]!;
    }
    return toHex(r / slice.length, g / slice.length, b / slice.length);
  };
  push(mean(lums.slice(lums.length - tail)));
  push(mean(lums.slice(0, tail)));
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CAST — which way the footage leans
   ═══════════════════════════════════════════════════════════════════════════ */

/** Below this OKLCH chroma the footage has no hue worth following (a grey clip). */
export const NEUTRAL_CAST_CHROMA = 0.025;

/**
 * The footage's colour cast: the dominant colours averaged in OKLab (so hues
 * cancel honestly — a red and a green frame averages grey, not yellow), the most
 * common weighted most. `null` when the footage is effectively neutral.
 *
 * Only the dominant colours vote. The lightest and darkest (the last two of the
 * frame) are for contrast; a single hot highlight must not decide the button.
 */
export function frameCast(frame: readonly string[]): { H: number; C: number } | null {
  const voters = frame.length > 2 ? frame.slice(0, frame.length - 2) : frame;
  let a = 0;
  let b = 0;
  let w = 0;
  voters.forEach((hex, i) => {
    const o = oklchOfHex(hex);
    const weight = voters.length - i;
    a += o.a * weight;
    b += o.b * weight;
    w += weight;
  });
  if (w === 0) return null;
  a /= w;
  b /= w;
  const C = Math.hypot(a, b);
  if (C < NEUTRAL_CAST_CHROMA) return null;
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { H, C };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEGIBILITY OVER THE COUPLE'S FRAME — free, whatever the toggle says
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Past half, the veil shows more paper than footage: the words only read because
 * most of the clip is covered — so the couple is told a calmer one will show
 * more of itself. A DESIGN CALL, not a measurement, and it governs no money;
 * the legibility itself never depends on it (the scrim rises regardless).
 */
export const CALMER_CLIP_SCRIM = 0.5;

/** The page paper and ink a theme paints — House keeps today's white page. */
export function pagePaperAndInk(theme: InviteTheme): { paper: string; ink: string } {
  if (theme.id === 'house') return { paper: HOUSE_PAPER, ink: HOUSE_INK };
  const t = hubThemePageTokens(theme);
  return { paper: t.canvas, ink: t.ink };
}

export type MainGroundLegibility = {
  /** 0…1 — the page paper laid over the couple's media (`--color-cream` at this strength). */
  scrim: number;
  /** The worst body-text contrast over the frame once the scrim is on. */
  bodyContrast: number;
  /** The clip is so busy the scrim had to all but hide it. */
  calmer: boolean;
};

/**
 * THE RE-MEASURE: the theme's own ink over the couple's frame. The veil is the
 * page paper — the colour every ink on the page is computed against, exactly as
 * the theme's own ground lays it (`GuestGround`) — strengthened from nothing
 * until body text clears AA over EVERY measured colour, the lightest and darkest
 * included. At full strength it is the plain paper, which the theme
 * already guarantees; so this always succeeds, and the only question is how
 * much of the footage survives. That is what `calmer` reports.
 */
export function mainGroundLegibility(theme: InviteTheme, frame: readonly string[]): MainGroundLegibility {
  const { paper, ink } = pagePaperAndInk(theme);
  /* ⛔ AN UNMEASURED FRAME IS NOT A CALM ONE. The Maker never saves footage it
     could not measure, so this is a stored value from somewhere else — and
     "nothing measured" read as "nothing to veil" would lay words straight over
     footage nobody looked at. Unknown footage gets the full paper. */
  if (frame.length === 0) {
    return { scrim: 1, bodyContrast: contrastRatio(ink, paper), calmer: true };
  }
  const samples = frame;
  /* ⚠ FROM ZERO, NOT FROM THE THEME'S OWN SCRIM. The spec scrim (Modern's is
     0.86) was tuned over OUR loop, and as a floor it would veil every couple's
     footage 86 % whatever it held — a calm clip hidden as thoroughly as a busy
     one, so "try a calmer clip" could never be true advice. The veil here is
     exactly as strong as THEIR frame needs for AA, and no stronger. */
  const scrim = requiredScrim(ink, paper, samples, 0, AA_BODY);
  let worst = Infinity;
  for (const s of samples) worst = Math.min(worst, contrastRatio(ink, compositeOver(paper, scrim, s)));
  return { scrim, bodyContrast: worst, calmer: scrim >= CALMER_CLIP_SCRIM };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE TINT — Pro, only when the couple left "Match my video's colours" on
   ═══════════════════════════════════════════════════════════════════════════ */

export type AdaptiveTint = {
  /**
   * Button fill (`--color-mulberry`). Its label is the paper; ≥ 4.5:1 against
   * it. `null` = no lightness on the footage's hue keeps that promise, so the
   * theme's own button is NOT overridden (a fallback colour written here would
   * itself be an override — on House it would replace the root button).
   */
  button: string | null;
  /** Accent as text — eyebrows and gilt lines (`--color-terracotta`, `--color-gild`). `null` as above. */
  accent: string | null;
  /** The metal: rules, frames, the material's `--accent` (`--hub-accent`). */
  ornament: string;
  /** Text on an ornament-coloured fill (`--hub-accent-ink`). */
  ornamentInk: string;
};

/** The chroma a tinted colour is allowed: the theme's own, lifted toward the footage's, capped. */
function tintChroma(themeC: number, castC: number): number {
  return Math.max(themeC, Math.min(castC, 0.14), 0.04);
}

/**
 * Move `hex` onto the footage's hue, then walk its lightness away from the paper
 * (never toward it) until `passes` — or give up and return null, so the caller
 * keeps the theme's own colour.
 */
function followCast(
  hex: string,
  cast: { H: number; C: number },
  paper: string,
  passes: (candidate: string) => boolean,
): string | null {
  const o = oklchOfHex(hex);
  const C = tintChroma(o.C, cast.C);
  const away = relativeLuminance(paper) > 0.18 ? -1 : 1;
  for (let step = 0; step <= 60; step += 1) {
    const L = o.L + away * step * 0.01;
    if (L < 0.05 || L > 0.97) break;
    const candidate = hexOfOklch(L, C, cast.H).toLowerCase();
    if (passes(candidate)) return candidate;
  }
  return null;
}

/**
 * The theme's accent, button and ornament, moved toward the couple's footage.
 * `null` when the footage has no hue to follow (a grey or black-and-white clip)
 * — the theme's own colours are already the right answer there.
 *
 * Every tinted colour keeps the contract in the file note or is not tinted.
 */
export function adaptiveTint(theme: InviteTheme, frame: readonly string[]): AdaptiveTint | null {
  const cast = frameCast(frame);
  if (!cast) return null;
  const { paper } = pagePaperAndInk(theme);
  const tokens = hubThemePageTokens(theme);
  const { scrim } = mainGroundLegibility(theme, frame);
  const overFrame = frame.map((s) => compositeOver(paper, scrim, s));

  const button = followCast(tokens.cta, cast, paper, (c) => contrastRatio(c, paper) >= AA_BODY);
  const accent = followCast(tokens.gild, cast, paper, (c) =>
    contrastRatio(c, paper) >= AA_BODY && overFrame.every((g) => contrastRatio(c, g) >= AA_BODY),
  );

  // The ornament is decoration: the footage's hue at the theme's own lightness.
  const metal = oklchOfHex(theme.palette.accent);
  const ornament = hexOfOklch(metal.L, tintChroma(metal.C, cast.C), cast.H).toLowerCase();
  const inks = [theme.palette.accentInk, theme.palette.lightInk, theme.palette.darkInk];
  const ornamentInk =
    inks.find((ink) => contrastRatio(ink, ornament) >= AA_BODY) ??
    inks.reduce((best, ink) => (contrastRatio(ink, ornament) > contrastRatio(best, ornament) ? ink : best));

  return { button, accent, ornament, ornamentInk };
}

/**
 * What the page wears for this Main background: the scrim always (free), the
 * tint only when the couple left matching on and the footage has a hue.
 */
export type AdaptiveTheme = MainGroundLegibility & {
  /** The tint, or null — "Keep the theme's colours", or neutral footage. */
  tint: AdaptiveTint | null;
};

export function resolveAdaptiveTheme(theme: InviteTheme, tint: HubTint | null): AdaptiveTheme {
  const frame = tint?.frame ?? [];
  const legible = mainGroundLegibility(theme, frame);
  return { ...legible, tint: tint && tint.match ? adaptiveTint(theme, frame) : null };
}

/**
 * The tint as the custom properties the guest page already paints through —
 * the SAME tokens the theme blocks in `globals.css` set, so no widget had to
 * learn about adaptive colour. `{}` when there is no tint: the theme's own
 * values are simply not overridden, which is what "Keep the theme's colours"
 * means.
 *
 * `ownButton`: the couple chose their own button colour (a Pro hex) — the one
 * choice more deliberate than an automatic tint, so the button is left alone.
 */
export function adaptiveThemeVars(
  resolved: AdaptiveTheme,
  opts: { ownButton?: boolean } = {},
): Record<string, string> {
  const t = resolved.tint;
  if (!t) return {};
  const button = t.button && !opts.ownButton ? channels(t.button) : null;
  const accent = t.accent ? channels(t.accent) : null;
  return {
    ...(button
      ? { '--color-mulberry': button, '--color-mulberry-600': button, '--color-mulberry-700': button }
      : {}),
    ...(accent
      ? {
          '--color-gild': accent,
          '--color-terracotta': accent,
          '--color-terracotta-600': accent,
          '--color-terracotta-700': accent,
        }
      : {}),
    '--hub-accent': t.ornament,
    '--hub-accent-ink': t.ornamentInk,
    '--accent': t.ornament,
  };
}
