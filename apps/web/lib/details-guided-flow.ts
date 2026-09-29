/**
 * lib/details-guided-flow.ts — DETAILS AS A GUIDED "WHAT'S LEFT": three
 * rounds, one thing at a time (Details part 5).
 *
 * Owner, 2026-09-29 (DECISION_LOG): *"it needs to be very easy"* ("IT NEEDS TO
 * BE VERY EASY — DETAILS OPENS AS A GUIDED WHAT'S LEFT"), the order *"find the
 * appropriate sequence from step 1-finish"* ("THE EVENT HUB SEQUENCE, STEP 1 TO
 * FINISH — THREE ROUNDS, EACH ENDING IN APPLY"), and *"yes, apply the guided
 * flow. but they can still pick a step anytime?"* ("THE GUIDED FLOW IS APPROVED
 * — AND ANY STEP CAN BE PICKED ANY TIME"). Approved prototypes:
 * `Setnayan/prototypes/event_hub_sequence_2026-09-29.html` and
 * `details_themes_page_2026-09-28.html?view=easy`.
 *
 * 🔑 EACH STEP IS A DETAILS ITEM — the same editor, shown one at a time. No new
 * data: a step names the item(s) it shows (`items`), and whether it is done is
 * those items' OWN "done" (`DetailsItemModel.done`, derived from what is already
 * saved). A step whose items this event does not have is simply not in the plan
 * — which is how a birthday loses the march and the Love Story, and how the
 * Seat plan step waits for its item (DECISION_LOG "THE PLAN ADAPTS TO EVERY
 * EVENT TYPE").
 *
 *   Round 1 · Save the Date — names · date & time · venues · theme · colours ·
 *                             logo · first screen → Ready (Preview · Share · Apply)
 *   Round 2 · Invitations   — parents & hosts · the march · schedule · RSVP ·
 *                             words · Love Story (optional) · check your prints
 *                             → Ready (Send invitations · Apply)
 *   Round 3 · The day       — seat plan · day-of prints → Ready (Apply)
 *
 * A step's STATE, from its items' done:
 *   · 'done'  — every item that has a "done" says done;
 *   · 'left'  — some item says not done (it stays in What's left until it is);
 *   · 'check' — no item has a "done" at all (RSVP, the whole set, the day-of
 *               prints: nothing to fill, their defaults work) — a look-over.
 *
 * NEXT goes to the next step in the round that is not 'done' (so a look-over is
 * never skipped), then the round's Ready screen. SKIP goes to the very next
 * screen and changes nothing — the step stays in What's left.
 *
 * Pure: no I/O, no React. Plain words only — no "stage" or "scene" on this path,
 * and no wedding word (the march's name comes from its item's label, which the
 * event type writes).
 */
import { formatCount } from '@/lib/format-number';
import type { DetailsItemContext, DetailsItemKey, WordsAndPlansInput } from '@/lib/maker-details-items';
import {
  FREE_PRINT_KEYS,
  WORDS_ITEM_KEYS,
  STORY_ITEM_KEYS,
  detailsItemApplies,
  wordsAndPlansItem,
  type StoryItemKey,
  type WordsItemKey,
} from '@/lib/maker-details-items';
import { yourEventDone, yourEventLabel, type YourEventFacts, type YourEventKind } from '@/lib/details-your-event';
import type { StoredPrintDetails } from '@/lib/print-pieces';

export type GuidedRound = 1 | 2 | 3;

export type GuidedStepKey =
  | 'names'
  | 'date'
  | 'venues'
  | 'theme'
  | 'colours'
  | 'logo'
  | 'hero'
  | 'parents'
  | 'march'
  | 'schedule'
  | 'rsvp'
  | 'words'
  | 'love-story'
  | 'prints'
  | 'seat-plan'
  | 'day-prints';

/**
 * 🪑 THE SEAT PLAN STEP'S ITEM. The Seat plan tool moves into Details as its own
 * item ("THE SEAT PLAN IS LIVE BEHIND ONE DOOR — 'GUESTS SEE THIS NOW'", Details
 * part 4). Until that item exists the step is not in the plan — "skip if
 * absent". Its key is not a `DetailsItemKey` yet, so it is named as a string;
 * `details-guided-flow.test.ts` fails the day a seat item joins Details that
 * this list does not name, so the step can never wait for a key nobody used.
 */
