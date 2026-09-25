/**
 * lib/hub-legibility.ts — TEXT COLOUR ADAPTS TO EVERY BACKGROUND, FOR EVERY COUPLE.
 *
 * Owner, 2026-09-25 (DECISION_LOG): *"did you already make the font color adapt
 * also based on the background?"* — it had not, for the Event Hub. The ruling:
 * each scene's text tone follows its own background, automatically, and it is
 * FREE — free couples change background colours, so legibility can never be a
 * paid feature. Build plan §3, the acceptance rule every Maker phase carries.
 *
 * Built once here (Phase 3), applied to the Event Hub's main ground now and to
 * scene backgrounds in Phase 5. Composed from what already ships, not re-invented:
 *
 *   · a SOLID colour  → `readableTextOn(bgHex)` (lib/site-palette.ts), the rule the
 *     Save-the-Date film button already uses — mapped onto the THEME's own two
 *     inks, so a Luxe couple's text is Luxe's cream, never a generic white;
 *   · a THEME ground  → the theme's own palette + its measured scrim;
 *   · PHOTO / VIDEO   → the frame colours sampled under the text box (the caller
 *     samples with `lib/extract-palette.ts`; the theme loops carry their measured
 *     lightest and darkest clusters) — the tone that clears AA over the WORST
 *     sample wins, and the scrim is strengthened until it does.
 *
 * Theme accents (foil, gold headings) stay on-brand only when they pass over the
 * actual background; otherwise they fall back to the readable tone.
 *
 * WCAG 2.x relative luminance and contrast, composited in sRGB exactly as CSS
 * does it. Pure. No I/O. Client-safe.
 */
import type { InviteTheme } from '@/lib/invite-themes';
import { readableTextOn } from '@/lib/site-palette';

