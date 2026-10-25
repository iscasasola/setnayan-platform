'use client';

import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ROLE_DONE_NOTE } from '@/lib/guest-group-role-pick';
import { splitPickText, useSplitPick, withMainMark } from './card-fields';
import { GuestGroupPicker, type OwnGroup } from './guest-group-picker';
import { useState } from 'react';

/**
 * new-guest-group-role.tsx — /guests/new's ONE Group dropdown and ONE Role dropdown (owner 2026-10-20: "there are 2
 * groups." · "several group, several roles"; the same two dropdowns as the guest card — `GuestGroupPicker` and the
 * checkmark PickMenu over `useSplitPick`). Posts `group_category` + `group_ids` and `role` + `extra_roles` to `createGuest`.
 * The Group starts with nothing ticked, as the old "Choose…" did: the form still asks for a group (`missing_group`).
 */

const PICK = 'w-full justify-between border border-ink/15 !bg-white/80 font-medium';

/** `hasSides`: "Your groups" follows the form's Side select (owner 2026-10-20, "THE GROUP LIST FOLLOWS THE GUEST'S SIDE"). */
export function NewGuestGroupField({ eventId, standard, groups, hasSides = false }: { eventId: string; standard: readonly PickOption[]; groups: readonly OwnGroup[] | null; hasSides?: boolean }) {
  const [list, setList] = useState<OwnGroup[] | null>(groups ? [...groups] : null);
  const { picked, pick, inputs } = useSplitPick('group', ['group_category', list ? 'group_ids' : null], '', standard.map((o) => o.key), (list ?? []).map((g) => g.groupId));
  return (
    <div className="space-y-1.5" data-new-guest-field="group">
      <span className="block text-sm font-medium text-ink">Group *</span>
      <GuestGroupPicker eventId={eventId} label="Group" picked={picked} onPick={pick} standard={standard} groups={list} onGroupsChange={setList} side={hasSides ? null : undefined} sideField={hasSides ? 'side' : undefined} className={PICK} emptyText="Choose…" />
      {inputs}
    </div>
  );
}

export function NewGuestRolesField({ label, options, solo }: { label: string; options: readonly PickOption[]; solo: readonly string[] }) {
  const { picked, pick, inputs } = useSplitPick('role', ['role', 'extra_roles'], 'guest', solo, options.map((o) => o.key));
  return (
    <div className="space-y-1.5" data-new-guest-field="role">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <PickMenu label={label} value={null} options={withMainMark(options, picked[0])} onPick={pick} picked={picked} buttonText={splitPickText('role', picked, options) || 'Guest'} doneNote={ROLE_DONE_NOTE} className={PICK} />
      {inputs}
    </div>
  );
}
