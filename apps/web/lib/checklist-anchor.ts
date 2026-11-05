/**
 * lib/checklist-anchor.ts — ONE TASK'S ADDRESS IN PLANNING STAGE (was: on the Checklist page, until the owner merged
 * the Checklist into Planning Stage on 2026-11-01 — the page forwards, the rows keep this address) (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html`: "Checklist · 3 open · 1 due this week | /checklist#<taskId> — needs a
 * param"). The checklist row carries `id={checklistTaskAnchor(item_id)}` and Home links `/checklist#task-<item_id>`,
 * so a tap lands on that exact task (the page lists every task, no folds — the browser scrolls to it, `:target` rings
 * it). One function, so the row and the link can never spell it two ways.
 */
export const CHECKLIST_TASK_ANCHOR_PREFIX = 'task-';

export function checklistTaskAnchor(itemId: string): string {
  return `${CHECKLIST_TASK_ANCHOR_PREFIX}${itemId}`;
}

/**
 * Planning Stage's To do filter — where Home's To do tile and the old /checklist address land (owner 2026-11-01).
 * `rowId` — a task's or a hand-added row's id: the link opens THAT row (`#task-<id>`).
 */
export function planningTodoHref(eventId: string, rowId?: string | null): string {
  const base = `/dashboard/${eventId}/schedule?view=preparation&filter=todo`;
  return rowId ? `${base}#${checklistTaskAnchor(rowId)}` : base;
}
