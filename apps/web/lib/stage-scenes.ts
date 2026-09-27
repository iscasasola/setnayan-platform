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
 * ↕ THE TABLE IS THE DEFAULT, NOT A LOCK (owner 2026-09-27, "EVERY SCENE DRAGS
 * WITHIN ITS STAGE (ORDER SAVED PER STAGE)"). Every scene — built-in included —
 * drags within its stage, and the couple's order is kept PER STAGE on each
 * section's own row: `config_json.stage_order[stage]`, beside its canvas, in the
 * draft first and live at Apply (`lib/hub-draft.ts`). A stage nobody has dragged
 * reads this table's order; a scene with no saved place (one added later) goes
 * after the placed ones.
 *
 * 🎞 SAVE THE DATE: FILM OR PHOTOS (same ruling). The couple picks which one
 * leads: `config_json.std_lead` on the gallery's own row (`our_photos`),
 * 'film' | 'photos'. Unset → the film where this kind of event has one,
 * otherwise the photos (`stdShows`).
 *
 * Pure. No I/O.
 */
import type { LifecyclePhase, WidgetType } from './invitation-widgets';

/** The `config_json` key holding a section's place on each stage. */
export const STAGE_ORDER_KEY = 'stage_order';
/** The `config_json` key (on the `our_photos` row) holding the Save the Date's pick. */
export const STD_LEAD_KEY = 'std_lead';
export type StdLead = 'film' | 'photos';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isPlace = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000;

/**
 * A section's saved places, one per stage — only well-formed ones. `null` for a
 * stage is kept (it means "back to the stage's default", e.g. a Reset) so a
 * draft can carry it to Apply; `stagePlace` reads it as "no place".
 */
export function sanitizeStageOrder(raw: unknown): Partial<Record<LifecyclePhase, number | null>> | null {
  if (!isPlain(raw)) return null;
  const out: Partial<Record<LifecyclePhase, number | null>> = {};
  for (const st of STAGES) {
    if (!(st in raw)) continue;
    const v = raw[st];
    if (v === null) out[st] = null;
    else if (isPlace(v)) out[st] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Where this row sits on `stage`, as the couple dragged it — or null (the default). */
export function stagePlace(config: unknown, stage: LifecyclePhase): number | null {
  if (!isPlain(config)) return null;
  const v = sanitizeStageOrder(config[STAGE_ORDER_KEY])?.[stage];
  return typeof v === 'number' ? v : null;
}

/** `config_json` with these stage places merged in (null removes one); every sibling key kept. */
export function configWithStageOrder(
  config: unknown,
  places: Partial<Record<LifecyclePhase, number | null>>,
): Record<string, unknown> {
  const base = isPlain(config) ? { ...config } : {};
  const now = sanitizeStageOrder(base[STAGE_ORDER_KEY]) ?? {};
  const merged: Record<string, number> = {};
  for (const st of STAGES) {
    const v = st in places ? places[st] : now[st];
    if (typeof v === 'number') merged[st] = v;
  }
  if (Object.keys(merged).length > 0) base[STAGE_ORDER_KEY] = merged;
  else delete base[STAGE_ORDER_KEY];
  return base;
}

export function sanitizeStdLead(raw: unknown): StdLead | null {
  return raw === 'film' || raw === 'photos' ? raw : null;
}

/** The couple's stored pick, read off the `our_photos` row. Null = never chosen. */
export function storedStdLead(rows: readonly { widget_type: string; config_json?: unknown }[]): StdLead | null {
  const row = rows.find((r) => r.widget_type === 'our_photos');
  return row && isPlain(row.config_json) ? sanitizeStdLead(row.config_json[STD_LEAD_KEY]) : null;
}

/**
 * What the Save the Date leads with. A type with no film (the film is
 * wedding-signature) always shows the photos; otherwise the couple's pick, and
 * the film when they have not picked.
 */
export function stdShows(stored: StdLead | null, mayShowFilm: boolean): StdLead {
  if (!mayShowFilm) return 'photos';
  return stored ?? 'film';
}

/** `config_json` with the pick set (null = back to the default); every sibling key kept. */
export function configWithStdLead(config: unknown, lead: StdLead | null): Record<string, unknown> {
  const base = isPlain(config) ? { ...config } : {};
  if (lead === null) delete base[STD_LEAD_KEY];
  else base[STD_LEAD_KEY] = lead;
  return base;
}

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
 * A stage's scenes in the stage's order. The couple's order first: every scene
 * they placed on this stage, by its place. Then the stage's DEFAULT for the
 * rest — scenes the table names in the table's order, then anything else (the
 * couple's own scenes) by `display_order`. Nothing is dropped here —
 * membership is the phase fence's job.
 */
export function inStageOrder<T extends { widget_type: string; display_order: number; config_json?: unknown }>(
  rows: readonly T[],
  stage: LifecyclePhase,
): T[] {
  const order = STAGE_SCENES[stage] as readonly string[];
  const rank = (t: string) => {
    const i = order.indexOf(t);
    return i < 0 ? order.length : i;
  };
  const byDefault = (a: T, b: T) => rank(a.widget_type) - rank(b.widget_type) || a.display_order - b.display_order;
  return [...rows].sort((a, b) => {
    const pa = stagePlace(a.config_json, stage);
    const pb = stagePlace(b.config_json, stage);
    if (pa !== null && pb !== null) return pa - pb || byDefault(a, b);
    if (pa !== null) return -1;
    if (pb !== null) return 1;
    return byDefault(a, b);
  });
}

/**
 * EVERY row that belongs to `stage` (hidden and guest-only ones included), in
 * the stage's order — the list a move swaps in, so a drag past a hidden or
 * guest-only scene is counted right. The navigator's scenes are a subsequence
 * of it by construction (same order; membership is `inStage`, the phase fence).
 */
export function stageRowOrder<
  T extends { widget_type: string; display_order: number; is_always_on: boolean; config_json?: unknown },
>(rows: readonly T[], stage: LifecyclePhase, inStage: (type: string, stage: LifecyclePhase) => boolean): T[] {
  return inStageOrder(
    rows.filter((r) => !r.is_always_on && inStage(r.widget_type, stage)),
    stage,
  );
}

/**
 * One move within a stage: `id` swaps with its neighbour in `ordered`, and
 * EVERY scene on the stage gets its place (0, 1, 2 …) — so the stage's whole
 * order is saved, not just the pair, and nothing ties with the default. Null
 * at an edge (nothing to swap with) or for a row not on the stage.
 */
export function stagePlacesAfterMove<T extends { widget_id: string }>(
  ordered: readonly T[],
  id: string,
  direction: 'up' | 'down',
): Array<{ row: T; place: number }> | null {
  const i = ordered.findIndex((r) => r.widget_id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return null;
  const next = [...ordered];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next.map((row, place) => ({ row, place }));
}

/** Does this stage draw the entourage? */
export function stageShowsEntourage(stage: LifecyclePhase): boolean {
  return STAGE_FIXED.entourage.includes(stage);
}
