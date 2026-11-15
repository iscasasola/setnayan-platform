'use client';

/**
 * SETS — "Set 2, dinner, eight songs", which is how a band actually thinks.
 *
 * Owner, 2026-07-27: *"the band can set 1/2/3/4/5/6 sets, and name the x number of
 * songs per set"* · *"they can place songs per set. they can choose."*
 *
 * ── NOTHING HERE SUGGESTS ANYTHING ─────────────────────────────────────────
 *
 * "No auto-fill, no recommender" is an explicit instruction, so there is no
 * "suggested for this set", no ordering hint, no fill button. The band picks from
 * their own repertoire and that is the whole interaction.
 *
 * ── WHAT THE SHARED VOCABULARY BUYS, VISIBLY ───────────────────────────────
 *
 * Each set is anchored to one of the couple's eleven moments, which is the only
 * reason the line *"still missing: Through the Years"* can exist. That line is the
 * payoff for the constraint the contract insisted on: a band's set named "Slow
 * burn" can be checked against what the couple asked for at dinner precisely
 * because both sides say `dinner` underneath.
 *
 * ── COLLAPSED BY DEFAULT, BECAUSE OF WHERE IT SITS ─────────────────────────
 *
 * The sets panel goes LAST on the desk and starts closed. On the night the
 * actionable things are the requests inbox and the gaps; a setlist is what you
 * built beforehand and open when you want it. A band mid-set should not scroll
 * past six expanded sets to reach a pending request.
 */

import { useState, useTransition } from 'react';
import { Check, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

import {
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_SLOT_TYPES,
  type PlaylistSlotType,
} from '@/lib/playlist';
import type { Song } from '@/lib/songs';
import { MAX_SETS, repertoireAvailableForSet, type VendorSet } from '@/lib/vendor-sets';
import {
  addSongToVendorEventSet,
  updateVendorEventSet,
  createVendorEventSet,
  deleteVendorEventSet,
  removeSongFromVendorEventSet,
} from '../../../../actions';
import { formatCount } from '@/lib/format-number';

/** The moments a set may cover — every playlist slot but the "Don't play these" list. One list for both pickers. */
const MOMENT_OPTIONS: readonly PickOption[] = PLAYLIST_SLOT_TYPES.filter((s) => s !== 'banned_songs').map((slot) => ({
  key: slot,
  label: PLAYLIST_SLOT_LABELS[slot],
}));

export function SetsPanel({
  eventId,
  sets,
  repertoire,
}: {
  eventId: string;
  sets: VendorSet[];
  /** The act's own repertoire — the only place a set song may come from. */
  repertoire: Song[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlot, setNewSlot] = useState<PlaylistSlotType>('open_floor');

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'That didn’t save.');
    });
  }

  /**
   * 👈 DELETES WAIT OUT AN UNDO (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕
   * ON ROWS"). A song leaves its set by its swipe; a whole set is deleted from its rename editor. Either leaves the
   * screen at once and is written only when the Undo window closes (`deleteWithUndo`) — which matters most for a set,
   * whose songs CASCADE with it: Undo there brings the whole setlist back, because nothing was ever sent.
   */
  const [hiddenSets, setHiddenSets] = useState<ReadonlySet<string>>(() => new Set());
  const [hiddenSongs, setHiddenSongs] = useState<ReadonlySet<string>>(() => new Set());
  const without = (h: ReadonlySet<string>, id: string) => {
    const next = new Set(h);
    next.delete(id);
    return next;
  };
  const removeSong = (set: VendorSet, setSongId: string, title: string) =>
    deleteWithUndo({
      label: `${title} removed from ${set.name}`,
      hide: () => setHiddenSongs((h) => new Set(h).add(setSongId)),
      restore: () => setHiddenSongs((h) => without(h, setSongId)),
      commit: () => removeSongFromVendorEventSet(eventId, setSongId),
      failed: `Couldn’t take ${title} out of ${set.name}. It’s back — try again.`,
    });
  const deleteSet = (set: VendorSet) =>
    deleteWithUndo({
      label: `${set.name} deleted`,
      hide: () => setHiddenSets((h) => new Set(h).add(set.setId)),
      restore: () => setHiddenSets((h) => without(h, set.setId)),
      commit: () => deleteVendorEventSet(eventId, set.setId),
      failed: `Couldn’t delete ${set.name}. It’s back — try again.`,
    });
  const shownSets = sets
    .filter((set) => !hiddenSets.has(set.setId))
    .map((set) => ({ ...set, songs: set.songs.filter((s) => !hiddenSongs.has(s.setSongId)) }));

  const full = sets.length >= MAX_SETS;

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink">
        <ChevronRight
          aria-hidden
          className="h-4 w-4 text-terracotta transition-transform duration-sn-micro ease-sn group-open:rotate-90"
          strokeWidth={2}
        />
        {sets.length === 0
          ? 'Your sets'
          : `Your sets · ${formatCount(sets.length)} of ${formatCount(MAX_SETS)}`}
      </summary>

      <div className="space-y-3 pt-2">
        <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">
          Name each stretch of the night and place songs from your repertoire. Up to {MAX_SETS}.
        </p>

        {error ? (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        ) : null}

        {shownSets.length > 0 ? (
          <div className="divide-y divide-[color:var(--m-line)] border-y border-[color:var(--m-line)]">
            {shownSets.map((set) => (
              <SetCard
                key={set.setId}
                eventId={eventId}
                set={set}
                repertoire={repertoire}
                pending={pending}
                run={run}
                onRemoveSong={(setSongId, title) => removeSong(set, setSongId, title)}
                onDeleteSet={() => deleteSet(set)}
              />
            ))}
          </div>
        ) : null}

        {adding ? (
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name it — “Slow burn”, “Last call”"
              maxLength={60}
              aria-label="Set name"
              className="min-h-12 w-full rounded-lg border border-[color:var(--m-line)] bg-white px-3 text-sm text-ink dark:bg-raised"
            />
            <div className="flex min-h-14 items-center justify-between gap-3">
              <InfoTip label="Which moment does it cover?" labelClassName="text-sm text-ink">
                Naming the moment is what lets us show you anything the couple asked for there and you haven’t placed yet.
              </InfoTip>
              <PickMenu
                label="Which moment the new set covers"
                value={newSlot}
                options={MOMENT_OPTIONS}
                onPick={(k) => setNewSlot(k as PlaylistSlotType)}
                dataAttr="data-new-set-moment"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                tone="brand"
                main
                icon={Plus}
                label="Add set"
                disabled={pending || newName.trim().length === 0}
                onClick={() =>
                  run(async () => {
                    const res = await createVendorEventSet(eventId, newName, newSlot);
                    if (res.ok) {
                      setNewName('');
                      setAdding(false);
                    }
                    return res;
                  })
                }
              />
              <ActionButton
                tone="neutral"
                icon={X}
                label="Cancel"
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                }}
              />
            </div>
          </div>
        ) : (
          <ActionButton
            tone="neutral"
            icon={Plus}
            label={full ? `${MAX_SETS} sets is the most` : sets.length === 0 ? 'Add your first set' : 'Add a set'}
            disabled={full || pending}
            onClick={() => setAdding(true)}
          />
        )}
      </div>
      <UndoToastHost />
    </details>
  );
}

