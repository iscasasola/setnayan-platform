/**
 * apps/web/lib/what-guests-see.ts
 *
 * 👁 WHAT GUESTS SEE, STAGE BY STAGE — the one place that decides whether a scene
 * is on a stage (owner 2026-10-10, DECISION_LOG "WHAT GUESTS SEE": a tick table
 * of information by stage; *"give them freedom to pick what they want to add.
 * but have our recommendation as the checked one"*).
 *
 * THE STORED VALUE is `invitation_widgets.config_json.stage_show[stage]`
 * (`lib/stage-scenes.ts`): `false` = the couple hid the scene on that stage;
 * `true` = the couple shows it there; no entry = nothing chosen.
 *
 * THE RULE, in the order it is applied to one scene on one stage:
 *
 *   1. NO CHOICE → exactly what the page did before this file existed: the
 *      stage's own list (`STAGE_SCENES`) AND the event-wide eye (`is_visible`,
 *      or `mode` with open browsing on).
 *   2. `false` → not on that stage. Everywhere: the stage's list, and the places
 *      that draw a scene WITHOUT reading the list (see "OFF THE LIST" below).
 *   3. `true` → on that stage, over the event-wide eye, and on a stage whose own
 *      list would leave it out — drawn by its ordinary component, at its saved
 *      place (`stage_order[stage]`) or, with none, after the stage's own scenes.
 *      EXCEPT where the scene cannot be on that stage at all (`whyNotPossible`):
 *      then `true` is refused and the scene stays out.
 *
 * WHERE A CHOICE DOES NOT APPLY (`stageChoice` answers "none"):
 *   · an always-on row (names & date, the greeting, the ticket, the reply) —
 *     refused exactly as the eye is;
 *   · a type no stage's list names and that is not the couple's own scene
 *     ("Two ways to celebrate" — on no stage by the owner's ruling);
 *   · a page with stages switched off (`WEBSITE_PHASES_ENABLED` off): there is
 *     no stage to choose for, so the page is the one it was.
 *
 * OPEN BROWSING (`events.website_open_browse`). Stages are still what the page
 * draws by — since 2026-09-27 a stage draws only its own scenes on that path
 * too — so a choice means the same thing there: `false` takes the scene off that
 * stage, `true` puts it on over a `Hidden` mode. What open browsing adds stays
 * in force for a `true`: an empty scene is not drawn, a "guests only" scene is
 * not drawn for a reader with no key, and a scene retired after the day is not
 * drawn.
 *
 * OFF THE LIST — four places draw a scene without asking the stage's list. Each
 * asks THIS file for the stage's choice, and with no choice does what it did:
 *   · the Day's Welcome — the dress code (the guest's look) and the reminders
 *     (`welcomePartsOnTheDay`); they follow the event-wide eye;
 *   · the Day's own schedule block and the Day's directions (a guest's page) —
 *     they do NOT follow the event-wide eye, and still do not;
 *   · the love story's prose (`<OurStory>`), which stands in on every stage
 *     whose list has no love story scene — a scene hidden by the event-wide eye
 *     included;
 *   · the Save-the-Date film, which carries the gallery and the love story line
 *     itself.
 *
 * Pure: no React, no database, no `server-only` — the unit suite imports it.
 */