export const SEAT_PLAN_STEP_ITEMS: readonly string[] = ['seating'];

type StepDef = {
  key: GuidedStepKey;
  round: GuidedRound;
  /** The Details item(s) this step shows, in order (a string: the Seat plan's may not exist yet). */
  items: readonly string[];
  optional?: boolean;
  /** Its title — or, from its first item's label, where the event type writes the word. */
  title: string | ((itemLabel: string) => string);
  /** Where it shows, in plain words. */
  shows: (w: GuidedWords) => string;
};

/** What the plan's words need to know about the celebration. */
export type GuidedWords = {
  /** A solemn event has no countdown (`EventWords.solemn`). */
  solemn: boolean;
  /** The role set offers a parent role the invitation prints. */
  parentsOffered: boolean;
};

/**
 * THE SEQUENCE — the approved order (DECISION_LOG "THE EVENT HUB SEQUENCE,
 * STEP 1 TO FINISH"). DATA: a new step is a row, never a new screen.
 */
export const GUIDED_STEPS: readonly StepDef[] = [
  { key: 'names', round: 1, items: ['names'], title: 'Your names', shows: () => 'Shows on your page, your invitation, every print and every pass.' },
  {
    key: 'date',
    round: 1,
    items: ['date'],
    title: 'Date & time',
    shows: (w) => (w.solemn ? 'Shows on your page and every print.' : 'Shows on your page, the countdown and every print.'),
  },
  { key: 'venues', round: 1, items: ['venues'], title: 'Venues', shows: () => 'Shows on your invitation and every print. Not sure yet? Skip it for now.' },
  { key: 'theme', round: 1, items: ['theme'], title: 'Theme', shows: () => 'The look of your whole Event Hub and every print.' },
  { key: 'colours', round: 1, items: ['mood-board'], title: 'Your colours', shows: () => 'Your palette — on your cards, your QR code and what your suppliers see.' },
  { key: 'logo', round: 1, items: ['logo'], title: 'Your logo', shows: () => 'On your page, in the centre of your QR code and on your prints.' },
  { key: 'hero', round: 1, items: ['hero'], title: 'First screen', shows: () => 'The first thing guests see when they open your Event Hub.' },

  {
    key: 'parents',
    round: 2,
    items: ['parents'],
    title: (label) => label,
    shows: (w) => (w.parentsOffered ? 'Parents show on your invitation. Hosts are who guests reply to.' : 'Hosts are who guests reply to.'),
  },
  { key: 'march', round: 2, items: ['march'], title: (label) => label, shows: () => 'Who walks, and in what order — on your invitation and The Entourage card.' },
  { key: 'schedule', round: 2, items: ['schedule'], title: 'Schedule', shows: () => 'The run of the day — on your page and The Finer Details card.' },
  { key: 'rsvp', round: 2, items: ['rsvp'], title: 'RSVP', shows: () => 'What guests answer when they reply, and by when.' },
  {
    key: 'words',
    round: 2,
    items: ['opening-line', 'kindly-reply', 'special-message'],
    title: 'Your words',
    shows: () => 'The lines on your invitation and your cards.',
  },
  {
    key: 'love-story',
    round: 2,
    items: ['love-story'],
    optional: true,
    title: 'Love Story',
    shows: () => 'Optional — your story on your page, and a line of it on a card.',
  },
  { key: 'prints', round: 2, items: ['download'], title: 'Check your prints', shows: () => 'Your whole set, in your look — save what you need.' },

  { key: 'seat-plan', round: 3, items: SEAT_PLAN_STEP_ITEMS, title: 'Seat plan', shows: () => 'Guests find their table on the day — once you switch it on.' },
  {
    key: 'day-prints',
    round: 3,
    items: FREE_PRINT_KEYS,
    title: 'Day-of prints',
    shows: () => 'The desk list, guest QR codes, the seat plan and the caterer’s counts.',
  },
];

export type GuidedRoundWords = Readonly<Record<GuidedRound, { title: string; ready: string }>>;

/** Each round's name and the line its Ready screen leads with — a celebration's. */
export const GUIDED_ROUNDS: GuidedRoundWords = {
  1: { title: 'Save the Date', ready: 'Your Save the Date is ready to send' },
  2: { title: 'Invitations', ready: 'Your invitations are ready to send' },
  3: { title: 'The day', ready: 'Your day is set' },
};

