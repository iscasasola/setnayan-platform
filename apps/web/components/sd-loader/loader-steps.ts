/**
 * loader-steps.ts — the single place to edit brand-loader narration copy.
 *
 * Each entry is the ordered list of status lines <SDLoader> cycles through for
 * one context. Keep them SPECIFIC and TRUE to the actual work (3–5 lines) —
 * generic copy ("Loading…") kills the "we're personalizing your stuff"
 * effect. The loader advances through these and HOLDS on the last line.
 *
 * Add a new context here, then pass it at the call site:
 *   <SDLoader steps={LOADER_STEPS.checkout} />
 *   useLoader().show({ steps: LOADER_STEPS.signin })
 */
export const LOADER_STEPS = {
  /** Sign-in → dashboard boot (global overlay on the login form). */
  signin: [
    'Verifying your details',
    'Loading your events',
    'Setting up your dashboard',
  ],

  /** Order-and-pay submit in the inline checkout drawer. */
  checkout: [
    'Validating your details',
    'Logging your payment proof',
    'Filing your request',
  ],

  /** Booting the couple's landing-page / site editor (route loading). */
  siteEditor: [
    'Opening your site',
    'Loading your design',
    'Preparing the editor',
  ],

  /** Opening the couple's Monogram Maker studio (route loading). */
  monogram: [
    'Opening the monogram studio',
    'Loading your initials & design',
    'Preparing the canvas',
  ],

  /** Vendor matching / recommendations (handpicking by refinements). */
  matching: [
    'Reading your preferences',
    'Cross-referencing vendors',
    'Ranking your best matches',
  ],

  /** Generic fallback for blocking actions without bespoke copy. */
  default: [
    'Reading your preferences',
    'Analyzing your selections',
    'Composing your result',
  ],
} as const;

export type LoaderStepKey = keyof typeof LOADER_STEPS;
