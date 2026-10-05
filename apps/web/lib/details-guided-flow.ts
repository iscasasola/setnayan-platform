/**
 * lib/details-guided-flow.ts — DETAILS AS A GUIDED "WHAT'S LEFT", BY STAGE:
 * one thing at a time (Details part 5 → PR-2 "Setup by stage").
 *
 * Owner, 2026-09-29 (DECISION_LOG): *"it needs to be very easy"* ("IT NEEDS TO
 * BE VERY EASY — DETAILS OPENS AS A GUIDED WHAT'S LEFT") and *"yes, apply the
 * guided flow. but they can still pick a step anytime?"* ("THE GUIDED FLOW IS
 * APPROVED — AND ANY STEP CAN BE PICKED ANY TIME"). Owner, 2026-10-04 ("YES TO
 * ALL" — `EVENT_DETAILS_STUDY_2026-10-04_fable.md` § 3, § 7 PR-2): the rounds
 * become STAGES — "Finish your Event Hub" opens with **"Which stage do you want
 * ready?"** (Save the Date · RSVP · Invitation · The Day · Post Event), then
 * that stage's **Before we start** (approved 2026-10-01, frame 0), then its
 * steps, then its Ready screen; the picker shows each stage's progress after.
 *
 *   stages → before (once per stage) → step · step · … → ready → stages
 *
 * 🔑 EACH STEP IS A DETAILS ITEM — the same editor, shown one at a time (and,
 * where the item has sections, the one section it is: `piece`, e.g. RSVP's
 * "Reply by"). No new data: a step names the item(s) it shows (`items`), and
 * whether it is done is those items' OWN "done" (`DetailsItemModel.done`,
 * derived from what is already saved). A step whose items this event does not
 * have is simply not in the plan — which is how a birthday loses the march and
 * the Love Story (DECISION_LOG "THE PLAN ADAPTS TO EVERY EVENT TYPE").
 *
 * 🗂 A STAGE IS A FILTER, NEVER A SECOND HOME (`lib/stage-setup.ts`): a step
 * belongs to every stage whose parts draw its fact (`stages`), so a fact two
 * stages share — the names, the date — is ONE step: asked once (filled in one
 * stage, Next passes it in the other), counted for both.
 *
 * A step's STATE, from its items' done:
 *   · 'done'  — every item that has a "done" says done;
 *   · 'left'  — some item says not done (it stays in What's left until it is);
 *   · 'check' — no item has a "done" at all (what to ask: nothing to fill, its
 *               defaults work) — a look-over.
 *
 * NEXT goes to the next step of the stage that is not 'done' (so a look-over is
 * never skipped), then the stage's Ready screen. SKIP goes to the very next
 * screen and changes nothing — the step stays in What's left.
 *
 * Pure: no I/O, no React. Plain words on every step — no "stage" or "scene" in
 * a step's own words (only the picker asks "Which stage"), and no wedding word
 * (the march's name comes from its item's label, which the event type writes).
 */
import { formatCount } from '@/lib/format-number';
import type { DetailsItemContext, DetailsItemKey, WordsAndPlansInput } from '@/lib/maker-details-items';
import {
  WORDS_ITEM_KEYS,
  STORY_ITEM_KEYS,
  detailsItemApplies,
  wordsAndPlansItem,
  type StoryItemKey,
  type WordsItemKey,
} from '@/lib/maker-details-items';
import { yourEventDone, yourEventLabel, type YourEventFacts, type YourEventKind } from '@/lib/details-your-event';
import type { StoredPrintDetails } from '@/lib/print-pieces';
/* Types only: the setup's step table is built on the server (`hubSetupRound`) and handed in. */
import type { HubSetupRound, HubSetupStepKey } from '@/lib/hub-setup-steps';
import { SETUP_STAGES, isSetupStage, setupStageLabel, stagesOfStep, type SetupStage } from '@/lib/stage-setup';

/**
 * A ROUND IS A STAGE (owner 2026-10-04). Save the Date · RSVP · Invitation ·
 * The Day · Post Event — `lib/stage-setup.ts` `SETUP_STAGES`.
 */