/**
 * 🕯 A WAKE'S ROUNDS (owner 2026-09-29, DECISION_LOG "OWNER ANSWERS — TEN OPEN
 * QUESTIONS" (6): per-type round names, YES — wake → "Share the news · Service
 * details · The day"; christening / debut / birthday keep the celebration's).
 * Nobody sends a wake a "Save the Date".
 */
export const WAKE_ROUNDS: GuidedRoundWords = {
  1: { title: 'Share the news', ready: 'Your news is ready to share' },
  2: { title: 'Service details', ready: 'Your service details are ready to share' },
  3: { title: 'The day', ready: 'Your day is set' },
};

/** The rounds' words for THIS event — read off its EventWords (`solemn` = the wake). */
export function guidedRoundsFor(words: Pick<GuidedWords, 'solemn'>): GuidedRoundWords {
  return words.solemn ? WAKE_ROUNDS : GUIDED_ROUNDS;
}

export type GuidedStepState = 'done' | 'left' | 'check';

export type GuidedStep = {
  key: GuidedStepKey;
  round: GuidedRound;
  /** The round's name for THIS event (`guidedRoundsFor`). */
  roundTitle: string;
  title: string;
  shows: string;
  optional: boolean;
  /** The items this event HAS, in the step's order — never empty. */
  items: DetailsItemKey[];
  /** Those of them still not done — the step opens on the first. */
  left: DetailsItemKey[];
  state: GuidedStepState;
};

/** A screen of the flow: a step, or a round's Ready screen. */
export type GuidedScreen = { kind: 'step'; step: GuidedStepKey } | { kind: 'ready'; round: GuidedRound };

export type GuidedPlan = {
  steps: GuidedStep[];
  /** The rounds that have at least one step, in order. */
  rounds: GuidedRound[];
  /** The rounds' names and Ready lines for THIS event (`guidedRoundsFor`). */
  roundWords: GuidedRoundWords;
};

/** One item as the plan needs it — the navigator's row (`DetailsItemModel`). */
export type GuidedItem = { key: DetailsItemKey; label: string; done?: boolean };

/** A step's state from its items' "done" (see the docblock). */
export function stepStateOf(dones: ReadonlyArray<boolean | undefined>): GuidedStepState {
  if (dones.some((d) => d === false)) return 'left';
  if (dones.every((d) => d === undefined)) return 'check';
  return 'done';
}

/**
 * THE PLAN FOR THIS EVENT — built from the navigator's own rows (the items this
 * celebration has, each with its label and its done). A step with none of its
 * items here is not in the plan.
 */
export function buildGuidedPlan(items: readonly GuidedItem[], words: GuidedWords): GuidedPlan {
  const roundWords = guidedRoundsFor(words);
  const byKey = new Map(items.map((i) => [i.key as string, i]));
  const steps: GuidedStep[] = [];
  for (const def of GUIDED_STEPS) {
    const here = def.items.map((k) => byKey.get(k)).filter((i): i is GuidedItem => i !== undefined);
    if (here.length === 0) continue;
    steps.push({
      key: def.key,
      round: def.round,
      roundTitle: roundWords[def.round].title,
      title: typeof def.title === 'string' ? def.title : def.title(here[0]!.label),
      shows: def.shows(words),
      optional: Boolean(def.optional),
      items: here.map((i) => i.key),
      left: here.filter((i) => i.done === false).map((i) => i.key),
      state: stepStateOf(here.map((i) => i.done)),
    });
  }
  const rounds = ([1, 2, 3] as const).filter((r) => steps.some((s) => s.round === r));
  return { steps, rounds, roundWords };
}

/** Every screen, in order: each round's steps, then its Ready screen. */
export function guidedScreens(plan: GuidedPlan): GuidedScreen[] {
  return plan.rounds.flatMap((r) => [
    ...plan.steps.filter((s) => s.round === r).map((s): GuidedScreen => ({ kind: 'step', step: s.key })),
    { kind: 'ready', round: r } as GuidedScreen,
  ]);
}

function sameScreen(a: GuidedScreen, b: GuidedScreen): boolean {
  return a.kind === 'step' ? b.kind === 'step' && a.step === b.step : b.kind === 'ready' && a.round === b.round;
}

function indexOf(plan: GuidedPlan, at: GuidedScreen): number {
  return guidedScreens(plan).findIndex((s) => sameScreen(s, at));
}

