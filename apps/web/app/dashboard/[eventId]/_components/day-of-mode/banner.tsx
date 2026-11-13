'use client';

import { useEffect, useMemo, useState } from 'react';
import { Notice, NOTICE_ACTION } from '@/app/_components/notices/notices';
import { formatRelativeMs } from '@/lib/day-of-mode';
import { venueNowMs } from '@/lib/schedule';
import { isTimeTba } from '@/lib/schedule-chapters';
import { DAY_OF_SCHEDULE_UNREAD, ScheduleUnread } from './schedule-unread';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  /** ⏰ A Time-TBA chapter — never "now" or "next" (its stored 00:00 is only its day). */
  time_tba?: boolean | null;
};

type Props = {
  eventId: string;
  blocks: Block[];
  /** 🛑 The schedule read was refused — said, never "everything looks wrapped". */
  failed?: boolean;
};


type Position = {
  current: Block | null;
  next: Block | null;
};

export function locatePosition(blocks: Block[], now: number): Position {
  const sorted = blocks.filter((b) => !isTimeTba(b)).sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  let current: Block | null = null;
  let next: Block | null = null;
  for (const b of sorted) {
    const start = new Date(b.start_at).getTime();
    const end = b.end_at
      ? new Date(b.end_at).getTime()
      : start + 30 * 60_000; // assume 30 min if no end given
    if (start <= now && now < end) current = b;
    else if (start > now && next === null) next = b;
  }
  return { current, next };
}

export function DayOfModeBanner({ eventId, blocks, failed = false }: Props) {
  const [tick, setTick] = useState(0);

  // Tick every 30s so the countdown stays fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // tick triggers re-renders so the countdown copy stays fresh; we always
  // pull a fresh venueNowMs() at render time below.
  const position = useMemo(
    () => locatePosition(blocks, venueNowMs()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, tick],
  );
  // The venue's clock. `start_at` holds the venue's wall clock, so comparing it
  // against a real instant put this banner eight hours out on a Manila wedding
  // day — announcing hair and make-up as "next" during the ceremony itself.
  const now = venueNowMs();

  // Build subdued copy.
  let subdued: string;
  if (failed) {
    subdued = DAY_OF_SCHEDULE_UNREAD;
  } else if (position.current) {
    if (position.next) {
      const ms = new Date(position.next.start_at).getTime() - now;
      subdued = `Right now: ${position.current.label} · ${position.next.label} ${formatRelativeMs(ms)}`;
    } else {
      subdued = `Right now: ${position.current.label}`;
    }
  } else if (position.next) {
    const ms = new Date(position.next.start_at).getTime() - now;
    subdued = `Up next: ${position.next.label} ${formatRelativeMs(ms)}`;
  } else {
    subdued = 'No schedule blocks queued — everything looks wrapped.';
  }

  // 🔔 Inventory #16 — a LIVE notice (one notice system, owner approved 14 Nov 2026): "Hide" works until the next day
  // (the day is in its key). Where things stand is the line itself; a refused schedule read is said, never hidden.
  return (
    <Notice
      kind="live"
      tone="info"
      noticeKey={`event-day:${eventId}:${new Date().toISOString().slice(0, 10)}`}
      title={failed ? 'Event day mode is active' : `Event day mode is active · ${subdued}`}
      titleNode={
        <>
          Event day mode is active
          {failed ? <ScheduleUnread /> : <span className="block text-[13px] font-normal text-ink/70">{subdued}</span>}
        </>
      }
    />
  );
}
