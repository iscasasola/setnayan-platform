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
import { Check, ChevronRight, Pencil, Plus, X } from 'lucide-react';

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

  const full = sets.length >= MAX_SETS;

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink/75 hover:text-ink">
        <ChevronRight
          aria-hidden
          className="h-3.5 w-3.5 text-ink/40 transition-transform group-open:rotate-90"
          strokeWidth={1.75}
        />
        {sets.length === 0
          ? 'Your sets'
          : `Your sets · ${sets.length} of ${MAX_SETS}`}
      </summary>

      <div className="space-y-3 pt-2">
        <p className="text-xs leading-relaxed text-ink/60">
          Name each stretch of the night and place songs from your repertoire. Up to {MAX_SETS}.
        </p>

        {error ? (
          <p role="alert" className="text-xs text-terracotta-700">
            {error}
          </p>
        ) : null}

        {sets.map((set) => (
          <SetCard
            key={set.setId}
            eventId={eventId}
            set={set}
            repertoire={repertoire}
            pending={pending}
            run={run}
          />
        ))}

        {adding ? (
          <div className="space-y-2 rounded-xl border border-dashed border-ink/20 p-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name it — “Slow burn”, “Last call”"
              maxLength={60}
              className="w-full rounded-lg border border-ink/15 px-2.5 py-1.5 text-sm"
            />
            <label className="block text-xs text-ink/60">
              Which moment does it cover?
              <select
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value as PlaylistSlotType)}
                className="mt-1 w-full rounded-lg border border-ink/15 px-2.5 py-1.5 text-sm text-ink/85"
              >
                {PLAYLIST_SLOT_TYPES.filter((s) => s !== 'banned_songs').map((slot) => (
                  <option key={slot} value={slot}>
                    {PLAYLIST_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[0.6875rem] leading-relaxed text-ink/50">
              Naming the moment is what lets us show you anything the couple asked for there and
              you haven’t placed yet.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
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
                className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                Add set
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                }}
                className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/70"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={full || pending}
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/75 hover:bg-ink/5 disabled:opacity-60"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {full ? `${MAX_SETS} sets is the most` : sets.length === 0 ? 'Add your first set' : 'Add a set'}
          </button>
        )}
      </div>
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
}: {
  eventId: string;
  set: VendorSet;
  repertoire: Song[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const available = repertoireAvailableForSet({ repertoire, setSongs: set.songs });

  return (
    <section className="space-y-1.5 rounded-xl border border-ink/10 p-3">
      {editing ? (
        <SetHeaderEditor
          eventId={eventId}
          set={set}
          pending={pending}
          run={run}
          onDone={() => setEditing(false)}
        />
      ) : (
        <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <h5 className="text-sm font-medium text-ink">
            <span className="font-mono text-xs text-ink/45">{set.position}</span> {set.name}
          </h5>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-ink/45">
              {set.slotLabel}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              aria-label={`Rename set ${set.name}`}
              className="rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70 disabled:opacity-60"
            >
              <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteVendorEventSet(eventId, set.setId))}
              aria-label={`Delete set ${set.name}`}
              className="rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70 disabled:opacity-60"
            >
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </span>
        </header>
      )}

      {set.songs.length > 0 ? (
        <ul>
          {set.songs.map((s) => (
            <li key={s.setSongId} className="flex min-w-0 items-baseline gap-2 py-0.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{s.title}</span>
              {s.artist ? (
                <span className="min-w-0 shrink truncate text-xs text-ink/55">{s.artist}</span>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeSongFromVendorEventSet(eventId, s.setSongId))}
                aria-label={`Remove ${s.title} from ${set.name}`}
                className="shrink-0 rounded-full p-0.5 text-ink/35 hover:text-ink/70 disabled:opacity-60"
              >
                <X aria-hidden className="h-3 w-3" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink/50">Nothing placed yet.</p>
      )}

      {/* THE PAYOFF FOR THE SHARED VOCABULARY. Only possible because the set and
          the couple's picks both say the same slot underneath. */}
      {set.missingFromHost.length > 0 ? (
        <p className="text-xs leading-relaxed text-terracotta-700">
          They asked for {set.missingFromHost.join(', ')} at {set.slotLabel.toLowerCase()} — not in
          this set yet.
        </p>
      ) : null}

      {available.length > 0 ? (
        <label className="block pt-0.5">
          <span className="sr-only">Add a song to {set.name}</span>
          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) {
                run(() => addSongToVendorEventSet(eventId, set.setId, v));
                e.target.value = '';
              }
            }}
            className="rounded-full border border-ink/15 px-2.5 py-1 text-xs text-ink/80 disabled:opacity-60"
          >
            <option value="">Add from your repertoire…</option>
            {available.map((s) => (
              <option key={s.song_id} value={s.song_id}>
                {s.title}
                {s.artist ? ` · ${s.artist}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[0.6875rem] text-ink/45">
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
}: {
  eventId: string;
  set: VendorSet;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  onDone: () => void;
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
      <span className="font-mono text-xs text-ink/45">{set.position}</span>
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
        className="min-w-0 flex-1 rounded-lg border border-ink/20 bg-white px-2 py-1 text-sm text-ink"
      />
      <select
        value={slot}
        onChange={(e) => setSlot(e.target.value as PlaylistSlotType)}
        aria-label="Moment this set covers"
        className="rounded-lg border border-ink/20 bg-white px-1.5 py-1 text-xs text-ink"
      >
        {PLAYLIST_SLOT_TYPES.filter((sl) => sl !== 'banned_songs').map((sl) => (
          <option key={sl} value={sl}>
            {PLAYLIST_SLOT_LABELS[sl]}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || trimmed.length === 0}
        onClick={save}
        aria-label="Save set name"
        className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-50"
      >
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onDone}
        aria-label="Cancel rename"
        className="rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70 disabled:opacity-60"
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
