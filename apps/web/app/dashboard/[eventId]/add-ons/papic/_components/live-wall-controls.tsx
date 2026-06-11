'use client';

/**
 * Salamisim Live Photo Wall — the couple's interactive controls (P1):
 * generate/revoke single-use screen codes + the one-tap kill switch over the
 * latest wall tiles (Hide from wall = reversible, wall-only · "also hide from
 * gallery" = the durable album hide — two distinct semantics).
 */

import { useState, useTransition } from 'react';
import { EyeOff, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import {
  createWallScreenCode,
  hideWallTile,
  revokeWallScreen,
  unhideWallTile,
} from './live-wall-actions';

export type WallScreenRow = {
  sessionId: string;
  code: string;
  claimed: boolean;
  expiresAt: string;
};

export type WallTileRow = {
  feedId: string;
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  sourceId: string;
  hidden: boolean;
  thumbUrl: string | null;
};

export function LiveWallControls({
  eventId,
  screens,
  tiles,
}: {
  eventId: string;
  screens: WallScreenRow[];
  tiles: WallTileRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'something hiccuped');
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createWallScreenCode(eventId))}
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3.5 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          Generate screen code
        </button>
        {screens.map((s) => (
          <span
            key={s.sessionId}
            className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1.5 font-mono text-sm tracking-widest text-ink"
          >
            {s.code}
            <span className="text-[11px] font-sans tracking-normal text-ink/50">
              {s.claimed ? 'on a screen' : 'unclaimed'}
            </span>
            <button
              type="button"
              aria-label={`Revoke screen code ${s.code}`}
              disabled={pending}
              onClick={() => run(() => revokeWallScreen(eventId, s.sessionId))}
              className="rounded p-0.5 text-ink/40 hover:bg-ink/10 hover:text-ink"
            >
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>

      {tiles.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            On the wall now — newest first
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {tiles.map((tile) => (
              <div
                key={tile.feedId}
                className={`relative h-20 w-20 flex-none overflow-hidden rounded-md border ${
                  tile.hidden ? 'border-terracotta/40 opacity-40' : 'border-ink/10'
                }`}
              >
                {tile.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned R2 thumb
                  <img src={tile.thumbUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-ink/10" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink/60 py-0.5">
                  {tile.hidden ? (
                    <button
                      type="button"
                      aria-label="Show on wall again"
                      disabled={pending}
                      onClick={() =>
                        run(() => unhideWallTile(eventId, tile.sourceTable, tile.sourceId))
                      }
                      className="rounded p-0.5 text-cream/90 hover:bg-cream/20"
                    >
                      <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label="Hide from wall (keeps it in your gallery)"
                        title="Hide from wall (keeps it in your gallery)"
                        disabled={pending}
                        onClick={() =>
                          run(() => hideWallTile(eventId, tile.sourceTable, tile.sourceId, false))
                        }
                        className="rounded p-0.5 text-cream/90 hover:bg-cream/20"
                      >
                        <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Hide from wall AND gallery"
                        title="Hide from wall AND gallery"
                        disabled={pending}
                        onClick={() =>
                          run(() => hideWallTile(eventId, tile.sourceTable, tile.sourceId, true))
                        }
                        className="rounded p-0.5 text-terracotta hover:bg-cream/20"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/50">
          No photos on the wall yet — they appear here the moment your paparazzi start shooting.
        </p>
      )}

      {error ? <p className="text-xs text-terracotta">{error}</p> : null}
    </div>
  );
}
