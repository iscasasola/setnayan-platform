'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Radio, RadioTower, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import {
  decideIngestHealth,
  POLL_INTERVAL_MS,
  type IngestHealthState,
  type EncoderHealthInput,
} from '@/lib/live-studio-ingest-health';
import { isTauri } from '@/lib/desktop-stream-key';

/**
 * apps/web/app/panood/control/[eventId]/_components/ingest-health-strip.tsx
 *
 * ⭐ THE RENDER HALF of closing `getYoutubeStreamStatus`'s zero-callers gap —
 * see lib/live-studio-ingest-health.ts (the decision) and
 * lib/live-studio-ingest-health-server.ts (the read). Mounted by the
 * controller page beside the transport row, right where "On air" already
 * lives — this is a PERSISTENT state, never a toast, never console-only.
 * `no_data` while the tally is on air is the loudest state this console has.
 *
 * ⚠ THE TWO TRAPS (see lib/live-studio-ingest-health.ts's docblock in full):
 * a failed poll must never overwrite the cached reading with a guess (a
 * stopped upload fires no event at all — the Papic upload defect hid exactly
 * this way), and staleness — not a bad status — is what must eventually flag
 * it. `cachedRef` only updates on a tick whose `streamStatus` came back
 * non-null; every other tick just lets time (and therefore `lastOkAt`) pass.
 */

type ReadResponse = {
  live: boolean;
  streamStatus: string | null;
  healthStatus: string | null;
};

type CachedRead = {
  streamStatus: string | null;
  healthStatus: string | null;
  /** Epoch ms this was last confirmed by a successful read, or null (never). */
  at: number | null;
};

const STATE_SKIN: Record<IngestHealthState, string> = {
  waiting_for_encoder: 'border-ink/15 bg-ink/[0.03] text-ink/70',
  receiving: 'border-success-300/70 bg-success-50 text-success-900',
  degraded: 'border-warn-300/70 bg-warn-50 text-warn-950',
  reconnecting: 'border-warn-400/70 bg-warn-100 text-warn-950',
  encoder_down: 'border-danger-400/70 bg-danger-50 text-danger-900',
  no_data: 'border-danger-400/70 bg-danger-50 text-danger-900',
};

const STATE_ICON: Record<IngestHealthState, typeof Radio> = {
  waiting_for_encoder: Loader2,
  receiving: Radio,
  degraded: AlertTriangle,
  reconnecting: RefreshCw,
  encoder_down: WifiOff,
  no_data: RadioTower,
};

/** States whose icon should spin — "still in motion", not "stopped and bad". */
const SPINNING_STATES: ReadonlySet<IngestHealthState> = new Set([
  'waiting_for_encoder',
  'reconnecting',
]);

export function IngestHealthStrip({
  eventId,
  mode = 'broadcast',
  initialLive,
  initialStreamStatus,
  initialHealthStatus,
}: {
  eventId: string;
  /**
   * S9 mount-rule extension: `'broadcast'` is the pre-existing Setnayan-
   * managed-broadcast case (YouTube polling, as before). `'manual'` is the
   * own-channel/by-hand route — no `stream_id`, so this never polls YouTube
   * — and only renders once the client confirms a desktop encoder might
   * exist (`isTauri()`); a plain-browser by-hand stream still shows nothing,
   * unchanged from before this session.
   */
  mode?: 'broadcast' | 'manual';
  initialLive: boolean;
  initialStreamStatus: string | null;
  initialHealthStatus: string | null;
}) {
  const [live, setLive] = useState(initialLive);
  const cachedRef = useRef<CachedRead>({
    streamStatus: initialStreamStatus,
    healthStatus: initialHealthStatus,
    at: initialStreamStatus !== null ? Date.now() : null,
  });
  // Bumped on every tick (success or failure) so the strip re-renders even
  // when `live` and the cache are unchanged — staleness must still advance.
  const [, bumpTick] = useState(0);
  // `window.__TAURI__` is only known after mount (SSR always renders the
  // browser case first) — same one-frame-flash tradeoff as EncoderKeyPanel.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(isTauri());
  }, []);

  useEffect(() => {
    // Own-channel: no Setnayan-managed broadcast exists, so there is no
    // stream_id for this endpoint to poll — starting the loop here would
    // burn quota checking a broadcast that was never created.
    if (mode === 'manual') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/live-studio/ingest-health?event_id=${encodeURIComponent(eventId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`ingest-health ${res.status}`);
        const data = (await res.json()) as ReadResponse;
        if (cancelled) return;
        setLive(data.live);
        // A REAL answer (even "inactive") refreshes the cache. Only a genuine
        // failure (streamStatus: null) is left untouched — see module header.
        if (data.streamStatus !== null) {
          cachedRef.current = {
            streamStatus: data.streamStatus,
            healthStatus: data.healthStatus,
            at: Date.now(),
          };
        }
      } catch {
        // Network blip to our OWN endpoint — treated identically to a failed
        // YouTube read: never touch the cache. Staleness will speak for it.
      } finally {
        if (!cancelled) bumpTick((n) => n + 1);
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId, mode]);

  // Own-channel + plain browser: no YouTube reading, no desktop encoder to
  // ask either — render nothing, exactly as before this session.
  if (mode === 'manual' && !desktop) return null;

  const lastOkAt = cachedRef.current.at === null ? null : Date.now() - cachedRef.current.at;
  // ⚠ NOT WIRED YET — always null. `src-tauri/src/encoder_ipc.rs` (S5) has no
  // Tauri `Channel<HealthEvent>` emitting from `reconnect::supervise()` (its
  // `encoder_start` still runs a STUB byte-counter sink, by its own comment).
  // See `lib/live-studio-ingest-health.ts`'s S9 docblock — a follow-up only
  // has to fill in this one value; decideIngestHealth already accepts it.
  const encoder: EncoderHealthInput | null = null;
  const decision = decideIngestHealth({
    streamStatus: cachedRef.current.streamStatus,
    healthStatus: cachedRef.current.healthStatus,
    live: mode === 'broadcast' && live,
    lastOkAt,
    encoder,
  });

  const Icon = STATE_ICON[decision.state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex shrink-0 items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-snug ${STATE_SKIN[decision.state]}`}
    >
      <Icon
        aria-hidden
        className={`mt-px h-4 w-4 shrink-0 ${SPINNING_STATES.has(decision.state) ? 'animate-spin' : ''}`}
        strokeWidth={1.75}
      />
      <span>{decision.sentence}</span>
    </div>
  );
}