/** Body text and button labels (WCAG AA, normal text). */
export const AA_BODY = 4.5;
/** Headings and large display type (WCAG AA, large text). */
export const AA_LARGE = 3;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function channelLum(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb`. A malformed hex reads as white. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex) ?? [255, 255, 255];
  return 0.2126 * channelLum(rgb[0]) + 0.7152 * channelLum(rgb[1]) + 0.0722 * channelLum(rgb[2]);
}

/** WCAG contrast ratio between two colours, 1…21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` laid at `alpha` over an opaque `bg`, in sRGB — what the browser paints. */
export function compositeOver(fg: string, alpha: number, bg: string): string {
  const f = parseHex(fg) ?? [0, 0, 0];
  const b = parseHex(bg) ?? [255, 255, 255];
  const a = Math.min(1, Math.max(0, alpha));
  return toHex([0, 1, 2].map((i) => f[i]! * a + b[i]! * (1 - a)) as Rgb);
}

export type HubTone = 'light' | 'dark';

/** What a background is made of, from the legibility rule's point of view. */
export type HubBackground =
  /** A flat colour the couple chose (free). */
  | { kind: 'color'; hex: string }
  /** The theme's own ground — its canvas, and its loop under its scrim. */
  | { kind: 'theme' }
  /** A photo or video: the colours sampled under the text box. */
  | { kind: 'media'; samples: readonly string[] };

export type HubLegibility = {
  /** Which of the theme's two inks the text takes. */
  tone: HubTone;
  /** That ink, as a hex. */
  ink: string;
  /** The veil between the background and the words: `color` at `opacity` (0 = none). */
  scrim: { color: string; opacity: number };
  /** The heading colour — the theme's own when it passes, else the ink. */
  heading: string;
  /** The accent as TEXT (eyebrows, links) — the theme's own when it passes, else the ink. */
  accent: string;
  /** The worst body-text contrast over the background, after the scrim. */
  bodyContrast: number;
};

/** The worst contrast of `ink` over every sample once the scrim is laid on it. */
function worstContrast(ink: string, samples: readonly string[], scrim: { color: string; opacity: number }): number {
  let worst = Infinity;
  for (const s of samples) {
    worst = Math.min(worst, contrastRatio(ink, compositeOver(scrim.color, scrim.opacity, s)));
  }
  return worst;
}

/**
 * The weakest scrim, from `floor` up, that holds `ink` at `target` over every
 * sample. Returns 1 when only an opaque veil would do (it always does: the scrim
 * colour is the other ink's ground).
 */
export function requiredScrim(
  ink: string,
  scrimColor: string,
  samples: readonly string[],
  floor = 0,
  target = AA_BODY,
): number {
  for (let step = Math.round(floor * 100); step <= 100; step++) {
    const opacity = step / 100;
    if (worstContrast(ink, samples, { color: scrimColor, opacity }) >= target) return opacity;
  }
  return 1;
}

/** A theme colour used as text, if it clears `target` over every sample; else the readable ink. */
function brandOrInk(
  colour: string,
  ink: string,
  samples: readonly string[],
  scrim: { color: string; opacity: number },
  target: number,
): string {
  return worstContrast(colour, samples, scrim) >= target ? colour : ink;
}

/**
 * THE RULE: which of the theme's inks, over how strong a scrim, with which
 * accents, for this background. Every theme, every couple, no entitlement read.
 */
export function hubLegibility(theme: InviteTheme, background: HubBackground): HubLegibility {
  const { palette } = theme;

  // ── A flat colour — `readableTextOn` decides the tone; the theme supplies the ink.
  if (background.kind === 'color') {
    const bg = parseHex(background.hex) ? background.hex : palette.canvas;
    const generic = readableTextOn(bg);
    const tone: HubTone = relativeLuminance(generic) > 0.5 ? 'light' : 'dark';
    const themed = tone === 'light' ? palette.lightInk : palette.darkInk;
    // The theme's ink when it clears AA, else the extreme `readableTextOn` chose.
    const ink = contrastRatio(themed, bg) >= AA_BODY ? themed : generic;
    const none = { color: bg, opacity: 0 };
    return {
      tone,
      ink,
      scrim: none,
      heading: brandOrInk(palette.heading, ink, [bg], none, AA_LARGE),
      accent: brandOrInk(palette.accent, ink, [bg], none, AA_BODY),
      bodyContrast: contrastRatio(ink, bg),
    };
  }

  const legibleWith = (tone: HubTone, ink: string, samples: readonly string[], scrim: { color: string; opacity: number }): HubLegibility => ({
    tone,
    ink,
    scrim,
    heading: brandOrInk(palette.heading, ink, samples, scrim, AA_LARGE),
    accent: brandOrInk(palette.accent, ink, samples, scrim, AA_BODY),
    bodyContrast: worstContrast(ink, samples, scrim),
  });
  const toneOf = (ink: string): HubTone => (relativeLuminance(ink) > 0.5 ? 'light' : 'dark');

  // ── The theme's own ground: its canvas, plus (for a media theme) its loop's
  //    measured lightest and darkest clusters under its scrim. The theme's OWN ink
  //    always — the spec's scrim is the floor, strengthened until AA holds.
  //    Classic has only paper and no scrim at all.
  if (background.kind === 'theme') {
    const samples = theme.media ? [theme.media.samples.light, theme.media.samples.dark] : [palette.canvas];
    const base = theme.scrim ?? { color: palette.canvas, opacity: 0 };
    const opacity = requiredScrim(palette.ink, base.color, samples, base.opacity);
    return legibleWith(toneOf(palette.ink), palette.ink, samples, { color: base.color, opacity });
  }

  // ── A couple's own photo or video: the frame colours under the text box. Try
  //    both of the theme's inks, each veiled by the OTHER ink's ground, and keep
  //    the one that needs the lighter veil — the one that shows the most photo.
  const samples = background.samples.length > 0 ? background.samples : [palette.canvas];
  let best: HubLegibility | null = null;
  for (const [ink, veil] of [
    [palette.darkInk, palette.lightInk],
    [palette.lightInk, palette.darkInk],
  ] as const) {
    const opacity = requiredScrim(ink, veil, samples, 0);
    const result = legibleWith(toneOf(ink), ink, samples, { color: veil, opacity });
    if (!best || result.scrim.opacity < best.scrim.opacity - 1e-9) best = result;
  }
  return best!;
}

/**
 * The tone as custom properties, for a scene or the page root: `--hub-ink`,
 * `--hub-heading`, `--hub-accent-text` and the scrim `--hub-scrim`. Hex values
 * only — never a couple-typed string, since every input was parsed above.
 */
export function hubLegibilityVars(leg: HubLegibility): Record<string, string> {
  const s = parseHex(leg.scrim.color) ?? [0, 0, 0];
  return {
    '--hub-ink': leg.ink,
    '--hub-heading': leg.heading,
    '--hub-accent-text': leg.accent,
    '--hub-scrim': `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${leg.scrim.opacity.toFixed(2)})`,
  };
}
