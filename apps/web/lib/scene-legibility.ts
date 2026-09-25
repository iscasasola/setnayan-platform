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
import { hubLegibility, type HubLegibility } from '@/lib/hub-legibility';
import type { InviteTheme } from '@/lib/invite-themes';

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
 * The custom properties a scene frame with a flat-colour ground carries — the
 * legibility answer on the channel tokens the words are actually painted with.
 * Only tokens a rule READS: `hubLegibilityVars`' `--hub-*` names are read by
 * nothing on the guest page yet, and a value nothing reads is a dead control.
 */
export function sceneLegibilityVars(theme: InviteTheme, groundHex: string): Record<string, string> {
  const leg = sceneLegibility(theme, groundHex);
  return {
    '--color-ink': channels(leg.ink),
    '--color-ink-on-plate': channels(leg.ink),
    '--color-terracotta': channels(leg.accent),
    '--color-gild': channels(leg.accent),
  };
}