export function stepOf(plan: GuidedPlan, key: GuidedStepKey): GuidedStep | null {
  return plan.steps.find((s) => s.key === key) ?? null;
}

/** The step an item belongs to (its first), or null — an item no step shows. */
export function stepOfItem(plan: GuidedPlan, item: DetailsItemKey): GuidedStep | null {
  return plan.steps.find((s) => s.items.includes(item)) ?? null;
}

/**
 * NEXT — the next step in this round that is not done (a look-over is never
 * skipped), else the round's Ready screen. From a Ready screen, the next
 * round's first unfinished step (or its Ready). Null after the last Ready.
 */
export function nextScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  const all = guidedScreens(plan);
  const i = indexOf(plan, at);
  if (i < 0) return firstOpenScreen(plan);
  /* The screens run round by round, each round's Ready after its steps — so
     walking forward from a step meets its own round's Ready before any later
     step, and from a Ready it meets the next round's steps, then that Ready. */
  for (let j = i + 1; j < all.length; j++) {
    const s = all[j]!;
    if (s.kind === 'ready' || stepOf(plan, s.step)?.state !== 'done') return s;
  }
  return null;
}

/** SKIP — the very next screen; nothing is marked. Null after the last. */
export function skipScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  const all = guidedScreens(plan);
  const i = indexOf(plan, at);
  return all[i + 1] ?? null;
}

/** BACK — the screen before, or null on the first. */
export function backScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  const all = guidedScreens(plan);
  const i = indexOf(plan, at);
  return i > 0 ? all[i - 1]! : null;
}

/** Is anything that is not optional still left? — "an unfinished event". */
export function isUnfinished(plan: GuidedPlan): boolean {
  return plan.steps.some((s) => s.state === 'left' && !s.optional);
}

/**
 * Where the flow opens — the first step still left (an optional one only when
 * nothing else is), else the last round's Ready screen.
 */
export function firstOpenScreen(plan: GuidedPlan): GuidedScreen | null {
  const left = plan.steps.find((s) => s.state === 'left' && !s.optional) ?? plan.steps.find((s) => s.state === 'left');
  if (left) return { kind: 'step', step: left.key };
  const last = plan.rounds[plan.rounds.length - 1];
  return last ? { kind: 'ready', round: last } : null;
}

/** "Round 1 · 3 of 7" — where this screen sits in its round; "Round 1 · Apply" on its Ready (never "done" — it may not be). */
export function progressLabel(plan: GuidedPlan, at: GuidedScreen): string {
  if (at.kind === 'ready') return `Round ${at.round} · Apply`;
  const step = stepOf(plan, at.step);
  if (!step) return '';
  const inRound = plan.steps.filter((s) => s.round === step.round);
  return `Round ${step.round} · ${formatCount(inRound.indexOf(step) + 1)} of ${formatCount(inRound.length)}`;
}

/** How far along the bar is — this screen's place in its round, 0–1. */
export function progressShare(plan: GuidedPlan, at: GuidedScreen): number {
  if (at.kind === 'ready') return 1;
  const step = stepOf(plan, at.step);
  if (!step) return 0;
  const inRound = plan.steps.filter((s) => s.round === step.round);
  return (inRound.indexOf(step) + 1) / inRound.length;
}

/**
 * HOME's line — "Round N · x of y · Continue": the first round with a step
 * still left (optional steps never hold a round open), how many of its steps
 * are no longer left, and where Continue opens. Null when nothing is left.
 */
export function homeProgress(plan: GuidedPlan): { round: GuidedRound; title: string; done: number; total: number; next: GuidedStepKey } | null {
  for (const r of plan.rounds) {
    const inRound = plan.steps.filter((s) => s.round === r);
    const left = inRound.find((s) => s.state === 'left' && !s.optional);
    if (!left) continue;
    return {
      round: r,
      title: plan.roundWords[r].title,
      done: inRound.filter((s) => s.state !== 'left').length,
      total: inRound.length,
      next: left.key,
    };
  }
  return null;
}

/* ══ THE ADDRESS ════════════════════════════════════════════════════════════
   `?guide=1` opens the flow where it should (`firstOpenScreen`, or the step of
   the item the address names); `?guide=ready-2` opens Round 2's Ready screen.
   Anything else is not the flow. */

export const GUIDE_PARAM = 'guide';

export type GuideAddress = { ready: GuidedRound | null } | null;

