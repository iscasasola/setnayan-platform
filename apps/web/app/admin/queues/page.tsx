/**
 * /admin/queues — legacy redirect → /admin/work.
 *
 * WHY: the ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md)
 * renamed the mobile "Queues" tab to "Work" and expanded its feed (Payouts +
 * Token sales pulled in from the dissolved Money group). The triage feed now
 * lives at /admin/work. This route stays as a redirect for bookmark
 * continuity — anyone with an /admin/queues link lands on the new feed.
 *
 * NOTE: the triage feed component still lives at ./_components/
 * queues-triage-feed.tsx — /admin/work imports it from there.
 */

import { redirect } from 'next/navigation';

export default function AdminQueuesLegacyRedirect() {
  redirect('/admin/work');
}
