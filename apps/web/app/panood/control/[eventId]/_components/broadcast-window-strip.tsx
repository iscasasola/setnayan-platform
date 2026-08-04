'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Clock3, Radio, Film } from 'lucide-react';
import {
  YOUTUBE_ARCHIVE_HOURS,
  decideArchiveGuard,
  windowPhaseAt,
} from '@/lib/live-studio-window';

/**
 * THE BROADCAST-WINDOW STRIP — the host-facing half of Wave 7
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4f ②/③).
 *
 * Two warnings live here because they share the one thing a server component
 * cannot do: TICK. Both are time-crossings during a show nobody is going to
 * refresh the page for, and a warning that only appears on the next navigation is
 * not a warning.
 *
 *   ① THE BROADCAST DAY — at ~1 hour left, say so and offer another day right
 *     there. Then, past the end: if they are ON AIR, promise plainly that nothing
 *     will be interrupted; if they are off air, say what the next go-live will be.
 *   ② THE 12-HOUR ARCHIVE CAP — YouTube does not limit how long a stream runs, but
 *     it archives only the first 12 hours, so a longer stream can leave NO replay.
 *     For a wedding feeding the Alaala handover that is worse than any paywall.
 *
 * ⚠ THIS COMPONENT DECIDES NOTHING. It renders words and a link to a purchase; the
 * entitlement itself is resolved server-side (lib/live-studio-window-server.ts) on every
 * render of the controller, the program pop-out and the public page. The clock here
 * is the operator's own laptop clock, which is fine for "show a sentence" and is
 * exactly why it is not allowed anywhere near "may they broadcast".
 *
 * NEVER A BLOCK. Nothing here disables a control, ends a broadcast, or covers the
 * monitor. Both items are sentences the host can read and ignore.
 */

/** Re-evaluate twice a minute: fine enough for a minutes countdown, cheap enough to ignore. */
const TICK_MS = 30_000;

export function BroadcastWindowStrip({
  expiresAt,
  isLive,
  broadcastStartedAt,
  addADay,
  compact = false,
}: {
  /** ISO end of the paid broadcast day, or null when no clock is running. */
  expiresAt: string | null;
  /** Is a broadcast on air right now (server-resolved at render). */
  isLive: boolean;
  /** ISO start of the CURRENT broadcast — the archive cap is per-stream. */
  broadcastStartedAt: string | null;
  /** The "Add another day" purchase control (the shared inline checkout drawer). */
  addADay: ReactNode;
  /**
   * ⭐ WAVE 8 (§ 4g) — render inside a FIXED viewport that must never scroll.
   *
   * Two of these strips can be up at once (the day ending AND the 12-hour archive
   * cap), and at full size that is ~140px appearing without warning directly above
   * the transport row. On a 360×640 phone that is enough to push Go live off a
   * viewport the operator cannot scroll.
   *
   * Compact keeps the ACTIONABLE half at full strength — the bold headline and the
   * "Add another day" button are untouched — and clamps the explanatory sentence to
   * two lines. NOTHING IS REMOVED FROM THE DOM: `line-clamp` is a visual clamp, so
   * screen readers still read the whole sentence, and the full text is one tap away
   * in Setup. Default false, so every other caller renders byte-identically.
   */
  compact?: boolean;
}) {
  // Start from the server's own instant so the first paint matches what the server
  // decided, then take over the clock for the crossings it cannot see.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  if (!now) return null; // SSR + first paint: nothing to warn about yet

  const phase = windowPhaseAt(expiresAt, now, isLive);
  const archive = decideArchiveGuard({ startedAt: broadcastStartedAt, isLive, now });

  if (phase === 'none' && !archive.warn) return null;

  return (
    <div className="space-y-2">
      {phase === 'ending-soon' ? (
        <Strip
          compact={compact}
          tone="warn"
          Icon={Clock3}
          title={`Your broadcast day ends ${untilLabel(expiresAt, now)}.`}
          action={addADay}
        >
          Add another day to keep every camera on air. If you are still streaming when it
          ends, we will not cut you off — but the next time you go live it would be one
          camera.
        </Strip>
      ) : null}

      {phase === 'running-long' ? (
        <Strip compact={compact} tone="calm" Icon={Radio} title="Your broadcast day is up — carry on." action={addADay}>
          We do not interrupt a broadcast in progress. Every camera stays on air until you
          stop. Add another day if you plan to go live again after this.
        </Strip>
      ) : null}

      {phase === 'ended' ? (
        <Strip compact={compact} tone="warn" Icon={Radio} title="Your broadcast day has ended." action={addADay}>
          Going live now streams one camera, free, exactly as it always does. Add another
          day to put all of them back on air.
        </Strip>
      ) : null}

      {archive.exceeded ? (
        <Strip compact={compact} tone="warn" Icon={AlertCircle} title={`This stream has passed ${YOUTUBE_ARCHIVE_HOURS} hours.`}>
          YouTube saves only the first {YOUTUBE_ARCHIVE_HOURS} hours of a stream as a replay —
          anything from here may not appear in the recording at all. It is still going out
          live to everyone watching. For a celebration that runs over more than one day, stop
          and start a fresh broadcast for each one rather than leaving a single stream up.
        </Strip>
      ) : archive.warn ? (
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
      ) : null}
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
  Icon: typeof Clock3;
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

/** "in 43 minutes" / "in about an hour" — never a bare timestamp mid-show. */
function untilLabel(expiresAt: string | null, now: Date): string {
  if (!expiresAt) return 'soon';
  const mins = Math.max(0, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60_000));
  if (mins <= 1) return 'in under a minute';
  if (mins < 60) return `in ${mins} minutes`;
  return 'in about an hour';
}
