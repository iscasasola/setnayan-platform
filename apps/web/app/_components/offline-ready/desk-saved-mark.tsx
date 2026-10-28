'use client';

import { savedMark } from '@/lib/offline-copies';

import { SavedMarkLine } from './saved-mark-line';
import { useOfflineCopy } from './use-offline-copy';

/**
 * 📶 The Check-in desk's own saved mark (EV3): opening the desk with signal keeps this phone's copy of it; with no signal
 * the desk opens from that copy and this line says which copy it is ("No signal · showing the copy from 2:10 PM").
 * Inside the event's window only (T-3 days → the day after); outside it, nothing is drawn and nothing is kept.
 */
export function DeskSavedMark({
  viewer,
  eventId,
  eventDate,
  eventDay,
}: {
  viewer: string;
  eventId: string;
  eventDate: string | null;
  eventDay: boolean;
}) {
  const path = `/dashboard/${eventId}/guests/checkin`;
  const copy = useOfflineCopy({ viewer, eventId, eventDate, paths: [path] });
  if (!copy.open) return null;
  return (
    <div className="mt-2" data-desk-saved="">
      <SavedMarkLine
        mark={savedMark({ phase: copy.phase, savedAt: copy.savedAt, now: copy.now, online: copy.online, eventDay })}
        busy={copy.phase === 'saving'}
      />
    </div>
  );
}
