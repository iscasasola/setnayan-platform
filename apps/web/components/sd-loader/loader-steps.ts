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

/**
 * ROUTE_STEPS — narration for the route-navigation brand loader (the gold mark
 * that fades in over a page skeleton on section changes; see
 * components/loading-activity.tsx). Keyed by the section the URL resolves to.
 *
 * Route loading is a shorter beat than a blocking action, so 3 lines each; the
 * loader HOLDS on the last. `hint` is the small uppercase sublabel under the
 * status line — the human name of the section being opened. Unknown sections
 * fall back to `route`.
 */
export const ROUTE_STEPS = {
  route: {
    steps: ['Opening your event', 'Gathering your details', 'Almost ready'],
    hint: 'Setnayan',
  },
  guests: {
    steps: ['Opening your guest list', 'Counting your RSVPs', 'Sorting your tables'],
    hint: 'Guest list',
  },
  vendors: {
    steps: ['Opening your vendors', 'Loading their details', 'Checking your bookings'],
    hint: 'Vendors',
  },
  budget: {
    steps: ['Opening your budget', 'Tallying your payments', 'Balancing the numbers'],
    hint: 'Budget',
  },
  schedule: {
    steps: ['Opening your schedule', 'Lining up the timeline', 'Syncing your day'],
    hint: 'Schedule',
  },
  seating: {
    steps: ['Opening your seat plan', 'Arranging the tables', 'Placing your guests'],
    hint: 'Seat plan',
  },
  messages: {
    steps: ['Opening your messages', 'Loading your threads', 'Catching you up'],
    hint: 'Messages',
  },
  studio: {
    steps: ['Opening your studio', 'Loading your services', 'Preparing your canvas'],
    hint: 'Studio',
  },
  website: {
    steps: ['Opening your site', 'Loading your design', 'Bringing in your photos'],
    hint: 'Website',
  },
  explore: {
    steps: ['Reading your preferences', 'Cross-referencing vendors', 'Ranking your best matches'],
    hint: 'Explore',
  },
  orders: {
    steps: ['Opening your orders', 'Loading your services', 'Checking each status'],
    hint: 'Orders',
  },
  workspace: {
    steps: ['Opening the workspace', 'Loading messages & payments', 'Bringing in your documents'],
    hint: 'Workspace',
  },
  admin: {
    steps: ['Opening the console', 'Loading the latest', 'Getting things ready'],
    hint: 'Console',
  },
  vendorDashboard: {
    steps: ['Opening your dashboard', 'Loading your business', 'Getting things ready'],
    hint: 'Dashboard',
  },
} as const;
