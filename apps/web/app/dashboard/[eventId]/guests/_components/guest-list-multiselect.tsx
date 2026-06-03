'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Trash2, X, UserPlus } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { guestSelection, useGuestSelection } from './guest-selection-store';
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
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import { getPrimaryColor, type RolePalette } from '@/lib/mood-board';
import { ROLE_GROUP_CHIP, ROLE_GROUP_LABELS, roleGroupOf } from '@/lib/role-groups';

// Role groupings for the bulk-assign dropdown. Keeps the spec-locked
// 20-value role enum but presents it grouped so hosts can scan quickly.
// Mirrors the sidebar VIEW_FILTERS ordering for muscle-memory consistency.
export type RoleSection = { label: string; roles: GuestRole[] };
// Exported so the mobile Assign bottom sheet (MobileGuestCarousel) shows the
// SAME grouped role picker as the desktop SelectionBar — single source of
// truth for the spec-locked 20-value role enum.
export const BULK_ROLE_SECTIONS: RoleSection[] = [
  // Bride & groom omitted (owner directive 2026-06-03) — the couple is set at
  // event creation and is the foundation of the event; they're renamable but
  // not a role you bulk-assign, so they don't appear in the role picker.
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
  // Selection lives in the shared external store so the mobile carousel's
  // Customize panel (a sibling component) shows the live count / select-all
  // and the desktop SelectionBar stay in lockstep (owner directive
  // 2026-06-03). `selectMode` only gates the MOBILE card checkbox; the
  // desktop table keeps its always-on checkbox column.
  const { selectMode, ids: selectedIds, set: selectedSet } = useGuestSelection();
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);

  const allIds = useMemo(() => guests.map((g) => g.guest_id), [guests]);
  const allSelected =
    selectedIds.length > 0 && selectedIds.length === allIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = () =>
    allSelected ? guestSelection.clear() : guestSelection.setAll(allIds);

  return (
    <div className="space-y-4">
      {/* Floating bulk-action bar — DESKTOP ONLY (lg+). On phones + tablets
          the carousel's Customize panel + Assign bottom sheet own bulk
          actions (owner directive 2026-06-03), so the floating bar would be
          redundant chrome there. */}
      {selectedIds.length > 0 ? (
        <div className="hidden lg:block">
          <SelectionBar
            eventId={eventId}
            count={selectedIds.length}
            selectedIds={selectedIds}
            groups={groups}
            onClear={() => guestSelection.clear()}
            showNewGroupForm={showNewGroupForm}
            setShowNewGroupForm={setShowNewGroupForm}
          />
        </div>
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
                selected={selectedSet.has(guest.guest_id)}
                onToggle={() => guestSelection.toggle(guest.guest_id)}
                groupIds={groupMemberships[guest.guest_id] ?? []}
                groupsById={Object.fromEntries(groups.map((g) => [g.group_id, g]))}
                currentGroupId={currentGroupId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile · stacked cards with leading checkbox. */}
      <ul className="space-y-2 sm:hidden gc-mobile-list">
        {guests.map((guest) => (
          <MobileCard
            key={guest.guest_id}
            guest={guest}
            eventId={eventId}
            palette={palette}
            selectMode={selectMode}
            selected={selectedSet.has(guest.guest_id)}
            onToggle={() => guestSelection.toggle(guest.guest_id)}
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
          this form (NewGroupInlineForm has its own action).
          *
          *  BulkApplyForm + BulkDeleteForm are two separate <form>
          *  elements (each has its own server action — Apply hits
          *  bulkApplyRoleAndGroup, Delete hits bulkSoftDeleteGuests).
          *  Wrapping them in this flex flex-wrap parent so they sit on
          *  the SAME ROW at desktop widths instead of stacking. On
          *  narrow screens flex-wrap kicks in and Delete drops to its
          *  own line — natural responsive behavior. */}
      <div className="flex flex-wrap items-center gap-3">
        <BulkApplyForm
          eventId={eventId}
          selectedIds={selectedIds}
          groups={groups}
          onNewGroupClick={() => setShowNewGroupForm(true)}
          onClear={onClear}
          count={count}
        />

        {/* Delete affordance · owner directive 2026-05-23. Separate
         *  form (different server action) but inline with the apply
         *  toolbar via the parent flex container. Confirm dialog is
         *  intentional — soft-delete is reversible only via direct DB
         *  write, not by host UI. */}
        <BulkDeleteForm
          eventId={eventId}
          selectedIds={selectedIds}
          count={count}
        />
      </div>

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

  // In-app `<ConfirmForm>` (upgraded 2026-05-30) replaces the prior
  // `<form onSubmit={confirm()}>` pattern · no UI block, brand-voice copy.
  // Parent SelectionBar still wraps this in `flex flex-wrap items-center
  // gap-3` so the Delete button sits inline with the Apply toolbar (owner
  // directive 2026-05-23 — "delete button is not aligned").
  return (
    <ConfirmForm
      action={bulkSoftDeleteGuests.bind(null, eventId)}
      title="Remove selected guests?"
      message={confirmMessage}
      confirmLabel={`Delete ${count}`}
      destructive
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
    </ConfirmForm>
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

      {/* Side select · owner directive 2026-05-23 PM: "we want them to
          pick a role, add to a group, assign sides". Sits between Role
          and Group in the bulk toolbar. Server action accepts an
          optional `side` field on the same bulkApplyRoleAndGroup
          payload — applying alone, alongside Role, alongside Group, or
          all three together is supported. */}
      <label className="sr-only" htmlFor="bulk-side">
        Assign side to selected guests
      </label>
      <div className="relative">
        <select
          id="bulk-side"
          name="side"
          defaultValue=""
          className="h-9 appearance-none rounded-md border border-ink/20 bg-cream px-3 pr-8 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        >
          <option value="">Assign side…</option>
          {(['bride', 'groom', 'both'] as GuestSide[]).map((side) => (
            <option key={side} value={side}>
              {SIDE_LABELS[side]}
            </option>
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
        className="inline-flex h-9 items-center rounded-md bg-mulberry px-4 text-xs font-medium text-cream hover:bg-mulberry-600"
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
        <RoleChips guest={guest} palette={palette} />
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
  selectMode,
  selected,
  onToggle,
  groupIds,
  groupsById,
  currentGroupId,
}: {
  guest: GuestRow;
  eventId: string;
  palette: RolePalette;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  groupIds: string[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
}) {
  const cardInner = (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-cream p-3 ${
        selected ? 'border-terracotta/60 bg-terracotta/[0.05]' : 'border-ink/10'
      }`}
    >
      {/* Checkbox appears only in select mode (owner directive 2026-06-03) —
          a clean card by default, the leading checkbox once "Select" is on. */}
      {selectMode ? (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${guestDisplayName(guest)}`}
            className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
        </label>
      ) : null}
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
            <RoleChips guest={guest} palette={palette} />
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
    </div>
  );

  // Swipe-left-to-delete (owner directive 2026-06-03) — only when NOT in select
  // mode (there the row is for checkbox bulk ops) and not the couple (the bride
  // & groom can't be removed; bulkSoftDeleteGuests blocks them server-side, so
  // don't dangle a Delete that will always fail).
  const swipeable =
    !selectMode && guest.role !== 'bride' && guest.role !== 'groom';

  return (
    <li className="list-none">
      {swipeable ? (
        <SwipeToDelete
          eventId={eventId}
          guestId={guest.guest_id}
          guestName={guestDisplayName(guest)}
        >
          {cardInner}
        </SwipeToDelete>
      ) : (
        cardInner
      )}
    </li>
  );
}

// -----------------------------------------------------------------------
// SwipeToDelete — wraps a mobile guest card so a left-swipe reveals a Delete
// action (owner directive 2026-06-03). The swipe-then-tap IS the confirmation
// (iOS-style), and deletion reuses bulkSoftDeleteGuests, so the same gates
// apply (couple blocked upstream · RSVP'd guests get the reset-first message)
// and it's a recoverable SOFT delete. Touch-only — the desktop table keeps
// its own row affordances; rendered only in the `sm:hidden` card list.
// -----------------------------------------------------------------------
function SwipeToDelete({
  eventId,
  guestId,
  guestName,
  children,
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  children: ReactNode;
}) {
  const REVEAL = 84; // px width of the revealed Delete action
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Gesture state in a ref so the touch handlers never read a stale closure.
  const drag = useRef({ x: 0, y: 0, tx: 0, horiz: false, moved: false, active: false });

  const begin = (x: number, y: number) => {
    drag.current = { x, y, tx, horiz: false, moved: false, active: true };
    setDragging(true);
  };
  const move = (x: number, y: number) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = x - d.x;
    const dy = y - d.y;
    if (!d.horiz) {
      // Lock the axis on first real movement: vertical intent releases the
      // gesture so the list scrolls; horizontal intent is ours.
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        d.active = false;
        setDragging(false);
        return;
      }
      if (Math.abs(dx) > 8) d.horiz = true;
      else return;
    }
    d.moved = true;
    setTx(Math.max(-REVEAL, Math.min(0, d.tx + dx)));
  };
  const end = () => {
    const d = drag.current;
    d.active = false;
    setDragging(false);
    // Snap open (revealed) past the halfway point, else snap closed.
    if (d.horiz) setTx((t) => (t < -REVEAL / 2 ? -REVEAL : 0));
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete action, revealed behind the card on a left-swipe. */}
      <form
        action={bulkSoftDeleteGuests.bind(null, eventId)}
        className="absolute inset-y-0 right-0 flex"
        style={{ width: REVEAL }}
      >
        <input type="hidden" name="guest_ids[]" value={guestId} />
        <button
          type="submit"
          aria-label={`Delete ${guestName}`}
          tabIndex={tx === 0 ? -1 : 0}
          className="flex w-full flex-col items-center justify-center gap-0.5 bg-rose-600 text-cream"
        >
          <Trash2 aria-hidden className="h-5 w-5" strokeWidth={2} />
          <span className="text-[11px] font-semibold">Delete</span>
        </button>
      </form>

      {/* Front card — translates on swipe; opaque (bg-cream on the child) so it
          fully covers the Delete action when closed. */}
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) begin(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) move(t.clientX, t.clientY);
        }}
        onTouchEnd={end}
        onTouchCancel={end}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            // Click synthesized right after a drag — ignore it and keep the
            // snapped position (don't navigate, don't toggle).
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
            return;
          }
          if (tx !== 0) {
            // Genuine tap on an OPEN row → close it instead of navigating.
            e.preventDefault();
            e.stopPropagation();
            setTx(0);
          }
          // Genuine tap on a closed row → let the inner <Link> navigate.
        }}
        className="relative z-10"
        style={{
          transform: `translateX(${tx}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
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

/* primary role chip + smaller secondary chips for any extra roles
   (multi-role guests, iteration 0001 2026-06-02) */
function RoleChips({ guest, palette }: { guest: GuestRow; palette: RolePalette }) {
  const extras = guest.extra_roles ?? [];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {/* primary role chip — render <RoleChip>, NOT <RoleChips> (self).
          Rendering RoleChips here was infinite self-recursion → stack
          overflow → SSR 500 on the Guests page (the un-merged
          claude/fix-rolechips-recursion branch chased this). */}
      <RoleChip role={guest.role} palette={palette} />
      {extras.map((r) => (
        <span
          key={r}
          title={`Also ${ROLE_LABELS[r]}`}
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_GROUP_CHIP[roleGroupOf(r)]}`}
        >
          +{ROLE_LABELS[r]}
        </span>
      ))}
    </span>
  );
}
