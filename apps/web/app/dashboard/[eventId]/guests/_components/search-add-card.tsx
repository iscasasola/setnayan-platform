'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Users, X } from 'lucide-react';
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
import { useGuestActions } from './guest-actions-context';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';
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
 *     🔗 Built to the same behaviour as the guest card's one Group picker (rd/card-one-group-one-role) — fold into it.
 *   · Plus — the card's "Extra seats" words: None · +1 … +4. A +N makes the same linked "+1 · TBA" seat rows the app
 *     already makes (`syncExtraSeats`).
 *
 * The picks live in the Guests screen (`useAddPicks`), so the box's Enter reads them.
 */
type GroupOpt = { group_id: string; label: string };

const SIDE_SHORT: Record<GuestSide, string> = { bride: 'Bride', groom: 'Groom', both: 'Both' };
const CAT = 'cat:';
const NEW = '__new__';
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
  const router = useRouter();
  const { quickCreateGroup } = useGuestActions();
  const offeredRoles = resolveRoleSet(roleSetKey ?? 'wedding').offeredRoles;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [making, startMaking] = useTransition();

  const groupWords = [
    ...(picks.category ? [GROUP_CATEGORY_LABELS[picks.category]] : []),
    ...picks.groupIds.map((id) => groups.find((g) => g.group_id === id)?.label).filter(Boolean),
  ].join(' · ');

  const pickGroup = (key: string) => {
    if (key === NEW) {
      setGroupError(null);
      setName('');
      setNaming(true);
      return;
    }
    if (key.startsWith(CAT)) {
      const c = key.slice(CAT.length) as GuestGroupCategory;
      setPicks({ ...picks, category: picks.category === c ? null : c });
      return;
    }
    setPicks({ ...picks, groupIds: picks.groupIds.includes(key) ? picks.groupIds.filter((g) => g !== key) : [...picks.groupIds, key] });
  };

  const makeGroup = () => {
    const label = name.trim();
    if (!label) {
      setNaming(false);
      return;
    }
    setGroupError(null);
    startMaking(async () => {
      const res = await hearAction(() => quickCreateGroup(eventId, label));
      if (!res.ok) {
        setGroupError(plainRefusal(res.error, 'Couldn’t make that group. Try again.'));
        return;
      }
      onMadeGroup({ group_id: res.group.group_id, label: res.group.label });
      setPicks({ ...picks, groupIds: picks.groupIds.includes(res.group.group_id) ? picks.groupIds : [...picks.groupIds, res.group.group_id] });
      setNaming(false);
      setName('');
      router.refresh();
    });
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
        <div className="space-y-1">
          <span className={LABEL}>Group</span>
          <PickMenu
            label="Group"
            value={null}
            buttonText={groupWords || 'No group'}
            picked={[...(picks.category ? [`${CAT}${picks.category}`] : []), ...picks.groupIds]}
            options={[
              ...(Object.keys(GROUP_CATEGORY_LABELS) as GuestGroupCategory[]).map((c) => ({ key: `${CAT}${c}`, label: GROUP_CATEGORY_LABELS[c], group: 'Standard — one of these' })),
              ...groups.map((g) => ({ key: g.group_id, label: g.label, group: 'Your groups' })),
              { key: NEW, label: '＋ New group…', group: 'Your groups' },
            ]}
            onPick={pickGroup}
            className="w-full justify-between"
            dataAttr="data-add-pick-group"
          />
        </div>
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
      {naming ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setGroupError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  makeGroup();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setNaming(false);
                }
              }}
              placeholder="New group name"
              autoComplete="off"
              maxLength={64}
              className="input-field min-w-0 flex-1"
            />
            <ActionButton tone="brand" main icon={Check} label={making ? 'Creating…' : 'Create'} onClick={makeGroup} disabled={making || !name.trim()} />
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Cancel new group" onClick={() => setNaming(false)} disabled={making} />
          </div>
          {groupError ? (
            <p role="alert" className="text-xs text-danger-700">
              {groupError}
            </p>
          ) : null}
        </div>
      ) : null}
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
