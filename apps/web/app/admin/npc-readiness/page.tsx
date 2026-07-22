import { redirect } from 'next/navigation';

/**
 * The NPC pre-filing checklist merged into the Data Privacy & NPC Filing hub
 * (/admin/data-privacy) on 2026-07-22 — this standalone route now redirects to
 * its "NPC checklist" tab. The task-update action still lives in ./actions.ts
 * (imported by the hub's checklist tab); only the page moved.
 */
export default function NpcReadinessRedirect() {
  redirect('/admin/data-privacy?tab=checklist');
}
