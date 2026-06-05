'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItunesResult } from '@/lib/itunes-preview';
import { searchSongBankAction, cacheSongItunesAction, type SongBankItem } from '../actions';
import { SongPreviewList } from './song-preview-list';

/**
 * Song Bank — the onboarding music step (Onboarding_Style_and_Song_Bank_2026-06-04 §5).
 *
 * SEARCH-ONLY (owner 2026-06-05: "our songlist must not show. we only want the
 * search bar"): there is NO browseable catalogue list. The couple SEARCHES our
 * curated `songs` bank — search hits OUR list (`searchSongBankAction` →
 * `lib/songs.searchSongBank`, a DB query), never iTunes; iTunes is used ONLY to
 * resolve each result's album cover + 30-sec preview (and the resolved value is
 * cached back to the DB, §5.4, so production trends to near-zero live calls).
 *
 * Default (no query) view shows ONLY the couple's own picks, so they can see and
 * remove their ≥10 selection — not the catalogue. Search pinned at the bottom.
 */

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

  // Default (no-query) view = the couple's own picks ONLY (no catalogue browse).
  const pickedRows = useMemo<Row[]>(
    () => picked.map((lbl) => seenRef.current.get(lbl) ?? rowFromLbl(lbl)),
    [picked],
  );

  const rows = isSearch ? results : pickedRows;
  // Search mode → pass the query so every server result shows. Picked view → ''
  // so SongPreviewList shows them all (they're all selected).
  const listQuery = isSearch ? q : '';

  const header = isSearch
    ? searching
      ? 'Searching…'
      : results.length
        ? 'Tap to preview · tap again to add'
        : 'No match in our song bank — try another spelling'
    : n === 0
      ? 'Search for the songs you love'
      : 'Your songs';

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
