'use client';

/**
 * Playlist slot section · client island for one of the 8 slot types
 * (processional · ceremony · cocktail_hour · first_dance · parents_dance
 * · dinner · open_floor · banned_songs).
 *
 * Renders the slot label + hint + list of existing picks + inline
 * "Add song" affordance. Per-pick edit + delete handled by
 * <PlaylistPickRow>.
 *
 * Add form is disclosed inline (drawer-style · not modal) when the host
 * taps [+ Add song]. Submit fires addPlaylistPick · the page revalidates
 * via revalidatePath → the new pick renders at the bottom of the slot.
 *
 * Banned-songs slot uses different copy (red tint · "Don't play" framing)
 * but the same inner form/delete logic. Single-component handles both
 * cases via `isBannedSlot` prop.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Plus, X } from 'lucide-react';
import { addPlaylistPick, setPlaylistSlotVibe } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import {
  PLAYLIST_VIBES,
  PLAYLIST_VIBE_LABELS,
  type PlaylistSlotType,
  type PlaylistPickRow,
  type PlaylistVibe,
} from '@/lib/playlist';
import { PlaylistPickRow as PlaylistPickRowComponent } from './playlist-pick-row';

type Props = {
  eventId: string;
  slotType: PlaylistSlotType;
  label: string;
  hint: string;
  picks: PlaylistPickRow[];
  isBannedSlot: boolean;
  /** The feel the couple already chose for this moment, if any. */
  vibe: PlaylistVibe | null;
};

