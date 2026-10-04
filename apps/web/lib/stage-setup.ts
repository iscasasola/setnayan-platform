/**
 * lib/stage-setup.ts — "FINISH YOUR EVENT HUB", BY STAGE (PR-2).
 *
 * Owner, 2026-10-04 (DECISION_LOG "YES TO ALL" — the Event Details study
 * `EVENT_DETAILS_STUDY_2026-10-04_fable.md` § 3 and § 7 PR-2; screens 1–3 of
 * `prototypes/event_details_improved_2026-10-04_fable.html`): the setup opens
 * with **"Which stage do you want ready?"** — Save the Date · RSVP ·
 * Invitation · The Day · Post Event, the same five the Maker's Page ▾ names —
 * and each stage counts "n of m" from the facts THAT stage shows.
 *
 * 🔑 A STAGE IS A FILTER OVER THE ONE RECORD, NEVER A SECOND HOME. Nothing here
 * stores anything. A fact (a step of the guided flow, `lib/details-guided-flow.ts`
 * — each one a Details item, the SAME field the Maker opens) belongs to every
 * stage whose parts draw it, so a fact two stages share (the names, the date)
 * is ONE step: asked once, and counted for both.
 *
 * WHICH PARTS A STAGE DRAWS — derived, never typed twice:
 *
 *   · the fixed top part (`hero` — names · date · cover · logo, in the theme),
 *     on every lifecycle stage;
 *   · its hideable parts, `STAGE_SCENES[stage]` (`lib/stage-scenes.ts`, the
 *     table the page, its bar and the Maker's navigator all read);
 *   · its fixed parts — the entourage where `STAGE_FIXED` places it, each
 *     guest's own greeting on the Invitation and The Day, Find your seat on The Day;
 *   · the RSVP stage (a page of the Maker, not a lifecycle phase): its three
 *     settings — how guests get in · what to ask · reply by (`RSVP_PIECES`, the
 *     sections `MakerRsvpSettings` always drew).
 *
 * 🌅 POST EVENT HAS NO STEP — it fills itself from the day (study § 3). It is
 * listed, never walked.
 *
 * Pure and client-safe: no I/O, no React. Its imports are the stage tables and
 * the stage words — nothing heavy rides into the Maker's first load.
 */
import type { LifecyclePhase, WidgetType } from './invitation-widgets';
import { STAGE_FIXED, STAGE_SCENES } from './stage-scenes';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import { RSVP_STAGE_KEY, RSVP_STAGE_LABEL } from './rsvp-stage-shared';
import type { GuidedPlan, GuidedStepKey, GuidedStepState } from './details-guided-flow';

/** A stage of the setup — the four lifecycle stages and the Maker's RSVP stage. */
export type SetupStage = LifecyclePhase | typeof RSVP_STAGE_KEY;

/**
 * The five, in the order the one link lives through them — RSVP between Save the
 * Date and the Invitation, exactly as Page ▾ orders them (`MAKER_PAGE_STAGES`).
 */
export const SETUP_STAGES: readonly SetupStage[] = PUBLIC_STAGE_ORDER.flatMap((p): SetupStage[] =>
  p === 'save_the_date' ? [p, RSVP_STAGE_KEY] : [p],
);

export function isSetupStage(v: unknown): v is SetupStage {
  return typeof v === 'string' && (SETUP_STAGES as readonly string[]).includes(v);
}

/** A stage's name — the one stage vocabulary (`PUBLIC_STAGE_LABELS`), never per type. */
export function setupStageLabel(stage: SetupStage): string {
  return stage === RSVP_STAGE_KEY ? RSVP_STAGE_LABEL : PUBLIC_STAGE_LABELS[stage];
}

/** The stage that fills itself from the day — listed, never walked. */
export const SELF_FILLING_STAGE: SetupStage = 'editorial';

/** The RSVP stage's settings — each the `MakerRsvpSettings` section of the same key (`RSVP_PIECES`). */
export const RSVP_SETTING_PARTS = ['rsvp:who', 'rsvp:questions', 'rsvp:reply-by'] as const;
export type RsvpSettingPart = (typeof RSVP_SETTING_PARTS)[number];

/** The piece (`RSVP_PIECES` key) each RSVP setting opens. */
export function rsvpSettingPiece(part: RsvpSettingPart): string {
  return part.slice('rsvp:'.length);
}

/** The fixed parts the page places itself (`MakerFixedKey` names). */
export type StageFixedPart = 'hero' | 'entourage' | 'greeting' | 'find_your_seat';

/** Anything a stage draws that can show a fact. */
export type StagePart = WidgetType | StageFixedPart | RsvpSettingPart;

/** Each guest's own greeting (and pass) — the Invitation and The Day. */
const GREETING_STAGES: readonly LifecyclePhase[] = ['rsvp', 'event'];
/** Find your seat — The Day. */
const SEAT_STAGES: readonly LifecyclePhase[] = ['event'];

/** Every part this stage draws, in the stage's order (the top part first). */
export function stageParts(stage: SetupStage): StagePart[] {
  if (stage === SELF_FILLING_STAGE) return [];
  if (stage === RSVP_STAGE_KEY) return [...RSVP_SETTING_PARTS];
  return [
    'hero',
    ...STAGE_SCENES[stage],
    ...(STAGE_FIXED.entourage.includes(stage) ? (['entourage'] as const) : []),
    ...(GREETING_STAGES.includes(stage) ? (['greeting'] as const) : []),
    ...(SEAT_STAGES.includes(stage) ? (['find_your_seat'] as const) : []),
  ];
}

