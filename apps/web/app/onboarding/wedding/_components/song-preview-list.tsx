'use client';

import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lookupItunes, type ItunesResult } from '@/lib/itunes-preview';

/**
 * Song picker rows with iTunes preview (Onboarding Song Bank · §5, LOCKED):
 * the album cover IS the play surface — tap to play the 30-sec preview, tap
 * again to stop, one at a time. Covers hydrate lazily as rows scroll into view
 * (IntersectionObserver + a small concurrency cap), each looked up once via the
 * keyless client-side JSONP lookup; a gold placeholder shows until loaded, and
 * throttled lookups keep the placeholder + retry on the next view. Clicking the
 * row (not the cover) still toggles the pick.
 *
 * §5.4 DB cache: a song may arrive with its preview/artwork already cached in our
 * DB (`previewUrl` + `artworkUrl`). Cached rows render their cover instantly with
 * NO live iTunes call; only un-cached rows hit the keyless JSONP lookup, and on a
 * successful live resolve we hand it back via `onCacheSong` so the parent persists
 * it (so the next user reads the cache). Production trends to near-zero live calls.
 */

type Song = {
  title: string;
  artist: string;
  lbl: string;
  /** DB-cached iTunes preview URL (§5.4) — present → no live lookup needed. */
  previewUrl?: string | null;
  /** DB-cached iTunes album artwork URL (§5.4). */
  artworkUrl?: string | null;
};
type ArtState = Record<string, ItunesResult | 'loading'>;

const HYDRATE_CONCURRENCY = 4;