export function PlaylistSlotSection({
  eventId,
  slotType,
  label,
  hint,
  picks,
  isBannedSlot,
  vibe,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [songLabel, setSongLabel] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const save = useSaveLoader();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (songLabel.trim().length === 0) {
      setErrorMessage('Enter a song title first.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('slot_type', slotType);
    formData.set('song_label', songLabel.trim());
    if (artist.trim()) formData.set('artist', artist.trim());
    if (notes.trim()) formData.set('notes', notes.trim());

    startTransition(async () => {
      try {
        await save.run(() => addPlaylistPick(formData), {
          steps: ['Adding to your playlist'],
          hint: 'Saving',
        });
        // Reset form + close drawer · revalidatePath in the action will
        // re-render the parent with the new pick.
        setSongLabel('');
        setArtist('');
        setNotes('');
        setAddOpen(false);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Couldn't save that pick. Try again.",
        );
      }
    });
  }

  // Banned-songs slot uses a rose tint to read as a "do-not" surface;
  // positive slots stay cream/terracotta. Brand-voice editorial restraint
  // per [[feedback_setnayan_no_dev_text_post_launch]].
  const sectionTint = isBannedSlot
    ? 'border-danger-300/60 bg-danger-50/40'
    : 'border-ink/15 bg-cream/40';
  const labelTint = isBannedSlot ? 'text-danger-900' : 'text-ink';
  const hintTint = isBannedSlot ? 'text-danger-900/65' : 'text-ink/65';

  return (
    <section
      className={`rounded-2xl border ${sectionTint} p-4 sm:p-5`}
      aria-labelledby={`playlist-slot-${slotType}-heading`}
    >
      <header className="mb-3 space-y-1">
        <h2
          id={`playlist-slot-${slotType}-heading`}
          className={`font-display text-xl italic leading-tight ${labelTint} sm:text-2xl`}
        >
          {label}
        </h2>
        <p className={`text-xs leading-relaxed ${hintTint} sm:text-sm`}>{hint}</p>
        {/* The FEEL for this moment — offered on every real moment but not on
            "Don't play these", where a vibe would be meaningless (you cannot ask
            for jazz you don't want). Owner-locked PR 4: a moment may carry a vibe
            AND songs, so this sits beside the list rather than replacing it. */}
        {!isBannedSlot ? <VibePicker eventId={eventId} slotType={slotType} vibe={vibe} /> : null}
      </header>

      {picks.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {picks.map((pick) => (
            <PlaylistPickRowComponent
              key={pick.pick_id}
              eventId={eventId}
              pick={pick}
              isBannedSlot={isBannedSlot}
              onError={(msg) => setErrorMessage(msg)}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-3 italic text-xs text-ink/50">No picks yet.</p>
      )}

      {!addOpen ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
            isBannedSlot
              ? 'text-danger-700 hover:text-danger-900'
              : 'text-terracotta hover:text-terracotta-700'
          }`}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          {isBannedSlot ? 'Add a no-play' : 'Add a song'}
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 rounded-lg border border-ink/15 bg-white p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`playlist-${slotType}-song`}
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
              >
                Song <span className="text-danger-700">*</span>
              </label>
              <input
                id={`playlist-${slotType}-song`}
                type="text"
                value={songLabel}
                onChange={(e) => setSongLabel(e.target.value)}
                required
                maxLength={200}
                autoFocus
                placeholder={
                  isBannedSlot
                    ? 'e.g. Macarena'
                    : 'e.g. At Last'
                }
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
            <div>
              <label
                htmlFor={`playlist-${slotType}-artist`}
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
              >
                Artist (optional)
              </label>
              <input
                id={`playlist-${slotType}-artist`}
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={200}
                placeholder={
                  isBannedSlot
                    ? 'Los del Río'
                    : 'Etta James'
                }
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor={`playlist-${slotType}-notes`}
              className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
            >
              {isBannedSlot ? 'Why no-play?' : 'Note for the DJ'} (optional)
            </label>
            <input
              id={`playlist-${slotType}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder={
                isBannedSlot
                  ? 'Cringe / overplayed / personal reason'
                  : 'Play the radio edit, not the album version'
              }
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md border border-danger-300/60 bg-danger-50 px-3 py-2 text-xs text-danger-800"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setSongLabel('');
                setArtist('');
                setNotes('');
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-ink/55 hover:text-ink/85"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2.25} />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || songLabel.trim().length === 0}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-cream transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isBannedSlot
                  ? 'bg-danger-700 hover:bg-danger-800'
                  : 'bg-mulberry hover:bg-mulberry-700'
              }`}
            >
              <Music aria-hidden className="h-3 w-3" strokeWidth={2.25} />
              {isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * Six chips and a clear. Tapping the chosen one again clears it, because the
 * absence of a vibe IS "let the band decide" — the owner declined a seventh
 * option for exactly that reason, so the affordance has to be reachable.
 *
 * No confirm step and no save button: this is one small value, and a couple
 * fiddling with the feel of dinner should not have to commit a form.
 */
function VibePicker({
  eventId,
  slotType,
  vibe,
}: {
  eventId: string;
  slotType: PlaylistSlotType;
  vibe: PlaylistVibe | null;
}) {
  const [current, setCurrent] = useState<PlaylistVibe | null>(vibe);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: PlaylistVibe) {
    // Tapping the active chip clears it.
    const target = current === next ? null : next;
    const previous = current;
    setError(null);
    startTransition(async () => {
      setCurrent(target);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('slot_type', slotType);
      if (target) fd.set('vibe', target);
      try {
        await setPlaylistSlotVibe(fd);
      } catch {
        setCurrent(previous);
        setError('That didn’t save. Try again.');
      }
    });
  }

  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink/45">
          Feel
        </span>
        {PLAYLIST_VIBES.map((v) => {
          const active = current === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => choose(v)}
              disabled={pending}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60 ${
                active
                  ? 'border-gild bg-gild/15 font-medium text-ink'
                  : 'border-ink/15 text-ink/60 hover:bg-ink/5 hover:text-ink/85'
              }`}
            >
              {PLAYLIST_VIBE_LABELS[v]}
            </button>
          );
        })}
      </div>
      <p className="pt-1 text-[0.6875rem] leading-relaxed text-ink/45">
        {current
          ? 'Tap it again to leave this one to your band.'
          : 'Optional — name a feel and your band fills the gaps you don’t.'}
      </p>
      {error ? (
        <p role="alert" className="text-[0.6875rem] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
