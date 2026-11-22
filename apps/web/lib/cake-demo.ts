/**
 * 🎂 THE CAKE MAKER DEMO — what a shop below Pro plays with after the admin's start date (owner ruling "A LOCKED SPECIAL
 * TOOL SHOWS ITS FRONT-END EXPERIENCE, NOT ITS SETTINGS"). The couple's own designer, on built-in SAMPLE options, in the
 * browser: every part is on (sizes 1–10, every arrangement, shape, height, accent, flowing accent, the monogram, toppers,
 * cupcakes) so the whole tool is playable. Nothing is read, saved or sent — no server action.
 *
 * 💸 Every extra here is ₱0 and there is no priced card, so the demo shows no money at all: a demo never invents a
 * price (CLAUDE.md "never guess a money number"). Its total line says the shop quotes the price, exactly as a shop with
 * no priced cake card would.
 */
import { CAKE_ACCENTS, CAKE_ARRANGEMENTS, CAKE_FINISHES, CAKE_FLOWING, CAKE_SHAPES, CAKE_TOPPERS } from './cake-config';
import { cakeShopTemplate, type CakeShopOptions } from './cake-maker';

/** The sample colours (a cake palette, not page colours). */
const DEMO_COLOURS = [
  { name: 'Dusty rose', hex: '#C98B8B' },
  { name: 'Sage', hex: '#9CAF94' },
  { name: 'Champagne', hex: '#E8D9B5' },
  { name: 'Ivory', hex: '#F5EFE4' },
];

/** The demo's shop options: the template with every part switched on, all at ₱0. */
export function cakeDemoOptions(): CakeShopOptions {
  const t = cakeShopTemplate();
  const free = <T extends string>(list: readonly { id: T }[]) => list.map((x) => ({ id: x.id, extraCentavos: 0 }));
  return {
    ...t,
    sizes: Array.from({ length: 10 }, (_, i) => ({ count: i + 1, extraCentavos: 0, serves: null })),
    display: { extraCentavos: 0 },
    shapes: free(CAKE_SHAPES),
    tall: { extraCentavos: 0 },
    finishes: free(CAKE_FINISHES),
    colours: DEMO_COLOURS,
    accents: free(CAKE_ACCENTS),
    arrangements: free(CAKE_ARRANGEMENTS),
    flowing: free(CAKE_FLOWING.filter((f) => f.id !== 'none')) as CakeShopOptions['flowing'],
    monogram: { extraCentavos: 0 },
    toppers: free(CAKE_TOPPERS.filter((f) => f.id !== 'none')) as CakeShopOptions['toppers'],
    cupcakes: { packs: [{ count: 24, priceCentavos: 0 }], tower: true },
  };
}

/**
 * The words on the demo's calm bar, in place of Send; the Upgrade button sits beside them. Five plans, no Max (owner
 * 22 Nov, DECISION_LOG "CORRECTION — THERE IS NO MAX PLAN"): special tools come with Pro and Ultra.
 */
export const CAKE_DEMO_BAR_WORDS = 'This special tool is available on Pro and Ultra';