export type GuidedRound = SetupStage;

export type GuidedStepKey =
  | HubSetupStepKey
  | 'names'
  | 'date'
  | 'theme'
  | 'logo'
  | 'hero'
  | 'love-story'
  | 'who'
  | 'rsvp'
  | 'reply-by'
  | 'venues'
  | 'schedule'
  | 'parents'
  | 'march'
  | 'colours'
  | 'message'
  | 'seat-plan'
  | 'papic';

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
  /** The Details item(s) this step shows, in order (a string: the Seat plan's may not exist yet). */
  items: readonly string[];
  /** The item's section this step is (`RSVP_PIECES` — the RSVP stage's three settings). */
  piece?: string;
  optional?: boolean;
  /** Only where guests reply from a list — a setup event whose guests do not reply is not asked it. */
  guestListOnly?: true;
  /** Its title — or, from its first item's label, where the event type writes the word. */
  title: string | ((itemLabel: string) => string);
  /** Where it shows, in plain words. */
  shows: (w: GuidedWords) => string;
};

/** What the plan's words need to know about the event. */
export type GuidedWords = {
  /** A solemn event has no countdown (`EventWords.solemn`). */
  solemn: boolean;
  /** The role set offers a parent role the invitation prints. */
  parentsOffered: boolean;
};

/**
 * THE FACTS, in the order a stage walks them (each stage takes the ones its
 * parts draw — `lib/stage-setup.ts` `STEP_PARTS`). DATA: a new step is a row,
 * never a new screen. The setup's own steps (`lib/hub-setup-steps.ts`, a
 * wedding) take the place of the row on the same item.
 */
export const GUIDED_STEPS: readonly StepDef[] = [
  { key: 'names', items: ['names'], title: 'Your names', shows: () => 'Shows on your page, your invitation, every print and every pass.' },
  {
    key: 'date',
    items: ['date'],
    title: 'Date & time',
    shows: (w) => (w.solemn ? 'Shows on your page and every print.' : 'Shows on your page, the countdown and every print.'),
  },
  { key: 'theme', items: ['theme'], title: 'Look', shows: () => 'The background, font and colours of your whole Event Hub and every print.' },
  { key: 'logo', items: ['logo'], title: 'Your logo', shows: () => 'On your page, in the centre of your QR code and on your prints.' },
  {
    key: 'hero',
    items: ['hero'],
    title: 'Cover photo',
    shows: () => 'The first thing guests see when they open your Event Hub — and what sits behind every part of it.',
  },
  {
    key: 'love-story',
    items: ['love-story'],
    optional: true,
    title: 'Love Story',
    shows: () => 'Optional — your story on your page, and a line of it on a card.',
  },
  { key: 'who', items: ['rsvp'], piece: 'who', title: 'How guests get in', shows: () => 'Who can reply — only the people on your list, or anyone you approve.' },
  { key: 'rsvp', items: ['rsvp'], piece: 'questions', guestListOnly: true, title: 'What to ask guests', shows: () => 'What guests answer when they reply.' },
  { key: 'reply-by', items: ['rsvp'], piece: 'reply-by', guestListOnly: true, title: 'Reply by', shows: () => 'The date guests reply by.' },
  { key: 'venues', items: ['venues'], title: 'Venues', shows: () => 'Shows on your invitation and every print. Not sure yet? Skip it for now.' },
  { key: 'schedule', items: ['schedule'], title: 'Schedule', shows: () => 'The run of the day — on your page and The Finer Details card.' },
  {
    key: 'parents',
    items: ['parents'],
    /* 👪 OPTIONAL, like the Love Story (review 2026-10-05): where the invitation
       prints parents, only they count — a co-host account never does — and a
       couple with none to list could otherwise never finish the stage. An
       optional step never holds its stage open; adding a parent still ticks it. */
    optional: true,
    title: (label) => label,
    shows: (w) => (w.parentsOffered ? 'Optional — the parents your invitation names.' : 'Optional — who guests reply to.'),
  },
  { key: 'march', items: ['march'], title: (label) => label, shows: () => 'Who walks, and in what order — on your invitation and The Entourage card.' },
  { key: 'colours', items: ['mood-board'], title: 'Your colours', shows: () => 'Your palette — on your cards, your QR code and what your suppliers see.' },
  { key: 'message', items: ['special-message'], title: 'Special message', shows: () => 'A few lines from you, on your invitation and your cards.' },
  { key: 'seat-plan', items: SEAT_PLAN_STEP_ITEMS, title: 'Seat plan', shows: () => 'Guests find their table on the day.' },
  { key: 'papic', items: ['papic'], title: 'Photos from your guests', shows: () => 'Your guests’ photos from the day, gathered in one gallery.' },
];

