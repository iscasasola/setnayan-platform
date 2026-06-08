'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItunesResult } from '@/lib/itunes-preview';
import { searchSongBankAction, cacheSongItunesAction, fetchSongBankCuratedAction, type SongBankItem } from '../actions';
import { SongPreviewList } from './song-preview-list';

/**
 * Song Bank — the onboarding music step (Onboarding_Style_and_Song_Bank_2026-06-04 §5).
 *
 * RECOMMENDED-LIST + SEARCH (owner 2026-06-08: "song list must still have the top 100
 * recommended songs … can it also play. search bar should never go off the screen" —
 * reverses the 2026-06-05 search-only lock). The default (no-query) view shows the curated
 * TOP-100 recommended songs (`fetchSongBankCuratedAction` → `lib/songs.fetchSongBankCurated`),
 * every one PLAYABLE via SongPreviewList, with the couple's own picks pinned in so they're
 * always removable. Searching hits OUR whole bank (`searchSongBankAction` →
 * `lib/songs.searchSongBank`), never iTunes; iTunes resolves only each row's album cover +
 * 30-sec preview and is cached back to the DB (§5.4), so production trends to near-zero live
 * calls. The search bar stays pinned at the bottom (`.songbank-bar`, flex:0 0 auto) while the
 * list scrolls inside `.songresults` — so it never scrolls off-screen.
 */

/** How many recommended songs the default browse shows (owner 2026-06-08 "top 100"). */
const RECOMMENDED_LIMIT = 100;

const SEARCH_DEBOUNCE_MS = 240;

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
  const isSearch = q.length > 0;

  // Remember rows we've seen from searches so a picked song keeps its cached
  // cover/preview in the default view even after the query clears.
  const seenRef = useRef<Map<string, Row>>(new Map());
  useEffect(() => {
    for (const r of results) seenRef.current.set(r.lbl, r);
  }, [results]);

  // Debounced search over OUR bank (the curated `songs` table). Latest query wins.
  const seqRef = useRef(0);
  useEffect(() => {
    if (!q) {
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
  }, [q]);

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

  // Default (no-query) view = the curated Top-100 recommended songs (owner 2026-06-08),
  // with any of the couple's picks that fall OUTSIDE the Top-100 pinned in front so they
  // stay visible + removable. Both the recommended songs and the picks are playable.
  const defaultRows = useMemo<Row[]>(() => {
    const inCurated = new Set(curated.map((r) => r.lbl));
    const extraPicks = picked
      .filter((lbl) => !inCurated.has(lbl))
      .map((lbl) => seenRef.current.get(lbl) ?? rowFromLbl(lbl));
    return [...extraPicks, ...curated];
  }, [curated, picked]);

  const rows = isSearch ? results : defaultRows;
  // Search mode → pass the query so every server result shows. Default browse → ''
  // so SongPreviewList renders them all (alwaysShowAll keeps the whole Top-100 visible
  // even after the couple has picked ≥10).
  const listQuery = isSearch ? q : '';

  const header = isSearch
    ? searching
      ? 'Searching…'
      : results.length
        ? 'Tap to preview · tap again to add'
        : 'No match in our song bank — try another spelling'
    : !curatedLoaded
      ? 'Loading recommended songs…'
      : 'Top 100 for your day · tap to preview, tap again to add';

  return (
    <div className="songpick songbank">
      <div className="songresults rise" data-empty={rows.length === 0 ? 'true' : undefined}>
        <div className="songresult-h">{header}</div>
        <SongPreviewList
          songs={rows}
          pickedLbls={picked}
          query={listQuery}
          onToggle={onToggle}
          onCacheSong={onCacheSong}
          alwaysShowAll={!isSearch}
        />
      </div>

      <div className="songbar songbank-bar">
        <span className="songbar-count">
          Picked <b>{n}</b>
          {' · '}
          <span className={n >= 10 ? 'done' : undefined}>
            {n >= 10 ? 'we’ll build the rest of your playlist' : `pick at least ${10 - n} more`}
          </span>
        </span>
        <label className="songsearch songbank-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search songs or artists…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
        </label>
      </div>
    </div>
  );
}
