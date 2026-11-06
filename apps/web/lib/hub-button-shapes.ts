/**
 * lib/hub-button-shapes.ts — LOOK › ELEMENTS › BUTTONS OFFERS THREE SHAPES, AND READS THE THEME'S OWN AS ONE OF THEM.
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E "Buttons — three shapes only"), verbatim: *"do not need to
 * show default button just show the 3 button styles"* — and round 3: *"button color will be taken from their 5
 * palette"*.
 *
 *   Square · Rounded · Pill          (`HUB_BUTTON_RADIUS`: 0 · 12 px · 999 px)
 *
 * 🔑 NOTHING NEW IS STORED, AND NOTHING IS REWRITTEN. `events.site_button_style` keeps its vocabulary
 * (`lib/hub-buttons.ts` — `theme` is still a shape a row may HOLD). An event that never chose keeps wearing its
 * theme's own corner; the row only READS which of the three that corner is and rings it (`hubButtonShapeRead`) — a
 * reading, never a write. The page changes when the couple taps ANOTHER one.
 *
 * THE READING (the note's): a theme's own corner is 0 → Square, a pill (half the button's height or more) → Pill,
 * anything between → Rounded. The shipped themes are 2–8 px or 999, so five ring Rounded and five ring Pill; none
 * rings Square. "Nearest by number" was rejected in the note: a 2-px corner is nearer 0 than 12 and still reads as
 * rounded to the eye.
 *
 * Kept OUT of `lib/hub-buttons.ts` on purpose: that file is read by the draft library (the Maker's first load);
 * this one is read only by the lazily-loaded row.
 *
 * Pure. Held by `lib/look-buttons-reach-every-button.test.ts`.
 */
import { HUB_BUTTON_RADIUS, HUB_BUTTON_SHAPE_LABEL, type HubButtonShape } from './hub-buttons';

export type HubButtonShapeOffered = Exclude<HubButtonShape, 'theme'>;

/** What the row offers, in the order it is drawn. */
export const HUB_BUTTON_SHAPES_OFFERED = ['square', 'rounded', 'pill'] as const satisfies readonly HubButtonShapeOffered[];

/** The sample button is 48 px tall: a corner of half that or more IS a pill. */
const PILL_FROM_PX = 24;

/** Which of the three a corner of `px` reads as. */
export function hubButtonShapeOfRadius(px: number): HubButtonShapeOffered {
  if (!(px > 0)) return 'square';
  return px >= PILL_FROM_PX ? 'pill' : 'rounded';
}

/**
 * The card that is ringed: the stored shape, or — while the event wears its theme's own — the one of the three the
 * theme's corner reads as. `stored: 'theme'` is never turned into a write by this.
 */
export function hubButtonShapeRead(stored: HubButtonShape, theme: { radius: number }): HubButtonShapeOffered {
  return stored === 'theme' ? hubButtonShapeOfRadius(theme.radius) : stored;
}

/** The corner a card's button is drawn with: the shape's own — or, for the card that stands for the theme's, the theme's. */
export function hubButtonCardRadius(card: HubButtonShapeOffered, stored: HubButtonShape, theme: { radius: number }): string {
  return stored === 'theme' && hubButtonShapeRead(stored, theme) === card ? `${theme.radius}px` : HUB_BUTTON_RADIUS[card];
}

export const hubButtonShapeName = (shape: HubButtonShapeOffered): string => HUB_BUTTON_SHAPE_LABEL[shape];
