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
 */

type Song = { title: string; artist: string; lbl: string };
type ArtState = Record<string, ItunesResult | 'loading'>;

const HYDRATE_CONCURRENCY = 4;

export function SongPreviewList({
  songs,
  pickedLbls,
  query,
  onToggle,
}: {
  songs: Song[];
  pickedLbls: string[];
  query: string;
  onToggle: (lbl: string) => void;
}) {
  const picked = useMemo(() => new Set(pickedLbls), [pickedLbls]);
  const n = pickedLbls.length;
  const q = query.trim().toLowerCase();

  const [art, setArt] = useState<ArtState>({});
  const [playing, setPlaying] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const songMap = useMemo(() => new Map(songs.map((s) => [s.lbl, s])), [songs]);
  const songMapRef = useRef(songMap);
  songMapRef.current = songMap;

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
      activeRef.current += 1;
      setArt((a) => ({ ...a, [lbl]: 'loading' }));
      lookupItunes(song.title, song.artist)
        .then((r) => {
          setArt((a) => ({ ...a, [lbl]: r }));
          // Throttles aren't cached → let the row retry the next time it's seen.
          if (r.status === 'throttled') startedRef.current.delete(lbl);
        })
        .finally(() => {
          activeRef.current -= 1;
          pump();
        });
    }
  }, []);

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
    // Root = the onboarding scroll container (.body), so "visible" means in the
    // actual viewport — NOT the list itself (which would mark all 100 rows
    // visible and hydrate the whole catalogue at once). Covers are fixed (100
    // rows, keyed by lbl) so observing once on mount is enough; re-sorts reuse
    // the same elements.
    const scrollRoot = list.closest('.body');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const lbl = (e.target as HTMLElement).dataset.lbl;
          if (e.isIntersecting && lbl) enqueue(lbl);
        }
      },
      { root: scrollRoot, rootMargin: '200px 0px' },
    );
    list.querySelectorAll<HTMLElement>('button.scover[data-lbl]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enqueue]);

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
        play(r);
      });
    },
    [playing, art],
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
        const show = q ? `${title} ${artist}`.toLowerCase().includes(q) : sel || n < 10;
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
