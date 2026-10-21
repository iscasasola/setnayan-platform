/**
 * lib/attire-library.ts — EACH STYLE'S DESIGNS: UP TO FIVE A STYLE, ONE REGISTRY ENTRY PER DRAWING.
 *
 * Owner 2026-10-21: *"For the guests they can pick different outfit styles. This means we need different attire looks
 * as well."* → *"Show me a prototype. Where up to 5 different attires. Meaning 5 different smart casual, 5 coat and tie,
 * 5 barong"* (prototype `attire_five_designs_per_style_2026-10-21.html`, DECISION_LOG 2026-10-21 "STYLE → UP TO FIVE
 * DESIGNS"). A STYLE (Suit and tie · Barong Tagalog · Smart casual; Long dress · Cocktail dress · Filipiniana) is what
 * the hosts allow; a DESIGN is one drawing inside it (a double-breasted suit, a polo barong).
 *
 * 🧩 ONE ENTRY PER DRAWING, NO CODE PER DRAWING. Each row below is a design. A design is DRAWN when its row says so —
 *   · `art` — it is one of the 45 shipped role drawings (the style's first design, `public/attire/roles/<role>-<style>`);
 *   · `w`   — its width at 280 tall, printed by `scripts/build-role-attire.py`, for a drawing in its own folder:
 *             `public/attire/roles/<role>-<style>/<variant>.webp` and one mask per colour zone,
 *             `…/<variant>-<zone>.webp` (the style's zones, `DESIGN_ZONES` — a new design joins its style's zones).
 * A row with neither is NOT YET DRAWN: it is never offered and never rendered (no placeholder reaches anyone). When the
 * drawing lands, the only edit is its `w` — the files and that number. Held by `guests-pick-styles-and-designs.test.ts`
 * (every drawn row has its files; every file has a drawn row; nothing undrawn renders).
 *
 * 🔑 THE NAMES ARE THE PROTOTYPE'S (§ 2) and the target files are PROMPTS.md's (`guest_m-suit/double_breasted`), so a
 * generated drawing drops in under the name it was generated for.
 *
 * Pure data — types only from elsewhere, so `attire-figures.ts` can build the drawings from it without a cycle.
 */
import type { AttireStyle } from './role-dress-code';
import type { FigureRole } from './attire-designs';

/** One design of a style: its key inside the style, its name, and — when drawn — its drawing. */
export type LibraryDesign = {
  readonly style: AttireStyle;
  /** The design's key inside its style (`double_breasted`). */
  readonly variant: string;
  /** Its name, as the prototype names it ("Double-breasted"). */
  readonly label: string;
  /** Drawn: one of the shipped role drawings (`<role>-<style>`). */
  readonly art?: `${FigureRole}-${AttireStyle}`;
  /** Drawn: its width at 280 tall (a drawing in `public/attire/roles/<role>-<style>/<variant>…`). */
  readonly w?: number;
};

/** At most this many designs in one style (owner 2026-10-21, "up to 5"). */
export const DESIGNS_PER_STYLE_MAX = 5;

const x = (style: AttireStyle, variant: string, label: string, drawn: { art?: `${FigureRole}-${AttireStyle}`; w?: number } = {}): LibraryDesign => ({
  style,
  variant,
  label,
  ...drawn,
});

/**
 * THE LIBRARY — the guests' six styles, five designs each (prototype § 2, its order). Six are drawn (#16 #17 #42–#45);
 * the 24 others wait for their drawings (PROMPTS.md). A role absent here keeps one drawing per design, as shipped.
 */
export const DESIGN_LIBRARY: Readonly<Partial<Record<FigureRole, readonly LibraryDesign[]>>> = {
  guest_m: [
    x('suit', 'classic', 'Classic two-button', { art: 'guest_m-suit' }),
    x('suit', 'double_breasted', 'Double-breasted'),
    x('suit', 'three_piece', 'Three-piece'),
    x('suit', 'shawl', 'Shawl lapel'),
    x('suit', 'slim', 'Slim, skinny tie'),
    x('barong_tagalog', 'pina', 'Classic piña, long sleeve', { art: 'guest_m-barong_tagalog' }),
    x('barong_tagalog', 'polo', 'Polo barong, short sleeve'),
    x('barong_tagalog', 'jusi', 'Jusi, full pechera'),
    x('barong_tagalog', 'modern', 'Modern slim, Mandarin collar'),
    x('barong_tagalog', 'coat', 'Barong with coat'),
    x('smart_casual', 'shirt_chinos', 'Shirt and chinos', { art: 'guest_m-smart_casual' }),
    x('smart_casual', 'linen', 'Linen shirt'),
    x('smart_casual', 'polo_slacks', 'Polo and slacks'),
    x('smart_casual', 'blazer_tee', 'Blazer over tee'),
    x('smart_casual', 'cuban', 'Cuban-collar shirt'),
  ],
  guest_w: [
    x('long_gown', 'cowl', 'Cowl neck, column', { art: 'guest_w-long_gown' }),
    x('long_gown', 'aline', 'A-line, flutter sleeve'),
    x('long_gown', 'wrap', 'Wrap, with slit'),
    x('long_gown', 'off_shoulder', 'Off-shoulder'),
    x('long_gown', 'halter', 'Halter, chiffon'),
    x('cocktail_dress', 'flutter_midi', 'Flutter-sleeve midi', { art: 'guest_w-cocktail_dress' }),
    x('cocktail_dress', 'sheath', 'Sheath, knee-length'),
    x('cocktail_dress', 'fit_flare', 'Fit and flare'),
    x('cocktail_dress', 'off_shoulder_midi', 'Off-shoulder midi'),
    x('cocktail_dress', 'slip', 'Satin slip'),
    x('filipiniana', 'terno_top', 'Terno top and skirt', { art: 'guest_w-filipiniana' }),
    x('filipiniana', 'terno_gown', 'Terno gown'),
    x('filipiniana', 'barot_saya', "Baro't saya"),
    x('filipiniana', 'butterfly_midi', 'Butterfly-sleeve midi'),
    x('filipiniana', 'terno_pantsuit', 'Terno pantsuit'),
  ],
};

/** Is this design drawn (a shipped role drawing, or a width for its own files)? */
export const isDrawn = (d: LibraryDesign): boolean => Boolean(d.art) || typeof d.w === 'number';

/** The drawing key of a design in its own folder — `guest_m-suit/double_breasted` (PROMPTS.md's target key). */
export type VariantArtKey = `${FigureRole}-${AttireStyle}/${string}`;
export function variantArtKey(role: FigureRole, d: LibraryDesign): VariantArtKey {
  return `${role}-${d.style}/${d.variant}`;
}
