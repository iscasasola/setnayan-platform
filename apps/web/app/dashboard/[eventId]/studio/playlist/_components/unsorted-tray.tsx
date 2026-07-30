'use client';

/**
 * THE UNSORTED TRAY — the songs you already chose, waiting for a moment.
 *
 * Owner-answered 2026-07-30 ("onboarding feeds the studio"). Before this, a couple
 * picked songs at onboarding, opened this studio, found it **empty**, and typed
 * the same songs again — then the band's desk showed both copies.
 *
 * ── IT SITS ABOVE THE MOMENTS, AND IT DISAPPEARS ───────────────────────────
 *
 * At the top, because it is the answer to "where did my songs go?" and that
 * question is asked before any other on this page. And it renders nothing at all
 * once every pick is placed — a permanently visible empty tray would be a chore
 * the couple can never finish.
 *
 * ── PLACE, NOT DRAG ────────────────────────────────────────────────────────
 *
 * A dropdown per row rather than drag-and-drop. Dragging on a phone — which is
 * where couples actually plan — means long-press, scroll-while-holding, and a
 * drop target that may be off screen. A select is one tap and one choice, it is
 * reachable by keyboard and screen reader for free, and it says out loud what the
 * gesture would only imply. Dragging can be added later as polish over the same
 * action; it is not a prerequisite for the feature.
 *
 * ⚠ Placing WRITES a normal playlist pick — there is no "unsorted" slot in the
 * schema and the tray is a derived view. So the row leaves the tray because the
 * derivation changed, not because anything was moved. Clearing that moment later
 * brings the song back here, which is correct: `event_song_picks` still records
 * that the couple chose it.
 */

import { useState, useTransition } from 'react';
import { Music4 } from 'lucide-react';

import {
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_SLOT_TYPES,
  type PlaylistSlotType,
} from '@/lib/playlist';
import type { UnsortedTrayEntry } from '@/lib/song-desk';
import { addPlaylistPick } from '../actions';

export function UnsortedTray({
  eventId,
  entries,
}: {
  eventId: string;
  entries: UnsortedTrayEntry[];
}) {
  // Rows the couple has just placed. Kept locally so the row leaves immediately
  // rather than after the server round-trip — the list is short and the couple is
  // working down it.
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = entries.filter((e) => !placed.has(e.songId));
  // The whole section vanishes when there is nothing left to sort. See the header.
  if (remaining.length === 0) return null;

  function place(entry: UnsortedTrayEntry, slot: PlaylistSlotType) {
    setError(null);
    startTransition(async () => {
      setPlaced((prev) => new Set(prev).add(entry.songId));
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('slot_type', slot);
      fd.set('song_label', entry.title);
      if (entry.artist) fd.set('artist', entry.artist);
      try {
        await addPlaylistPick(fd);
      } catch {
        setPlaced((prev) => {
          const next = new Set(prev);
          next.delete(entry.songId);
          return next;
        });
        setError('That didn’t save. Try again.');
      }
    });
  }

  return (
    <section
      className="rounded-2xl border border-gild/40 bg-gild/5 p-4 sm:p-5"
      aria-labelledby="playlist-unsorted-heading"
    >
      <header className="mb-3 space-y-1">
        <h2
          id="playlist-unsorted-heading"
          className="flex items-center gap-2 font-display text-xl italic leading-tight text-ink sm:text-2xl"
        >
          <Music4 aria-hidden className="h-5 w-5 shrink-0 text-ink/50" strokeWidth={1.75} />
          Songs you’ve already chosen
        </h2>
        <p className="text-xs leading-relaxed text-ink/65 sm:text-sm">
          {remaining.length === 1
            ? 'One song from your earlier picks hasn’t been given a moment yet.'
            : `${remaining.length} songs from your earlier picks haven’t been given a moment yet.`}{' '}
          Put each where you want it heard — or leave them here and your band will read the room.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mb-2 text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {remaining.map((entry) => (
          <li
            key={entry.songId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{entry.title}</span>
              {entry.artist ? (
                <span className="block truncate text-xs text-ink/55">{entry.artist}</span>
              ) : null}
            </span>
            <label className="shrink-0 text-xs text-ink/60">
              <span className="sr-only">Place “{entry.title}” in a moment</span>
              <select
                defaultValue=""
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) place(entry, v as PlaylistSlotType);
                }}
                className="rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs text-ink/80 disabled:opacity-60"
              >
                <option value="">Place in…</option>
                {PLAYLIST_SLOT_TYPES.filter((s) => s !== 'banned_songs').map((slot) => (
                  <option key={slot} value={slot}>
                    {PLAYLIST_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
