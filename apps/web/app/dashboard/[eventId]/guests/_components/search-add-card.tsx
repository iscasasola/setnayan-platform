'use client';

import { useRef, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import {
  GROUP_CATEGORY_LABELS,
  guestRolePickLabel,
  PLUS_ONE_CHOICES,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { resolveRoleSet } from '@/lib/role-sets';
import { SIDELESS_SIDE } from '@/lib/guest-side-question';
import { SIDE_CONTROL_BORDER } from '@/lib/side-colors';
import type { RoleNames } from '@/lib/role-names';
import { GuestGroupPicker } from './guest-group-picker';
import type { AddPicks } from './guest-add-queue';
export { picksForAdd, type AddPicks } from './guest-add-queue';

/**
 * search-add-card.tsx — THE "ADD “…”" CARD'S FOUR STICKY PICKS: Side · Role · Group · Plus (owner 2026-10-20: *"they can
 * set the Role, Group, Side, and Plus"*; DECISION_LOG 2026-10-20; prototype `guest_group_and_fast_add_2026-10-20.html`
 * frame B2). Quick add's own row, with Plus added, two by two at 375; picked once, they stay for every following Enter.
 *
 *   · Side · Role — the Quick add sheet's words and options (Bride · Groom · Both; the event's offered roles in the
 *     couple's own words). Side is absent on an event with no sides.
 *   · Group — ONE multi list: a standard group (one of Family · Friends · Work · School · Officiant · Other — writes
 *     `group_category`), then the couple's own groups (tick freely — memberships), then ＋ New group…, made in place.
 *     🔗 FOLDED (2026-10-20): it IS the guest card's one Group picker — `GuestGroupPicker` (guest-group-picker.tsx), the
 *     same list, ＋ New group…, ✎ rename and 🗑 delete in place. Only the tick rule differs, and it is this card's: here
 *     the standard group may be left unticked ("No group" — the add stores 'other', as Quick add always did).
 *   · Plus — the card's "Extra seats" words: None · +1 … +4. A +N makes the same linked "+1 · TBA" seat rows the app
 *     already makes (`syncExtraSeats`).
 *
 * The picks live in the Guests screen (`useAddPicks`), so the box's Enter reads them.
 */
type GroupOpt = { group_id: string; label: string; team_side: 'bride' | 'groom' | 'both' };

const SIDE_SHORT: Record<GuestSide, string> = { bride: 'Bride', groom: 'Groom', both: 'Both' };
const LABEL = 'block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45';

export function useAddPicks(hasSides: boolean) {
  return useState<AddPicks>({ side: hasSides ? 'bride' : SIDELESS_SIDE, role: 'guest', category: null, groupIds: [], plus: 0 });
}

export function AddCardPicks({
  eventId,
  hasSides,
  roleSetKey,
  roleNames,
  groups,
  picks,
  setPicks,
  onMadeGroup,
}: {
  eventId: string;
  hasSides: boolean;
  roleSetKey?: string | null;
  roleNames: RoleNames | null | undefined;
  groups: readonly GroupOpt[];
  picks: AddPicks;
  setPicks: (next: AddPicks) => void;
  /** A group made here — the screen keeps it in the list before the re-read lands. */
  onMadeGroup: (g: GroupOpt) => void;
}) {
  const offeredRoles = resolveRoleSet(roleSetKey ?? 'wedding').offeredRoles;
  const standard = (Object.keys(GROUP_CATEGORY_LABELS) as GuestGroupCategory[]).map((c) => ({ key: c, label: GROUP_CATEGORY_LABELS[c] }));
  /* The picks as of the tap — a group made in place answers after an await, and must not undo a tick made meanwhile. */
  const latest = useRef(picks);
  latest.current = picks;

  /* This card's tick rule: a standard group is one-of AND may be left unticked; an own group toggles. */
  const pickGroup = (key: string) => {
    const now = latest.current;
    if (key in GROUP_CATEGORY_LABELS) {
      const c = key as GuestGroupCategory;
      setPicks({ ...now, category: now.category === c ? null : c });
      return;
    }
    setPicks({ ...now, groupIds: now.groupIds.includes(key) ? now.groupIds.filter((g) => g !== key) : [...now.groupIds, key] });
  };

  return (
    <div className="space-y-2" data-add-card-picks="">
      <div className="grid grid-cols-2 gap-2">
        {hasSides ? (
          <div className="space-y-1">
            <span className={LABEL}>Side</span>
            <PickMenu
              label="Side"
              value={picks.side}
              options={(['bride', 'groom', 'both'] as GuestSide[]).map((s) => ({ key: s, label: SIDE_SHORT[s] }))}
              onPick={(k) => setPicks({ ...picks, side: k as GuestSide })}
              className={`w-full justify-between border-2 ${SIDE_CONTROL_BORDER[picks.side]}`}
              dataAttr="data-add-pick-side"
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <span className={LABEL}>Role</span>
          <PickMenu
            label="Role"
            value={picks.role}
            options={offeredRoles.map((r) => ({ key: r, label: guestRolePickLabel(r, roleNames) }))}
            onPick={(k) => setPicks({ ...picks, role: k as GuestRole })}
            className="w-full justify-between"
            dataAttr="data-add-pick-role"
          />
        </div>
        {/* 👥 THE one Group picker (the guest card's): the pill in its cell, its list full width under the four picks. Its
            "Your groups" follows the Side pick (owner 2026-10-20 — "THE GROUP LIST FOLLOWS THE GUEST'S SIDE"). */}
        <GuestGroupPicker
          eventId={eventId}
          label="Group"
          picked={[...(picks.category ? [picks.category] : []), ...picks.groupIds]}
          onPick={pickGroup}
          standard={standard}
          groups={groups.map((g) => ({ groupId: g.group_id, label: g.label, teamSide: g.team_side }))}
          side={hasSides ? picks.side : undefined}
          onGroupsChange={(next) => {
            // ⚡ The group's create / rename / delete revalidates the guest list (`editGuestGroupInPlace`): no second render.
            for (const g of next) if (!groups.some((x) => x.group_id === g.groupId)) onMadeGroup({ group_id: g.groupId, label: g.label, team_side: g.teamSide });
          }}
          emptyText="No group"
          className="w-full justify-between"
          layout={(button, list) => (
            <>
              <div className="space-y-1" data-add-pick-group="">
                <span className={LABEL}>Group</span>
                {button}
              </div>
              {list ? <div className="order-last col-span-2">{list}</div> : null}
            </>
          )}
        />
        <div className="space-y-1">
          <span className={LABEL}>Plus</span>
          <PickMenu
            label="Plus — extra seats"
            value={String(picks.plus)}
            options={PLUS_ONE_CHOICES.map((n) => ({ key: String(n), label: n === 0 ? 'None' : `+${n}` }))}
            onPick={(k) => setPicks({ ...picks, plus: Number(k) || 0 })}
            className="w-full justify-between"
            dataAttr="data-add-pick-plus"
          />
        </div>
      </div>
      <p className="text-xs text-ink/55">All four stay as picked for the next names.</p>
    </div>
  );
}

export type PersonHit = { key: string; name: string; lastName: string; from: string; source: string };

/** "FROM YOUR PEOPLE · NOT ON THIS LIST YET" — the shipped Add-from-your-people rows' look and words, one tap adds. */
export function PeopleHits({ hits, onAdd }: { hits: readonly PersonHit[]; onAdd: (p: PersonHit) => void }) {
  if (hits.length === 0) return null;
  return (
    <div className="space-y-1" data-people-hits="">
      <p className={LABEL}>From your People · not on this list yet</p>
      {hits.map((p) => (
        <div key={p.key} className="flex min-h-11 items-center gap-3" data-people-hit={p.key}>
          <Users aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
            <span className="block truncate text-xs text-ink/55">{p.source === 'people' ? 'From your People' : `From ${p.from}`}</span>
          </span>
          <ActionButton tone="brand" icon={Plus} label="Add" name={`Add ${p.name}`} onClick={() => onAdd(p)} />
        </div>
      ))}
      <p className="text-xs text-ink/55">Enter adds the first one, with what People knows and the four picks below.</p>
    </div>
  );
}