export function SongPreviewList({
  songs,
  pickedLbls,
  query,
  onToggle,
  onCacheSong,
  alwaysShowAll = false,
}: {
  songs: Song[];
  pickedLbls: string[];
  query: string;
  onToggle: (lbl: string) => void;
  /** Persist a freshly live-resolved preview/artwork to the DB cache (§5.4). */
  onCacheSong?: (s: { title: string; artist: string; result: ItunesResult }) => void;
  /**
   * When true and there's no query, show EVERY row (the recommended Top-100 browse,
   * owner 2026-06-08) instead of collapsing to only the picks once ≥10 are chosen.
   */
  alwaysShowAll?: boolean;
}) {
  const picked = useMemo(() => new Set(pickedLbls), [pickedLbls]);
  const n = pickedLbls.length;
  const q = query.trim().toLowerCase();

  // Seed art state from any DB-cached rows so their covers render instantly with
  // no JSONP. Keyed by lbl; merged in an effect as the song set changes (search).
  const [art, setArt] = useState<ArtState>({});
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const seeded: ArtState = {};
    for (const s of songs) {
      if (s.previewUrl && s.artworkUrl) {
        seeded[s.lbl] = { status: 'ok', previewUrl: s.previewUrl, artworkUrl: s.artworkUrl, trackId: 0 };
      }
    }
    if (Object.keys(seeded).length === 0) return;
    // Don't overwrite a live-resolved entry already in state; only fill gaps.
    setArt((a) => {
      let changed = false;
      const next = { ...a };
      for (const [lbl, r] of Object.entries(seeded)) {
        if (!next[lbl]) {
          next[lbl] = r;
          changed = true;
        }
      }
      return changed ? next : a;
    });
  }, [songs]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const songMap = useMemo(() => new Map(songs.map((s) => [s.lbl, s])), [songs]);
  const songMapRef = useRef(songMap);
  songMapRef.current = songMap;

  const onCacheRef = useRef(onCacheSong);
  onCacheRef.current = onCacheSong;

  // Persist a freshly LIVE-resolved hit to the DB cache (§5.4) so the next user
  // reads it. Only fires for songs that weren't already cached (cached rows are
  // seeded into art state + never enter the lookup path). Throttle/none don't cache.
  const reportResolved = useCallback((song: Song, r: ItunesResult) => {
    if (r.status === 'ok' && !(song.previewUrl && song.artworkUrl)) {
      onCacheRef.current?.({ title: song.title, artist: song.artist, result: r });
    }
  }, []);

  // Lazy artwork hydration — a concurrency-capped queue fed by an
  // IntersectionObserver so only on-screen covers resolve (each once).
  const startedRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);

  const pump = useCallback(() => {
    while (activeRef.current < HYDRATE_CONCURRENCY && queueRef.current.length) {
      const lbl = queueRef.current.shift();
      if (!lbl) break;
      const song = songMapRef.current.get(lbl);
      if (!song) continue;
      // Cached row → already seeded into art state, no live call.
      if (song.previewUrl && song.artworkUrl) continue;
      activeRef.current += 1;
      setArt((a) => ({ ...a, [lbl]: 'loading' }));
      lookupItunes(song.title, song.artist)
        .then((r) => {
          setArt((a) => ({ ...a, [lbl]: r }));
          // Throttles aren't cached → let the row retry the next time it's seen.
          if (r.status === 'throttled') startedRef.current.delete(lbl);
          else reportResolved(song, r);
        })
        .finally(() => {
          activeRef.current -= 1;
          pump();
        });
    }
  }, [reportResolved]);

  const enqueue = useCallback(
    (lbl: string) => {
      if (startedRef.current.has(lbl)) return;
      startedRef.current.add(lbl);
      queueRef.current.push(lbl);
      pump();
    },
    [pump],
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === 'undefined') return;
    // Root = the actual scroll container, so "visible" means in view — NOT the
    // list itself (which would mark every row visible and hydrate the whole
    // catalogue at once). In the bottom-pinned Song Bank the rows scroll inside
    // `.songresults`; the legacy top-search layout scrolled inside `.body`.
    const scrollRoot = list.closest('.songresults') ?? list.closest('.body');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const lbl = (e.target as HTMLElement).dataset.lbl;
          if (e.isIntersecting && lbl) enqueue(lbl);
        }
      },
      { root: scrollRoot, rootMargin: '200px 0px' },
    );
    // Re-runs when the song set changes (a search replaces the rows), so newly
    // mounted covers get observed too. Covers are keyed by lbl, so a re-sort
    // reuses the same elements (idempotent enqueue dedupes via startedRef).
    list.querySelectorAll<HTMLElement>('button.scover[data-lbl]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enqueue, songs]);

  // One shared <audio>; starting a song stops any other.
  const togglePlay = useCallback(
    (lbl: string) => {
      const a = audioRef.current;
      if (!a) return;
      if (playing === lbl) {
        a.pause();
        setPlaying(null);
        return;
      }
      const play = (r: ItunesResult | 'loading' | undefined) => {
        if (r && r !== 'loading' && r.status === 'ok') {
          a.src = r.previewUrl;
          setPlaying(lbl);
          void a.play().catch(() => setPlaying(null));
        }
      };
      const cur = art[lbl];
      if (cur && cur !== 'loading') {
        play(cur);
        return;
      }
      // Not resolved yet — resolve on demand, then play.
      const song = songMapRef.current.get(lbl);
      if (!song) return;
      setArt((s) => ({ ...s, [lbl]: 'loading' }));
      void lookupItunes(song.title, song.artist).then((r) => {
        setArt((s) => ({ ...s, [lbl]: r }));
        if (r.status !== 'throttled') reportResolved(song, r);
        play(r);
      });
    },
    [playing, art, reportResolved],
  );

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(null);
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, []);

  return (
    <div className="songlist" ref={listRef}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- 30s instrumental preview, no captions */}
      <audio ref={audioRef} preload="none" />
      {songs.map(({ title, artist, lbl }) => {
        const sel = picked.has(lbl);
        const show = q ? `${title} ${artist}`.toLowerCase().includes(q) : alwaysShowAll || sel || n < 10;
        const a = art[lbl];
        const cover = a && a !== 'loading' && a.status === 'ok' ? a.artworkUrl : null;
        const isPlaying = playing === lbl;
        const note =
          a && a !== 'loading' && a.status === 'none'
            ? 'no preview on file'
            : a && a !== 'loading' && a.status === 'throttled'
              ? 'tap again in a moment'
              : null;
        return (
          <div
            key={lbl}
            className={`song${sel ? ' sel' : ''}`}
            style={show ? undefined : { display: 'none' }}
            onClick={() => onToggle(lbl)}
          >
            <button
              type="button"
              className={`scover${isPlaying ? ' playing' : ''}`}
              data-lbl={lbl}
              aria-label={`${isPlaying ? 'Stop' : 'Play'} 30-second preview of ${title} by ${artist}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay(lbl);
              }}
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- external iTunes artwork, not a local/optimizable asset
                <img className="scover-img" src={cover} alt="" loading="lazy" />
              ) : null}
              <span className="scover-ic" aria-hidden>
                {isPlaying ? <Pause size={12} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} />}
              </span>
            </button>
            <span className="stxt">
              <span className="st">{title}</span>
              <span className="sa">
                {artist}
                {note ? <span className="snote"> · {note}</span> : null}
              </span>
            </span>
            <span className="sck" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
