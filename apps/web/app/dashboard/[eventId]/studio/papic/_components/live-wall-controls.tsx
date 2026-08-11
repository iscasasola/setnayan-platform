'use client';

/**
 * Salamisim Live Photo Wall — the couple's interactive controls (P1):
 * generate/revoke single-use screen codes + the one-tap kill switch over the
 * latest wall tiles (Hide from wall = reversible, wall-only · "also hide from
 * gallery" = the durable album hide — two distinct semantics).
 */

import { useState, useTransition } from 'react';
import { EyeOff, Loader2, Plus, RotateCcw, Smartphone, X } from 'lucide-react';
import { WALL_TILE_LAYOUTS, type WallTileLayout } from '@/lib/live-wall-logic';
import {
  createWallScreenCode,
  hideWallTile,
  revokeWallScreen,
  saveWallConfig,
  setWallGuestMirror,
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
  photoCount,
  tileLayout,
  guestMirrorOn,
}: {
  eventId: string;
  screens: WallScreenRow[];
  tiles: WallTileRow[];
  photoCount: number;
  tileLayout: WallTileLayout;
  /** Does the wall also play on guests' own phones? (events.live_photo_wall_visibility) */
  guestMirrorOn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(photoCount);
  const [layout, setLayout] = useState<WallTileLayout>(tileLayout);
  const [mirror, setMirror] = useState(guestMirrorOn);
  const [mirrorError, setMirrorError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'something hiccuped');
    });
  };

  // The mirror switch keeps its OWN error slot. Sharing the card-wide one would
  // let a failed save scroll out of sight above the fold while the switch sat
  // showing the state the couple asked for and did not get — and this is the
  // one control where believing it worked is the whole harm.
  function flipMirror() {
    const next = !mirror;
    setMirrorError(null);
    startTransition(async () => {
      const res = await setWallGuestMirror(eventId, next);
      if (res.ok) {
        setMirror(res.on);
      } else {
        setMirrorError(
          res.error === 'forbidden'
            ? 'Only the couple can change where the wall shows.'
            : 'That didn’t save — the wall is unchanged. Try again.',
        );
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* WHERE THE WALL SHOWS — the control this card never had. The wall was
          sold as a venue projection ("Live VENUE Photo Wall") and also mirrored
          onto every invited guest's phone; revoking the screen codes below did
          nothing to that. events.live_photo_wall_visibility was built for
          exactly this choice in Nov 2026 and had zero readers and zero writers
          until now. */}
      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Where the wall shows
        </p>
        <p className="mt-1.5 text-sm text-ink/70">
          {mirror
            ? 'On your venue screens and on your guests’ own phones while the celebration is on.'
            : 'On your venue screens only. Guests won’t see the wall on their phones.'}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={mirror}
          onClick={flipMirror}
          disabled={pending}
          className={`mt-2.5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
            mirror
              ? 'bg-mulberry text-cream hover:bg-mulberry-600'
              : 'bg-ink/5 text-ink/80 hover:bg-ink/10'
          }`}
        >
          {pending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Smartphone aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          {mirror ? 'On guests’ phones — tap to stop' : 'Venue screens only — tap to allow phones'}
        </button>
        {mirrorError ? (
          <p role="alert" className="mt-2 text-xs text-terracotta">
            {mirrorError}
          </p>
        ) : null}
      </div>

      {/* Wall display config (owner 2026-07-08 · D5) — how many photos + which
          layout. Fully responsive, so no resolution. */}
      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Wall display</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-sm text-ink/70">
            Photos shown
            <input
              type="number"
              min={6}
              max={60}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="ml-2 w-16 rounded border border-ink/15 bg-surface px-2 py-1 text-sm text-ink"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {WALL_TILE_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLayout(l)}
                aria-pressed={layout === l}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                  layout === l
                    ? 'bg-mulberry text-cream'
                    : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveWallConfig(eventId, count, layout))}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>

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
                  <img src={tile.thumbUrl} alt="Live wall photo" className="h-full w-full object-cover" />
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
                        className="rounded p-0.5 text-terracotta-700 hover:bg-cream/20"
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