/** One set: its songs, what the couple asked for that it is still missing, and a picker. */
function SetCard({
  eventId,
  set,
  repertoire,
  pending,
  run,
  onRemoveSong,
  onDeleteSet,
}: {
  eventId: string;
  set: VendorSet;
  repertoire: Song[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onRemoveSong: (setSongId: string, title: string) => void;
  onDeleteSet: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const available = repertoireAvailableForSet({ repertoire, setSongs: set.songs });

  return (
    <section className="space-y-1.5 py-3">
      {editing ? (
        <SetHeaderEditor
          eventId={eventId}
          set={set}
          pending={pending}
          run={run}
          onDone={() => setEditing(false)}
          onDelete={onDeleteSet}
        />
      ) : (
        <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h5 className="text-sm font-semibold text-ink">
            <span className="tabular-nums text-[color:var(--m-slate-2)]">{set.position}</span> {set.name}
          </h5>
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
              {set.slotLabel}
            </span>
            <ActionButton
              tone="neutral"
              iconOnly
              icon={Pencil}
              label="Rename"
              name={`Rename set ${set.name}`}
              disabled={pending}
              onClick={() => setEditing(true)}
            />
          </span>
        </header>
      )}

      {set.songs.length > 0 ? (
        <ul className="divide-y divide-[color:var(--m-line)]">
          {set.songs.map((s) => (
            <SwipeToDelete
              key={s.setSongId}
              as="li"
              label={`Remove ${s.title} from ${set.name}`}
              word="Remove"
              onDelete={() => onRemoveSong(s.setSongId, s.title)}
              disabled={pending}
              radiusClass=""
              surfaceClass="bg-paper-deep"
            >
              <div className="flex min-h-14 min-w-0 items-center gap-2 py-1" data-set-song="">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.title}</span>
                {s.artist ? (
                  <span className="min-w-0 shrink truncate text-sm text-[color:var(--m-slate-2)]">{s.artist}</span>
                ) : null}
              </div>
            </SwipeToDelete>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[color:var(--m-slate-2)]">Nothing placed yet.</p>
      )}

      {/* THE PAYOFF FOR THE SHARED VOCABULARY. Only possible because the set and
          the couple's picks both say the same slot underneath. */}
      {set.missingFromHost.length > 0 ? (
        <p className="text-sm leading-relaxed text-warn-700">
          They asked for {set.missingFromHost.join(', ')} at {set.slotLabel.toLowerCase()} — not in
          this set yet.
        </p>
      ) : null}

      {available.length > 0 ? (
        <div className="pt-0.5">
          <PickMenu
            label={`Add a song to ${set.name}`}
            value={null}
            buttonText="Add from your repertoire…"
            options={available.map((s) => ({
              key: String(s.song_id),
              label: s.artist ? `${s.title} · ${s.artist}` : s.title,
            }))}
            dataAttr="data-set-add-song"
            onPick={(k) => {
              // Was a disabled <select> while a save was in flight; the pick waits the same way.
              if (pending) return;
              const v = Number(k);
              if (Number.isFinite(v) && v > 0) run(() => addSongToVendorEventSet(eventId, set.setId, v));
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-[color:var(--m-slate-2)]">
          Every song you play is already in this set.
        </p>
      )}
    </section>
  );
}


/**
 * Rename a set, or re-anchor it to a different moment.
 *
 * 🚨 THE ONLY OTHER ROUTE TO A CORRECTED NAME DESTROYED THE SETLIST.
 * `vendor_event_set_songs.set_id` is `ON DELETE CASCADE` (migration
 * 20271022422205), and `deleteVendorEventSet`'s own docblock says so plainly:
 * "its songs cascade — the set is the unit, not the songs." That is right for a
 * real delete and catastrophic as a way to fix a typo — delete "Slow bunr",
 * re-add "Slow burn", and every song placed in it is gone. On the night.
 *
 * The action to do this properly (`updateVendorEventSet`) shipped with the rest
 * of the Song Desk and was never mounted, so the band had the destructive route
 * and no other. The panel's long docblock lists what it deliberately omits — no
 * auto-fill, no recommender — and renaming is not on that list; it was missed,
 * not declined. The owner's own framing was *"the band can set 1/2/3/4/5/6 sets,
 * and NAME the x number of songs per set."*
 *
 * Re-anchoring is offered in the same breath because it is the same row and the
 * same mistake — picking `dinner` when you meant `first_dance` costs the couple
 * their "still missing" line, which is the whole payoff of the shared vocabulary.
 */
function SetHeaderEditor({
  eventId,
  set,
  pending,
  run,
  onDone,
  onDelete,
}: {
  eventId: string;
  set: VendorSet;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onDone: () => void;
  /** Delete the whole set (its songs go with it) — with Undo, from the panel. */
  onDelete: () => void;
}) {
  const [name, setName] = useState(set.name);
  const [slot, setSlot] = useState<PlaylistSlotType>(set.slot);

  const trimmed = name.trim();
  const dirty = trimmed !== set.name || slot !== set.slot;

  function save() {
    if (trimmed.length === 0 || !dirty) {
      onDone();
      return;
    }
    run(async () => {
      const res = await updateVendorEventSet(eventId, set.setId, {
        name: trimmed,
        slotType: slot,
      });
      if (res.ok) onDone();
      return res;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm tabular-nums text-[color:var(--m-slate-2)]">{set.position}</span>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onDone();
        }}
        maxLength={60}
        aria-label="Set name"
        autoFocus
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-[color:var(--m-line)] bg-white px-3 text-sm text-ink dark:bg-raised"
      />
      <PickMenu
        label="Moment this set covers"
        value={slot}
        options={MOMENT_OPTIONS}
        onPick={(k) => setSlot(k as PlaylistSlotType)}
        dataAttr="data-set-moment"
      />
      <ActionButton
        tone="ok"
        iconOnly
        icon={Check}
        label="Save"
        name="Save set name"
        disabled={pending || trimmed.length === 0}
        onClick={save}
      />
      <ActionButton
        tone="neutral"
        iconOnly
        icon={X}
        label="Cancel"
        name="Cancel rename"
        disabled={pending}
        onClick={onDone}
      />
      {/* The set's own Delete lives in its editor (owner 2026-11-03: no ✕ on the card). Its songs go with it, so it
          waits out the Undo window before anything is written. */}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          onDone();
          onDelete();
        }}
        aria-label={`Delete set ${set.name}`}
        className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-60"
      >
        <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Delete set
      </button>
    </div>
  );
}
