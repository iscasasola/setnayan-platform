'use client';

import { useEffect, useState } from 'react';
import { parseYouTubeVideoId, youTubeEmbedUrl } from '@/lib/panood-watch';
import type { GuestWatchState } from '@/lib/live-watch-state';

/** Exported so the mutation-test guard can assert on the exact value. */
export const WATCH_POLL_INTERVAL_MS = 30_000;

/**
 * W1 — the poll that keeps the CAST single-camera embed pointed at whatever
 * broadcast is actually running. Extracted from watch-live-block.tsx (which
 * stays a server component: the Roam-picker and Facebook-only branches there
 * need no client state) because this is the one branch whose `<a href>` and
 * iframe `src` used to be server-rendered once and never revisited — a
 * reconnect that binds a NEW YouTube broadcast id
 * (app/api/live-studio/encoder/broadcast-ended/route.ts) left every guest
 * already on the page holding the dead one.
 *
 * Polls GET /api/live/[slug]/watch every 30s WHILE state is 'live' or
 * 'reconnecting' — once it reads 'ended', there is nothing left to reconnect
 * to and polling stops (the effect's cleanup fires because `state` is a
 * dependency; no new interval is scheduled once the branch below returns
 * early). A transient fetch failure keeps the last known-good link and tries
 * again next tick, never blanks the player.
 *
 * `watchUrl`/`embedUrl` are re-derived from the SAME parse the server already
 * ran (lib/panood-watch.ts's parseYouTubeVideoId/youTubeEmbedUrl — pure,
 * client-safe, no `server-only`), never trusted as pre-built HTML: belt and
 * braces on top of the route's own server-side normalize-or-reject.
 */
export function WatchLiveEmbed({
  slug,
  initialWatchUrl,
  initialEmbedUrl,
  facebookUrl,
  occasion = 'celebration',
}: {
  slug: string;
  initialWatchUrl: string | null;
  initialEmbedUrl: string;
  facebookUrl: string | null;
  occasion?: string;
}) {
  const [watchUrl, setWatchUrl] = useState(initialWatchUrl);
  const [embedUrl, setEmbedUrl] = useState(initialEmbedUrl);
  const [state, setState] = useState<GuestWatchState>('live');

  useEffect(() => {
    // Nothing left to poll for once the broadcast has ended or never started —
    // see this component's docblock. Also the guard the mutation test targets:
    // this condition is the ONLY gate on the reconnecting sentence below, so a
    // sabotage that widens it (e.g. to "state !== 'live'") would make 'ended'
    // show the reconnecting banner, which the W1 GUARD forbids.
    if (!slug || (state !== 'live' && state !== 'reconnecting')) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}/watch`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { watchUrl: string | null; state: GuestWatchState };
        setState(data.state);
        if (data.state === 'live' && data.watchUrl) {
          const videoId = parseYouTubeVideoId(data.watchUrl);
          if (videoId) {
            setWatchUrl(data.watchUrl);
            setEmbedUrl(youTubeEmbedUrl(videoId));
          }
        }
      } catch {
        // Transient network hiccup — keep the last known-good link, retry next tick.
      }
    }, WATCH_POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [slug, state]);

  return (
    <section
      aria-label={`Watch the ${occasion} live`}
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          Watch live
        </p>
        <span className="flex items-center gap-3">
          {watchUrl ? (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
            >
              Open on YouTube
            </a>
          ) : null}
          {facebookUrl ? (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cream/65 underline-offset-4 hover:text-cream hover:underline"
            >
              Watch on Facebook
            </a>
          ) : null}
        </span>
      </div>
      <div className="aspect-video w-full">
        <iframe
          title={`Live broadcast of the ${occasion}`}
          src={embedUrl}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {state === 'reconnecting' ? (
        <p className="bg-ink px-4 pb-3 pt-1 text-xs leading-relaxed text-cream/60">
          The stream is reconnecting — this link will update on its own.
        </p>
      ) : (
        // NOTHING HERE KNOWS WHETHER A STREAM IS RUNNING (2026-08-05, still true
        // outside the reconnect case above): the pulsing dot appears because the
        // couple saved a link, not because YouTube confirmed video is flowing.
        <p className="bg-ink px-4 pb-3 pt-1 text-xs leading-relaxed text-cream/60">
          If the ceremony hasn&rsquo;t started, the player above will say the video
          is unavailable. Nothing is wrong — check back a little later.
        </p>
      )}
    </section>
  );
}
