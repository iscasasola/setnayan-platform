import Link from 'next/link';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { askForMoreHref, ASK_FOR_MORE, THEIR_EVENT_PART_NAME, type TheirEventPart } from '@/lib/their-event';
import type { BookingGroupRead } from '@/lib/their-event.server';
import { GuestsPart, NumbersPart } from './their-event-parts';

/**
 * 🚪 ONE PART OF "THEIR EVENT", AS ONE BODY — drawn by the part's own page on a phone (`their-event/[part]/page.tsx`,
 * full screen under "Their event · ✕ Close") and by the chat's RIGHT COLUMN on a computer (owner 2026-11-21, DECISION_LOG
 * "DESKTOP SPLIT VIEW + ONE EDITOR PER PART — APPROVED TO BUILD"; drawing `desktop_split_view_v2_fable.html` frame 2:
 * *"One right column, drawn twice. The part replaces the list."*). One body, two places — never a second copy.
 *
 * The server decided already: `open` is whether this part is on THIS supplier's list (`theirEventRows`); a part that is
 * not says so and offers "Ask for access to more", never the content. A refused group read is said, never empty.
 */
export type TheirEventPartBrief = {
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
  timeline: { label: string; start_at: string | null; location: string | null }[];
};

/** The parts this body draws. Seats and Mood Board open their own shipped pages; the Logo is a file. */
export const PART_BODY_PARTS: readonly TheirEventPart[] = ['schedule', 'numbers', 'guests', 'hub'];

export function TheirEventPartBody({
  eventId,
  part,
  open,
  brief,
  group,
  hubSlug,
  hubUnread = false,
}: {
  eventId: string;
  part: TheirEventPart;
  open: boolean;
  brief: TheirEventPartBrief;
  group: BookingGroupRead;
  /** The Hub's address, when the caller read it; null = not published (or not read — said the same, never a guess). */
  hubSlug: string | null;
  /** The Hub address read was refused (A6-56): said, never "not published". */
  hubUnread?: boolean;
}) {
  const clientHref = `/vendor-dashboard/clients/${eventId}`;
  if (!open) {
    return (
      <div className="space-y-3 p-4" data-their-event-shut="">
        <p className="text-sm text-ink/70">{THEIR_EVENT_PART_NAME[part]} is not open to you. The hosts decide what each supplier sees.</p>
        <Link href={askForMoreHref(eventId)} className="inline-flex min-h-11 items-center text-sn-lg font-medium text-sn-accent">
          {ASK_FOR_MORE}
        </Link>
      </div>
    );
  }
  if (part === 'schedule') {
    return (
      <div className="p-4" data-their-event-schedule="">
        <h1 className="text-lg font-semibold text-ink">Schedule</h1>
        <p className="mt-1 text-sn-md text-ink/60">The whole day. Your own items are changed from your Schedule.</p>
        {brief.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-ink/70">The hosts have not set the day yet.</p>
        ) : (
          <ul className="mt-2">
            {brief.timeline.map((b, i) => (
              <li key={`${b.start_at}-${i}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2 first:border-t-0">
                <span className="min-w-0">
                  <span className="block text-sn-lg text-ink">
                    {b.start_at ? `${formatWallClock(b.start_at)} · ` : ''}
                    {b.label}
                  </span>
                  {b.location ? <span className="block truncate text-sn-md text-ink/60">{b.location}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`${clientHref}?tab=schedule`} className="mt-3 inline-flex min-h-11 items-center text-sn-lg font-medium text-sn-accent">
          Edit your items
        </Link>
      </div>
    );
  }
  if (part === 'numbers') return <NumbersPart pax={brief.pax} group={group} />;
  if (part === 'guests') return <GuestsPart group={group} />;
  // Hub — what the guests see: the event's public page.
  return (
    <div className="space-y-2 p-4" data-their-event-hub="">
      <h1 className="text-lg font-semibold text-ink">Hub</h1>
      {hubUnread ? (
        <p role="alert" className="text-sm text-ink/70">We couldn&rsquo;t read their Hub&rsquo;s address right now. Try again in a moment.</p>
      ) : hubSlug ? (
        <Link href={`/${hubSlug}`} target="_blank" className="inline-flex min-h-11 items-center text-sn-lg font-medium text-sn-accent">
          Open what the guests see
        </Link>
      ) : (
        <p className="text-sm text-ink/70">The hosts have not published their Hub yet.</p>
      )}
    </div>
  );
}