export type GuidedRoundWords = Readonly<Record<GuidedRound, { title: string; ready: string }>>;

/** Each stage's name (the one stage vocabulary — `setupStageLabel`) and the line its Ready screen leads with. */
function stageWords(ready: Record<GuidedRound, string>): GuidedRoundWords {
  return Object.fromEntries(SETUP_STAGES.map((s) => [s, { title: setupStageLabel(s), ready: ready[s] }])) as GuidedRoundWords;
}

/** An event's Ready lines. */
export const GUIDED_ROUNDS: GuidedRoundWords = stageWords({
  save_the_date: 'Your Save the Date is ready to send',
  'rsvp-stage': 'Your reply form is ready',
  rsvp: 'Your invitations are ready to send',
  event: 'Your day is set',
  editorial: 'Your Post Event fills itself from the day',
});

/**
 * 🕯 A WAKE'S READY LINES (owner 2026-09-29, DECISION_LOG "OWNER ANSWERS — TEN
 * OPEN QUESTIONS" (6)): nobody sends a wake a "Save the Date". The stages keep
 * the one vocabulary the Maker's Page ▾ uses for every type; what a Ready
 * screen promises is the wake's own.
 */
export const WAKE_ROUNDS: GuidedRoundWords = stageWords({
  save_the_date: 'Your news is ready to share',
  'rsvp-stage': 'Your reply form is ready',
  rsvp: 'Your service details are ready to share',
  event: 'Your day is set',
  editorial: 'Your Post Event fills itself from the day',
});

/** The stages' words for THIS event — read off its EventWords (`solemn` = the wake). */
export function guidedRoundsFor(words: Pick<GuidedWords, 'solemn'>): GuidedRoundWords {
  return words.solemn ? WAKE_ROUNDS : GUIDED_ROUNDS;
}

export type GuidedStepState = 'done' | 'left' | 'check';

export type GuidedStep = {
  key: GuidedStepKey;
  /** Every stage that shows this fact — a filter, never a second copy of the step. */
  stages: GuidedRound[];
  title: string;
  shows: string;
  optional: boolean;
  /** The items this event HAS, in the step's order — never empty. */
  items: DetailsItemKey[];
  /** The item's section this step opens on (RSVP's settings), or null — the whole item. */
  piece: string | null;
  /** Those of them still not done — the step opens on the first. */
  left: DetailsItemKey[];
  state: GuidedStepState;
  /** 🔓 A setup step's line: what filling it in turns on ("Unlocks: …" / "Unlocked: …"). */
  unlocks?: string;
};

/**
 * A setup step with no Details item — the guests' names, which open the Guest
 * list's import (`hubSetupGuestsHref`). Counted with its stages, listed on their
 * Ready screens as a link; never a screen of its own.
 */
export type GuidedLinkStep = {
  key: HubSetupStepKey;
  stages: GuidedRound[];
  title: string;
  shows: string;
  unlocks: string;
  state: GuidedStepState;
};

/**
 * A screen of the flow: the stage picker, a stage's Before we start, a step
 * (walked as part of `round`), or a stage's Ready screen.
 */
