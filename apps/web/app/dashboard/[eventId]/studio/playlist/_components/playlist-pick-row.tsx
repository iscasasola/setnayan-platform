'use client';

/**
 * Single playlist pick row · displays song + artist + notes + delete
 * affordance. Inline edit mode swaps the row into 3 input fields with
 * Save/Cancel · debounced auto-save via updatePlaylistPick.
 *
 * Used inside <PlaylistSlotSection>. Distinct visual tint for the
 * banned-songs slot (rose-on-cream) vs positive slots (white-on-cream).
 */

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, Music, Trash2 } from 'lucide-react';
import { deletePlaylistPick, updatePlaylistPick } from '../actions';
import { useConfirm } from '@/app/_components/confirm-dialog';
import type { PlaylistPickRow as PickRowType } from '@/lib/playlist';

type Props = {
  eventId: string;
  pick: PickRowType;
  isBannedSlot: boolean;
  onError: (msg: string) => void;
};

export function PlaylistPickRow({
  eventId,
  pick,
  isBannedSlot,
  onError,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [songLabel, setSongLabel] = useState(pick.song_label);
  const [artist, setArtist] = useState(pick.artist ?? '');
  const [notes, setNotes] = useState(pick.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-app confirm replaces `window.confirm()` per pre-pilot audit cleanup
  // 2026-05-30. Render `{dialog}` at the row root so the modal can mount.
  const { confirm, dialog } = useConfirm();

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('pick_id', pick.pick_id);
      formData.set('song_label', songLabel.trim());
      formData.set('artist', artist.trim());
      formData.set('notes', notes.trim());
      startTransition(async () => {
        try {
          await updatePlaylistPick(formData);
          router.refresh();
        } catch (err) {
          onError(
            err instanceof Error
              ? err.message
              : "Couldn't save the edit. Try again.",
          );
        }
      });
    }, 600);
  }

  async function handleDelete() {
    // In-app modal replaces the prior `window.confirm()` (pre-pilot audit
    // cleanup 2026-05-30) — same intent, brand-voice copy, no UI block.
    const ok = await confirm({
      title: 'Remove this pick?',
      body: `Remove "${pick.song_label}" from the${isBannedSlot ? ' no-play' : ''} list?`,
      destructive: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('pick_id', pick.pick_id);
      await deletePlaylistPick(formData);
      router.refresh();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Couldn't remove this pick. Try again.",
      );
    }
  }

  const rowTint = isBannedSlot
    ? 'border-danger-200/60 bg-white/80'
    : 'border-ink/10 bg-white';

  if (editing) {
    return (
      <>
      {dialog}
      <li
        className={`flex flex-col gap-2 rounded-lg border ${rowTint} p-3`}
      >
        <input
          type="text"
          value={songLabel}
          onChange={(e) => {
            setSongLabel(e.target.value);
            scheduleSave();
          }}
          maxLength={200}
          placeholder="Song title"
          autoFocus
          className="rounded border border-ink/15 px-2 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
        <input
          type="text"
          value={artist}
          onChange={(e) => {
            setArtist(e.target.value);
            scheduleSave();
          }}
          maxLength={200}
          placeholder="Artist (optional)"
          className="rounded border border-ink/15 px-2 py-1.5 text-xs focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            scheduleSave();
          }}
          maxLength={500}
          placeholder={
            isBannedSlot
              ? 'Why no-play? (optional)'
              : 'Note for the DJ (optional)'
          }
          className="rounded border border-ink/15 px-2 py-1.5 text-xs italic focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-ink/45">{isPending ? 'Saving…' : 'Saved'}</span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-terracotta hover:text-terracotta-700"
          >
            Done
          </button>
        </div>
      </li>
      </>
    );
  }

  return (
    <>
    {dialog}
    <li
      className={`flex items-start gap-3 rounded-lg border ${rowTint} p-3`}
    >
      <Music
        aria-hidden
        className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${
          isBannedSlot ? 'text-danger-700/60' : 'text-ink/40'
        }`}
        strokeWidth={2}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isBannedSlot ? 'text-danger-900' : 'text-ink'
          }`}
        >
          {pick.song_label}
        </p>
        {pick.artist ? (
          <p
            className={`truncate text-xs ${
              isBannedSlot ? 'text-danger-900/65' : 'text-ink/65'
            }`}
          >
            {pick.artist}
          </p>
        ) : null}
        {pick.notes ? (
          <p
            className={`mt-0.5 truncate text-[11px] italic ${
              isBannedSlot ? 'text-danger-900/55' : 'text-ink/55'
            }`}
          >
            {pick.notes}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${pick.song_label}`}
          className="text-ink/35 transition-colors hover:text-ink/75"
        >
          <Edit3
            aria-hidden
            className="h-3.5 w-3.5 flex-shrink-0"
            strokeWidth={2}
          />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Remove ${pick.song_label}`}
          className="text-ink/35 transition-colors hover:text-danger-700"
        >
          <Trash2
            aria-hidden
            className="h-3.5 w-3.5 flex-shrink-0"
            strokeWidth={2}
          />
        </button>
      </div>
    </li>
    </>
  );
}