export function parseGuideParam(v: string | null | undefined): GuideAddress {
  if (v === '1') return { ready: null };
  const m = /^ready-([123])$/.exec(v ?? '');
  return m ? { ready: Number(m[1]) as GuidedRound } : null;
}

export function guideParamOf(at: GuidedScreen): string {
  return at.kind === 'ready' ? `ready-${at.round}` : '1';
}

/* ══ "DONE" FROM WHAT IS ALREADY SAVED — for the pages that decide before
   Details draws (the Maker opening on the flow; Home's line) ═════════════════
   Each answer is the SAME function the navigator's row asks
   (`yourEventDone`, `wordsAndPlansItem`), fed the same facts — never a second
   opinion of what "done" means. */

export type GuidedDoneFacts = {
  /** Your event's facts (`loadYourEvent` / `readYourEventFacts`); null = unread (no claim). */
  yourEvent: YourEventFacts | null;
  /** The event type's own facts, for the words its items carry; null = unread. */
  kind: YourEventKind | null;
  themeChosen: boolean;
  palette: boolean;
  logo: boolean;
  hero: boolean;
  words: WordsAndPlansInput;
  /**
   * 🪑 The Seat plan's door (\`event_floor_plan.published_at\`) — its row's done
   * (\`seatPlanRow\`: "guests see it"). Null/absent = unread (no claim).
   */
  seatPlanOpen?: boolean | null;
};

const EVENT_KEYS = new Set<string>(['names', 'date', 'venues', 'parents', 'march']);

/** One item's done, as its navigator row says it. Undefined = "done" means nothing for it (or it could not be read). */
export function guidedItemDone(key: DetailsItemKey, f: GuidedDoneFacts): boolean | undefined {
  if (EVENT_KEYS.has(key)) return f.yourEvent ? yourEventDone(key as 'names', f.yourEvent) : undefined;
  if ((WORDS_ITEM_KEYS as readonly string[]).includes(key) || (STORY_ITEM_KEYS as readonly string[]).includes(key)) {
    return wordsAndPlansItem(key as WordsItemKey | StoryItemKey, f.words).done;
  }
  switch (key) {
    case 'theme':
      return f.themeChosen;
    case 'mood-board':
      return f.palette;
    case 'logo':
      return f.logo;
    case 'hero':
      return f.hero;
    case 'seating':
      return f.seatPlanOpen ?? undefined;
    default:
      return undefined;
  }
}

/**
 * The Words · Story & plans row input — ONE builder, used by the navigator
 * (`maker-details.tsx`) and by the pages that decide before it draws, so the
 * two can never read a different "done" from the same saved words.
 */
export function wordsAndPlansInputFrom(input: {
  specialMessage: string | null;
  pabuyaMessage: string | null;
  stored: StoredPrintDetails;
  /** Null = the story could not be read; 0 where this type has no Love Story. */
  loveStoryMoments: number | null;
  scheduleMoments: number | null;
}): WordsAndPlansInput {
  const inc = input.stored.include;
  return {
    specialMessage: input.specialMessage,
    thankYou: input.pabuyaMessage,
    openingLine: input.stored.openingLine,
    kindlyReply: Boolean(input.stored.rsvp),
    include: {
      specialMessage: inc.specialMessage,
      thankYou: inc.thankYou,
      openingLine: inc.openingLine,
      rsvp: inc.rsvp,
      loveStory: inc.loveStory !== 'none',
      schedule: inc.schedule,
    },
    loveStoryMoments: input.loveStoryMoments,
    scheduleMoments: input.scheduleMoments,
  };
}

/**
 * The plan from saved facts — which items this event has (`present`, then the
 * type's own rule `detailsItemApplies`), each with the done its row would show.
 */
export function guidedPlanFromFacts(input: {
  ctx: DetailsItemContext;
  present: ReadonlySet<DetailsItemKey>;
  facts: GuidedDoneFacts;
  parentsOffered: boolean;
}): GuidedPlan {
  const items: GuidedItem[] = [];
  for (const key of input.present) {
    if (!detailsItemApplies(key, input.ctx)) continue;
    const label = EVENT_KEYS.has(key) && input.facts.kind ? yourEventLabel(key as 'names', input.facts.kind) : '';
    items.push({ key, label, done: guidedItemDone(key, input.facts) });
  }
  return buildGuidedPlan(items, { solemn: input.ctx.solemn, parentsOffered: input.parentsOffered });
}