export type GuidedScreen =
  | { kind: 'stages' }
  | { kind: 'before'; round: GuidedRound }
  | { kind: 'step'; step: GuidedStepKey; round: GuidedRound }
  /** 🧭 A setup step with no item of its own (the guests' names) — a screen of
   *  the walk like every step (owner 2026-10-05: Skip jumped past it to Ready). */
  | { kind: 'link'; link: HubSetupStepKey; round: GuidedRound }
  | { kind: 'ready'; round: GuidedRound };

export type GuidedPlan = {
  steps: GuidedStep[];
  /** Setup steps that open a page instead of an item (the guests' names). */
  links: GuidedLinkStep[];
  /** The stages that have at least one step, in order (Post Event never — it fills itself). */
  rounds: GuidedRound[];
  /** The stages' names and Ready lines for THIS event (`guidedRoundsFor`). */
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
 * A section-step's state where the item's row cannot say it (one row, three
 * settings): how guests get in is onboarding's own answer (`ONBOARDING_A_FIELDS`
 * — asked once, never again), the reply-by date the setup's own fact (B5–6).
 * Without the setup's facts, neither makes a claim — a look-over.
 */
function sectionState(key: GuidedStepKey, setup: HubSetupRound | null): GuidedStepState | null {
  if (key === 'who') return setup ? 'done' : 'check';
  if (key === 'reply-by') return setup?.steps.find((s) => s.key === 'ask')?.state ?? 'check';
  return null;
}

/**
 * THE PLAN FOR THIS EVENT — built from the navigator's own rows (the items this
 * event has, each with its label and its done). A step with none of its items
 * here is not in the plan; a step no stage shows is not in the plan.
 */
export function buildGuidedPlan(items: readonly GuidedItem[], words: GuidedWords, setup: HubSetupRound | null = null): GuidedPlan {
  const roundWords = guidedRoundsFor(words);
  const byKey = new Map(items.map((i) => [i.key as string, i]));
  const steps: GuidedStep[] = [];
  const links: GuidedLinkStep[] = [];
  /* 🧭 "Finish your Event Hub" (the setup, B — a wedding): each setup step IS a
     Details item; its done is the setup's own fact (what is really in place).
     It takes the place of the row on the same WHOLE item, and an item the setup
     owns never returns as that row — one step per fact. A row on one SECTION of
     an item (`piece`) is its own fact, and stays. */
  const claimed = new Set<string>(setup?.claims ?? []);
  const setupByItem = new Map<string, HubSetupRound['steps'][number]>();
  for (const s of setup?.steps ?? []) {
    if (s.item !== null && byKey.has(s.item) && stagesOfStep(s.key).length > 0) setupByItem.set(s.item, s);
  }
  const placed = new Set<string>();
  const pushSetup = (s: HubSetupRound['steps'][number]) => {
    if (placed.has(s.key)) return;
    placed.add(s.key);
    const item = s.item as DetailsItemKey;
    steps.push({
      key: s.key,
      stages: stagesOfStep(s.key),
      title: s.title,
      shows: s.shows,
      optional: false,
      items: [item],
      piece: null,
      left: s.state === 'left' ? [item] : [],
      state: s.state,
      unlocks: s.unlocks,
    });
  };
  for (const def of GUIDED_STEPS) {
    const stages = stagesOfStep(def.key);
    if (stages.length === 0) continue;
    if (!def.piece && def.items.some((k) => claimed.has(k))) {
      for (const k of def.items) {
        const s = setupByItem.get(k);
        if (s) pushSetup(s);
      }
      continue;
    }
    if (def.guestListOnly && setup && !setup.guestList) continue;
    const here = def.items.map((k) => byKey.get(k)).filter((i): i is GuidedItem => i !== undefined);
    if (here.length === 0) continue;
    const state = sectionState(def.key, setup) ?? stepStateOf(here.map((i) => i.done));
    steps.push({
      key: def.key,
      stages,
      title: typeof def.title === 'string' ? def.title : def.title(here[0]!.label),
      shows: def.shows(words),
      optional: Boolean(def.optional),
      items: here.map((i) => i.key),
      piece: def.piece ?? null,
      /* The step opens on what is still to do — or, for a section the setup says is left, on its item. */
      left: state !== 'left' ? [] : here.some((i) => i.done === false) ? here.filter((i) => i.done === false).map((i) => i.key) : here.map((i) => i.key),
      state,
    });
  }
  // A setup step no row stands for, and the steps that open a page (the guests' names).
  for (const s of setup?.steps ?? []) {
    const stages = stagesOfStep(s.key);
    if (stages.length === 0) continue;
    if (s.item === null) links.push({ key: s.key, stages, title: s.title, shows: s.shows, unlocks: s.unlocks, state: s.state });
    else if (setupByItem.get(s.item) === s) pushSetup(s);
  }
  const rounds = SETUP_STAGES.filter((r) => steps.some((s) => s.stages.includes(r)) || links.some((l) => l.stages.includes(r)));
  return { steps, links, rounds, roundWords };
}

