'use client';

import { useContext } from 'react';
import { useGuestActions } from './guest-actions-context';
import { StayForm } from '@/app/_components/stay-form';
import { TEAM_SIDE_LABELS, type GuestGroupTeamSide } from '@/lib/guests';
import { GuestListHasSidesContext } from './guest-list-has-sides-context';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PostedPick } from '../../_components/posted-pick';

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
  const { createGuestGroup, stay } = useGuestActions();
  /* Saved IN PLACE (owner 2026-10-26, "a save never resets the screen") — the list keeps its scroll and selection. */
  return (
    <StayForm
      door="guests.createGuestGroup"
      action={createGuestGroup.bind(null, eventId)}
      save={stay}
      onSaved={onClose}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-ink/10 bg-cream/60 p-3"
    >
      <input type="hidden" name="event_id" value={eventId} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="guest_ids[]" value={id} />
      ))}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium uppercase tracking-[0.12em] text-ink/70">
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
        {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 4): the ▾ picker, posting the same `team_side` field. */}
        <span className="block text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Team side</span>
        <PostedPick
          name="team_side"
          label="Team side"
          initial="both"
          options={(['bride', 'groom', 'both'] as GuestGroupTeamSide[]).map((side) => ({ key: side, label: TEAM_SIDE_LABELS[side] }))}
          className="mt-1 block"
        />
      </div>
      ) : null}
      <div className="flex gap-2">
        <ActionButton tone="brand" main type="submit" icon={Plus} label={`Create + Add ${selectedIds.length}`} />
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onClose} />
      </div>
    </StayForm>
  );
}
