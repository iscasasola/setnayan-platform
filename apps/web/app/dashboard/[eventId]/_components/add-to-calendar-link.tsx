'use client';

import { useMemo } from 'react';
import { CalendarPlus } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { buildWeddingIcs, icsDataHref } from '@/lib/calendar-links';

/**
 * 📅 ADD TO CALENDAR, INSIDE THE EVENT (Unihome v5, owner-approved 23 Nov 2026 — DECISION_LOG "UNIHOME v5 APPROVED":
 * *"Add to calendar moves inside the event dashboard"*). It lived in the Home card's ⋯ menu, which Unihome removed; it
 * now sits under the event's own date in the event's ⚙ sheet. The SAME file as before — one all-day event, this event
 * only, a copy taken once (owner 2026-08-22), the same `uid` so a phone that already has it updates rather than
 * doubling it — saved through `SaveFileLink` (the share sheet in the app, a download on the web). No date, no link.
 */
export function AddToCalendarLink({ eventId, title, dateIso }: { eventId: string; title: string; dateIso: string | null }) {
  const href = useMemo(() => {
    const ics = buildWeddingIcs({ title, dateIso, location: null, uid: `wedding-${eventId}@setnayan.com` });
    return ics ? icsDataHref(ics) : null;
  }, [eventId, title, dateIso]);
  if (!href) return null;
  return (
    <SaveFileLink href={href} filename={`${title}.ics`} className={actionButtonClass('neutral', { quiet: true, extra: 'self-start' })} data-add-to-calendar="">
      <CalendarPlus aria-hidden strokeWidth={1.9} />
      Add to calendar
    </SaveFileLink>
  );
}
