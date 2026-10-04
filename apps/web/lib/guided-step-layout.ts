/**
 * lib/guided-step-layout.ts — ONE STEP LAYOUT FOR EVERY GUIDED STEP.
 *
 * Owner, live iPhone test 2026-10-05, after walking "Finish your Event Hub":
 * *"why are there so many inconsistencies"* — the logo step's only control sat
 * at the top of the page outside its sheet, the names step had its own Save,
 * Love Story's Back/Next ran off the screen, the bar's title flipped between
 * "Look" and "Event Details" inside one stage, and what sat behind the sheet
 * changed from step to step (a 5×7 print card, the page, the logo canvas, the
 * Love Story studio). The ruling: EVERY step wears ONE shared layout and
 * behaves the same.
 *
 *   ┌ the Maker's bar — ONE title per stage ("Save the Date") ┐
 *   │ BEHIND: what THIS STAGE produces, live, in the draft    │
 *   ├ the half sheet ─────────────────────────────────────────┤
 *   │ step ▾ · Peek · ×                     (ONE header row)  │
 *   │ the step's own field(s) — drafted as they change        │
 *   │ ‹ Back · Skip for now · Next ›                          │
 *   └─────────────────────────────────────────────────────────┘
 *
 * 🖼 WHAT SITS BEHIND THE SHEET — ONE RULE PER STAGE: the thing the stage
 * produces, the page guests open, scrolled to the part the step fills —
 *   · Save the Date · Invitation · The Day → that stage's page (`?phase=`);
 *   · RSVP → the RSVP page as a guest who has not replied yet;
 * …unless the step's subject exists only in its own tool, where the page
 * could not show it being made:
 *   · Your logo  → the logo itself, as it is drawn (no editor guide lines);
 *   · Seat plan  → the floor plan the guests are seated on;
 *   · Schedule (and the guests' arrival) → the day's rail, where a moment is
 *     picked, dragged and resized — the page shows the day, not the rail;
 *   · Cover photo → the cover photo itself (the page lays the invitation card
 *     over it); the page when there is no photo yet.
 *
 * Pure: no React, no I/O — the workspace (`details-workspace.tsx`) draws it and
 * `the-guided-steps-share-one-layout.test.ts` holds every step to it.
 */
import type { LifecyclePhase } from './invitation-widgets';
import type { GuidedStepKey } from './details-guided-flow';
import { RSVP_STAGE_KEY } from './rsvp-stage-shared';
import type { SetupStage } from './stage-setup';

/** The bar's title on the stage picker — the flow's own name (a stage's screens wear the stage's name). */
export const GUIDED_FLOW_TITLE = 'Finish your Event Hub';

export type GuidedStepBody =
  /** The stage's own page, at the part the step fills (`anchor`, '' = the top). */
  | { kind: 'page'; phase: LifecyclePhase; anchor: string }
  /** The RSVP stage: the RSVP page, as a guest who has not replied yet. */
  | { kind: 'rsvp-page' }
  /** The step's subject exists only in its own tool — its item's own picture. */
  | { kind: 'own' }
  /** The cover photo itself (the page when there is none). */
  | { kind: 'cover'; phase: LifecyclePhase };

/** Steps whose subject exists only in its own tool (see the docblock). */
export const STEP_OWN_BODY: readonly GuidedStepKey[] = ['logo', 'seat-plan', 'schedule', 'arrive'];

/**
 * Where on the stage's page each step's part sits — the section ids every
 * guest page already renders (`maker-section-find.ts` SECTION_IDS). A step
 * not named here is at the top (the hero: names · date · theme · cover).
 */
const STEP_ANCHOR: Partial<Record<GuidedStepKey, string>> = {
  'love-story': '#site-story',
  venues: '#site-details',
  parents: '#site-entourage',
  march: '#site-entourage',
};

/** What sits behind the sheet on this step, walked as part of this stage. */
export function guidedStepBody(step: GuidedStepKey, stage: SetupStage): GuidedStepBody {
  if (STEP_OWN_BODY.includes(step)) return { kind: 'own' };
  if (stage === RSVP_STAGE_KEY) return { kind: 'rsvp-page' };
  const phase = stage as LifecyclePhase;
  if (step === 'hero') return { kind: 'cover', phase };
  return { kind: 'page', phase, anchor: STEP_ANCHOR[step] ?? '' };
}

/**
 * The stage page's address on the Maker's canvas door — the host's DRAFT
 * (`editor=1`), wearing the theme being picked (`theme=`, the theme-tile door:
 * a pick shows at the tap, before its save lands — owner rule "real-time
 * preview, Apply publishes").
 */
export function stagePageSrc(publicLandingUrl: string, body: GuidedStepBody, theme: string | null): string | null {
  if (body.kind === 'own') return null;
  if (body.kind === 'rsvp-page') return `${publicLandingUrl}/invite/reply?editor=1`;
  const tried = theme ? `&theme=${encodeURIComponent(theme)}` : '';
  const anchor = body.kind === 'page' ? body.anchor : '';
  return `${publicLandingUrl}?phase=${body.phase}&editor=1${tried}${anchor}`;
}
