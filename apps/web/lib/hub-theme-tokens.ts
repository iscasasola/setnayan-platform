/**
 * lib/hub-theme-tokens.ts — WHAT EACH THEME'S PALETTE BECOMES ON THE GUEST PAGE.
 *
 * The registry (`lib/invite-themes.ts`) holds the spec's palette. The guest
 * pages were drawn on House and render through House's tokens — `text-ink/45`
 * muted labels, `text-terracotta` eyebrows, `text-gild` accents, a `bg-mulberry`
 * button with a `text-cream` label. This decides, from the palette alone, which
 * colour each of those tokens takes so that — the rule the fixed pages hold
 * (globals.css, "what the FIXED pages need to stay readable") —
 *
 *   🔑 A THEME NEVER MAKES A WORD HARDER TO READ THAN HOUSE MAKES IT.
 *
 * Where House clears AA the theme must too; where House itself sits under AA
 * (its muted `ink/45…/60` labels), the theme must not be worse.
 *
 *   · `ink`      — the spec ink, pushed away from the canvas only as far as the
 *                  muted steps need to match House (a light theme's ink deepens,
 *                  a dark theme's lightens). The spec ink when it already holds.
 *   · `eyebrow`  — the theme's heading, else its accent, if it clears 4.5:1.
 *   · `gild`     — the accent when it clears 4.5:1 as text (it is used on small
 *                  italic lines), else the eyebrow colour. Metal is decoration;
 *                  a word set in it is still a word.
 *   · `cta`      — the button fill whose `text-cream` label (the canvas) clears 4.5.
 *
 * The CSS blocks in `globals.css` are GENERATED from this, and
 * `lib/invite-themes.test.ts` re-reads the stylesheet and compares every channel,
 * so the page and this rule cannot drift. Pure. No I/O.
 */
import { compositeOver, contrastRatio, relativeLuminance, AA_BODY } from '@/lib/hub-legibility';
import type { InviteTheme } from '@/lib/invite-themes';

/** House's ink and paper, as the root tokens set them (`--color-ink`, `--color-cream`). */
export const HOUSE_INK = '#1e2229';
export const HOUSE_PAPER = '#ffffff';

/** The opacity steps the guest pages use on `text-ink/…`. */
export const MUTED_STEPS = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8] as const;

/** What a muted step must reach on a theme: House's own ratio, capped at AA. */
export function mutedTarget(alpha: number): number {
  return Math.min(AA_BODY, contrastRatio(compositeOver(HOUSE_INK, alpha, HOUSE_PAPER), HOUSE_PAPER));
}

function mutedHolds(ink: string, canvas: string): boolean {
  return MUTED_STEPS.every(
    (a) => contrastRatio(compositeOver(ink, a, canvas), canvas) >= mutedTarget(a) - 1e-9,
  );
}

/** The spec ink, mixed toward black (light canvas) or white (dark canvas) until every muted step holds. */
export function pageInk(ink: string, canvas: string): string {
  const toward = relativeLuminance(canvas) > 0.2 ? '#000000' : '#ffffff';
  for (let step = 0; step <= 100; step++) {
    const candidate = compositeOver(toward, step / 100, ink);
    if (mutedHolds(candidate, canvas)) return candidate;
  }
  return toward;
}

export type HubThemePageTokens = {
  canvas: string;
  surface: string;
  ink: string;
  eyebrow: string;
  gild: string;
  cta: string;
  dark: boolean;
};

export function hubThemePageTokens(theme: InviteTheme): HubThemePageTokens {
  const p = theme.palette;
  const reads = (c: string) => contrastRatio(c, p.canvas) >= AA_BODY;
  const ink = pageInk(p.ink, p.canvas);
  const eyebrow = [p.heading, p.accent, p.muted, ink].find(reads) ?? ink;
  return {
    canvas: p.canvas,
    surface: p.surface,
    ink,
    eyebrow,
    gild: reads(p.accent) ? p.accent : eyebrow,
    cta: [p.accent, p.heading, p.muted, ink].find(reads) ?? ink,
    dark: relativeLuminance(p.canvas) < 0.2,
  };
}

/** `#rrggbb` → the space-separated channels the `--color-*` tokens take. */
export function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