/**
 * 🔢 ONE COUNT — the plan the Maker walks, when Home and Event Details' read
 * (`readGuidedPlan`) is in hand: ITS steps, links and states — which steps
 * exist, so every "n of m" (`setupProgress`, `stageProgress`) is that read's
 * number, not only its ticks (review 2026-10-05: overriding states by key left
 * the TOTALS to the Maker's own item list). Only the words are the Maker's own,
 * where it draws the same step (its row labels name the step). Without the
 * shared read, the Maker's own plan, as before.
 */
export function oneCountPlan(shared: GuidedPlan | null | undefined, local: GuidedPlan): GuidedPlan {
  if (!shared) return local;
  const title = new Map<string, string>([...local.steps, ...local.links].map((s) => [s.key, s.title]));
  return {
    ...shared,
    steps: shared.steps.map((s) => ({ ...s, title: title.get(s.key) || s.title })),
    links: shared.links.map((l) => ({ ...l, title: title.get(l.key) || l.title })),
  };
}

/** A stage's name, as a line reads it: "Save the Date". */
export function roundName(plan: Pick<GuidedPlan, 'roundWords'>, round: GuidedRound): string {
  return plan.roundWords[round].title;
}

/** Any step's title by key — a screen's, or a link step's. */
export function stepTitleOf(plan: GuidedPlan, key: GuidedStepKey): string | null {
  return stepOf(plan, key)?.title ?? plan.links.find((l) => l.key === key)?.title ?? null;
}

/** The steps a stage walks, in the plan's order. */
export function stageSteps(plan: Pick<GuidedPlan, 'steps'>, round: GuidedRound): GuidedStep[] {
  return plan.steps.filter((s) => s.stages.includes(round));
}

/** A stage's link steps (the guests' names) — counted with it, walked after its steps. */
export function stageLinks(plan: Pick<GuidedPlan, 'links'>, round: GuidedRound): GuidedLinkStep[] {
  return plan.links.filter((l) => l.stages.includes(round));
}

/** Every screen of one stage, in order: Before we start, its steps, its link steps, its Ready screen. */
export function guidedScreens(plan: GuidedPlan, round: GuidedRound): GuidedScreen[] {
  return [
    { kind: 'before', round },
    ...stageSteps(plan, round).map((s): GuidedScreen => ({ kind: 'step', step: s.key, round })),
    ...stageLinks(plan, round).map((l): GuidedScreen => ({ kind: 'link', link: l.key, round })),
    { kind: 'ready', round },
  ];
}

function sameScreen(a: GuidedScreen, b: GuidedScreen): boolean {
  if (a.kind === 'stages' || b.kind === 'stages') return a.kind === b.kind;
  if (a.kind === 'step') return b.kind === 'step' && a.step === b.step && a.round === b.round;
  if (a.kind === 'link') return b.kind === 'link' && a.link === b.link && a.round === b.round;
  return a.kind === b.kind && a.round === b.round;
}

function indexOf(plan: GuidedPlan, at: Exclude<GuidedScreen, { kind: 'stages' }>): number {
  return guidedScreens(plan, at.round).findIndex((s) => sameScreen(s, at));
}

export function stepOf(plan: GuidedPlan, key: GuidedStepKey): GuidedStep | null {
  return plan.steps.find((s) => s.key === key) ?? null;
}

