import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/details/change — EVENT SETTINGS now open IN PLACE, on the
 * record (owner 2026-10-04, DECISION_LOG "YES TO ALL": *"Event Details rows are
 * edited in place"*).
 *
 * This page held the three live-saving editors (`EventSettingsEditor`: the kind
 * of wedding and its venue settings, the guest estimate, the area, the feel, the
 * budget target, the repeat, who is celebrated, the birth data, the guest
 * list's closing day and how costs are shown — see `event-settings-editor.tsx`
 * for why none of them can ride the Event Hub draft). The record's own rows now
 * open that very editor in place (`record-editor.tsx` › `case 'settings'`), so
 * this address — a bookmark, an old link — lands there, with the field open.
 * One editor, one home; the address keeps working.
 */
export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  // Written out (not built) so the Root map reads this page as the stub it is — `recordFieldHref` builds the same address.
  redirect(`/dashboard/${eventId}/details/field/area`);
}
