'use client';

import { useEffect, useMemo, useState } from 'react';
import { Radio, X } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
};

type Props = {
  eventId: string;
  blocks: Block[];
};

const DISMISS_TTL_MS = 60 * 60 * 1000; // 1 hour
const DISMISS_KEY = (eventId: string) => `setnayan:day-of-banner-dismissed:${eventId}`;

type Position = {
  current: Block | null;
  next: Block | null;
};

function locatePosition(blocks: Block[], now: number): Position {
  const sorted = [...blocks].sort(
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

export function DayOfModeBanner({ eventId, blocks }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  // Hydrate dismiss state from localStorage, honouring the 1-hour TTL.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY(eventId));
      if (!raw) return;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return;
      if (Date.now() - ts < DISMISS_TTL_MS) {
        setDismissed(true);
      } else {
        window.localStorage.removeItem(DISMISS_KEY(eventId));
      }
    } catch {
      // localStorage unavailable (private mode); just render the banner.
    }
  }, [eventId]);

  // Tick every 30s so the countdown stays fresh.
  useEffect(() => {
    if (dismissed) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [dismissed]);

  // tick triggers re-renders so the countdown copy stays fresh; we always
  // pull a fresh Date.now() at render time below.
  const position = useMemo(
    () => locatePosition(blocks, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, tick],
  );
  const now = Date.now();

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY(eventId), String(Date.now()));
    } catch {
      // swallow
    }
    setDismissed(true);
  };

  // Build subdued copy.
  let subdued: string;
  if (position.current) {
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

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 sm:items-center sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream sm:mt-0"
      >
        <Radio className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
          Live
        </p>
        <p className="text-base font-semibold text-ink sm:text-lg">
          Event day mode is active
        </p>
        <p className="truncate text-sm text-ink/65">{subdued}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss event day banner for 1 hour"
        className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-terracotta/15 hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
