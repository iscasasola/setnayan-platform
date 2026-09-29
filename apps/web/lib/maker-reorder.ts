/**
 * apps/web/lib/maker-reorder.ts
 *
 * ↕ A DRAG IN THE MAKER'S NAVIGATOR IS ONE SAVE, AND THE LIST MOVES AT ONCE.
 *
 * Owner, 2026-09-29: *"we also want to make sure 100% that there is no slow
 * response on the maker"*. Measured by code path before this: a drag of N places
 * was N form posts in a row (`moveWidgetUp/Down`), each a redirect plus a full
 * Maker render, and the navigator did not move until the LAST one came back —
 * with every control locked in between.
 *
 * Now the navigator shows the new order the moment the scene is dropped (the
 * pure `optimisticStageList` below), and the whole stage's order goes to the
 * draft in ONE `hubDraftAction` save through `makerSave` — exactly the patch the
 * move action writes in draft mode (`stagePlacesAfterMove` gives every scene on
 * the stage its place 0, 1, 2 …), so Apply, Undo and Restore see the same draft.
 * The canvas is NOT drawn by the bridge for a move: the save is unheld, and the
 * canvas reloads double-buffered for the render it brings (the old page stays
 * up until the new one is ready). The server render stays the only truth: the
 * optimistic order is dropped as soon as that render lands, or put back at once
 * if the save is refused.
 *
 * Pure — `maker-reorder.test.ts`.
 */
import type { HubDraftPatch } from './hub-draft';
import type { LifecyclePhase } from './invitation-widgets';
import type { MakerStageList } from './maker-scene-list';

/** `fullOrder` with `id` moved by `delta` places (negative = up). Null when nothing moves. */
export function movedOrder(fullOrder: readonly string[], id: string, delta: number): string[] | null {
  const from = fullOrder.indexOf(id);
  if (from < 0 || !Number.isInteger(delta) || delta === 0) return null;
  const to = Math.max(0, Math.min(fullOrder.length - 1, from + delta));
  if (to === from) return null;
  const next = fullOrder.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

/**
 * The draft patch that saves a stage's whole order — every scene its place, as
 * `moveWithinStage` writes it. Null when a row's type is unknown here (the
 * caller falls back to the move action, which reads the rows itself).
 */
export function stageOrderPatch(
  order: readonly string[],
  typeOf: (id: string) => string | undefined,
  stage: LifecyclePhase,
): HubDraftPatch | null {
  const widgets: Record<string, { stage_order: Partial<Record<LifecyclePhase, number>> }> = {};
  for (const [place, id] of order.entries()) {
    const type = typeOf(id);
    if (!type || type in widgets) return null;
    widgets[type] = { stage_order: { [stage]: place } };
  }
  return { widgets } as HubDraftPatch;
}

/**
 * The navigator's list with its SCENES in `order` — each scene tile moved into
 * the slots the scene tiles already take, fixed tiles and Post Event scenes
 * left where they are. The render the save brings replaces it.
 */
export function optimisticStageList(list: MakerStageList, order: readonly string[] | null): MakerStageList {
  if (!order) return list;
  const rank = new Map(order.map((id, i) => [id, i] as const));
  const scenes = list.shown.filter((t) => t.kind === 'scene');
  if (scenes.some((t) => t.kind === 'scene' && !rank.has(t.widgetId))) return list;
  const sorted = [...scenes].sort(
    (a, b) => rank.get(a.kind === 'scene' ? a.widgetId : '')! - rank.get(b.kind === 'scene' ? b.widgetId : '')!,
  );
  let k = 0;
  return { ...list, shown: list.shown.map((t) => (t.kind === 'scene' ? sorted[k++]! : t)) };
}

/** Has the server's render caught up with what the navigator shows? */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
