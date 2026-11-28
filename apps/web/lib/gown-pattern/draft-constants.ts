/**
 * 👗 gown-pattern/draft-constants — the bodice block's drafting constants (prototype v181 `DRAFT`), in ONE place: the
 * drafting code reads them from here, and the sheet prints the same table, so what is checked is what is drawn.
 *
 * ⚠ FROM MEMORY. These follow Aldrich's close-fitting bodice block as remembered, not copied from the book (owner,
 * v181: "use your memory of Aldrich, mark it to check"). Every sheet says so until step B19 replaces them with the
 * book's checked figures and a pattern-maker signs them off (owner Q11).
 * 🔒 lib/gown-pattern/pattern.test.ts
 */

export const GOWN_DRAFT = {
  /** Neck width = neck ÷ 5 − 0.2 cm (back and front). */
  neckWidthDiv: 5,
  neckWidthLess: 0.2,
  /** Back neck rise at the shoulder-neck point, cm. */
  backRise: 2,
  /** Front neck depth = neck ÷ 5 + 0.8 cm. */
  frontDepthAdd: 0.8,
  /** Back shoulder slope = armscye depth ÷ 5 − 0.7 cm; front ÷ 5 + 0.5 cm. */
  slopeDiv: 5,
  backSlopeLess: 0.7,
  frontSlopeAdd: 0.5,
  /** Back shoulder dart, cm wide × cm long. */
  backDartWidth: 1,
  backDartLength: 7,
  /** Added to half the back width and half the chest width, cm. */
  widthEase: 0.5,
  /** The side seam sits this far back of the half bust (back −, front +), cm. */
  sideSplit: 1,
  /** Waist shaping at the side seam, at most this much each side, cm. */
  sideShapeMax: 2.5,
  /** Side bust dart: this angle for a B cup… */
  bustDartDegrees: 16,
  /** …which is bust − underbust of this many cm; scaled by her cup. */
  bustDartCupCm: 14,
  /** Darts stop this short of the bust point, cm. */
  dartStop: 2,
} as const;

const D = GOWN_DRAFT;

/** The table printed on every bodice sheet: [key, value or rule, what it sets]. Built from GOWN_DRAFT. */
export const GOWN_DRAFT_TABLE: ReadonlyArray<readonly [string, string, string]> = [
  ['neckW', `neck ÷ ${D.neckWidthDiv} − ${D.neckWidthLess} cm`, 'back and front neck width'],
  ['backRise', `${D.backRise.toFixed(1)} cm`, 'back neck rise at the shoulder-neck point'],
  ['frontDepth', `neck ÷ ${D.neckWidthDiv} + ${D.frontDepthAdd} cm`, 'front neck depth'],
  ['backDrop', `armscye depth ÷ ${D.slopeDiv} − ${D.backSlopeLess} cm`, 'back shoulder slope'],
  ['frontDrop', `armscye depth ÷ ${D.slopeDiv} + ${D.frontSlopeAdd} cm`, 'front shoulder slope'],
  ['backDart', `${D.backDartWidth.toFixed(1)} cm wide, ${D.backDartLength} cm long`, 'back shoulder dart'],
  ['widthEase', `${D.widthEase} cm`, 'added to half back width and half chest width'],
  ['sideSplit', `back −${D.sideSplit} cm, front +${D.sideSplit} cm`, 'where the side seam sits'],
  ['sideShape', `up to ${D.sideShapeMax} cm each side`, 'waist shaping at the side seam'],
  ['bustDart', `angle ${D.bustDartDegrees}° for a B cup (bust − underbust ${D.bustDartCupCm} cm), scaled by her cup; Aldrich size 12 lists a 7 cm shoulder dart`, 'side bust dart width'],
  ['dartStop', `${D.dartStop} cm`, 'darts stop short of the bust point'],
];

/** Printed on every bodice sheet until step B19. */
export const GOWN_DRAFT_FROM_MEMORY =
  "FROM MEMORY: the drafting constants follow Aldrich's close-fitting bodice as remembered, not copied from the book. Check the table against Metric Pattern Cutting for Women's Wear before cutting.";

/** Printed on any block drawn from a 3D estimate. */
export const GOWN_DRAFT_ESTIMATE = 'ESTIMATE: measure before cutting. Some numbers are estimates from the 3D body.';

/** Printed on every sheet: these are starting blocks, not a finished pattern. */
export const GOWN_DRAFT_STARTING_BLOCKS = 'Starting blocks, net (no seam allowance yet). Fit in muslin first.';

/** A drawn number further than this from the asked one is marked on the check table, cm (2.5 mm). */
export const GOWN_DRAFT_TOLERANCE_CM = 0.25;
