'use client';

/**
 * ANNOUNCE — from the Schedule, before the day and on it (Schedule rebuild,
 * slice 1 · DECISION_LOG 2026-09-26 "WHERE ANNOUNCEMENTS ARE TYPED — TODAY
 * ONLY ON THE DAY; THE SCHEDULE REBUILD FIXES IT").
 *
 * Owner, verbatim: *"so my question is for the host and coordinator, where is
 * the place where they can type in announcments."* Measured then: the only
 * composer (`day-of-mode/coordinator-broadcast-card.tsx`) mounted inside the
 * day-of grid, so before the day there was NO place to announce at all. This is
 * that place. It is NOT a new channel — owner 2026-09-25: *"all announcments go
 * there"* — it writes the same `coordinator_broadcasts` row through the same
 * `sendCoordinatorBroadcast` action, under the same INSERT policies (couple, or
 * a delegate holding `schedule: 'edit'`). The day-of Overview box stays.
 *
 * ⚠ WHEN A GUEST SEES IT IS STATED, NOT IMPLIED. The guest-side reader
 * (`app/[slug]/_lib/loaders.ts` → `loadDayOfBroadcast`) shows the latest
 * announcement, to identified guests only, inside the day-of window. So an
 * announcement typed a week early is SAVED now and shown on the day. The sheet
 * says exactly that rather than "Sent to your guests" — a composer that implied
 * delivery it did not make would be the failure-that-looks-like-success this
 * repo has paid for repeatedly.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Send } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { sendCoordinatorBroadcast } from '../../_actions/day-of-broadcast';
import {
  BROADCAST_MAX_LENGTH,
  type BroadcastSenderRole,
  type CoordinatorBroadcastItem,
} from '@/lib/coordinator-broadcasts';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { Tip } from './day-ui';

const SENDER: Record<BroadcastSenderRole, string> = {
  couple: 'The couple',
  coordinator: 'Your coordinator',
};

/** A real instant (`created_at`), read on the venue's clock. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    timeZone: DEFAULT_EVENT_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AnnounceButton({
  eventId,
  isEventDay,
  recent,
}: {
  eventId: string;
  /** Inside the day-of window — guests see it at once. Before: on the day. */
  isEventDay: boolean;
  /** Latest announcements, newest first; `null` = the read was refused. */
  recent: CoordinatorBroadcastItem[] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('body', text);
      const result = await sendCoordinatorBroadcast(fd);
      if (result.ok) {
        setText('');
        setSent(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink ring-1 ring-inset ring-ink/20 hover:bg-ink/[0.05]"
      >
        <Megaphone aria-hidden className="h-4 w-4" strokeWidth={1.8} />
        Announce
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById="announce-title" wide rise>
        <div className="space-y-4 px-5 pb-6 pt-5">
          <div className="flex items-center gap-2 pr-14">
            <h2 id="announce-title" className="font-display text-[22px] leading-tight text-ink">
              Announce to your guests
            </h2>
            <Tip align="end">
              One message to every guest who has opened their invitation. The latest one sits at the top
              of their Event Hub. Hosts and your approved coordinator can announce.
            </Tip>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={BROADCAST_MAX_LENGTH}
            rows={3}
            aria-label="Your announcement"
            placeholder="e.g. Dinner is moving up 15 minutes — please find your seats."
            className="w-full resize-none border-0 border-b border-ink/15 bg-transparent px-0 py-1.5 text-[15px] leading-normal text-ink outline-none focus:border-ink"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink/55">
              {isEventDay
                ? 'Guests see it at the top of their Event Hub right away.'
                : 'Guests see your latest announcement at the top of their Event Hub on the day.'}
            </p>
            <span className="font-mono text-[11px] text-ink/45">
              {text.length}/{BROADCAST_MAX_LENGTH}
            </span>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger-700">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="text-sm font-medium text-success-700">
              {isEventDay ? 'Announced.' : 'Saved — it goes up on your guests’ Event Hub on the day.'}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={send}
              disabled={pending || text.trim().length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-50"
            >
              <Send aria-hidden className="h-3.5 w-3.5" />
              {pending ? 'Announcing…' : 'Announce'}
            </button>
          </div>

          <div className="pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/55">Latest</p>
            {recent === null ? (
              <p className="mt-2 text-sm text-ink/60">
                We couldn’t load your recent announcements right now. Refresh in a moment.
              </p>
            ) : recent.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">Nothing announced yet.</p>
            ) : (
              <ul className="mt-1">
                {recent.map((b) => (
                  <li key={b.broadcastId} className="border-b border-ink/[0.06] py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/50">
                      {SENDER[b.senderRole]} · {when(b.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/85">{b.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
