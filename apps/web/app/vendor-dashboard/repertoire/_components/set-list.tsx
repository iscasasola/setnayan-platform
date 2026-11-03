'use client';

/**
 * set-list.tsx — "Your set list": the songs a band performs, each with its optional performance video.
 *
 * 👈 A SONG'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE
 * ✕ ON ROWS"): left on a phone, the hover trash on a computer, named "Remove <title>". The row hides at once and the
 * removal is written after the Undo window (`deleteWithUndo`) by `dropRepertoireSong` — the same delete the old
 * trash's form posted, answered instead of redirected. A refusal brings the song back and says so.
 * Held by repertoire/the-set-list-deletes-by-swipe.test.ts.
 */

import { useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { dropRepertoireSong, setPerformanceLink } from '../actions';

export type SetListSong = { song_id: number; title: string; artist: string | null; performance_url: string | null };

export function SetList({ songs, query }: { songs: SetListSong[]; query: string }) {
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const shown = songs.filter((s) => !hidden.has(s.song_id));

  const remove = (song: SetListSong) =>
    deleteWithUndo({
      label: `${song.title} removed`,
      hide: () => setHidden((h) => new Set(h).add(song.song_id)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(song.song_id);
          return next;
        }),
      commit: () => dropRepertoireSong(song.song_id),
      failed: `Couldn’t remove ${song.title}. It’s back — try again.`,
    });

  return (
    <>
      <ul className="space-y-1">
        {shown.map((song) => (
          <SwipeToDelete
            key={song.song_id}
            as="li"
            label={`Remove ${song.title}`}
            word="Remove"
            onDelete={() => remove(song)}
            radiusClass=""
            surfaceClass="bg-[var(--m-paper)]"
          >
            <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5" data-set-list-song="">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink/90">{song.title}</span>
                {song.artist ? <span className="block truncate text-xs text-ink/55">{song.artist}</span> : null}
              </span>
              {/*
                Owner 2026-08-18: a band picks what it can play AND links a
                video of itself playing it. Saying "I can play this" and not
                being able to show it leaves a couple choosing between three
                bands who all claim the same song with nothing to compare.

                Full width on its own row, because a link is long and this is
                edited on a phone. Empty clears it — taking a video down must
                be as easy as putting one up.
              */}
              <form action={setPerformanceLink} className="mt-1 flex w-full items-center gap-2 basis-full">
                <input type="hidden" name="song_id" value={song.song_id} />
                <input type="hidden" name="q" value={query} />
                <input
                  type="url"
                  name="performance_url"
                  defaultValue={song.performance_url ?? ''}
                  placeholder="Link a video of you playing it (optional)"
                  aria-label={`Video of you performing ${song.title}`}
                  className="input-field h-8 min-w-0 flex-1 text-xs"
                />
                <SubmitButton
                  overlay={false}
                  className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 hover:bg-ink/5 hover:text-ink"
                >
                  Save
                </SubmitButton>
                {song.performance_url ? (
                  <a
                    href={song.performance_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-link underline underline-offset-2"
                  >
                    Watch
                  </a>
                ) : null}
              </form>
            </div>
          </SwipeToDelete>
        ))}
      </ul>
      <UndoToastHost />
    </>
  );
}
