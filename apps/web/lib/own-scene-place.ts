/**
 * lib/own-scene-place.ts — A NEW SCENE OF THEIR OWN LANDS WHERE THEY ASKED.
 *
 * Owner 2026-10-07 (the final fixes, item 6): ＋ "Add above / below <part>" →
 * "A scene of your own" put the new scene at the END of the stage, whatever
 * part the ＋ was on. Now the ＋ sheet sends the stage's order with the new
 * scene's place marked (`NEW_SCENE_TOKEN`), and `addCustomSection` drafts that
 * order — every scene its place on the stage (`stageOrderPatch`, the same patch
 * a grip drag saves) — so it lands right above or below the picked part, in the
 * draft, undoable, published at Apply.
 *
 * Pure — `a-new-own-scene-lands-where-asked.test.ts`.
 */
import type { LifecyclePhase } from './invitation-widgets';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];

export const NEW_SCENE_TOKEN = 'new';
/** The form fields the ＋ sheet sends with the template pick. */
export const PLACE_STAGE_FIELD = 'place_stage';
export const PLACE_ORDER_FIELD = 'place_order';

/** The stage's order with the new scene marked above / below `target`; null when `target` is not on it. */
export function ownScenePlaceOrder(
  fullOrder: readonly string[],
  target: string,
  where: 'above' | 'below',
): string[] | null {
  const at = fullOrder.indexOf(target);
  if (at < 0) return null;
  const out = [...fullOrder];
  out.splice(where === 'above' ? at : at + 1, 0, NEW_SCENE_TOKEN);
  return out;
}

/**
 * The posted place, checked against the event's OWN rows: a real stage, the
 * token exactly once, every other id one of this event's sections, no repeats.
 * Anything else → null, and the scene lands at the end as it always did.
 */
export function readOwnScenePlace(
  stageRaw: unknown,
  orderRaw: unknown,
  eventWidgetIds: ReadonlySet<string>,
): { stage: LifecyclePhase; order: string[] } | null {
  if (typeof stageRaw !== 'string' || !(STAGES as readonly string[]).includes(stageRaw)) return null;
  if (typeof orderRaw !== 'string' || orderRaw.length === 0 || orderRaw.length > 4000) return null;
  const order = orderRaw.split(',');
  if (order.filter((x) => x === NEW_SCENE_TOKEN).length !== 1) return null;
  if (new Set(order).size !== order.length) return null;
  if (!order.every((x) => x === NEW_SCENE_TOKEN || eventWidgetIds.has(x))) return null;
  return { stage: stageRaw as LifecyclePhase, order };
}
