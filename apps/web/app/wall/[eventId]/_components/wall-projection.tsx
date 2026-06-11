'use client';

/**
 * Salamisim projection — the full-screen venue collage (P1).
 *
 * Feed model (build plan, locked): Realtime broadcast is a WAKE-UP NUDGE,
 * never the source of truth — the projector pulls the service-role feed route
 * on a ~12s reconcile timer regardless of channel health, plus a ~60s FULL
 * sweep that also reconciles retractions (the kill switch lands within one
 * tick even if the broadcast was missed). On a network drop the collage
 * freezes on the last good frame (never whites out) with an amber dot;
 * wake-lock (best-effort) keeps the venue screen alive.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WallSnapshot } from '@/lib/live-wall';
import {
  latestCursor,
  mergeTiles,
  reconcileTiles,
  type WallTile,
} from '@/lib/live-wall-logic';

const NUDGE_POLL_MS = 12_000;
const FULL_SWEEP_MS = 60_000;
/** Cap the DOM at a sane tile count for an all-night projector session. */
const MAX_DOM_TILES = 48;

type Conn = 'live' | 'reconnecting' | 'offline';

export function WallProjection({
  eventId,
  initial,
}: {
  eventId: string;
  initial: WallSnapshot;
}) {
  const [tiles, setTiles] = useState<WallTile[]>(initial.tiles);
  const [count, setCount] = useState(initial.count);
  const [mode, setMode] = useState(initial.mode);
  const [conn, setConn] = useState<Conn>('live');
  const [caption, setCaption] = useState(initial.caption);
  const cursorRef = useRef<string>(latestCursor(initial.tiles, '1970-01-01T00:00:00Z'));
  const failsRef = useRef(0);
  const newestIdRef = useRef<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const applySnapshot = useCallback((snap: WallSnapshot, full: boolean) => {
    setCount(snap.count);
    setMode(snap.mode);
    setCaption(snap.caption ?? null);
    setTiles((prev) => {
      const next = full
        ? reconcileTiles(prev, snap.tiles).tiles
        : mergeTiles(prev, snap.tiles);
      const fresh = next.filter((t) => !prev.includes(t));
      if (fresh.length > 0) newestIdRef.current = fresh[fresh.length - 1]?.feedId ?? null;
      cursorRef.current = latestCursor(next, cursorRef.current);
      return next;
    });
  }, []);

  const pull = useCallback(
    async (full: boolean) => {
      try {
        const since = full ? '' : `?since=${encodeURIComponent(cursorRef.current)}`;
        const res = await fetch(`/api/wall/${eventId}/feed${since}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const snap = (await res.json()) as WallSnapshot;
        applySnapshot(snap, full);
        failsRef.current = 0;
        setConn('live');
      } catch {
        failsRef.current += 1;
        setConn(failsRef.current >= 4 ? 'offline' : 'reconnecting');
        // Freeze on the last good collage — never white out.
      }
    },
    [applySnapshot, eventId],
  );

  // Reconcile timers — the guaranteed path (cron-free, single long-lived page).
  useEffect(() => {
    const nudge = setInterval(() => void pull(false), NUDGE_POLL_MS);
    const sweep = setInterval(() => void pull(true), FULL_SWEEP_MS);
    return () => {
      clearInterval(nudge);
      clearInterval(sweep);
    };
  }, [pull]);

  // Realtime broadcast — the fast path. A received tile merges instantly;
  // a dropped channel only costs latency (the timers cover delivery).
  useEffect(() => {
    const channel = supabase
      .channel(`wall:${eventId}`)
      .on('broadcast', { event: 'tile' }, ({ payload }) => {
        const tile = payload as WallTile;
        if (!tile?.feedId || !tile?.url) return;
        newestIdRef.current = tile.feedId;
        setTiles((prev) => mergeTiles(prev, [tile]));
        setCount((c) => c + 1);
        cursorRef.current = latestCursor([tile], cursorRef.current);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  // Wake-lock: best-effort, re-request on visibility return (build plan rule).
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
        };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        // unsupported TV browser — the couple's setup hint covers it
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Teaser modes — the wall isn't live yet.
  if (mode === 'coming_soon' || mode === 'pre_event') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-8 text-center text-cream">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-terracotta">Setnayan · Papic</p>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight">
          {initial.displayName ?? 'The celebration'}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-cream/60">
          The photo wall lights up when the celebration starts.
        </p>
        <ConnDot conn={conn} />
      </main>
    );
  }

  const visible = tiles.slice(-MAX_DOM_TILES);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="flex items-center justify-between px-6 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-cream/70">
          {initial.displayName ?? 'Setnayan'} <span className="text-terracotta">· live</span>
        </p>
        <div className="flex items-center gap-4">
          <p className="text-sm text-cream/80">
            <span className="text-2xl font-semibold tabular-nums text-cream">{count}</span>{' '}
            photos
          </p>
          <ConnDot conn={conn} />
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="flex min-h-[70vh] items-center justify-center">
          <p className="text-lg text-cream/40">Waiting for the first shot…</p>
        </div>
      ) : (
        <div className="gap-2 px-4 pb-10 [column-fill:_balance] columns-2 sm:columns-3 lg:columns-4 xl:columns-5">
          {visible.map((tile) => (
            <figure
              key={tile.feedId}
              className={`mb-2 break-inside-avoid overflow-hidden rounded-md ${
                tile.feedId === newestIdRef.current ? 'wall-tile-new' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URLs; next/image would proxy + re-sign */}
              <img
                src={tile.url}
                alt=""
                loading="lazy"
                className="w-full"
                draggable={false}
              />
            </figure>
          ))}
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent px-6 pb-3 pt-8">
        {caption ? (
          <div className="mx-auto mb-2 max-w-3xl rounded-lg bg-ink/90 px-5 py-3 text-center shadow-lg">
            <p className="font-display text-xl italic leading-snug text-cream">
              &ldquo;{caption.text}&rdquo;
            </p>
            <p className="mt-1 text-sm text-terracotta">— {caption.author}</p>
          </div>
        ) : null}
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.3em] text-cream/50">
          Powered by Setnayan · Papic
        </p>
      </footer>

    </main>
  );
}

function ConnDot({ conn }: { conn: Conn }) {
  const color =
    conn === 'live' ? 'bg-emerald-400' : conn === 'reconnecting' ? 'bg-amber-400' : 'bg-red-500';
  const label =
    conn === 'live' ? 'connected' : conn === 'reconnecting' ? 'reconnecting' : 'offline';
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={`wall ${label}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}
