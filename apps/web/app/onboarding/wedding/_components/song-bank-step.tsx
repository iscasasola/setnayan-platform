'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItunesResult } from '@/lib/itunes-preview';
import { searchSongBankAction, cacheSongItunesAction, fetchSongBankCuratedAction, type SongBankItem } from '../actions';
import { SongPreviewList } from './song-preview-list';

/**
 * Song Bank — the onboarding music step (Onboarding_Style_and_Song_Bank_2026-06-04 §5).
 *
 * THREE CLEAN MODES via a top segmented control (owner 2026-06-09 — "redesign this to handle
 * 3 things cleanly: search, see top 100 most popular wedding songs, and see the playlist
 * created"; the prior bottom-pinned search bar + playlist were falling below the fold):
 *   • Top 100  — the curated recommended list (`fetchSongBankCuratedAction`), every row PLAYABLE.
 *   • Search   — search OUR whole bank (`searchSongBankAction`, never iTunes); the input sits at
 *                the top of this tab so it can never scroll off-screen.
 *   • Playlist — only the couple's picks, each playable + removable, with an empty-state nudge.
 * iTunes resolves only each row's album cover + 30-sec preview and is cached back to the DB
 * (§5.4), so production trends to near-zero live calls. The segmented control + the count bar are
 * flex:0 0 auto; only `.songresults` scrolls (the screen is height-bounded — see onboarding.css
 * `#screen-songs.active`).
 */

/** How many recommended songs the Top-100 browse shows (owner 2026-06-08 "top 100"). */
const RECOMMENDED_LIMIT = 100;

const SEARCH_DEBOUNCE_MS = 240;

type Mode = 'top' | 'search' | 'playlist';

type Row = { title: string; artist: string; lbl: string; previewUrl: string | null; artworkUrl: string | null };

const toRow = (s: SongBankItem): Row => ({
  title: s.title,
  artist: s.artist,
  lbl: s.lbl,
  previewUrl: s.previewUrl,
  artworkUrl: s.artworkUrl,
});

const rowFromLbl = (lbl: string): Row => {
  const [title, artist = ''] = lbl.split('|');
  return { title: title ?? '', artist, lbl, previewUrl: null, artworkUrl: null };
};

export function SongBankStep({
  picked,
  onToggle,
}: {
  picked: string[];
  onToggle: (lbl: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('top');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  // The curated Top-100 recommended list — loaded once on mount (owner 2026-06-08).
  const [curated, setCurated] = useState<Row[]>([]);
  const [curatedLoaded, setCuratedLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchSongBankCuratedAction().then((items) => {
      if (!live) return;
      setCurated(items.slice(0, RECOMMENDED_LIMIT).map(toRow));
      setCuratedLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const n = picked.length;
  const q = query.trim();

  // Remember rows we've seen (from searches + curated) so a picked song keeps its cached
  // cover/preview wherever it's shown (Top 100, Playlist) even after the query clears.
  const seenRef = useRef<Map<string, Row>>(new Map());
  useEffect(() => {
    for (const r of results) seenRef.current.set(r.lbl, r);
  }, [results]);
  useEffect(() => {
    for (const r of curated) seenRef.current.set(r.lbl, r);
  }, [curated]);
  const cachedRow = useCallback((lbl: string): Row => seenRef.current.get(lbl) ?? rowFromLbl(lbl), []);

  // Debounced search over OUR bank (the curated `songs` table). Latest query wins. Runs only
  // while the Search tab is active so switching tabs doesn't fire a stale query.
  const seqRef = useRef(0);
  useEffect(() => {
    if (mode !== 'search' || !q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mySeq = ++seqRef.current;
    const t = setTimeout(() => {
      void searchSongBankAction(q).then((items) => {
        if (mySeq !== seqRef.current) return; // a newer query superseded this one
        setResults(items.map(toRow));
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, mode]);

  // Persist a freshly live-resolved preview/artwork back to the DB cache (§5.4).
  const onCacheSong = useCallback(
    ({ title, artist, result }: { title: string; artist: string; result: ItunesResult }) => {
      if (result.status !== 'ok') return;
      void cacheSongItunesAction({
        title,
        artist,
        appleTrackId: result.trackId || null,
        previewUrl: result.previewUrl,
        artworkUrl: result.artworkUrl,
      });
    },
    [],
  );

  // Top 100 = the curated recommended songs, with any of the couple's picks that fall OUTSIDE
  // the Top-100 pinned in front so they stay visible + removable.
  const topRows = useMemo<Row[]>(() => {
    const inCurated = new Set(curated.map((r) => r.lbl));
    const extraPicks = picked.filter((lbl) => !inCurated.has(lbl)).map(cachedRow);
    return [...extraPicks, ...curated];
  }, [curated, picked, cachedRow]);

  // Playlist = exactly the couple's picks, in pick order, each playable + removable.
  const playlistRows = useMemo<Row[]>(() => picked.map(cachedRow), [picked, cachedRow]);

  const isSearch = mode === 'search';
  const rows = mode === 'search' ? results : mode === 'playlist' ? playlistRows : topRows;
  // Search → pass the query so SongPreviewList shows every server match. Top/Playlist → ''
  // so it renders them all (alwaysShowAll keeps the full list visible after ≥10 picks).
  const listQuery = isSearch ? q : '';

  const header =
    mode === 'search'
      ? !q
        ? 'Search our song bank — type a title or artist'
        : searching
          ? 'Searching…'
          : results.length
            ? 'Tap to preview · tap again to add'
            : 'No match in our song bank — try another spelling'
      : mode === 'playlist'
        ? n > 0
          ? 'Your playlist · tap to play, tap again to remove'
          : ''
        : !curatedLoaded
          ? 'Loading recommended songs…'
          : 'Top 100 for your day · tap to preview, tap again to add';

  const playlistEmpty = mode === 'playlist' && n === 0;

  const seg = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      className={mode === m ? 'on' : undefined}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <div className="songpick songbank">
      <div className="song-seg" role="tablist" aria-label="Browse songs">
        {seg('top', 'Top 100')}
        {seg('search', 'Search')}
        {seg('playlist', n > 0 ? `Playlist · ${n}` : 'Playlist')}
      </div>

      {isSearch ? (
        <label className="songsearch songbank-search song-seg-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the field the user just switched to
            autoFocus
            placeholder="Search songs or artists…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
        </label>
      ) : null}

      <div className="songresults rise" data-empty={rows.length === 0 ? 'true' : undefined}>
        {header ? <div className="songresult-h">{header}</div> : null}
        {playlistEmpty ? (
          <div className="songbank-empty">
            No songs yet — add some from <b>Top&nbsp;100</b> or <b>Search</b>.
          </div>
        ) : (
          <SongPreviewList
            songs={rows}
            pickedLbls={picked}
            query={listQuery}
            onToggle={onToggle}
            onCacheSong={onCacheSong}
            alwaysShowAll={!isSearch}
          />
        )}
      </div>

      <div className="songbar songbank-bar">
        <span className="songbar-count">
          Picked <b>{n}</b>
          {' · '}
          <span className={n >= 10 ? 'done' : undefined}>
            {n >= 10 ? 'we’ll build the rest of your playlist' : `pick at least ${10 - n} more`}
          </span>
        </span>
      </div>
    </div>
  );
}
