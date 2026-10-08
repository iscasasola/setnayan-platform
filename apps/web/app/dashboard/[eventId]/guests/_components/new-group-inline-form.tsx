'use client';

import { useContext } from 'react';
import { createGuestGroup } from '../groups-actions';
import { TEAM_SIDE_LABELS, type GuestGroupTeamSide } from '@/lib/guests';
import { GuestListHasSidesContext } from './guest-list-has-sides-context';

export function NewGroupInlineForm({
  eventId,
  selectedIds,
  onClose,
}: {
  eventId: string;
  selectedIds: string[];
  onClose: () => void;
}) {
  // A sideless event's group has no team side to pick: the action stores
  // 'both' when the field is absent (createGuestGroup).
  const hasSides = useContext(GuestListHasSidesContext);
  return (
    <form
      action={createGuestGroup.bind(null, eventId)}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-ink/10 bg-cream/60 p-3"
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="guest_ids[]" value={id} />
      ))}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">
          Group name
        </label>
        <input
          type="text"
          name="label"
          maxLength={64}
          required
          placeholder="e.g. College Friends"
          className="mt-1 h-9 w-full rounded-md border border-ink/20 bg-cream px-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          autoFocus
        />
      </div>
      {/* Team side picker — owner directive 2026-05-23 swapped the
       *  3-chip radio group for a native <select>. Same `name="team_side"`
       *  + same 'bride' | 'groom' | 'both' values, so the server action
       *  (createGuestGroup) consumes them unchanged. Native select is
       *  shorter vertically + matches the form's other dropdowns. */}
      {hasSides ? (
      <div>
        <label
          htmlFor="new-group-team-side"
          className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55"
        >
          Team side
        </label>
        <select
          id="new-group-team-side"
          name="team_side"
          defaultValue="both"
          className="mt-1 h-9 w-full appearance-none rounded-md border border-ink/20 bg-cream px-2 pr-8 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        >
          {(['bride', 'groom', 'both'] as GuestGroupTeamSide[]).map((side) => (
            <option key={side} value={side}>
              {TEAM_SIDE_LABELS[side]}
            </option>
          ))}
        </select>
      </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-mulberry px-3 text-xs font-medium text-cream hover:bg-mulberry-600"
        >
          Create + Add {selectedIds.length}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-md border border-ink/20 bg-cream px-3 text-xs text-ink/70 hover:border-ink/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