/**
 * The step an item (and its section) belongs to, or null — an item no step
 * shows. Within `round` first, so a stage being walked keeps its own step; a
 * step on the item's section wins over the item's other steps.
 */
export function stepOfItem(plan: GuidedPlan, item: DetailsItemKey, round: GuidedRound | null = null, piece: string | null = null): GuidedStep | null {
  const all = plan.steps.filter((s) => s.items.includes(item));
  const pool = (round ? all.filter((s) => s.stages.includes(round)) : []).concat(all);
  return pool.find((s) => piece !== null && s.piece === piece) ?? pool[0] ?? null;
}

/**
 * NEXT — from Before we start, or a step: the next step of the stage that is
 * not done (a look-over is never skipped), else the stage's Ready screen. From
 * a Ready screen: back to the stages. The picker itself has no Next — a stage
 * is picked.
 */
export function nextScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  if (at.kind === 'stages') return null;
  if (at.kind === 'ready') return { kind: 'stages' };
  const all = guidedScreens(plan, at.round);
  const i = indexOf(plan, at);
  if (i < 0) return firstOpenScreen(plan, at.round);
  for (let j = i + 1; j < all.length; j++) {
    const s = all[j]!;
    if (s.kind === 'ready' || (s.kind === 'step' && stepOf(plan, s.step)?.state !== 'done')) return s;
    if (s.kind === 'link' && plan.links.find((l) => l.key === s.link)?.state !== 'done') return s;
  }
  return null;
}

/** SKIP — the very next screen; nothing is marked. From a Ready screen, the stages. */
export function skipScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  if (at.kind === 'stages') return null;
  if (at.kind === 'ready') return { kind: 'stages' };
  const all = guidedScreens(plan, at.round);
  return all[indexOf(plan, at) + 1] ?? null;
}

/** BACK — the screen before; from Before we start, the stages; null on the picker. */
export function backScreen(plan: GuidedPlan, at: GuidedScreen): GuidedScreen | null {
  if (at.kind === 'stages') return null;
  if (at.kind === 'before') return { kind: 'stages' };
  const all = guidedScreens(plan, at.round);
  const i = indexOf(plan, at);
  return i > 0 ? all[i - 1]! : { kind: 'stages' };
}

/** Is anything that is not optional still left? — "an unfinished event". */
export function isUnfinished(plan: GuidedPlan): boolean {
  return plan.steps.some((s) => s.state === 'left' && !s.optional) || plan.links.some((l) => l.state === 'left');
}

/**
 * Where a stage's walk opens — its first step still left (an optional one only
 * when nothing else is), else its Ready screen (which lists a link step left).
 */
export function firstOpenScreen(plan: GuidedPlan, round: GuidedRound): GuidedScreen {
  const mine = stageSteps(plan, round);
  const left = mine.find((s) => s.state === 'left' && !s.optional) ?? mine.find((s) => s.state === 'left');
  if (left) return { kind: 'step', step: left.key, round };
  const link = stageLinks(plan, round).find((l) => l.state === 'left');
  return link ? { kind: 'link', link: link.key, round } : { kind: 'ready', round };
}

/**
 * A stage picked: its Before we start the first time, then straight to its
 * first step still left. "I'm ready" and "Start anyway" both go past it
 * (`firstOpenScreen`) — Before we start never stands between the host and the
 * steps once seen.
 */
export function startScreen(plan: GuidedPlan, round: GuidedRound, beforeSeen: boolean): GuidedScreen {
  return beforeSeen ? firstOpenScreen(plan, round) : { kind: 'before', round };
}

/** The steps (and link steps) a stage counts — for "2 of 6". */
function stageCount(plan: GuidedPlan, round: GuidedRound): number {
  return stageSteps(plan, round).length + plan.links.filter((l) => l.stages.includes(round)).length;
}

