'use client';

import { useEffect, useState, useTransition } from 'react';
import { checkInGuest, undoCheckIn } from '../checkin/actions';

/**
 * THE GUEST LIST'S CHECK-IN COLUMN (owner 2026-09-30, DECISION_LOG "GUEST LIST:
 * ACCESS + CHECK-IN BECOME COLUMNS"): *"RSVP fills up the list · Check-in fills
 * up who arrived"* — from the event day, one tap checks a guest in, and the
 * same cell takes it back.
 *
 * 🔑 NOT A SECOND DOOR. It calls the desk's own actions (`checkInGuest` /
 * `undoCheckIn`, checkin/actions.ts), so the couple-or-coordinator gate, the
 * request refusal and the double-tap idempotency are the desk's, unchanged.
 * A tap shows at once and saves in the background; a refusal puts it back and
 * says why.
 */
export function GuestCheckinCell({
  eventId,
  guestId,
  name,
  checkedInAt,
}: {
  eventId: string;
  guestId: string;
  name: string;
  /** When they arrived, or null. */
  checkedInAt: string | null;
}) {
  const [at, setAt] = useState<string | null>(checkedInAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setAt(checkedInAt), [checkedInAt]);

  const time = at
    ? new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
    : null;

  const toggle = () => {
    const was = at;
    setError(null);
    setAt(was ? null : new Date().toISOString());
    startTransition(async () => {
      const res = was ? await undoCheckIn(eventId, guestId) : await checkInGuest(eventId, guestId, 'manual_search');
      if (!res.ok) {
        setAt(was);
        setError(res.error);
      } else if ('checkedInAt' in res) {
        setAt(String(res.checkedInAt));
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-0.5" data-guest-checkin-cell={at ? 'in' : 'out'}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={at ? `Undo ${name}'s check-in` : `Check ${name} in`}
        className={`inline-flex min-h-[36px] items-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-60 ${
          at ? 'text-success-800 hover:bg-ink/5' : 'border border-ink/20 text-ink hover:border-ink/40'
        }`}
      >
        {at ? `✓ In ${time}` : 'Check in'}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-danger-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