import { isCustomSectionType } from './custom-sections';
import { sanitizeHubCanvas } from './hub-canvas';
import {
  hasContent,
  isTerminalRenderable,
  openBrowseWidgetVisibleTo,
  resolveWidgetTerminalState,
  widgetInPhase,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from './invitation-widgets';
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import { stageShown, stagesOfScene, stdShows, storedStdLead } from './stage-scenes';
import type { WeddingOnlyParts } from './wedding-only-parts';

export type StageReader = 'guest' | 'anonymous';

type ChoiceRow = Pick<InvitationWidgetRow, 'widget_type' | 'is_always_on' | 'config_json'>;

/** May the couple choose, per stage, whether this type is shown? The table's scenes and their own. */
export function stageChoiceApplies(type: WidgetType): boolean {
  return stagesOfScene(type).length > 0 || isCustomSectionType(type);
}

/**
 * The couple's choice for this row on `stage`: `true` shown, `false` hidden,
 * `null` none. `null` too wherever a choice does not apply (see the docblock).
 */
export function stageChoice(row: ChoiceRow | null | undefined, stage: LifecyclePhase, phasesEnabled: boolean): boolean | null {
  if (!row || !phasesEnabled || row.is_always_on || !stageChoiceApplies(row.widget_type)) return null;
  return stageShown(row.config_json, stage);
}

/** The same, for a type looked up in the event's rows. */
export function stageChoiceOf(
  widgets: readonly ChoiceRow[],
  type: WidgetType,
  stage: LifecyclePhase,
  phasesEnabled: boolean,
): boolean | null {
  return stageChoice(widgets.find((w) => w.widget_type === type), stage, phasesEnabled);
}

/**
 * FOR A PLACE THAT DRAWS A SCENE OFF THE LIST: the couple's choice for the
 * stage when there is one, otherwise `today` — what that place decided before.
 */
export function stageChoiceOr(
  widgets: readonly ChoiceRow[],
  type: WidgetType,
  stage: LifecyclePhase,
  phasesEnabled: boolean,
  today: boolean,
): boolean {
  return stageChoiceOf(widgets, type, stage, phasesEnabled) ?? today;
}

/** Did the couple hide this scene on this stage? (Only a stored `false` — never the event-wide eye.) */
export function hiddenOnStage(widgets: readonly ChoiceRow[], type: WidgetType, stage: LifecyclePhase, phasesEnabled: boolean): boolean {
  return stageChoiceOf(widgets, type, stage, phasesEnabled) === false;
}

/**
 * 🎞 A scene seeded from one of Post Event's presets can only be written AFTER
 * something happened — it is on Post Event and nowhere else, though it is one
 * of the six the couple's own scenes share. ("Two ways to celebrate" is on no
 * stage.) The ONE rule behind `widgetsGuestsMeet` (`lib/maker-scene-list.ts`).
 */
export function sceneMeetsGuestsOn(row: { widget_type: string; config_json?: unknown }, stage: LifecyclePhase): boolean {
  return (
    row.widget_type !== 'tier_comparison' &&
    (stage === 'editorial' || !isCustomSectionType(row.widget_type) || !sanitizeHubCanvas(row.config_json).postEventPreset)
  );
}

/**
 * The scenes the Day's Welcome draws itself, off the day's list
 * (`welcomePartsOnTheDay`): the guest's look from the dress code, and the
 * couple's reminders. On The Day they have ONE home, the Welcome — a `true`
 * there keeps them on the Welcome and never adds a second copy to the list.
 */
export const DAY_WELCOME_SCENES: readonly WidgetType[] = ['dress_code', 'what_to_bring'];

/** The scenes a guest's page draws on The Day off the list and off the eye: the schedule block, the directions. */
export const DAY_OWN_BLOCKS: readonly WidgetType[] = ['schedule', 'venue_map'];

export type StageFacts = {
  stage: LifecyclePhase;
  /** Who is reading. A reader with no key meets only the public-safe scenes. */
  reader: StageReader;
  openBrowse: boolean;
  /** `plan.body === 'save_the_date'` — the Save the Date is led by its film (which carries the gallery itself). */
  film: boolean;
  /** Per-scene "has something in it" — only consulted with open browsing on; absent = it has. */
  content: Partial<Record<WidgetType, boolean>>;
};

/**
 * WHY A SCENE CANNOT BE IN THIS STAGE'S LIST whatever the couple stores — the
 * name of the rule that says so, or null when nothing stands in the way.
 * (Reasons that belong to one reader or to one arrangement — a "guests only"
 * scene for a reader with no key, an empty scene with open browsing on — are
 * not here: they are not about the stage.)
 */
export function whyNotInStageList(row: ChoiceRow, facts: Pick<StageFacts, 'stage' | 'reader' | 'film'>): string | null {
  const t = row.widget_type;
  if (row.is_always_on) return 'is_always_on';
  if (!stageChoiceApplies(t)) return 'STAGE_SCENES';
  if (!sceneMeetsGuestsOn(row, facts.stage)) return 'sceneMeetsGuestsOn';
  if (!isTerminalRenderable(resolveWidgetTerminalState(t, facts.stage))) return 'resolveWidgetTerminalState';
  if (facts.stage === 'event' && DAY_WELCOME_SCENES.includes(t)) return 'DAY_WELCOME_SCENES';
  if (facts.film && t === 'our_photos') return 'stdShows';
  if (facts.reader === 'anonymous' && !PUBLIC_WIDGET_ALLOWLIST.includes(t)) return 'PUBLIC_WIDGET_ALLOWLIST';
  return null;
}

/**
 * IS THIS SCENE IN THE STAGE'S LIST? — the question `resolveSiteBodyPlan` asks
 * for every row once stages are on. `shownToday` is what the page decided
 * before the stage was looked at: the event-wide eye, or with open browsing on
 * the mode, the audience, the content and the retirement (the plan's own two
 * paths, unchanged).
 */
export function sceneInStageList(row: InvitationWidgetRow, shownToday: boolean, facts: StageFacts): boolean {
  const choice = stageChoice(row, facts.stage, true);
  if (choice === false) return false;
  if (choice === true) {
    if (whyNotInStageList(row, facts) !== null) return false;
    // What open browsing adds stays in force: who may read it, and nothing empty.
    if (facts.openBrowse && facts.reader === 'anonymous' && row.audience === 'guests_only') return false;
    if (facts.openBrowse && !hasContent(row.widget_type, facts.content)) return false;
    return true;
  }
  return shownToday && widgetInPhase(row.widget_type, facts.stage) && !(facts.film && row.widget_type === 'our_photos');
}

/**
 * The stage's list, before it is put in the stage's order: every row of
 * `shownToday` the stage keeps, then the rows a stored `true` brings in. The
 * order of `shownToday` is kept, so with nothing stored this IS the filter the
 * plan ran before.
 */
export function stageListRows(
  shownToday: readonly InvitationWidgetRow[],
  widgets: readonly InvitationWidgetRow[],
  facts: StageFacts,
): InvitationWidgetRow[] {
  const kept = shownToday.filter((w) => sceneInStageList(w, true, facts));
  const has = new Set(shownToday.map((w) => w.widget_id));
  const added = widgets.filter((w) => !has.has(w.widget_id) && stageChoice(w, facts.stage, true) === true && sceneInStageList(w, false, facts));
  return added.length > 0 ? [...kept, ...added] : kept;
}

/** Does the Save the Date's film lead this stage? The plan's own rule (`resolveSiteBodyPlan`, `showSaveTheDate`). */
export function filmLeadsStage(
  widgets: readonly { widget_type: string; config_json?: unknown }[],
  stage: LifecyclePhase,
  phasesEnabled: boolean,
  weddingOnlyParts?: Partial<WeddingOnlyParts>,
): boolean {
  const mayShowStdFilm = weddingOnlyParts?.save_the_date_film ?? true;
  return phasesEnabled && stage === 'save_the_date' && mayShowStdFilm && stdShows(storedStdLead(widgets), mayShowStdFilm) === 'film';
}

/** What the page decided for a row before stages were looked at — the plan's two paths, restated for `sceneOnStage`. */
export function shownBeforeStages(
  row: InvitationWidgetRow,
  facts: Pick<StageFacts, 'stage' | 'reader' | 'openBrowse' | 'content'>,
): boolean {
  if (row.is_always_on) return false;
  if (facts.reader === 'anonymous' && !PUBLIC_WIDGET_ALLOWLIST.includes(row.widget_type)) return false;
  if (!facts.openBrowse) return row.is_visible;
  return (
    openBrowseWidgetVisibleTo(row, facts.reader) &&
    hasContent(row.widget_type, facts.content) &&
    isTerminalRenderable(resolveWidgetTerminalState(row.widget_type, facts.stage))
  );
}