/** "Save the Date · 3 of 7" — where this screen sits in its stage; "… · Apply" on its Ready (never "done" — it may not be). */
export function progressLabel(plan: GuidedPlan, at: GuidedScreen): string {
  if (at.kind === 'stages') return 'Which stage?';
  const lead = roundName(plan, at.round);
  if (at.kind === 'ready') return `${lead} · Apply`;
  if (at.kind === 'before') return `${lead} · Before we start`;
  const mine = stageSteps(plan, at.round);
  if (at.kind === 'link') {
    const j = stageLinks(plan, at.round).findIndex((l) => l.key === at.link);
    return j < 0 ? lead : `${lead} · ${formatCount(mine.length + j + 1)} of ${formatCount(stageCount(plan, at.round))}`;
  }
  const i = mine.findIndex((s) => s.key === at.step);
  if (i < 0) return lead;
  return `${lead} · ${formatCount(i + 1)} of ${formatCount(stageCount(plan, at.round))}`;
}

/** How far along the bar is — this screen's place in its stage, 0–1. */
export function progressShare(plan: GuidedPlan, at: GuidedScreen): number {
  if (at.kind === 'ready') return 1;
  if (at.kind === 'link') {
    const total = stageCount(plan, at.round);
    const j = stageLinks(plan, at.round).findIndex((l) => l.key === at.link);
    return total === 0 ? 0 : (stageSteps(plan, at.round).length + j + 1) / total;
  }
  if (at.kind !== 'step') return 0;
  const mine = stageSteps(plan, at.round);
  const i = mine.findIndex((s) => s.key === at.step);
  return i < 0 || mine.length === 0 ? 0 : (i + 1) / mine.length;
}

/* ══ THE ADDRESS ════════════════════════════════════════════════════════════
   `?guide=1` opens the stage picker (every door's address: Home's card, the
   once-offer's Start, the Maker's What's left); `?guide=walk-rsvp` walks the
   Invitation (on the item the address names, else its first step left);
   `?guide=before-event` is The Day's Before we start; `?guide=ready-rsvp-stage`
   the RSVP stage's Ready screen. Anything else is not the flow. */

export const GUIDE_PARAM = 'guide';

export type GuideAddress =
  | { kind: 'stages' }
  | { kind: 'before' | 'walk' | 'ready'; round: GuidedRound }
  | null;

const ADDRESS_KINDS = ['before', 'walk', 'ready'] as const;

export function parseGuideParam(v: string | null | undefined): GuideAddress {
  if (v === '1') return { kind: 'stages' };
  for (const kind of ADDRESS_KINDS) {
    const prefix = `${kind}-`;
    if (v?.startsWith(prefix) && isSetupStage(v.slice(prefix.length))) return { kind, round: v.slice(prefix.length) as GuidedRound };
  }
  return null;
}

export function guideParamOf(at: GuidedScreen): string {
  switch (at.kind) {
    case 'stages':
      return '1';
    case 'step':
    case 'link':
      return `walk-${at.round}`;
    default:
      return `${at.kind}-${at.round}`;
  }
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
   * 🪑 The Seat plan is ARRANGED — at least one guest is seated
   * (\`event_seat_assignments\`). Its row's done (\`seatPlanRow\`). Deliberately
   * NOT whether guests can see it: from 2026-09-30 seats open by themselves on
   * the event's day, so a visibility "done" could never be finished before the
   * day (controller ruling). Null/absent = unread (no claim).
   */
  seatPlanArranged?: boolean | null;
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
      return f.seatPlanArranged ?? undefined;
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
  /** 🧭 The setup round, built on the server (`hubSetupRound`) — null where the setup is not drawn. */
  setup?: HubSetupRound | null;
}): GuidedPlan {
  const items: GuidedItem[] = [];
  for (const key of input.present) {
    if (!detailsItemApplies(key, input.ctx)) continue;
    const label = EVENT_KEYS.has(key) && input.facts.kind ? yourEventLabel(key as 'names', input.facts.kind) : '';
    items.push({ key, label, done: guidedItemDone(key, input.facts) });
  }
  return buildGuidedPlan(items, { solemn: input.ctx.solemn, parentsOffered: input.parentsOffered }, input.setup ?? null);
}
