import { redirect } from 'next/navigation';
import { planningTodoHref } from '@/lib/checklist-anchor';

/**
 * /dashboard/[eventId]/checklist — FORWARDS to Planning Stage's To do filter (owner 2026-11-01, DECISION_LOG
 * "CHECKLIST MERGES INTO PLANNING STAGE": *"the Checklist page becomes a 'To do' filter whose URL forwards"*).
 *
 * The Checklist's tasks are rows of the one lead-up list now (`lib/preparation.ts` · `fetchPreparationAgenda`), with
 * real editable dates, still auto-ticking. Every old link — a bookmark, an email, `/checklist#task-<id>` from an older
 * Home — lands on the same task there: the row keeps its address (`checklistTaskAnchor`) and a browser carries the
 * `#task-…` across a redirect that names none. Nothing is read here.
 */
type Props = { params: Promise<{ eventId: string }> };

export default async function EventChecklistPage({ params }: Props) {
  const { eventId } = await params;
  redirect(planningTodoHref(eventId));
}
