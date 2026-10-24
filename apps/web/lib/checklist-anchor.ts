/**
 * lib/checklist-anchor.ts — ONE TASK'S ADDRESS ON THE CHECKLIST PAGE (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html`: "Checklist · 3 open · 1 due this week | /checklist#<taskId> — needs a
 * param"). The checklist row carries `id={checklistTaskAnchor(item_id)}` and Home links `/checklist#task-<item_id>`,
 * so a tap lands on that exact task (the page lists every task, no folds — the browser scrolls to it, `:target` rings
 * it). One function, so the row and the link can never spell it two ways.
 */
export const CHECKLIST_TASK_ANCHOR_PREFIX = 'task-';

export function checklistTaskAnchor(itemId: string): string {
  return `${CHECKLIST_TASK_ANCHOR_PREFIX}${itemId}`;
}
