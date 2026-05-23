'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Trash2, X, UserPlus } from 'lucide-react';
import {
  bulkApplyRoleAndGroup,
  bulkSoftDeleteGuests,
  createGuestGroup,
  removeGuestFromGroup,
} from '../groups-actions';
import {
  guestDisplayName,
  guestInitials,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  TEAM_SIDE_CHIP,
  TEAM_SIDE_LABELS,
  type GuestGroupTeamSide,
  type GuestGroupWithCount,
  type GuestRole,
  type GuestRow,
  type RsvpStatus,
} from '@/lib/guests';
import { getPrimaryColor, type RolePalette } from '@/lib/mood-board';
import { ROLE_GROUP_CHIP, ROLE_GROUP_LABELS, roleGroupOf } from '@/lib/role-groups';

// Role groupings for the bulk-assign dropdown. Keeps the spec-locked
// 20-value role enum but presents it grouped so hosts can scan quickly.
// Mirrors the sidebar VIEW_FILTERS ordering for muscle-memory consistency.
type RoleSection = { label: string; roles: GuestRole[] };
const BULK_ROLE_SECTIONS: RoleSection[] = [
  { label: ROLE_GROUP_LABELS.couple, roles: ['bride', 'groom'] },
  // VIP family — owner directive 2026-05-23 PM (PR #424 lock).
  // 4 roles for Tier-1 seating auto-fill per iteration 0008.
  {
    label: ROLE_GROUP_LABELS.vip_family,
    roles: [
      'bride_parents',
      'groom_parents',
      'bride_immediate_family',
      'groom_immediate_family',
    ],
  },
  {
    label: ROLE_GROUP_LABELS.wedding_party,
    roles: ['maid_of_honor', 'matron_of_honor', 'best_man', 'bridesmaid', 'groomsman'],
  },
  { label: ROLE_GROUP_LABELS.principal_sponsors, roles: ['principal_sponsor'] },
  {
    label: ROLE_GROUP_LABELS.secondary_sponsors,
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
  },
  {
    label: ROLE_GROUP_LABELS.bearers_flower_girl,
    roles: ['ring_bearer', 'bible_bearer', 'coin_bearer', 'flower_girl'],
  },
  {
    label: ROLE_GROUP_LABELS.officiants,
    roles: ['officiant', 'reader_lector', 'soloist_musician'],
  },
  { label: 'Generic', roles: ['guest'] },
];

type Props = {
  eventId: string;
  guests: GuestRow[];
  palette: RolePalette;
  groups: GuestGroupWithCount[];
  groupMemberships: Record<string, string[]>; // guest_id → group_id[]
  currentGroupId: string | null;
};

