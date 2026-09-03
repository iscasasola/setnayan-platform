'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Film } from 'lucide-react';
import { YOUTUBE_ARCHIVE_HOURS, decideArchiveGuard } from '@/lib/live-studio-window';

/**
 * THE BROADCAST-WINDOW STRIP — now, JUST the 12-hour archive warning.
 *
 * 🚫 RETIRED HERE (LS6, owner-ruled 2026-09-02): the per-event-DAY countdown ("ends
 * in 43 minutes", "add another day"), the never-interrupt "running long" message,
 * and the "your broadcast day hasn't started" unanchored-day warning are ALL gone.
 * They existed only because multi-cam used to expire on a clock
 * (lib/live-studio-window.ts's retired `decideBroadcastWindow`); LS6 made
 * ownership permanent, so there is nothing left to count down to and nothing an
 * un-anchored day could cost. See that module's header for the retired shape.
 *
 * WHAT SURVIVES: THE 12-HOUR ARCHIVE CAP (§ 4f ③) — YouTube does not limit how
 * long a stream runs, but it archives only the first 12 hours, so a longer stream
 * can leave NO replay at all. This is unrelated to how Live Studio is billed — it
 * is YouTube's own per-stream technical limit — so LS6 does not touch it.
 *
 * ⚠ THIS COMPONENT DECIDES NOTHING. It renders a sentence; the entitlement itself
 * is resolved server-side (lib/live-studio-window-server.ts) on every render of
 * the controller, the program pop-out and the public page. The clock here is the
 * operator's own laptop clock, which is fine for "show a sentence" and exactly why
 * it is not allowed anywhere near "may they broadcast".
 *
 * NEVER A BLOCK. Nothing here disables a control, ends a broadcast, or covers the
 * monitor. This is a sentence the host can read and ignore.
 */

/** Re-evaluate twice a minute: fine enough for an hours countdown, cheap enough to ignore. */
const TICK_MS = 30_000;

export function BroadcastWindowStrip({
  isLive,
  broadcastStartedAt,
  compact = false,
}: {
  /** Is a broadcast on air right now (server-resolved at render). */
  isLive: boolean;
  /** ISO start of the CURRENT broadcast — the archive cap is per-stream. */
  broadcastStartedAt: string | null;
  /**
   * ⭐ WAVE 8 (§ 4g) — render inside a FIXED viewport that must never scroll.
   *
   * Compact keeps the ACTIONABLE half at full strength and clamps the explanatory
   * sentence to two lines. NOTHING IS REMOVED FROM THE DOM: `line-clamp` is a
   * visual clamp, so screen readers still read the whole sentence. Default false,
   * so every other caller renders byte-identically.
   */
  compact?: boolean;
}) {
  // Start from the server's own instant so the first paint matches what the server
  // decided, then take over the clock for the crossing it cannot see.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  if (!now) return null; // SSR + first paint: nothing to warn about yet

  const archive = decideArchiveGuard({ startedAt: broadcastStartedAt, isLive, now });
  if (!archive.warn) return null;

  return (
    <div className="space-y-2">
      {archive.exceeded ? (
        <Strip compact={compact} tone="warn" Icon={AlertCircle} title={`This stream has passed ${YOUTUBE_ARCHIVE_HOURS} hours.`}>
          YouTube saves only the first {YOUTUBE_ARCHIVE_HOURS} hours of a stream as a replay —
          anything from here may not appear in the recording at all. It is still going out
          live to everyone watching. For a celebration that runs over more than one day, stop
          and start a fresh broadcast for each one rather than leaving a single stream up.
        </Strip>
      ) : (
        <Strip
          compact={compact}
          tone="calm"
          Icon={Film}
          title={`${archive.hoursToCap} hour${archive.hoursToCap === 1 ? '' : 's'} of recording left.`}
        >
          YouTube keeps only the first {YOUTUBE_ARCHIVE_HOURS} hours of a stream as a replay.
          Your broadcast can run as long as you like, but if you want the recording, end this
          one before then and start a fresh broadcast for the rest.
        </Strip>
      )}
    </div>
  );
}

function Strip({
  tone,
  Icon,
  title,
  action,
  compact = false,
  children,
}: {
  tone: 'warn' | 'calm';
  Icon: typeof Film;
  title: string;
  action?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  const skin =
    tone === 'warn'
      ? 'border-terracotta/40 bg-terracotta/[0.07] text-ink/75'
      : 'border-ink/15 bg-ink/[0.03] text-ink/70';
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border text-xs leading-snug ${
        compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
      } ${skin}`}
    >
      <Icon
        aria-hidden
        className={`h-4 w-4 shrink-0 ${tone === 'warn' ? 'text-terracotta' : 'text-ink/45'}`}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {/* Visual clamp only — the sentence stays whole in the DOM and for AT. */}
        <span className={compact ? 'line-clamp-2 block' : undefined}>{children}</span>
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
