'use client';

import { offlineEventDay, savedMark, type SavedMark } from '@/lib/offline-copies';

import { SavedMarkLine } from './saved-mark-line';
import { useOfflineCopy } from './use-offline-copy';

/**
 * 📅 YOUR SCHEDULE, SAVED FOR NO SIGNAL — the one saved mark every person's own day wears (owner-approved 5 Nov, the
 * schedule plan's "each person's day: Your schedule, saved for no signal"): a guest's Event Hub › Me, a supplier's
 * (and a Host/MC's) Customer › Schedule, the hosts' and coordinator's Schedule. The crew's day is the supplier's event
 * console, which `SupplierSavedStrip` already keeps.
 *
 * Opening the page with signal inside the event's window keeps this viewer's copy of THIS page (`path`); with no
 * signal the page opens from that copy and this line says which copy it is. The words and tones are `savedMark`'s and
 * `SavedMarkLine`'s, unchanged — this adds no wording of its own.
 *
 * 🧾 `version` — a fingerprint of the day the page drew (`copyVersionOf`). It is rendered here as `data-sn-copy-version`
 * so the worker records it with the copy, and handed to the hook so a copy from before a Release or an edit is
 * re-saved on this open and never called "Saved for offline" meanwhile. The attribute is drawn even when no line is
 * (outside the window), so every render of the page carries it.
 */
export function ScheduleSavedMark({
  viewer,
  eventKey,
  eventDate,
  eventEndDate = null,
  path,
  version,
  className = '',
}: {
  viewer: string;
  /** The registry key: the event id the address names (a guest's Me: the slug). */
  eventKey: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  path: string;
  version: string;
  className?: string;
}) {
  const copy = useOfflineCopy({ viewer, eventId: eventKey, eventDate, eventEndDate, paths: [path], version });
  const mark = copy.open
    ? savedMark({
        phase: copy.phase,
        savedAt: copy.savedAt,
        now: copy.now,
        online: copy.online,
        eventDay: offlineEventDay(eventDate, copy.now, eventEndDate),
        onCopy: copy.onCopy,
        stale: copy.stale,
      })
    : null;
  return <ScheduleSavedMarkView mark={mark} busy={copy.phase === 'saving'} version={version} className={className} />;
}

/** What the mark draws — every state passed in (the lab draws each one). `mark` null = outside the window: no line. */
export function ScheduleSavedMarkView({
  mark,
  busy,
  version,
  className = '',
}: {
  mark: SavedMark | null;
  busy: boolean;
  version: string;
  className?: string;
}) {
  return (
    <div data-schedule-saved="" data-sn-copy-version={version} className={mark ? className : undefined}>
      {mark ? <SavedMarkLine mark={mark} busy={busy} /> : null}
    </div>
  );
}
