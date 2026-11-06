/**
 * lib/main-ground-patterns.ts — THE FOUR PATTERNS, AS CSS (Fine lines · Dots · Lace · Grid).
 *
 * ONE definition, two readers: the guest page's pattern layer
 * (`app/[slug]/_components/main-ground.tsx` `PatternGround` — where these lived
 * until 2026-10-08) and Studio › Look › Background's Pattern cards
 * (`main-background-panel.tsx`), so a card is a picture of exactly what a guest
 * gets — never a second drawing of it. Drawn in the page's ink at a whisper over
 * the colour: never a picture, so nothing to sign and nothing to measure.
 *
 * Pure data — moved here as it was, byte for byte (the guest page is unchanged).
 */
import type { HubMainPatternKey } from '@/lib/hub-canvas';

export const MAIN_GROUND_PATTERN_CSS: Readonly<Record<HubMainPatternKey, { image: string; size: string }>> = {
  lines: { image: 'repeating-linear-gradient(135deg, rgb(var(--color-ink) / 0.07) 0 1px, transparent 1px 9px)', size: 'auto' },
  dots: { image: 'radial-gradient(rgb(var(--color-ink) / 0.10) 1.2px, transparent 1.6px)', size: '16px 16px' },
  lace: {
    image:
      'radial-gradient(circle at 50% 0, transparent 7px, rgb(var(--color-ink) / 0.08) 7.5px 8.5px, transparent 9px), radial-gradient(rgb(var(--color-ink) / 0.08) 1px, transparent 1.5px)',
    size: '18px 12px, 18px 12px',
  },
  grid: {
    image: 'linear-gradient(rgb(var(--color-ink) / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-ink) / 0.06) 1px, transparent 1px)',
    size: '22px 22px',
  },
};
