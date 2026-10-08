/**
 * lib/main-ground-pattern-cards.ts — A PATTERN CARD MUST SHOW ITS PATTERN.
 *
 * Studio › Look › Background's Pattern cards are pictures of the four patterns
 * (`lib/main-ground-patterns.ts` — the guest page's own CSS). The guest page
 * draws them in the PAGE's ink (`--color-ink`), which flips light on a dark
 * paper; a card in the Maker stood in the DASHBOARD's ink instead, so on a dark
 * page colour (the owner's preview walk 2026-10-08: paper `#1e2229`) all four
 * cards were the same dark rectangle. Measured that day, by running the page's
 * own look resolver:
 *
 *   guest page, paper #1e2229 — ink #f6f1e7 → the stroke reads 1.17–1.34 : 1
 *                               (clearer than on white, 1.12–1.20 : 1);
 *   the card as first built    — espresso over #1e2229 → 1.00–1.01 : 1 (nothing).
 *
 * So the guest page was right and the CARD was wrong. A card draws the SAME
 * definition with two things put in: the ink the page would use on that paper
 * (dark on a light paper, light on a dark one), and enough of it to be told
 * apart at card size — the page's whisper (6–10 %) is right across a whole
 * screen and too quiet in a 104 × 66 px picture.
 *
 * Pure. Never a second drawing of a pattern: `patternCardSwatch` only rewrites
 * the ink of the one definition. Held by `the-background-has-one-source.test.ts`.
 */
import { compositeOver, contrastRatio } from '@/lib/hub-legibility';
import type { HubMainPatternKey } from '@/lib/hub-canvas';
import { MAIN_GROUND_PATTERN_CSS } from '@/lib/main-ground-patterns';

/** The page's two inks — espresso on a light paper, paper-white on a dark one (`globals.css` `--color-ink`). */
export const PATTERN_CARD_INKS = { dark: '#2c2a29', light: '#fbfaf7' } as const;

/** How clearly a card's stroke must stand off its paper (the page's own whisper is 1.1–1.35 : 1). */
export const PATTERN_CARD_MIN_CONTRAST = 1.6;

/** The pattern's ink as the one definition writes it — `rgb(var(--color-ink) / 0.07)`. */
const PAGE_INK = /rgb\(var\(--color-ink\) \/ (0?\.\d+)\)/g;
const HEX6 = /^#[0-9a-f]{6}$/i;

/** The ink that reads on this paper — whichever of the page's two stands further off it. */
export function patternCardInk(paper: string): string {
  return contrastRatio(PATTERN_CARD_INKS.dark, paper) >= contrastRatio(PATTERN_CARD_INKS.light, paper)
    ? PATTERN_CARD_INKS.dark
    : PATTERN_CARD_INKS.light;
}

/** The least of that ink (never less than the pattern's own) at which the stroke clears the card's floor. */
export function patternCardAlpha(ink: string, paper: string, own: number): number {
  for (let a = Math.round(own * 100); a <= 100; a += 2) {
    if (contrastRatio(compositeOver(ink, a / 100, paper), paper) >= PATTERN_CARD_MIN_CONTRAST) return a / 100;
  }
  return 1;
}

/**
 * One Pattern card's picture: the pattern's own CSS, in an ink that shows on
 * `paper`, laid over that paper. A paper that is not a plain hex cannot be
 * measured, so the card then keeps the definition as it is.
 */
export function patternCardSwatch(pattern: HubMainPatternKey, paper: string): { image: string; size: string } {
  const p = MAIN_GROUND_PATTERN_CSS[pattern];
  if (!HEX6.test(paper)) return { image: `${p.image}, ${paper}`, size: p.size };
  const ink = patternCardInk(paper);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  const image = p.image.replace(PAGE_INK, (_m, own: string) => `rgb(${r} ${g} ${b} / ${patternCardAlpha(ink, paper, Number(own))})`);
  return { image: `${image}, ${paper}`, size: p.size };
}
