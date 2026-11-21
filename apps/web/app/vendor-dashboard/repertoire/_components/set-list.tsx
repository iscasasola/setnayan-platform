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
import { Play } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { SongLinkForm } from './repertoire-tools';
import { removeRepertoireSong } from '../actions';

export type SetListSong = { song_id: number; title: string; artist: string | null; performance_url: string | null };

/**
 * The redraw (v3, 21 Nov 2026): one white frame, a song a row; a song OPENS IN PLACE (the shared `Fold`, one at a time)
 * to edit its video link (`SongLinkForm`); "Watch" opens the video beside the row.
 */
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
      commit: () => removeRepertoireSong(song.song_id),
      failed: `Couldn’t remove ${song.title}. It’s back — try again.`,
    });

  return (
    <>
      <ul className="sn-frame px-4 py-1">
        {shown.map((song) => (
          <SwipeToDelete
            key={song.song_id}
            as="li"
            label={`Remove ${song.title}`}
            word="Remove"
            onDelete={() => remove(song)}
            radiusClass=""
            surfaceClass="bg-[rgb(var(--sn-frame-bg))]"
          >
            <div data-set-list-song="">
              <Fold
                title={song.title}
                line={song.artist ?? undefined}
                aside={song.performance_url ? undefined : <span className="text-[13px] font-semibold text-[color:var(--m-slate-2)]">Video</span>}
                endPress={
                  song.performance_url ? (
                    <a
                      href={song.performance_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sn-press inline-flex min-h-11 items-center gap-1 px-1 text-[13px] font-semibold text-[rgb(var(--color-link))]"
                    >
                      <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Watch
                    </a>
                  ) : undefined
                }
                data="set-list-song"
              >
                <SongLinkForm song={song} query={query} />
              </Fold>
            </div>
          </SwipeToDelete>
        ))}
      </ul>
      <UndoToastHost />
    </>
  );
}
