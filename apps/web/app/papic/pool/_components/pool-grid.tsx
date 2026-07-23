'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import type { PoolTile } from '@/lib/papic-pool-gallery';

/**
 * Shared Pool Gallery grid — the client half of /papic/pool.
 *
 * Tiles come presigned from the server (web-copy derivatives only). Photos get
 * the "I'm in this" toggle (self-link is PHOTOS-ONLY in V1); clips render as
 * playable <video> tiles with no link affordance. Load-more is keyset via the
 * /api/papic/guest-pool cursor. All writes go through the cookie-validated
 * pool-link/unlink routes — no ids beyond the capture's own UUID leave here.
 */

type LinkState = 'idle' | 'busy';

export function PoolGrid({
  initialTiles,
  initialCursor,
}: {
  initialTiles: PoolTile[];
  initialCursor: string | null;
}) {
  const [tiles, setTiles] = useState<PoolTile[]>(initialTiles);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoadingMore, startLoadMore] = useTransition();

  async function toggleLink(tile: PoolTile) {
    if (busyId) return;
    setBusyId(tile.id);
    setNotice(null);
    try {
      const res = await fetch(
        tile.linked ? '/api/papic/guest-pool-unlink' : '/api/papic/guest-pool-link',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceTable: tile.sourceTable, sourceId: tile.id }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; already?: boolean; removed?: boolean }
        | null;
      if (data?.ok && tile.linked && data.removed === false) {
        // Unlink removed nothing: the live tag isn't the guest's own manual
        // pick (a crew QR / face tag). It stays in their gallery — say so
        // honestly instead of flipping the tile to a lie.
        setNotice('This photo was tagged for you by the crew, so it stays in your gallery.');
      } else if (data?.ok) {
        setTiles((prev) =>
          prev.map((t) => (t.id === tile.id ? { ...t, linked: !tile.linked } : t)),
        );
      } else if (data?.error === 'cap_reached') {
        setNotice('This photo already has the maximum number of people tagged.');
      } else if (data?.error === 'removed_by_host') {
        setNotice('The couple removed this tag, so it can’t be re-added.');
      } else if (data?.error === 'pool_closed') {
        setNotice('The couple has closed the shared gallery.');
      } else {
        setNotice('That didn’t save — try again in a moment.');
      }
    } catch {
      setNotice('That didn’t save — try again in a moment.');
    } finally {
      setBusyId(null);
    }
  }

  function loadMore() {
    if (!cursor) return;
    startLoadMore(async () => {
      try {
        const res = await fetch(
          `/api/papic/guest-pool?before=${encodeURIComponent(cursor)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; tiles?: PoolTile[]; nextCursor?: string | null }
          | null;
        if (data?.ok && Array.isArray(data.tiles)) {
          setTiles((prev) => {
            const seen = new Set(prev.map((t) => t.id));
            return [...prev, ...data.tiles!.filter((t) => !seen.has(t.id))];
          });
          setCursor(data.nextCursor ?? null);
        } else {
          setCursor(null);
        }
      } catch {
        // Leave the cursor so the guest can retry on venue WiFi.
      }
    });
  }

  if (tiles.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">
        No photos yet — the gallery fills up as the crew and guests start
        shooting. Check back soon!
      </p>
    );
  }

  return (
    <div className="mt-6">
      {notice ? (
        <p role="status" className="mb-3 rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/70">
          {notice}
        </p>
      ) : null}
      <ul className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => {
          const busy = busyId === tile.id;
          const state: LinkState = busy ? 'busy' : 'idle';
          return (
            <li key={tile.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
              {tile.mediaType === 'clip' && tile.clipUrl ? (
                // Web-copy clip playback; the poster (when present) is the tile.
                <video
                  src={tile.clipUrl}
                  poster={tile.thumbUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                // Presigned URL — raw <img> (the optimizer would cache the expiry).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
              {tile.mediaType === 'photo' ? (
                <button
                  type="button"
                  onClick={() => toggleLink(tile)}
                  disabled={state === 'busy'}
                  aria-pressed={tile.linked}
                  className={`absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium backdrop-blur transition ${
                    tile.linked
                      ? 'bg-mulberry/90 text-cream hover:bg-mulberry'
                      : 'bg-cream/85 text-ink/80 hover:bg-cream'
                  } disabled:opacity-60`}
                >
                  {state === 'busy' ? (
                    <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
                  ) : tile.linked ? (
                    <>
                      <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                      In your gallery
                      <X aria-hidden className="ml-0.5 h-3 w-3 opacity-70" strokeWidth={2} />
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                      I&rsquo;m in this
                    </>
                  )}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/10 disabled:opacity-60"
        >
          {isLoadingMore ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : null}
          Load more
        </button>
      ) : null}
    </div>
  );
}