export function GuestListMultiselect({
  eventId,
  guests,
  palette,
  groups,
  groupMemberships,
  currentGroupId,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allIds = useMemo(() => guests.map((g) => g.guest_id), [guests]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="space-y-4">
      {selected.size > 0 ? (
        <SelectionBar
          eventId={eventId}
          count={selected.size}
          selectedIds={selectedIds}
          groups={groups}
          onClear={clearSelection}
          showNewGroupForm={showNewGroupForm}
          setShowNewGroupForm={setShowNewGroupForm}
        />
      ) : null}

      {/* Desktop · table with checkbox column. Mirrors the prior
          DesktopTable layout but no longer wraps the whole row in a
          Link — the checkbox owns row-click for selection, and the name
          column carries an explicit Link to the detail page. */}
      <div className="hidden overflow-hidden rounded-xl border border-ink/10 sm:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="w-10 px-3 py-3">
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={
                      allSelected ? 'Clear selection' : 'Select all guests in view'
                    }
                    className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                  />
                </label>
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              {/* Side column — owner directive 2026-05-23. Surfaces the
               *  guest's bride/groom/both attribution explicitly instead
               *  of relying on the Avatar's tint cue. Narrow 88px-ish
               *  width is enough for the "Bride's side" / "Groom's side"
               *  / "Both sides" label rendered as a tinted pill. */}
              <th className="w-[10%] px-3 py-3 font-medium">Side</th>
              <th className="w-[18%] px-3 py-3 font-medium">Role</th>
              <th className="w-[16%] px-3 py-3 font-medium">Groups</th>
              <th className="w-[12%] px-3 py-3 font-medium">RSVP</th>
              <th className="w-[14%] px-3 py-3 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <DesktopRow
                key={guest.guest_id}
                guest={guest}
                eventId={eventId}
                palette={palette}
                selected={selected.has(guest.guest_id)}
                onToggle={() => toggleOne(guest.guest_id)}
                groupIds={groupMemberships[guest.guest_id] ?? []}
                groupsById={Object.fromEntries(groups.map((g) => [g.group_id, g]))}
                currentGroupId={currentGroupId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile · stacked cards with leading checkbox. */}
      <ul className="space-y-2 sm:hidden">
        {guests.map((guest) => (
          <MobileCard
            key={guest.guest_id}
            guest={guest}
            eventId={eventId}
            palette={palette}
            selected={selected.has(guest.guest_id)}
            onToggle={() => toggleOne(guest.guest_id)}
            groupIds={groupMemberships[guest.guest_id] ?? []}
            groupsById={Object.fromEntries(groups.map((g) => [g.group_id, g]))}
            currentGroupId={currentGroupId}
          />
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------
// SelectionBar — sticky top action bar surfaced when ≥1 guest selected.
// Renders three forms (assign-role · add-to-group · new-group) inline so
// the host can act without leaving the page. Each form ships the
// selectedIds as repeated hidden inputs ("guest_ids[]").
// -----------------------------------------------------------------------

function SelectionBar({
  eventId,
  count,
  selectedIds,
  groups,
  onClear,
  showNewGroupForm,
  setShowNewGroupForm,
}: {
  eventId: string;
  count: number;
  selectedIds: string[];
  groups: GuestGroupWithCount[];
  onClear: () => void;
  showNewGroupForm: boolean;
  setShowNewGroupForm: (v: boolean) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions for selected guests"
      className="sticky top-20 z-20 rounded-xl border border-terracotta/40 bg-cream/95 p-3 shadow-md backdrop-blur"
    >
      {/* Single-Apply toolbar (owner directive 2026-05-23 PM verbatim:
          "apply and add button should be 1 only and at the last, Apply.
          New Group can be placed on the dropdown of Groups"). Two
          selects (role + group) inside ONE form, ONE Apply button at the
          end. "+ New group..." is a sentinel option inside the Groups
          select — picking it expands the inline create form OUTSIDE
          this form (NewGroupInlineForm has its own action). */}
      <BulkApplyForm
        eventId={eventId}
        selectedIds={selectedIds}
        groups={groups}
        onNewGroupClick={() => setShowNewGroupForm(true)}
        onClear={onClear}
        count={count}
      />

      {/* Delete affordance · owner directive 2026-05-23. Lives in a
       *  separate form (different server action) below the apply
       *  toolbar so it never accidentally fires alongside an Apply
       *  click. Confirm dialog is intentional — soft-delete is
       *  reversible only via direct DB write, not by host UI. */}
      <BulkDeleteForm
        eventId={eventId}
        selectedIds={selectedIds}
        count={count}
      />

      {showNewGroupForm ? (
        <NewGroupInlineForm
          eventId={eventId}
          selectedIds={selectedIds}
          onClose={() => setShowNewGroupForm(false)}
        />
      ) : null}
    </div>
  );
}

function BulkDeleteForm({
  eventId,
  selectedIds,
  count,
}: {
  eventId: string;
  selectedIds: string[];
  count: number;
}) {
  // Confirm prompt mentions the seat-release + RSVP-gate behavior so
  // the host knows what's about to happen. The server still enforces
  // both — this is informational, not authoritative.
  const confirmMessage = `Remove ${count} guest${count === 1 ? '' : 's'} from this event? Their seat assignments (if any) will open up. Guests who have already RSVP'd will be skipped — reset their RSVP to Pending first if you want to remove them.`;

  return (
    <form
      action={bulkSoftDeleteGuests.bind(null, eventId)}
      className="mt-2 flex justify-end"
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="guest_ids[]" value={id} />
      ))}
      <button
        type="submit"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-300/60 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:border-rose-400 hover:bg-rose-100"
        aria-label={`Remove ${count} selected guest${count === 1 ? '' : 's'}`}
      >
        <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Delete {count}
      </button>
    </form>
  );
}

// Sentinel value for the "+ New group..." option inside the Groups
// dropdown. Picking it doesn't submit a group_id (we strip it client-
// side before submit) — it opens the inline create form.
const NEW_GROUP_SENTINEL = '__new_group__';

function BulkApplyForm({
  eventId,
  selectedIds,
  groups,
  onNewGroupClick,
  onClear,
  count,
}: {
  eventId: string;
  selectedIds: string[];
  groups: GuestGroupWithCount[];
  onNewGroupClick: () => void;
  onClear: () => void;
  count: number;
}) {
  // Track the group select so we can intercept the sentinel and clear
  // it from the form before submit (preventing the server from seeing
  // a bogus group_id). Role select is fully form-managed; no state
  // needed for it.
  const [groupValue, setGroupValue] = useState('');

  return (
    <form
      action={bulkApplyRoleAndGroup.bind(null, eventId)}
      className="flex flex-wrap items-center gap-3"
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="guest_ids[]" value={id} />
      ))}

      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-terracotta px-2 text-xs font-semibold text-cream">
          {count}
        </span>
        <span className="text-sm font-medium text-ink">selected</span>
      </div>

      {/* Role select */}
      <label className="sr-only" htmlFor="bulk-role">
        Assign role to selected guests
      </label>
      <div className="relative">
        <select
          id="bulk-role"
          name="role"
          defaultValue=""
          className="h-9 appearance-none rounded-md border border-ink/20 bg-cream px-3 pr-8 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        >
          <option value="">Assign role…</option>
          {BULK_ROLE_SECTIONS.map((section) => (
            <optgroup key={section.label} label={section.label}>
              {section.roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          strokeWidth={1.75}
        />
      </div>

      {/* Group select — owner directive 2026-05-23 PM: "New Group can be
          placed on the dropdown of Groups". The sentinel option opens
          the inline create form (rendered by the parent component) and
          resets the select so the form doesn't submit a bogus value. */}
      <label className="sr-only" htmlFor="bulk-group">
        Add selected guests to a group
      </label>
      <div className="relative">
        <select
          id="bulk-group"
          name="group_id"
          value={groupValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === NEW_GROUP_SENTINEL) {
              // Sentinel — open the create form, reset the select so
              // the form submits an empty group_id (no-op on server
              // side).
              onNewGroupClick();
              setGroupValue('');
              return;
            }
            setGroupValue(v);
          }}
          className="h-9 appearance-none rounded-md border border-ink/20 bg-cream px-3 pr-8 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        >
          <option value="">Add to group…</option>
          {groups.length > 0 ? (
            <optgroup label="Custom groups">
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.label} · {TEAM_SIDE_LABELS[g.team_side]}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Create">
            <option value={NEW_GROUP_SENTINEL}>+ New group…</option>
          </optgroup>
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          strokeWidth={1.75}
        />
      </div>

      {/* Single Apply button at the end · owner directive */}
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md bg-terracotta px-4 text-xs font-medium text-cream hover:bg-terracotta-600"
      >
        Apply
      </button>

      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-ink/20 bg-cream px-3 text-xs text-ink/70 hover:border-ink/40"
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Clear selection
      </button>
    </form>
  );
}

function NewGroupInlineForm({
  eventId,
  selectedIds,
  onClose,
}: {
  eventId: string;
  selectedIds: string[];
  onClose: () => void;
}) {
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
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-terracotta px-3 text-xs font-medium text-cream hover:bg-terracotta-600"
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

// -----------------------------------------------------------------------
// Row components · checkbox + name (Link) + role chip + group chips +
// RSVP + contact. Mobile uses a compact stacked card with the same data.
// -----------------------------------------------------------------------

function DesktopRow({
  guest,
  eventId,
  palette,
  selected,
  onToggle,
  groupIds,
  groupsById,
  currentGroupId,
}: {
  guest: GuestRow;
  eventId: string;
  palette: RolePalette;
  selected: boolean;
  onToggle: () => void;
  groupIds: string[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
}) {
  return (
    <tr
      className={`border-t border-ink/5 transition-colors ${
        selected ? 'bg-terracotta/[0.06]' : 'hover:bg-terracotta/[0.04]'
      }`}
    >
      <td className="px-3 py-3">
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${guestDisplayName(guest)}`}
            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
        </label>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
          className="flex items-center gap-3"
        >
          <Avatar guest={guest} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{guestDisplayName(guest)}</p>
            {guest.plus_one_allowed ? (
              <p className="truncate text-xs text-ink/55">
                + {guest.plus_one_name ?? 'TBA'}
              </p>
            ) : null}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3">
        <SidePill side={guest.side} />
      </td>
      <td className="px-3 py-3">
        <RoleChip role={guest.role} palette={palette} />
      </td>
      <td className="px-3 py-3">
        <GroupChipList
          eventId={eventId}
          guestId={guest.guest_id}
          groupIds={groupIds}
          groupsById={groupsById}
          currentGroupId={currentGroupId}
        />
      </td>
      <td className="px-3 py-3">
        <RsvpPill status={guest.rsvp_status} />
      </td>
      <td className="px-3 py-3 text-xs text-ink/60">
        {guest.email ?? guest.mobile ?? '—'}
      </td>
    </tr>
  );
}

function MobileCard({
  guest,
  eventId,
  palette,
  selected,
  onToggle,
  groupIds,
  groupsById,
  currentGroupId,
}: {
  guest: GuestRow;
  eventId: string;
  palette: RolePalette;
  selected: boolean;
  onToggle: () => void;
  groupIds: string[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border bg-cream p-3 ${
        selected ? 'border-terracotta/60 bg-terracotta/[0.05]' : 'border-ink/10'
      }`}
    >
      <label className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${guestDisplayName(guest)}`}
          className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
      </label>
      <Link
        href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
        className="flex flex-1 items-center gap-3 min-w-0"
      >
        <Avatar guest={guest} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {guestDisplayName(guest)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <RoleChip role={guest.role} palette={palette} />
            <GroupChipList
              eventId={eventId}
              guestId={guest.guest_id}
              groupIds={groupIds}
              groupsById={groupsById}
              currentGroupId={currentGroupId}
              compact
            />
          </div>
        </div>
        <RsvpPill status={guest.rsvp_status} />
      </Link>
    </li>
  );
}

function GroupChipList({
  eventId,
  guestId,
  groupIds,
  groupsById,
  currentGroupId,
  compact = false,
}: {
  eventId: string;
  guestId: string;
  groupIds: string[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
  compact?: boolean;
}) {
  if (groupIds.length === 0) {
    return compact ? null : <span className="text-xs text-ink/35">—</span>;
  }

  // In a custom-group view, surface the "Remove from group" affordance
  // on this row for the currently-viewed group only — keeps the chip
  // list focused on the action that matches the host's context.
  return (
    <div className="flex flex-wrap items-center gap-1">
      {groupIds.slice(0, compact ? 2 : 3).map((gid) => {
        const grp = groupsById[gid];
        if (!grp) return null;
        const isCurrent = currentGroupId === gid;
        return (
          <span
            key={gid}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TEAM_SIDE_CHIP[grp.team_side]}`}
            title={`${grp.label} · ${TEAM_SIDE_LABELS[grp.team_side]}`}
          >
            <span className="max-w-[10ch] truncate">{grp.label}</span>
            {isCurrent ? (
              <form
                action={removeGuestFromGroup.bind(null, eventId)}
                className="inline-flex"
              >
                <input type="hidden" name="group_id" value={gid} />
                <input type="hidden" name="guest_id" value={guestId} />
                <button
                  type="submit"
                  aria-label={`Remove from ${grp.label}`}
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full hover:bg-ink/10"
                >
                  <X aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
                </button>
              </form>
            ) : null}
          </span>
        );
      })}
      {groupIds.length > (compact ? 2 : 3) ? (
        <span className="text-[10px] text-ink/50">+{groupIds.length - (compact ? 2 : 3)}</span>
      ) : null}
    </div>
  );
}

