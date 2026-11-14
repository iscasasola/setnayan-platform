'use client';

/**
 * set-list.tsx — "Your set list": the songs a band performs, each with its optional performance video.
 *
 * 👈 A SONG'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE
 * ✕ ON ROWS"): left on a phone, the hover trash on a computer, named "Remove <title>". The row hides at once and the
 * removal is written after the Undo window (`deleteWithUndo`) by `removeRepertoireSong` — the same delete the old
 * trash's form posted, now answered instead of redirected. A refusal brings the song back and says so.
 * Held by repertoire/the-set-list-deletes-by-swipe.test.ts.
 */

import { useState } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import type { ReactNode } from 'react';
import { removeRepertoireSong } from '../actions';

export type SetListSong = { song_id: number; title: string; artist: string | null; performance_url: string | null };

/**
 * `links` — each song's "link a video of you playing it" form, drawn by the server page (it stays where the Field
 * template's count for it lives) and placed under the song here.
 */
export function SetList({ songs, links }: { songs: SetListSong[]; links: Readonly<Record<number, ReactNode>> }) {
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
      commit: () => removeRepertoireSong(song.song_id),
      failed: `Couldn’t remove ${song.title}. It’s back — try again.`,
    });

  return (
    <>
      <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
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
            <div className="flex min-h-14 items-center justify-between gap-2 px-2 py-2" data-set-list-song="">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ink">{song.title}</span>
                {song.artist ? <span className="block truncate text-[13px] text-[color:var(--m-slate-2)]">{song.artist}</span> : null}
              </span>
              {links[song.song_id]}
            </div>
          </SwipeToDelete>
        ))}
      </ul>
      <UndoToastHost />
    </>
  );
}
