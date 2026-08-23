'use client';

import { useRef } from 'react';
import { Trash2 } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';

/**
 * songs-danger-controls.tsx — the two irreversible controls on the song
 * catalogue, each made to say what it is about to do BEFORE it does it.
 *
 * 🚨 FOUND BY THE OWNER LOOKING AT THE SCREEN, 2026-08-18. Both shipped with no
 * confirmation of any kind:
 *
 *   · DELETE was a bare bin icon on every row of a 391-row list. One tap and the
 *     song was gone. On a phone, in a scrolling list, that is one mis-tap from
 *     permanent — and this is the same catalogue that had just lost 93 songs to
 *     a different silent defect.
 *
 *   · MERGE took TWO HAND-TYPED NUMBERS into empty boxes, deleted one song and
 *     re-pointed every couple's pick to the other. Typing 688 where you meant
 *     686 destroys the wrong song and silently rewrites what couples chose,
 *     with no undo and nothing on screen naming which songs those numbers are.
 *
 * 🔑 A DESTRUCTIVE CONTROL DRIVEN BY AN ID MUST SHOW THE THING, NOT THE ID.
 * A number cannot be sanity-checked by the person typing it; a title can. The
 * merge confirmation resolves both ids against the list already on screen and
 * refuses to proceed silently when it cannot find one — an id you cannot see is
 * exactly the case where a typo hides.
 *
 * Reuses the console's existing pattern (`window.confirm` naming the target and
 * stating that it cannot be undone) from admin/website-media/media-table.tsx,
 * rather than inventing a second one.
 */

export type SongLabel = { song_id: number; title: string; artist: string | null };

const describe = (s: SongLabel) => `#${s.song_id} — ${s.title}${s.artist ? ` · ${s.artist}` : ''}`;

export function DeleteSongButton({ song }: { song: SongLabel }) {
  return (
    <SubmitButton
      className="inline-flex items-center justify-center rounded-full p-1.5 text-ink/40 hover:bg-terracotta/10 hover:text-mulberry"
      aria-label={`Delete ${song.title}`}
      onClick={(e) => {
        const ok = window.confirm(
          `Delete this song from the catalogue?\n\n${describe(song)}\n\n` +
            `This cannot be undone. Couples and vendors who already picked it ` +
            `lose that pick.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </SubmitButton>
  );
}

export function MergeSongsFields({ songs }: { songs: SongLabel[] }) {
  const dupRef = useRef<HTMLInputElement>(null);
  const canonRef = useRef<HTMLInputElement>(null);

  const find = (raw: string | undefined) => {
    const n = Number((raw ?? '').trim());
    if (!Number.isFinite(n)) return null;
    return songs.find((s) => s.song_id === n) ?? null;
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-ink/70">Duplicate ID</span>
          <input ref={dupRef} name="dup_id" inputMode="numeric" required className="input-field w-28" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink/70">Canonical ID (keep)</span>
          <input ref={canonRef} name="canonical_id" inputMode="numeric" required className="input-field w-28" />
        </label>
        <SubmitButton
          className="button-primary"
          onClick={(e) => {
            const dupRaw = dupRef.current?.value;
            const canonRaw = canonRef.current?.value;
            const dup = find(dupRaw);
            const canon = find(canonRaw);

            if (dupRaw && canonRaw && dupRaw.trim() === canonRaw.trim()) {
              window.alert('Those are the same song. Nothing to merge.');
              e.preventDefault();
              return;
            }

            // An id that is not in the list on screen is exactly where a typo
            // hides — say so plainly rather than merging something unseen.
            const unknown = [
              dup ? null : `Duplicate #${(dupRaw ?? '').trim()}`,
              canon ? null : `Canonical #${(canonRaw ?? '').trim()}`,
            ].filter(Boolean);

            const ok = window.confirm(
              unknown.length
                ? `${unknown.join(' and ')} ${unknown.length > 1 ? 'are' : 'is'} not in the ` +
                  `list on screen, so this cannot show you what it is about to delete.\n\n` +
                  `Search for the song first to check the id. Continue anyway?`
                : `Merge these two songs?\n\n` +
                  `DELETE   ${describe(dup!)}\n` +
                  `KEEP     ${describe(canon!)}\n\n` +
                  `Every couple and vendor who picked the first one will be moved to ` +
                  `the second. This cannot be undone.`,
            );
            if (!ok) e.preventDefault();
          }}
        >
          Merge
        </SubmitButton>
      </div>
    </>
  );
}
