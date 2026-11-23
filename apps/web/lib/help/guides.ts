import { TOURS, type TourKey } from '@/lib/tours';
import { HOST_PAGE_TOURS } from '@/lib/host-page-tours';
import { featurePage, type FeatureSlug } from '@/lib/feature-pages';
import type { HelpCoverage } from '@/lib/help-ask-core';
import { routes } from '@/lib/routes';

/**
 * 📘 THE GUIDES IN HELP — the Guide & Help drawing (owner "Approved" 21 Nov 2026, re-confirmed 22 Nov; corpus
 * `prototypes/guide_help_2026-11-20/index.html` screens 1, 3, 4 and 6; DECISION_LOG 2026-11-21 "GUIDE & HELP DRAWING
 * APPROVED").
 *
 * ✍ NO GUIDE WORDS ARE WRITTEN HERE. A guide's steps ARE its page's spotlight tour (`lib/tours.ts`), read through
 * `TOURS` — the plan's rule (`GUIDES_HELP_AND_I_PLAN_2026-11-20.md`): "words are written once, in the page key's files.
 * The tour, the frame, the answers and the guide reuse them, so the four can never disagree." Change a tour and its
 * guide follows; retire a tour and its guide goes (the guard fails first). New guide WRITING waits for each page's new
 * design (DECISION_LOG 2026-11-21 "GUIDES WAIT FOR THE NEW DESIGNS"), and the database guide store is the paused
 * plumbing — so this list holds only the pages that already have a tour, and only the few words a tour cannot give: the
 * guide's title (in the words people search), the help topics it sits in, its "Take me there", and which shipped
 * capture is its app picture (a feature page's real 375 px shot — `lib/feature-pages`, never a drawn stand-in).
 *
 * 🔑 ONE PAGE KEY per app page: the ⓘ sheet on that page (`app/_components/help-ask/page-info.tsx`) reads the same
 * row, so its Show me, its Answers and its Read the full guide name one page.
 *
 * Server only in practice: it reads `lib/tours.ts`, which never reaches the browser
 * (`lib/tours-stay-on-the-server.test.ts`). Client parts take the plain words as props.
 * 🔒 `lib/help/guides-are-the-tours.test.ts`.
 */

export type GuideAudience = 'Hosts' | 'Suppliers' | 'Guests';

export type HelpGuide = {
  /** The page key — one per app page; also the guide's address: /help/guides/<key>. */
  key: string;
  /** In the words people search (the plan's guide list). */
  title: string;
  audience: GuideAudience;
  /** Which helps list it (the active account — never a picker). */
  coverage: ReadonlyArray<HelpCoverage>;
  /** Its steps: this tour's spotlight stops. */
  tourKey: TourKey;
  /** The help topics it sits on top of; the FIRST is its home (the ⓘ sheet's Answers). */
  topicKeys: ReadonlyArray<string>;
  /** "Take me there": the event screen, as a path under /dashboard/<eventId>/ ('' = the event's Today). */
  eventPath: string;
  /** The page's name on the ⓘ sheet and under Take me there ("Opens Guests"). */
  pageName: string;
  /** The real app picture: this feature page's first shot. */
  shotFrom: FeatureSlug;
};

/** In the order a host meets each page (the plan's host list). "Start here" is the first three of a help. */
export const HELP_GUIDES: ReadonlyArray<HelpGuide> = [
  {
    key: 'guests',
    title: 'Make your guest list',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.guests,
    topicKeys: ['host-guest-list', 'guests'],
    eventPath: 'guests',
    pageName: 'Guests',
    shotFrom: 'guest-list',
  },
  {
    key: 'seat-plan',
    title: 'Set up your seat plan',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.seatPlan,
    topicKeys: ['host-seat-plan'],
    eventPath: 'seating',
    pageName: 'Seat plan',
    shotFrom: 'seat-plan',
  },
  {
    key: 'budget',
    title: 'Make your budget',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.budget,
    topicKeys: ['host-budget-and-contracts', 'vendors-budget'],
    eventPath: 'budget',
    pageName: 'Budget',
    shotFrom: 'budget',
  },
  {
    key: 'suppliers',
    title: 'Find your suppliers',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.suppliers,
    topicKeys: ['vendors-budget'],
    eventPath: 'vendors',
    pageName: 'Suppliers',
    shotFrom: 'suppliers',
  },
  {
    key: 'mood-board',
    title: 'Make a mood board',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.moodBoard,
    topicKeys: ['host-mood-board', 'mood-board'],
    eventPath: 'studio/mood-board',
    pageName: 'Mood Board',
    shotFrom: 'mood-board',
  },
  {
    key: 'memories',
    title: 'Keep every photo in Memories',
    audience: 'Hosts',
    coverage: ['user'],
    tourKey: HOST_PAGE_TOURS.memories,
    topicKeys: ['host-papic-and-memories', 'papic'],
    eventPath: 'memories',
    pageName: 'Memories',
    shotFrom: 'papic',
  },
];

export type GuideStep = { title: string; body: string };
export type GuideShot = { src: string; alt: string };

/** The steps: the tour's stops in order (a once-only welcome is a greeting, not a step). */
export function guideSteps(guide: HelpGuide): GuideStep[] {
  const script = TOURS[guide.tourKey]?.spotlight;
  if (!script) return [];
  return script.steps.filter((s) => !s.welcome).map((s) => ({ title: s.title, body: s.body }));
}

/** "4 steps" — the count a row shows. */
export function stepsLine(n: number): string {
  return `${n} ${n === 1 ? 'step' : 'steps'}`;
}

/**
 * "about 2 minutes" — half a minute a step (read it, find it on the page), rounded up. A reading estimate drawn from
 * the step count, never stored: it moves with the tour.
 */
export function minutesLine(n: number): string {
  const m = Math.max(1, Math.ceil(n / 2));
  return `about ${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

/** The guide's real app picture (English words), or null when its feature page has none. */
export function guideShot(guide: HelpGuide): GuideShot | null {
  const shot = featurePage(guide.shotFrom)?.shots[0];
  return shot ? { src: shot.src, alt: shot.alt.en } : null;
}

/** "Take me there": the guide's page in this event (built from the event's own route — `lib/routes.ts`). */
export function guideDoorHref(guide: HelpGuide, eventId: string): string {
  const today = routes.dashboard.detail(eventId);
  return guide.eventPath ? `${today}/${guide.eventPath}` : today;
}

export function findGuide(key: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.key === key);
}

/** The guides this help lists — only those whose tour still has steps. */
export function guidesFor(coverage: HelpCoverage): HelpGuide[] {
  return HELP_GUIDES.filter((g) => g.coverage.includes(coverage) && guideSteps(g).length > 0);
}

/** The guides on top of one topic. */
export function guidesInTopic(topicKey: string, coverage: HelpCoverage): HelpGuide[] {
  return guidesFor(coverage).filter((g) => g.topicKeys.includes(topicKey));
}

/** The guide a topic's answers belong to (its first), for the Ask's "Full guide". */
export function guideForTopic(topicKey: string, coverage: HelpCoverage): HelpGuide | undefined {
  return guidesInTopic(topicKey, coverage)[0];
}

/** The guide a page's tour belongs to — the ⓘ sheet's page key, by the tour its page mounts. */
export function guideForTour(tourKey: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.tourKey === tourKey);
}
