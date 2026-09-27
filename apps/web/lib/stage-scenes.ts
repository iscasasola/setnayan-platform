/**
 * apps/web/lib/stage-scenes.ts
 *
 * 🗂 EACH STAGE DOES ONE JOB — which scenes a stage draws, and in what order.
 *
 * DECISION_LOG 2026-09-27, "EACH STAGE DOES ONE JOB". The controller measured
 * the live Maker: Save the Date, Invitation and On the Day drew the SAME scenes
 * in the SAME order (Countdown → Dress code → Two ways → Photo moments →
 * Entourage), the stage-specific ones (message, Love Story, when & where,
 * schedule, venue) sat in "Not shown", On the Day had a countdown and no
 * schedule, and Post Event had a dress code. Owner, verbatim: *"save the date
 * can have a gallery of the photos, or save the date video. Invitation is home,
 * details, story, RSVP then Me replaces it once answered? On the day. seams to
 * be missing a lot of details and menus on the guest bar."*
 *
 * | Stage         | Its job         | The scenes it draws (after the names & date)          |
 * |---------------|-----------------|-------------------------------------------------------|
 * | Save the Date | hold the date   | a gallery of their photos (when there is no film) ·   |
 * |               |                 | countdown · Love Story teaser (only if written)       |
 * | Invitation    | get the reply   | countdown · message · Love Story · when & where       |
 * |               |                 | (details · schedule · venue) · dress code ·           |
 * |               |                 | what to bring                                         |
 * | On the Day    | be here now     | full schedule · venue map · camera tips (Papic)       |
 * | Post Event    | keep the story  | unchanged, minus the dress code and the countdown     |
 *
 * The film on the Save the Date carries its own gallery and "Add to calendar"
 * (`SaveTheDateView`), so the photo gallery SCENE draws there only when no
 * film does (`resolveSiteBodyPlan`). The always-on parts (names & date, the
 * personal greeting, the pass, the RSVP) and the fixed sections (the entourage,
 * the story) are placed by the page itself; see `STAGE_FIXED`.
 *
 * 🔑 THE ONE SOURCE. `WIDGET_PHASES` (which stage a scene belongs to) is
 * DERIVED from this table in `lib/invitation-widgets.ts`, and the page plan
 * orders every stage by it — on both paths, open browsing included. The page,
 * its Event Bar and the Maker's navigator all read the same answer, so a stage
 * cannot draw one list while the Maker lists another.
 *
 * 🧾 "TWO WAYS TO CELEBRATE" (`tier_comparison`) IS ON NO STAGE — the owner's
 * ruling, Post Event included.
 *
 * The couple's own scenes (`custom_1`…`custom_6`) are not in the table: they
 * stay on every stage, after the stage's own scenes, in the couple's order.
 *
 * Pure. No I/O.
 */
import type { LifecyclePhase, WidgetType } from './invitation-widgets';

/** The hideable scenes each stage draws, IN ORDER. */
export const STAGE_SCENES: Readonly<Record<LifecyclePhase, readonly WidgetType[]>> = {
  save_the_date: ['our_photos', 'countdown', 'our_love_story'],
  rsvp: [
    'countdown',
    'special_message',
    'our_love_story',
    'event_details',
    'schedule',
    'venue_map',
    'dress_code',
    'what_to_bring',
  ],
  event: ['schedule', 'venue_map', 'photo_moments', 'your_photos'],
  // Post Event is the owner's "okay for now" — its scenes as they were, minus
  // the dress code, the countdown and "Two ways to celebrate".
  editorial: ['our_love_story', 'our_photos', 'special_message', 'your_photos'],
};

/** The fixed sections, by the stages that draw them. */
export const STAGE_FIXED: Readonly<Record<'entourage', readonly LifecyclePhase[]>> = {
  // The Save the Date only holds the date — no entourage there.
  entourage: ['rsvp', 'event', 'editorial'],
};

/** Every stage a hideable scene belongs to — what `WIDGET_PHASES` is derived from. */
export function stagesOfScene(type: WidgetType): LifecyclePhase[] {
  return (Object.keys(STAGE_SCENES) as LifecyclePhase[]).filter((s) => STAGE_SCENES[s].includes(type));
}

/**
 * A stage's scenes in the stage's own order. Scenes the table names come first,
 * in the table's order; anything else (the couple's own scenes) follows, in
 * the couple's `display_order`. Nothing is dropped here — membership is the
 * phase fence's job.
 */
export function inStageOrder<T extends { widget_type: string; display_order: number }>(
  rows: readonly T[],
  stage: LifecyclePhase,
): T[] {
  const order = STAGE_SCENES[stage] as readonly string[];
  const rank = (t: string) => {
    const i = order.indexOf(t);
    return i < 0 ? order.length : i;
  };
  return [...rows].sort((a, b) => rank(a.widget_type) - rank(b.widget_type) || a.display_order - b.display_order);
}

/** Does this stage draw the entourage? */
export function stageShowsEntourage(stage: LifecyclePhase): boolean {
  return STAGE_FIXED.entourage.includes(stage);
}