function Avatar({ guest }: { guest: GuestRow }) {
  const sideTint: Record<GuestRow['side'], string> = {
    bride: 'bg-rose-200/60 text-rose-900',
    groom: 'bg-sky-200/60 text-sky-900',
    both: 'bg-amber-200/60 text-amber-900',
  };
  return (
    <span
      aria-hidden
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${sideTint[guest.side]}`}
    >
      {guestInitials(guest)}
    </span>
  );
}

// Side pill — owner directive 2026-05-23. New column on the desktop
// guests table. Same side-of-wedding tint as the Avatar cue (rose for
// bride · sky for groom · amber for both) so the visual language is
// consistent across the row + the chip is small enough to fit in a
// ~10% column width.
function SidePill({ side }: { side: GuestRow['side'] }) {
  const tone: Record<GuestRow['side'], string> = {
    bride: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200',
    groom: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200',
    both: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[side]}`}
    >
      {SIDE_LABELS[side]}
    </span>
  );
}

function RsvpPill({ status }: { status: RsvpStatus }) {
  const tone: Record<RsvpStatus, string> = {
    attending: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    declined: 'bg-rose-100 text-rose-800',
    maybe: 'bg-ink/10 text-ink/70',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[status]}`}
    >
      {RSVP_LABELS[status]}
    </span>
  );
}

function RoleChip({ role, palette }: { role: GuestRole; palette: RolePalette }) {
  const group = roleGroupOf(role);
  const accent = getPrimaryColor(palette, group);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_GROUP_CHIP[group]}`}
    >
      {accent ? (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full ring-1 ring-ink/10"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {ROLE_LABELS[role]}
    </span>
  );
}