/**
 * WHICH PART DRAWS EACH FACT — DATA, and exhaustive: a new step is a type error
 * here until it names the part(s) that show it. A fact no part draws (the
 * setup's B5–6, which the RSVP stage asks as its own three settings) names none
 * and is in no stage.
 */
export const STEP_PARTS: Readonly<Record<GuidedStepKey, readonly StagePart[]>> = {
  names: ['hero'],
  date: ['hero', 'countdown', 'event_details'],
  theme: ['hero'],
  logo: ['hero'],
  // The cover photo — and, the same step, the background behind every part (B6).
  hero: ['hero'],
  'love-story': ['our_love_story'],
  who: ['rsvp:who'],
  rsvp: ['rsvp:questions'],
  'reply-by': ['rsvp:reply-by'],
  venues: ['event_details', 'venue_map'],
  schedule: ['schedule'],
  arrive: ['schedule'],
  parents: ['entourage'],
  march: ['entourage'],
  colours: ['dress_code'],
  wear: ['dress_code'],
  message: ['special_message'],
  guests: ['greeting'],
  'seat-plan': ['find_your_seat'],
  papic: ['photo_moments', 'your_photos'],
  // B5–6 (what to ask · reply-by) is the RSVP stage's own settings above — never a second step on the same item.
  ask: [],
};

/** Every stage a fact is shown on — the stages whose parts draw it. */
export function stagesOfStep(key: GuidedStepKey): SetupStage[] {
  const parts = STEP_PARTS[key];
  return SETUP_STAGES.filter((s) => stageParts(s).some((p) => parts.includes(p)));
}

/* ══ COUNTING — from the plan's own steps, never a second list ═══════════════ */

type Counted = { key: GuidedStepKey; title: string; state: GuidedStepState; optional?: boolean };

/** The facts this stage shows, in the plan's order — its steps, then its link steps (the guests' names). */
export function stageFacts(plan: Pick<GuidedPlan, 'steps' | 'links'>, stage: SetupStage): Counted[] {
  return [
    ...plan.steps.filter((s) => s.stages.includes(stage)),
    ...plan.links.filter((l) => l.stages.includes(stage)),
  ];
}

/** In place: filled in, or nothing to fill (a look-over — its defaults work). */
const inPlace = (s: Counted) => s.state !== 'left';

/** "n of m" — this stage's facts in place, of all it shows. */
export function stageProgress(plan: Pick<GuidedPlan, 'steps' | 'links'>, stage: SetupStage): { done: number; total: number } {
  const facts = stageFacts(plan, stage);
  return { done: facts.filter(inPlace).length, total: facts.length };
}

/** The Event Hub as a whole — every fact ONCE, however many stages show it. */
export function setupProgress(plan: Pick<GuidedPlan, 'steps' | 'links'>): {
  done: number;
  total: number;
  /** The first stage with a fact still to do (an optional one never holds a stage open), or null. */
  next: SetupStage | null;
} {
  const all: Counted[] = [...plan.steps, ...plan.links];
  const next = SETUP_STAGES.find((st) => stageFacts(plan, st).some((s) => s.state === 'left' && !s.optional)) ?? null;
  return { done: all.filter(inPlace).length, total: all.length, next };
}

/** The stage the picker suggests: the first with something still to do, else Save the Date. */
export function suggestedStage(plan: Pick<GuidedPlan, 'steps' | 'links'>): SetupStage {
  return setupProgress(plan).next ?? SETUP_STAGES[0]!;
}

/** The short line under a stage's name — what it asks, in its own words, the ones no earlier stage already named first. */
export function stageLine(plan: Pick<GuidedPlan, 'steps' | 'links'>, stage: SetupStage): string {
  if (stage === SELF_FILLING_STAGE) return 'Fills itself from the day';
  const earlier = new Set(
    SETUP_STAGES.slice(0, SETUP_STAGES.indexOf(stage)).flatMap((s) => stageFacts(plan, s).map((f) => f.key)),
  );
  const facts = stageFacts(plan, stage);
  const own = facts.filter((f) => !earlier.has(f.key));
  return (own.length > 0 ? own : facts).map((f) => f.title).join(' · ');
}

/* ══ "BEFORE WE START", FILTERED TO THE STAGE (approved 2026-10-01 frame 0) ══ */

/**
 * What helps each fact — the approved frame 0's "Media that helps", per fact,
 * so a stage lists only what ITS steps use. Nothing here is required.
 */
const MEDIA_FOR: Partial<Record<GuidedStepKey, readonly string[]>> = {
  hero: ['One upright cover photo (2,000 px or more)', 'A short clip, a few seconds'],
  logo: ['Your logo file, if you have one — else we make one'],
  'love-story': ['Love Story photos, with the date each was taken'],
  venues: ['A photo of your venue — optional'],
  guests: ['Your guest list — the template is on the Guest list'],
};

export type BeforeWeStart = {
  /** Already in place — never asked again. */
  have: string[];
  /** Media that helps the steps still to do (optional). */
  media: string[];
  /** What this stage will ask — its facts still to do. */
  ask: string[];
};

/** The stage's "Before we start": what we have, what helps, what we'll ask — this stage's facts only. */
export function beforeWeStart(plan: Pick<GuidedPlan, 'steps' | 'links'>, stage: SetupStage): BeforeWeStart {
  const facts = stageFacts(plan, stage);
  const left = facts.filter((f) => f.state === 'left');
  return {
    have: facts.filter((f) => f.state === 'done').map((f) => f.title),
    media: [...new Set(left.flatMap((f) => MEDIA_FOR[f.key] ?? []))],
    ask: left.map((f) => f.title),
  };
}
