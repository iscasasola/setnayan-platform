'use client';

import { useRoleNames } from './role-names-context';
import { isWhiteSpaceTap } from './row-tap';
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { guestSelection, useGuestSelection } from './guest-selection-store';
import { guestOptimistic, useGuestOptimistic } from './guest-optimistic-store';
import {
  InspectorTrigger,
  useInspectorContext,
} from '@/app/_components/inspector/inspector-column';
import { SeatChip } from './seat-chip';
import { GuestInviteCell } from './guest-invite-cell';
import { GuestMoreMenu } from './guest-ticket-parts';
import { GuestAccessCell } from './guest-access-cell';
import { GuestCheckinCell } from './guest-checkin-cell';
import { useRosterColumns } from './use-roster-columns';
import type { GuestAccessState } from '@/lib/guest-access';
import {
  defaultRosterColumns,
  ROSTER_COLUMN_LABEL,
  SLOT_PX,
  type RosterColumn,
} from '@/lib/roster-columns';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import { InfoTip } from '@/app/_components/info-tip';
import {
  BringerSeatsProvider,
  PlusOneOverNote,
  PlusOneSeatsSummary,
  useBringerSeats,
  usePlaceholderLabel,
} from './plus-one-seats-note';
import type { BringerSeat } from '@/lib/extra-seats';
import {
  AddToGroupControl,
  GuestListFinalizedContext,
  GuestListHasSidesContext,
  PlusOneChipEditor,
  RoleChipEditor,
  ROW_RSVP_WORDS,
  RsvpChipEditor,
  SideChipEditor,
} from './chip-editors';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { publishPhoneColumn } from './phone-column-channel';
import { Sheet } from '@/app/_components/sheet';
import { setGuestInvitationSent } from '../../invitation/actions';
import { projectGuests } from '@/lib/guest-optimistic';
import { DeleteGuestSheet, useGuestRemoval } from './guest-delete';
import { plusOnesUnderBringers } from '@/lib/plus-ones-under-bringers';
import {
  bulkApplyRoleAndGroup,
  createGuestGroup,
  removeGuestFromGroup,
} from '../groups-actions';
import {
  guestDisplayName,
  guestFullName,
  guestHasTicket,
  guestInitials,
  plusOneSeats,
  guestRoleLabel,
  guestRolePickLabel,
  REQUEST_ENTRY_SOURCE,
  RSVP_LABELS,
  SIDE_LABELS,
  SIDE_ORDER,
  TEAM_SIDE_CHIP,
  TEAM_SIDE_LABELS,
  type GuestGroupTeamSide,
  type GuestGroupWithCount,
  type GuestRow,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import { type RolePalette } from '@/lib/mood-board';
import { roleTextStyle } from '@/lib/role-chip-style';
import { SIDE_AVATAR, SIDE_TINT_FILL } from '@/lib/side-colors';
import {
  importanceGroupOf,
  ROLE_GROUP_LABELS,
  sectionHeadingInTheirWords,
  isHonoreeRole,
  roleGroupOf,
  type RoleGroup,
} from '@/lib/role-groups';

// Role groupings for the bulk-assign dropdown. Keeps the spec-locked
// 20-value role enum but presents it grouped so hosts can scan quickly.
// Mirrors the sidebar VIEW_FILTERS ordering for muscle-memory consistency.
// 🔑 THE PICKER'S VOCABULARY MOVED TO lib/bulk-role-vocabulary.ts, and the
// server action that validates Apply now reads THE SAME export. It used to be
// a second hand-maintained literal in groups-actions.ts that had drifted into
// a near-inverse of this one — "Bride's Parents" was offered here and rejected
// there. Re-exported so existing importers (the mobile Assign sheet) are
// untouched; do not re-introduce a local copy.
// Imported for this module's own use AND re-exported for existing importers
// (the mobile Assign sheet imports both from here). `export … from` alone
// re-exports without binding the names locally, which is why both lines exist.
import {
  BULK_ROLE_SECTIONS,
  bulkRoleSectionsFor,
  type RoleSection,
} from '@/lib/bulk-role-vocabulary';

export {
  BULK_ROLE_SECTIONS,
  bulkRoleSectionsFor,
  type RoleSection,
} from '@/lib/bulk-role-vocabulary';
import {
  buildRosterSections,
  foldSections,
  groupingKeyOf,
  type ArrangeCtx,
  type ArrangeKey,
} from '@/lib/roster-arrangement';
import { formatCount } from '@/lib/format-number';
import { invitationLinkOn } from '@/lib/invitation-link';
import { tableWords } from '@/lib/table-words';

type SectionGroup = RoleGroup | 'guest';

// ⚖ Owner 2026-09-20 — the column header is the arrangement control. See
// lib/roster-arrangement.ts for the two-questions split and the URL contract.


const SECTION_CONFIG: {
  group: SectionGroup;
  label: string;
  mobileCols: string;
}[] = [
  { group: 'couple', label: ROLE_GROUP_LABELS.couple, mobileCols: 'grid-cols-2' },
  { group: 'vip_family', label: ROLE_GROUP_LABELS.vip_family, mobileCols: 'grid-cols-2' },
  // Nikah principals (wali/witness/imam/wakil) — only populated for muslim
  // weddings; the section is filtered out when empty, so it never shows on a
  // Catholic/civil wedding. Ranked just under VIP family to mirror ROLE_IMPORTANCE.
  { group: 'muslim_principals', label: ROLE_GROUP_LABELS.muslim_principals, mobileCols: 'grid-cols-2' },
  { group: 'groomsmen', label: ROLE_GROUP_LABELS.groomsmen, mobileCols: 'grid-cols-2' },
  { group: 'bridesmaids', label: ROLE_GROUP_LABELS.bridesmaids, mobileCols: 'grid-cols-2' },
  { group: 'principal_sponsors', label: ROLE_GROUP_LABELS.principal_sponsors, mobileCols: 'grid-cols-2' },
  { group: 'secondary_sponsors', label: ROLE_GROUP_LABELS.secondary_sponsors, mobileCols: 'grid-cols-2' },
  { group: 'bearers_flower_girl', label: ROLE_GROUP_LABELS.bearers_flower_girl, mobileCols: 'grid-cols-2' },
  { group: 'officiants', label: ROLE_GROUP_LABELS.officiants, mobileCols: 'grid-cols-2' },
  { group: 'guest', label: 'Guests', mobileCols: 'grid-cols-3' },
];

type GuestSection = {
  key: string;
  label: string | null;
  mobileCols: string;
  guests: GuestRow[];
  count: number;
  /** The honoree's section. Pinned FIRST — no sort or grouping can move it —
   *  and, since 2026-09-21, foldable like the rest: first is about order, not
   *  about staying open (owner: "collapse and expand like an accordion"). */
  pinned?: boolean;
};

/**
 * The order role sections appear in — the roster's curated hierarchy.
 *
 * 🔑 EXPORTED because the page needs the identical order to SORT by role when
 * Role is one of the ordering ticks. Two copies would let the headings and the
 * rows under them disagree about where Principal Sponsors goes.
 */
export const ROLE_SECTION_ORDER: readonly string[] = SECTION_CONFIG.map((c) => c.label);

const SIDE_SECTION_ORDER: readonly string[] = SIDE_ORDER.map((s) => SIDE_LABELS[s]);

const RSVP_SECTION_ORDER: readonly string[] = [
  RSVP_LABELS.attending,
  RSVP_LABELS.pending,
  RSVP_LABELS.maybe,
  RSVP_LABELS.declined,
];

/** What a roster row says under the name of a guest the couple marked "Passed away". */
const PASSED_AWAY_LINE = 'In loving memory · not counted';

function knownBucketOrder(key: ArrangeKey): readonly string[] {
  if (key === 'role') return ROLE_SECTION_ORDER;
  if (key === 'side') return SIDE_SECTION_ORDER;
  if (key === 'rsvp') return RSVP_SECTION_ORDER;
  return [];
}

// Subtle tier label above each section (Bride & Groom / Wedding Party / …).
// When onToggle is provided the header becomes a collapse control (redesign
// Phase 1) — a chevron that hides/shows the section's guests.
function TierHeader({
  label,
  count,
  collapsed,
  onToggle,
  pinned = false,
}: {
  label: string;
  count: number;
  collapsed?: boolean;
  onToggle?: () => void;
  /** The honoree — pinned first; carries the "always first" note. Folds. */
  pinned?: boolean;
}) {
  const labelEls = (
    <>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </h3>
      <span className="text-[11px] text-ink/35">{formatCount(count)}</span>
      {pinned ? (
        <span className="text-[10px] lowercase tracking-normal text-ink/30">
          always first
        </span>
      ) : null}
    </>
  );
  if (!onToggle) {
    return (
      <div className="mb-2 flex items-baseline gap-2">{labelEls}</div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="mb-2 -ml-1 flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-ink/[0.03]"
    >
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-ink/40 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        strokeWidth={2}
        aria-hidden
      />
      {labelEls}
    </button>
  );
}

// Small round photo (or side-tinted initials fallback) for a desktop table
// row — the table's equivalent of the grid card's hero photo.
function RowAvatar({
  guest,
  displayUrl,
}: {
  guest: GuestRow;
  displayUrl?: string;
}) {
  if (displayUrl) {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-ink/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  // Side-identity gradients (Glass PR-3, per the roster proto): bride → gold
  // family, groom → info-slate family, both → a gold↔slate blend, each with a
  // small side dot. White initials read on all three. This is the reference
  // recipe for the whole side-colour language — SIDE_AVATAR in lib/side-colors.
  const s = SIDE_AVATAR[guest.side];
  return (
    <span
      aria-hidden
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#FFFDF8]"
      style={{ background: s.bg }}
    >
      {guestInitials(guest)}
      <span
        className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-[#EFEAE0]"
        style={{ background: s.dot }}
      />
    </span>
  );
}

// Desktop table row (owner 2026-06-05 "row/table style"; redrawn 2026-09-30 to
// the approved Fable rows, then to the full width): ☐ · Name · then one cell per
// COLUMN SLOT — as many as the screen fits, each showing what its header's
// dropdown picked (`lib/roster-columns.ts`). The eye "Quick view" left: a click
// anywhere on the row opens the card on the right. And a walking pair is not on
// the list at all — the Maker's Wedding March owns the processional.
function DesktopRow({
  guest,
  displayUrl,
  selected,
  onToggle,
  nameById,
  columns,
  facts,
}: {
  guest: GuestRow;
  displayUrl?: string;
  selected: boolean;
  onToggle: () => void;
  /** guest_id → display name, built ONCE from the roster — "+1 of <bringer>". */
  nameById: Record<string, string>;
  /** What each slot shows, left → right. */
  columns: readonly RosterColumn[];
  facts: RowFacts;
}) {
  const { eventId } = facts;
  // Desktop inspector selection (Inspector P2): the open row wears the gild wash
  // with a bar on its left (owner 2026-09-30, frame F — the same colour as a
  // ticked row, because both mean "this row is in hand").
  const inspectorCtx = useInspectorContext();
  const inspected = Boolean(inspectorCtx && inspectorCtx.selectedId === guest.guest_id);
  // Frame G (owner 2026-09-29): "+3 (2 named)", an unnamed seat reads "+2 · TBA".
  const extraSeats = useBringerSeats(guest.guest_id);
  const seatLabel = usePlaceholderLabel(guest.guest_id);
  const shownName = seatLabel ?? guestFullName(guest) ?? guestDisplayName(guest);
  const bringer = guest.plus_one_of_guest_id ? (nameById[guest.plus_one_of_guest_id] ?? null) : null;
  const openRef = useRef<HTMLTableRowElement>(null);
  return (
    <tr
      className={`group/row cursor-pointer border-t border-ink/5 align-middle transition-colors ${
        selected || inspected
          ? 'bg-[var(--sn-gold-100)] shadow-[inset_3px_0_0_var(--sn-gold-500,#b8923a)]'
          : 'hover:bg-ink/[0.025]'
      }`}
      ref={openRef}
      /* "Open · click anywhere on the row" (frame F): a click that lands on no
         control of its own opens the card, through the name's own trigger. */
      onClick={(e) => {
        // The same rule as the phone card's white space (row-tap.ts) — one rule.
        if (!isWhiteSpaceTap(e.target, e.currentTarget)) return;
        openRef.current?.querySelector<HTMLAnchorElement>('a.sn-guest-namelink')?.click();
      }}
      title="Open · click anywhere on the row"
      data-row-open=""
    >
      <td className="px-3 py-2.5">
        {/* The box shows on hover, and stays once anything is ticked (frame G). */}
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${(guestFullName(guest) ?? guestDisplayName(guest))}`}
            className="h-4 w-4 rounded border-ink/30 text-terracotta opacity-40 transition-opacity focus:opacity-100 focus:ring-terracotta group-hover/row:opacity-100 checked:opacity-100"
          />
        </label>
      </td>
      <td className="px-3 py-2.5">
        {/* A +1 sits indented under the guest who brings them (frame B). */}
        <div className={`flex min-w-0 items-center gap-2 ${bringer ? 'pl-5' : ''}`}>
          <InspectorTrigger
            inspectId={guest.guest_id}
            href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
            className="sn-guest-namelink flex min-w-0 flex-1 items-center gap-3 rounded-md"
          >
            <RowAvatar guest={guest} displayUrl={displayUrl} />
            <div className="min-w-0">
              {/* `title` so a name the column still cannot fit is RECOVERABLE. */}
              <p className="truncate font-display text-[15px] text-ink" title={shownName}>
                {shownName}
              </p>
              {/* 🕯 Listed, never counted — the guest card's "Passed away". */}
              {guest.passed_away ? (
                <p className="truncate text-xs text-ink/55" data-passed-away="">
                  {PASSED_AWAY_LINE}
                </p>
              ) : bringer ? (
                <p className="truncate text-xs text-ink/55" data-plus-one-of="">
                  +1 of {bringer}
                </p>
              ) : null}
            </div>
          </InspectorTrigger>
          {/* ⚖ The dashed "+" add-to-group on EVERY computer row too (owner
              2026-10-01, "this also should be visible on desktop mode?" → yes:
              desktop may show more, never different). The phone row has it
              after the role; here it sits beside the name — unless the Groups
              column is showing, which already carries the same control. */}
          {!columns.includes('groups') && !guest.passed_away ? (
            <span className="shrink-0" data-desk-add-to-group="">
              <AddToGroupControl
                eventId={eventId}
                guest={guest}
                groups={facts.groups}
                memberGroupIds={facts.groupMemberships[guest.guest_id] ?? []}
              />
            </span>
          ) : null}
        </div>
        {/* More names than seats — allowed, and said, with a Remove per name.
            OUTSIDE the name trigger: a button cannot sit inside a link. */}
        <PlusOneOverNote
          eventId={eventId}
          guestName={shownName}
          count={plusOneSeats(guest)}
          seats={extraSeats}
        />
      </td>
      {columns.map((column) => (
        <td key={column} className="px-3 py-2.5" data-roster-cell={column}>
          <RosterCell column={column} guest={guest} facts={facts} size="row" />
        </td>
      ))}
    </tr>
  );
}

/**
 * What every row's cells need that is not the guest — built ONCE per render of
 * the list, so a row never re-derives a lookup a hundred rows share.
 */
type RowFacts = {
  eventId: string;
  palette: RolePalette;
  invite: GuestInviteSetup | null;
  groups: GuestGroupWithCount[];
  groupsById: Record<string, GuestGroupWithCount>;
  groupMemberships: Record<string, string[]>;
  currentGroupId: string | null;
  bulkRoleSections: RoleSection[];
  seatByGuest: Record<string, { placed: string | null; suggested: string | null }>;
  /** An account holds this invitation; null = not measured. */
  linkedOf: (guestId: string) => boolean | null;
  /** guest_id → when they arrived; null = not read (before the day) or refused. */
  checkins: Readonly<Record<string, string>> | null;
};

const DASH = <span className="text-xs text-ink/40">—</span>;

/**
 * ONE CELL, ANY COLUMN — the same control for a column wherever it is drawn
 * (owner 2026-09-30: "each cell uses the same control everywhere"): the desktop
 * row's slots and the phone row's one slot both come through here, so a column
 * cannot mean one thing on a computer and another on a phone.
 *
 *   · Invite  — `GuestInviteCell` (Invite · ⋯ + status); the hosts read Host.
 *   · RSVP    — the reply pill, ONE dropdown.
 *   · Access  — `GuestAccessCell` (#6191), the card's Access line.
 *   · Check-in — `GuestCheckinCell`, the desk's own actions.
 *   · Seat · Side · Role · Groups · +N — the shipped chip editors.
 *   · Account — Linked / Not linked, "—" when nobody measured.
 *   · Contact — the mobile as tap-to-call. Never an email (no email to guests).
 */
function RosterCell({
  column,
  guest,
  facts,
  size,
}: {
  column: RosterColumn;
  guest: GuestRow;
  facts: RowFacts;
  size: 'row' | 'phone';
}) {
  const { eventId } = facts;
  const isHost = HOST_ROLES.has(guest.role);
  const extraSeats = useBringerSeats(guest.guest_id);
  const seat = facts.seatByGuest[guest.guest_id];
  const linked = facts.linkedOf(guest.guest_id);
  switch (column) {
    case 'invite':
      // Invite · ⋯ with the status under it. The bride's row says Host — they
      // are the hosts, nothing to send.
      if (isHost) return <span className="text-xs font-medium text-ink/55">Host</span>;
      if (guest.passed_away) return <span className="text-xs text-ink/45">Remembered</span>;
      return <RowInvite eventId={eventId} guest={guest} invite={facts.invite} size={size} linked={linked} />;
    case 'rsvp':
      if (guest.passed_away) return DASH;
      return (
        <RsvpChipEditor eventId={eventId} guest={guest} seatedTableLabel={seat?.placed ?? null}>
          <RsvpText status={guest.rsvp_status} host={isHost} />
        </RsvpChipEditor>
      );
    case 'access':
      return <RowAccess eventId={eventId} guest={guest} size={size} />;
    case 'checkin': {
      // A request nobody accepted admits nobody (the desk refuses it too); a
      // refused read says "—", never "Check in" for everybody.
      if (guest.passed_away || guest.entry_source === REQUEST_ENTRY_SOURCE || facts.checkins === null) return DASH;
      return (
        <GuestCheckinCell
          eventId={eventId}
          guestId={guest.guest_id}
          name={guestDisplayName(guest)}
          checkedInAt={facts.checkins[guest.guest_id] ?? null}
        />
      );
    }
    case 'seat':
      // Placed · suggested until placed · a dash when none or not coming.
      return (
        <SeatChip
          placed={seat?.placed ?? null}
          suggested={seat?.suggested ?? null}
          rsvp={guest.rsvp_status}
          plusOnes={0}
          plain
        />
      );
    case 'side':
      return (
        <SideChipEditor eventId={eventId} guest={guest}>
          <SideText side={guest.side} />
        </SideChipEditor>
      );
    case 'role':
      return (
        <RoleChipEditor eventId={eventId} guest={guest} roleSections={facts.bulkRoleSections}>
          <RoleTexts guest={guest} palette={facts.palette} />
        </RoleChipEditor>
      );
    case 'groups': {
      const groupIds = facts.groupMemberships[guest.guest_id] ?? [];
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <GroupChipList
            eventId={eventId}
            guestId={guest.guest_id}
            groupIds={groupIds}
            groupsById={facts.groupsById}
            currentGroupId={facts.currentGroupId}
            compact
            plain
          />
          <AddToGroupControl eventId={eventId} guest={guest} groups={facts.groups} memberGroupIds={groupIds} />
        </div>
      );
    }
    case 'plus':
      // +N — the host's number; a dash when there is nothing to say.
      if (isHost || guest.rsvp_status === 'declined' || guest.passed_away) return DASH;
      return (
        <div className="space-y-0.5">
          <PlusOneChipEditor eventId={eventId} guest={guest} />
          {/* "+3 (2 named)" — how many of the seats already have a name. */}
          {extraSeats.some((s) => s.named) ? (
            <p className="whitespace-nowrap text-[11px] text-ink/55">
              <PlusOneSeatsSummary count={plusOneSeats(guest)} seats={extraSeats} />
            </p>
          ) : null}
        </div>
      );
    case 'account':
      if (linked === null) return DASH;
      return linked ? (
        <span className="text-xs font-medium text-success-800">Linked</span>
      ) : (
        <span className="text-xs text-ink/55">Not linked</span>
      );
    case 'contact':
      return <ContactCell mobile={guest.mobile} name={guestDisplayName(guest)} />;
  }
}

/**
 * The Contact column — the guest's mobile, one tap to call. Rule 1 allows a
 * guest's contact "only for the couple and if coordinator is given access"
 * (owner 2026-09-14), and this list renders only behind guest_list access —
 * billed in `no-door-out-of-the-app.test.ts`. No email: nothing on this list
 * writes to a guest by email (owner 2026-09-30).
 */
function ContactCell({ mobile, name }: { mobile: string | null; name: string }) {
  const number = mobile?.trim();
  if (!number) return DASH;
  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, '')}`}
      aria-label={`Call ${name}`}
      className="inline-flex min-h-[36px] items-center whitespace-nowrap text-xs text-ink/70 underline-offset-4 hover:text-ink hover:underline"
    >
      {number}
    </a>
  );
}

/**
 * One row's Access control — the card's Access line in a row's width
 * (`guest-access-cell.tsx`), reading the state the page loaded once. A guest
 * the read did not answer for gets "—": a refused read must not render as
 * "None" on every co-host.
 */
function RowAccess({
  eventId,
  guest,
  size,
}: {
  eventId: string;
  guest: GuestRow;
  size: 'row' | 'phone';
}) {
  const { byGuest, canManage } = useContext(GuestAccessContext);
  const state = byGuest[guest.guest_id];
  if (!state) return DASH;
  return (
    <GuestAccessCell
      eventId={eventId}
      guestId={guest.guest_id}
      firstName={guest.first_name}
      state={state}
      canManage={canManage}
      size={size}
    />
  );
}

/**
 * A slot's header — ONE dropdown choosing what the column shows (owner
 * 2026-09-30: "allow dropdown to each column like mobile mode"). Picking a
 * column already shown elsewhere swaps the two, so nothing shows twice.
 */
function ColumnPick({
  slot,
  column,
  available,
  onPick,
  label,
}: {
  slot: number;
  column: RosterColumn;
  available: readonly RosterColumn[];
  onPick: (slot: number, column: RosterColumn) => void;
  label: string;
}) {
  return (
    <PickMenu
      compact
      label={label}
      value={column}
      buttonText={ROSTER_COLUMN_LABEL[column]}
      options={available.map((c) => ({ key: c, label: ROSTER_COLUMN_LABEL[c] }))}
      onPick={(key) => onPick(slot, key as RosterColumn)}
      dataAttr="data-roster-column-pick"
    />
  );
}

type Props = {
  eventId: string;
  guests: GuestRow[];
  palette: RolePalette;
  groups: GuestGroupWithCount[];
  groupMemberships: Record<string, string[]>; // guest_id → group_id[]
  currentGroupId: string | null;
  // Self-join requests (Living Roster P2): guest_ids of unlisted joiners
  // (entry_source='self_added_unlisted'). Since 2026-09-30 (the Fable rows,
  // frame D) they are NEVER rows between real guests — the page's one strip
  // under the title leads to the Requests page — so these are left out here.
  selfJoinIds: string[];
  /**
   * The Account column — guest_ids an account holds (`event_members.guest_id`).
   * null when the read was refused: the column then says "—", never a
   * confident "Not linked" nobody measured.
   */
  linkedGuestIds?: readonly string[] | null;
  /** The event's tables, for the bulk bar's Set table ▾. */
  tables?: readonly { tableId: string; label: string }[];
  // Reactive seat column (Living Roster P3), keyed by guest_id: `placed` = the
  // guest's live assignment's table label (null when unseated); `suggested` = the
  // pure per-row seat-suggest hint (null when seated/declined/no tables).
  // Computed server-side in page.tsx over the same filtered `visible` set.
  seatByGuest: Record<string, { placed: string | null; suggested: string | null }>;
  // guest.photo_url (the stored r2:// ref or raw Google avatar URL) →
  // resolved display URL, signed server-side in page.tsx. Cards look their
  // photo up here; a miss falls back to side-tinted initials.
  photoDisplayUrls: Record<string, string>;
  /**
   * guest_id → the photo on their LINKED ACCOUNT, already resolved to a display
   * URL. The fallback when the couple has uploaded none — see
   * lib/guest-account-photos.ts for why the couple's own upload wins.
   */
  accountFaceByGuest: Record<string, string>;
  // Which sectioning the list uses (redesign Phase 1) — derived from the sort
  // control: 'importance' = role-tier sections (default), 'side' = group by the
  // couple's side, 'flat' = one uniform grid (name / rsvp / newest sorts).
  /** Ordered grouping keys from `?by=` (empty = one list, no headings). */
  grouping: readonly ArrangeKey[];
  /** The live `?sort=`, so a header can show which column is ordering. */
  sort: string;
  // Iteration 0053 P4 Unit 5: the event's role-set key, driving the bulk-assign
  // picker sections. Optional (defaults to wedding → byte-identical).
  roleSetKey?: string | null;
  // Success flags from the bulk-action redirects, used to reset the floating
  // SelectionBar once the action lands (the selection store is a module
  // singleton that the navigation alone doesn't clear). `recentlyDeleted` =
  // the `?bulk_deleted=N` flag (delete prunes the gone guests); `recentlyApplied`
  // = any of `?bulk_assigned|bulk_grouped|bulk_sided` (apply clears the bar so
  // the host isn't left with a stale selection after assigning a role/side/group).
  recentlyDeleted?: string;
  recentlyApplied?: boolean;
  /** The guest list is finalized — extra seats stop being editable (owner 2026-09-21). */
  listFinalized?: boolean;
  /** False on an event with no sides (birthday, Simple Event): no Side column,
   *  no side bulk-assign, no side grouping (owner 2026-09-30). Default true. */
  hasSides?: boolean;
  /**
   * guest_id → the guest's Access (None · Co-host · Limited helper, live or
   * waiting) from the live seats — `loadGuestAccessMap`, ONE read by the page.
   * A guest absent from it (a refused read) gets no Access cell at all, never
   * a false "None". The Access column draws and changes it (owner 2026-09-28).
   */
  accessByGuest?: Readonly<Record<string, GuestAccessState>>;
  /** The viewer is a co-host (`couple` member) — the only one who may change
   *  Access; the action refuses everyone else, so the column offers no dropdown. */
  canManageAccess?: boolean;
  /**
   * The Check-in column (owner 2026-09-30) — guest_id → when they arrived.
   * Only read from the event day (`checkinOpen`); null when the read was
   * refused, and the column then says "—" rather than "Check in" for everybody.
   */
  checkins?: Readonly<Record<string, string>> | null;
  /** The event day or after — Check-in is a column choice, and leads. */
  checkinOpen?: boolean;
  /**
   * Every guest's extra seats, from the FULL roster (`bringerSeatsFrom`, built
   * in page.tsx before any filter): "+3 (2 named)", "+2 · TBA", and the
   * "3 named · 1 allowed" warning (owner 2026-09-29, frame G).
   */
  seatsByBringer?: Readonly<Record<string, readonly BringerSeat[]>>;
  /**
   * The Invite column (owner 2026-09-30) — what every row's `GuestInviteCell`
   * needs that is not the guest: the base each guest's own link is built from,
   * and the event's words (`loadInviteSetup`, read ONCE by the page). null →
   * no link can be built, so every row says "—" rather than a control that
   * would copy a message with no link in it.
   */
  invite?: GuestInviteSetup | null;
};

/** The page's one read for the Invite column — see `Props.invite`. */
export type GuestInviteSetup = {
  base: string;
  facts: InviteEventFacts;
  template: string | null;
};

/**
 * One row's Invite control — or nothing. The SAME rule as the guest card's
 * Send invite (`guest-card-body.tsx`): the couple do not invite themselves, and
 * nothing is offered for a guest marked Passed away.
 */
function RowInvite({
  eventId,
  guest,
  invite,
  size,
  linked,
}: {
  eventId: string;
  guest: GuestRow;
  invite: GuestInviteSetup | null;
  size: 'row' | 'phone';
  linked: boolean | null;
}) {
  if (guest.role === 'bride' || guest.role === 'groom' || guest.passed_away) return null;
  if (!invite) {
    return size === 'row' ? <span className="text-xs text-ink/40">—</span> : null;
  }
  const inviteUrl = guest.qr_token ? invitationLinkOn(invite.base, guest.qr_token) : null;
  return (
    <GuestInviteCell
      eventId={eventId}
      layout={size}
      linked={linked}
      /* ⋯ — the same list as the card's (Write to NFC · New QR · Unlink). */
      more={
        <GuestMoreMenu
          eventId={eventId}
          guestId={guest.guest_id}
          guestName={guestDisplayName(guest)}
          nfcUrl={inviteUrl}
          linked={linked === true}
          returnTo={`/dashboard/${eventId}/guests`}
        />
      }
      guest={{
        guestId: guest.guest_id,
        formalName: guestFullName(guest, invite.facts.nameStyle),
        firstName: guest.first_name,
        fullName: guestDisplayName(guest),
        inviteUrl,
        sentAt: guest.invitation_sent_at,
        hasTicket: guestHasTicket(guest),
      }}
      facts={invite.facts}
      template={invite.template}
    />
  );
}

const NO_SEATS: Readonly<Record<string, readonly BringerSeat[]>> = {};
const NO_ACCESS: Readonly<Record<string, GuestAccessState>> = {};

/** The hosts' rows — no Invite, the reply reads Always. The RSVP and role LOCKS stay in their editors. */
const HOST_ROLES: ReadonlySet<string> = new Set(['bride', 'groom']);


export function GuestListMultiselect({
  eventId,
  guests,
  palette,
  groups,
  groupMemberships,
  currentGroupId,
  selfJoinIds,
  seatByGuest,
  photoDisplayUrls,
  accountFaceByGuest,
  grouping,
  sort,
  roleSetKey,
  recentlyDeleted,
  recentlyApplied,
  listFinalized = false,
  hasSides = true,
  accessByGuest = NO_ACCESS,
  canManageAccess = false,
  checkins = null,
  checkinOpen = false,
  seatsByBringer = NO_SEATS,
  invite = null,
  linkedGuestIds = null,
  tables = [],
}: Props) {
  const linkedSet = useMemo(() => (linkedGuestIds ? new Set(linkedGuestIds) : null), [linkedGuestIds]);
  // Per-event-type bulk-assign sections (iteration 0053 P4 Unit 5). Reused as
  // the role-editor popover's option groups (P2).
  /**
   * The face for one row, resolved in ONE place because six surfaces ask for it
   * (the roster, both mobile lists, the grid, and two self-join variants).
   *
   * ⚖ Owner 2026-09-20: a guest whose row is linked to an account wears that
   * account's photo when the couple has uploaded none. The couple's own upload
   * — or the guest's RSVP selfie — always wins: it was chosen for THIS wedding.
   *
   * 🔑 The six call sites used to spell this lookup out individually. That is
   * how five of them would have got the fallback and the sixth would not, and
   * one guest would have had a face in the list and initials in the grid.
   */
  const faceFor = (g: GuestRow): string | undefined =>
    photoDisplayUrls[g.photo_url ?? ''] ?? accountFaceByGuest[g.guest_id];

  const bulkRoleSections = useMemo(() => bulkRoleSectionsFor(roleSetKey), [roleSetKey]);
  // The couple's words for roles (owner 2026-09-30) — headings are drawn in them.
  const roleNames = useRoleNames();
  // Which visible rows are unlisted self-joiners → render the blush needs-you
  // variant instead of the normal editable row.
  // Selection lives in the shared external store so the mobile carousel's
  // Customize panel (a sibling component) shows the live count / select-all
  // and the desktop SelectionBar stay in lockstep (owner directive
  // 2026-06-03). `selectMode` only gates the MOBILE card checkbox; the
  // desktop grid keeps its always-interactive checkbox overlay.
  const { selectMode, ids: selectedIds, set: selectedSet } = useGuestSelection();


  // Optimistic overlay (Living Roster P1): a soft-delete hides its rows
  // instantly, before the server round-trip, and an undo restores them. The
  // overlay lives in its own module store (like `guestSelection`) so the delete
  // button, the rows, and this reconcile all share it.
  const optimistic = useGuestOptimistic();
  // Reconcile-by-id every time a fresh server list arrives: once the soft-delete
  // has propagated (the guest is gone from `guests`), prune it from the overlay.
  // Idempotent, so it never flips a row twice.
  useEffect(() => {
    guestOptimistic.reconcile(guests);
  }, [guests]);
  // Project the SSR list through the overlay — everything below renders from
  // `rosterGuests`, so optimistically-removed guests vanish immediately.
  const rosterGuests = useMemo(
    () => plusOnesUnderBringers(projectGuests(guests, optimistic).filter((g) => !selfJoinIds.includes(g.guest_id))),
    [guests, optimistic, selfJoinIds],
  );
  const guestsById = useMemo(() => new Map(rosterGuests.map((g) => [g.guest_id, g] as const)), [rosterGuests]);

  // guest_id → display name, for "+1 of <bringer>" — from the roster in hand.
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of rosterGuests) map[g.guest_id] = guestDisplayName(g);
    return map;
  }, [rosterGuests]);

  // The Access column's one context value — a fresh object per render would
  // re-render every row's cell on every keystroke in the search box.
  const accessCtx = useMemo(
    () => ({ byGuest: accessByGuest, canManage: canManageAccess }),
    [accessByGuest, canManageAccess],
  );

  // ── THE COLUMN SLOTS (owner 2026-09-30, "THE GUEST LIST USES THE FULL
  // WIDTH"): which columns this list can show, in their default order — Invite
  // leads while anybody is still to be sent theirs; from the event day
  // Check-in leads. The desktop fits as many as its width allows; the phone
  // shows ONE beside the name. Each device remembers its own picks.
  const anyUnsent = useMemo(
    () =>
      rosterGuests.some(
        (g) =>
          !HOST_ROLES.has(g.role) &&
          !g.passed_away &&
          g.entry_source !== REQUEST_ENTRY_SOURCE &&
          !g.invitation_sent_at &&
          g.rsvp_status !== 'declined',
      ),
    [rosterGuests],
  );
  const availableColumns = useMemo(
    () => defaultRosterColumns({ anyUnsent, checkinOpen, hasSides }),
    [anyUnsent, checkinOpen, hasSides],
  );
  const desk = useRosterColumns({ storageKey: 'sn:guest-list-columns:v1', defaults: availableColumns });
  const phone = useRosterColumns({
    storageKey: 'sn:guest-list-columns:phone:v1',
    defaults: availableColumns,
    fixedSlots: 1,
  });
  const phoneColumn = phone.columns[0] ?? 'invite';
  // The phone's Show ▾ is drawn behind the title's ⋯ (frame 2 of the approved
  // simple phone app) — the SAME pick, published for that sheet to read.
  const phonePick = phone.pick;
  useEffect(() => {
    publishPhoneColumn({ column: phoneColumn, available: availableColumns, pick: (c) => phonePick(0, c) });
    return () => publishPhoneColumn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneColumn, availableColumns]);

  // Collapsed section keys (redesign Phase 1) — client-only, resets on reload.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Exclude self-join (needs-you) rows: they render WITHOUT a checkbox and are
  // managed only via their inline Keep/Link/Remove, so they must never be swept
  // into select-all or the SelectionBar bulk actions — and keeping them out lets
  // allSelected/someSelected be reached by clicking the visible checkboxes.
  const allIds = useMemo(
    () => rosterGuests.map((g) => g.guest_id),
    [rosterGuests],
  );
  const allSelected =
    selectedIds.length > 0 && selectedIds.length === allIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  // Keep the latest selection in a ref so the reset effect below can read it
  // WITHOUT re-subscribing to every toggle. The reset must fire once per
  // bulk-action navigation, not each time the host (re)selects a guest while a
  // success flag still sits in the URL — otherwise Apply's clear would wipe a
  // fresh selection the instant it's made.
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Reset the floating SelectionBar after a completed bulk action. The server
  // action soft-deletes / applies, then redirects here with a success flag
  // (a client-side nav) + revalidates — but the module-singleton selection
  // store still holds the acted-on IDs, so the bar would linger on
  // "N selected / Delete N". `allIds` gets a fresh reference on every server
  // re-render, so it's the per-navigation trigger (and makes a repeat action
  // with the same N still re-run). Filter/search/sort nav carries no flag, so
  // selections made there are never touched.
  useEffect(() => {
    if (!recentlyApplied && !recentlyDeleted) return;
    const cur = selectedIdsRef.current;
    if (cur.length === 0) return;
    // Which selected guests survive the action:
    //   • Apply (role/side/group) — none; the host asked the bar to clear too.
    //   • Delete — those still in the list (the removed ones are already gone).
    const keep = recentlyApplied ? null : new Set(allIds);
    const next = keep ? cur.filter((id) => keep.has(id)) : [];
    if (next.length !== cur.length) guestSelection.setAll(next);
  }, [recentlyApplied, recentlyDeleted, allIds]);

  // group_id → group, built once instead of per-card (the old table rebuilt
  // this Object.fromEntries inside every row's render).
  const groupsById = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.group_id, g])),
    [groups],
  );

  const facts: RowFacts = useMemo(
    () => ({
      eventId,
      palette,
      invite,
      groups,
      groupsById,
      groupMemberships,
      currentGroupId,
      bulkRoleSections,
      seatByGuest,
      linkedOf: (id: string) => (linkedSet ? linkedSet.has(id) : null),
      checkins: checkinOpen ? checkins : null,
    }),
    [
      eventId,
      palette,
      invite,
      groups,
      groupsById,
      groupMemberships,
      currentGroupId,
      bulkRoleSections,
      seatByGuest,
      linkedSet,
      checkinOpen,
      checkins,
    ],
  );

  /*
    ⚖ Owner 2026-09-21: *"pressing it will deselect everything as well."* So
    with ANYTHING selected — all of it, or a few (the dash state) — the header
    box clears; with nothing selected it ticks everyone in view.
  */
  const toggleAll = () =>
    selectedIds.length > 0 ? guestSelection.clear() : guestSelection.selectAllInView(allIds);

  // Sections derived from the sort control (redesign Phase 1): role tiers
  // (importance · default), by-side, or one flat grid. Built from the already-
  // sorted `guests`, so order within a section holds + the couple-pin survives.
  // Built WHOLE — what is folded is applied once, below (`foldSections`).
  const builtSections = useMemo(() => {
    const groupKey = groupingKeyOf(grouping);
    // No grouping is a real answer: one list, no headings. The honoree still
    // leads it, because the PIN lives in the sort (page.tsx sortCompare), not
    // in the sectioning — which is the whole reason it survives every sort.
    if (groupKey === null)
      return [
        {
          key: 'all',
          label: null,
          mobileCols: 'grid-cols-2',
          count: rosterGuests.length,
          guests: rosterGuests,
        } satisfies GuestSection,
      ];

    // Each guest's first custom group (alphabetical) → the label to bucket by.
    const groupLabelById = new Map<string, string>();
    for (const g of rosterGuests) {
      let best: string | null = null;
      for (const id of groupMemberships[g.guest_id] ?? []) {
        const grp = groupsById[id];
        if (!grp) continue;
        if (!best || grp.label.localeCompare(best) < 0) best = grp.label;
      }
      if (best) groupLabelById.set(g.guest_id, best);
    }

    // A +1 is bucketed with the guest who brings them — sorting or grouping
    // never separates the two (owner 2026-09-30, frame B).
    const lead = (g: GuestRow): GuestRow =>
      (g.plus_one_of_guest_id ? guestsById.get(g.plus_one_of_guest_id) : undefined) ?? g;
    const ctx0: ArrangeCtx<GuestRow> = {
      lastName: (g) => g.last_name,
      sideLabel: (g) => SIDE_LABELS[g.side],
      roleGroupLabel: (g) => {
        const grp = importanceGroupOf([g.role, ...(g.extra_roles ?? [])]);
        return grp === 'guest' || grp === 'other_roles'
          ? 'Guests'
          : ROLE_GROUP_LABELS[grp];
      },
      groupLabel: (g) => groupLabelById.get(g.guest_id) ?? null,
      rsvpLabel: (g) => RSVP_LABELS[g.rsvp_status],
      seatLabel: (g) => {
        const seat = seatByGuest[g.guest_id];
        if (seat?.placed) return tableWords(seat.placed);
        if (seat?.suggested) return `Suggested ${tableWords(seat.suggested)}`;
        return null;
      },
      // Ordering by seat needs the TIER, not the label — see the ctx docblock.
      seatRank: (g) => {
        const seat = seatByGuest[g.guest_id];
        if (seat?.placed) return [0, seat.placed];
        if (seat?.suggested) return [1, seat.suggested];
        return [2, ''];
      },
    };
    const ctx: ArrangeCtx<GuestRow> = {
      lastName: (g) => ctx0.lastName(lead(g)),
      sideLabel: (g) => ctx0.sideLabel(lead(g)),
      roleGroupLabel: (g) => ctx0.roleGroupLabel(lead(g)),
      groupLabel: (g) => ctx0.groupLabel(lead(g)),
      rsvpLabel: (g) => ctx0.rsvpLabel(lead(g)),
      seatLabel: (g) => ctx0.seatLabel(lead(g)),
      seatRank: (g) => ctx0.seatRank(lead(g)),
    };

    // ⛔ THE HONOREE IS PULLED OUT BEFORE ANY BUCKETING. Left in, they would
    // scatter — the celebrant under "No group yet", the bride under her own
    // side — and "the first one will always be the celebrant" would hold only
    // until somebody ticked a box. With the default grouping (`role`) this is
    // byte-identical to what shipped: their role section was already first.
    const honorees: GuestRow[] = [];
    const rest: GuestRow[] = [];
    for (const g of rosterGuests) (isHonoreeRole(g.role) ? honorees : rest).push(g);

    const out: GuestSection[] = [];
    if (honorees.length) {
      const grp = roleGroupOf(honorees[0]!.role);
      out.push({
        key: 'honoree',
        label: grp === 'guest' ? 'Guests' : ROLE_GROUP_LABELS[grp],
        mobileCols: 'grid-cols-2',
        count: honorees.length,
        // Folds like every other section — owner 2026-09-21: "these rows
        // should be able to make the content of that grouping collapse and
        // expand like an accordion." Pinned means FIRST, not always-open: a
        // folded honoree heading is still the first heading on the list.
        guests: honorees,
        pinned: true,
      });
    }
    // ⚖ ONLY THE FIRST TICKED COLUMN MAKES HEADINGS (owner 2026-09-20). The
    // rest only ORDER, and that ordering is already applied — the page sorted
    // `rosterGuests` by them before this component saw a row, so bucketing
    // preserves it. Doing it here as well would be a second sort that could
    // disagree with the first.
    for (const sec of buildRosterSections(rest, groupKey, ctx, knownBucketOrder)) {
      out.push({
        key: sec.key,
        // The bucket key stays the usual word (it is what the order ranks
        // by); only the heading a host READS takes their word.
        label: sec.label === null ? null : sectionHeadingInTheirWords(sec.label, roleNames),
        mobileCols: 'grid-cols-2',
        count: sec.count,
        guests: sec.guests,
      });
    }
    return out;
  }, [
    rosterGuests,
    guestsById,
    grouping,
    groupMemberships,
    groupsById,
    seatByGuest,
    roleNames,
  ]);
  // ⚖ EVERY HEADING FOLDS, THE PINNED HONOREE TOO (measured live 2026-10-03:
  // "Bride & Groom" flipped aria-expanded and its cards stayed). ONE place
  // empties a folded section — the same line for every key — and both the
  // table and the phone list render only from `sections`.
  const sections = useMemo(() => foldSections(builtSections, collapsed), [builtSections, collapsed]);

  return (
    <GuestListFinalizedContext.Provider value={listFinalized}>
    <GuestListHasSidesContext.Provider value={hasSides}>
    <GuestAccessContext.Provider value={accessCtx}>
    <BringerSeatsProvider seats={seatsByBringer}>
    <div className="space-y-4">
      {/* The bulk bar — every width, floating at the bottom (owner 2026-09-30,
          frames C and G). On a phone a long press starts picking; on a
          computer, the row's box. */}
      {/* ⚖ Drawn whenever the list is SELECTING, not only while something is
          ticked — its Done is the way out of select mode (owner, live iPhone
          test 2026-10-02: "after deselecting there was no Done button"). */}
      {selectedIds.length > 0 || selectMode ? (
        <RosterBulkBar
          eventId={eventId}
          selectedIds={selectedIds}
          guestsById={guestsById}
          groups={groups}
          tables={tables}
          bulkRoleSections={bulkRoleSections}
          selectMode={selectMode}
          allIds={allIds}
        />
      ) : null}

      {/* Guest list — owner 2026-06-05. DESKTOP is a row/table layout ("guest
          on desktop mode will be row/table style not grid style"); MOBILE stays
          the tiered photo grid below. Both are importance-ordered (Bride #1 ·
          Groom #2 · then role) and built from the SAME `guestSelection` store,
          so the SelectionBar + select-all + carousel lockstep all hold. */}

      {/* Desktop · row/table. Photo thumbnail in the Name cell; when grouped
          (the importance sort · default) a tier header row precedes each tier's
          rows, else a flat table. The thead checkbox is select-all. */}
      {/* Glass roster panel (Glass PR-3 §1.6) — ONE blurred wrapper; the <tr>
          rows stay opaque (hairline dividers, translucent hover/selected tints)
          so hundreds of rows never each carry a blur layer. */}
      <div
        /* 🪤 `lg`, NOT `sm` — AND `overflow-x-auto`, NOT `hidden`.
           Three breakpoints described ONE decision and had drifted apart: the
           table showed from `sm` (640px), the card grid hid from `sm`, and the
           bulk-action bar only appeared at `lg` (1024px). So between 640 and
           1023 a host got the seven-column table AND no bulk actions at all —
           and the table, clipped by `overflow-hidden`, OVERLAPPED its own
           columns (the owner's phone showed "~Table 3" printed on top of a
           mobile number).
           The directive above this component already says phones AND TABLETS
           use the carousel's Customize + Assign sheets, so `lg` is what that
           sentence always meant. `overflow-x-auto` is belt-and-braces: at any
           width the table now SCROLLS instead of stacking cells on each
           other. */
        ref={desk.ref}
        className="hidden overflow-x-auto rounded-tile border lg:block"
        data-roster-slots={desk.columns.length}
        style={{
          background: 'var(--sn-glass-bg)',
          borderColor: 'var(--sn-glass-line)',
          backdropFilter: 'var(--sn-glass-blur)',
          WebkitBackdropFilter: 'var(--sn-glass-blur)',
          boxShadow: 'var(--sn-sh-tile)',
        }}
      >
        <table className="w-full table-fixed text-left text-sm">
          <thead
            // ⚖ Owner 2026-09-21: "make the header all caps and readable" →
            // "still not readable". It was 11px SPACE MONO capitals, 0.12em apart,
            // at 55% ink — the widest face in the app at its smallest size, and
            // monospace capitals are the hardest small text there is to read.
            // Now the dashboard's text face (Hanken Grotesk via font-sans) at
            // 12px, semibold, 0.06em, 70% ink: easier to read AND narrower,
            // which is what actually stops SIDE and CONTACT being cut off.
            // 🪤 The weight is ALSO set on every cell below: a header cell carries
            // the browser's own `font-weight: bold`, which beats the row's
            // semibold — measured at 700 until each cell said 600 itself.
            className="border-b border-ink/[0.07] font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/70"
          >
            <tr>
              {/* 🪤 THE HEADER MUST RESERVE THE ROW'S EDGE. Every body row's first
                  cell carries a 2px side rule; without a matching (transparent)
                  one here the header labels sit 2px off every column beneath
                  them — a misalignment invisible in a diff and obvious on screen. */}
              <th className="w-10 px-3 py-2.5 font-semibold">
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={
                      selectedIds.length > 0 ? 'Clear selection' : 'Select all guests in view'
                    }
                    className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                  />
                </label>
              </th>
              {/* ⚖ Owner 2026-09-30: Name first and widest, then as many
                  column SLOTS as the width fits, each header ONE dropdown
                  choosing what that column shows (no column twice — picking
                  one already shown swaps the two). Words only: Sort ▾ above the
                  list is the one place for order. Every header cell clips its
                  own word (`overflow-hidden`), so no label can widen the table. */}
              <th className="overflow-hidden px-3 py-2.5 font-semibold"><span className="block truncate">Name</span></th>
              {desk.columns.map((column, slot) => (
                <th
                  key={column}
                  /* Every slot is SLOT_PX wide — the same number the slot
                     count is computed from, so Name always keeps the rest.
                     The dropdown's list is portalled, so clipping the cell
                     never clips the menu. */
                  style={{ width: SLOT_PX }}
                  className="overflow-hidden px-3 py-2 font-semibold normal-case tracking-normal"
                  data-roster-slot={slot}
                >
                  <span className="flex items-center gap-1">
                    <ColumnPick
                      slot={slot}
                      column={column}
                      available={availableColumns}
                      onPick={desk.pick}
                      label={`Column ${slot + 1} shows`}
                    />
                    {column === 'invite' ? (
                      <InfoTip label="Invite" labelClassName="sr-only" align="end" ariaLabel="How Invite works">
                        <span className="block normal-case tracking-normal font-normal">
                          Each guest has their own ticket. Invite sends the message, their link and their
                          ticket together. On a computer: copy the message, then copy the ticket.
                        </span>
                      </InfoTip>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <Fragment key={sec.key}>
                {sec.label ? (
                  <tr>
                    <td
                      colSpan={2 + desk.columns.length}
                      className="border-t border-ink/10 bg-ink/[0.02] px-4 pb-1.5 pt-4"
                    >
                      <TierHeader
                        label={sec.label}
                        count={sec.count}
                        pinned={sec.pinned}
                        collapsed={collapsed.has(sec.key)}
                        onToggle={() => toggleSection(sec.key)}
                      />
                    </td>
                  </tr>
                ) : null}
                {/* No collapse test here — the section build already emptied a
                    shut section, so the rule lives in ONE place for both
                    surfaces (this table and the mobile grid below). */}
                {sec.guests.map((guest) => (
                  <DesktopRow
                    key={guest.guest_id}
                    guest={guest}
                    displayUrl={faceFor(guest)}
                    selected={selectedSet.has(guest.guest_id)}
                    onToggle={() => guestSelection.toggle(guest.guest_id)}
                    nameById={nameById}
                    columns={desk.columns}
                    facts={facts}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile · sectioned grids; checkbox only in select mode; swipe kept.
          Living Roster P4 (parity with the desktop rows): self-joiners render the
          blush "needs you" card (full width, Keep / Link / Remove), every card
          carries the reactive SeatChip + one-tap RSVP cycle, and the carousel's
          density toggle (`?density=list`) swaps the photo grid for a compact
          list. */}
      {/* Card grid — phones AND tablets, matching the bulk bar's `lg` and the
          2026-06-03 directive. See the table's note above for why this is not
          `sm:hidden` any more. */}
      <div className="space-y-5 lg:hidden">
        {/* The phone's ONE column beside the name (owner 2026-09-30) is still
            picked with the same dropdown — but behind the title's ⋯ now, as
            "Show ▾" (frame 2 of the approved simple phone app: setup never sits
            as a strip above the rows). See phone-column-channel.ts. */}
        {sections.map((sec) => (
          <section key={sec.key}>
            {sec.label ? (
              <TierHeader
                        label={sec.label}
                        count={sec.count}
                        pinned={sec.pinned}
                        collapsed={collapsed.has(sec.key)}
                        onToggle={() => toggleSection(sec.key)}
                      />
            ) : null}
            {/* ⚖ Owner 2026-09-20: "remove the grid view on guest list. make it
                same sa row view only." The phone had a `?density=grid|list`
                toggle defaulting to a photo-card GRID; there is one roster on
                every width now. A stale `?density=grid` link simply renders
                this list — nothing reads that param any more.

                🔀 MERGE NOTE (2026-09-21): this side kept the owner's ruling
                and main kept two things this side predated — the collapse test
                moved into the section build (#5793, so `sec.guests` is already
                empty for a folded section and the rule lives in ONE place), and
                phone rows resolve their photo through `faceFor` (#5769, the
                opt-in account photo). Taking this side verbatim would have
                quietly put the stale `photo_url` lookup back on every phone —
                a guest who had opted in would lose their face on mobile only. */}
            {sec.guests.length > 0 ? (
              <ul className="flex list-none flex-col gap-2">
                {sec.guests.map((guest) => (
                  <MobileListRow
                    key={guest.guest_id}
                    guest={guest}
                    eventId={eventId}
                    displayUrl={faceFor(guest)}
                    selectMode={selectMode}
                    selected={selectedSet.has(guest.guest_id)}
                    onToggle={() => guestSelection.toggle(guest.guest_id)}
                    palette={palette}
                    groupIds={groupMemberships[guest.guest_id] ?? []}
                    groups={groups}
                    groupsById={groupsById}
                    currentGroupId={currentGroupId}
                    bulkRoleSections={bulkRoleSections}
                    seat={seatByGuest[guest.guest_id]}
                    nameById={nameById}
                    linked={facts.linkedOf(guest.guest_id)}
                    column={phoneColumn}
                    facts={facts}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
    </BringerSeatsProvider>
    </GuestAccessContext.Provider>
    </GuestListHasSidesContext.Provider>
    </GuestListFinalizedContext.Provider>
  );
}

// -----------------------------------------------------------------------
// THE BULK BAR — ticked rows, one bar, the same four on every width (owner
// 2026-09-30, the Fable rows, frames C and G): "N selected · M not yet invited ·
// Clear", then Invite selected · Set group ▾ · Set table ▾ · ⋯.
//
//   · Invite selected — the one-by-one run (`/guests/send`) with only the
//     ticked guests, in the order they were ticked: one share sheet per guest,
//     each with that guest's own ticket. Bride and groom are never sent to.
//   · Set group ▾ / Set table ▾ — ONE dropdown each (existing groups + New
//     group… · the tables + No table). Each choice applies at once — no Apply —
//     through the ONE bulk action the old Apply used (`bulkApplyRoleAndGroup`,
//     which now also takes `table`), so no server action was added.
//   · ⋯ — the rest, ONE list: Set side · Set role · Mark invited · Remove.
//
// There is no Pair here any more: who walks beside whom is set in the Maker's
// Wedding March only (DECISION_LOG 2026-09-30 "WALKING TOGETHER IS NOT BEING A
// COUPLE").
// -----------------------------------------------------------------------

const NEW_GROUP_KEY = '__new_group__';

function RosterBulkBar({
  eventId,
  selectedIds,
  guestsById,
  groups,
  tables,
  bulkRoleSections,
  selectMode,
  allIds,
}: {
  eventId: string;
  /** Every guest in view — "Select all N". */
  allIds: string[];
  selectedIds: string[];
  guestsById: Map<string, GuestRow>;
  groups: GuestGroupWithCount[];
  tables: readonly { tableId: string; label: string }[];
  bulkRoleSections: RoleSection[];
  /** The phone's select mode — Done leaves it. */
  selectMode: boolean;
}) {
  // No sides on this event (owner 2026-09-30) → no "Set side" in the ⋯.
  const hasSides = useContext(GuestListHasSidesContext);
  const roleNames = useRoleNames();
  const toast = useToast();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [newGroup, setNewGroup] = useState(false);
  const { removing, remove } = useGuestRemoval(eventId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const count = selectedIds.length;

  const picked = selectedIds.map((id) => guestsById.get(id)).filter((g): g is GuestRow => Boolean(g));
  const invitable = picked.filter(
    (g) => g.role !== 'bride' && g.role !== 'groom' && !g.passed_away && g.entry_source !== REQUEST_ENTRY_SOURCE,
  );
  const notYet = invitable.filter((g) => !g.invitation_sent_at).length;

  const done = () => {
    guestSelection.clear();
    if (selectMode) guestSelection.exit();
  };

  // The shipped bulk action, as the old Apply posted it — one field at a time.
  const apply = (field: 'group_id' | 'side' | 'role' | 'table', value: string) => {
    const fd = new FormData();
    for (const id of selectedIds) fd.append('guest_ids[]', id);
    fd.set(field, value);
    startTransition(async () => {
      await bulkApplyRoleAndGroup(eventId, fd);
    });
  };

  const markInvited = () => {
    startTransition(async () => {
      const results = await Promise.all(invitable.map((g) => setGuestInvitationSent(eventId, g.guest_id, true)));
      const ok = results.filter((r) => r.ok).length;
      if (ok < invitable.length) toast.error(`${formatCount(invitable.length - ok)} could not be marked — try again.`);
      else toast.success(`${formatCount(ok)} marked as invited`);
      done();
      router.refresh();
    });
  };

  const moreOptions: PickOption[] = [
    ...(hasSides ? (['bride', 'groom', 'both'] as GuestSide[]) : []).map((s) => ({ key: `side:${s}`, label: SIDE_LABELS[s], group: 'Set side' })),
    ...bulkRoleSections.flatMap((sec) =>
      sec.roles.map((r) => ({
        key: `role:${r}`,
        label: guestRolePickLabel(r, roleNames),
        group: `Set role · ${sectionHeadingInTheirWords(sec.label, roleNames)}`,
      })),
    ),
    { key: 'mark', label: 'Mark invited', group: 'More', disabledNote: invitable.length === 0 ? 'nobody to invite' : undefined },
    // ⚖ Owner 2026-10-03: delete works for ANY reply — one warning for all.
    // The couple can never be deleted (the server refuses them), so a
    // selection holding them says so here instead of failing on the tap.
    {
      key: 'remove',
      label: `Delete ${formatCount(count)} ${count === 1 ? 'guest' : 'guests'}`,
      group: 'More',
      disabledNote: picked.some((g) => g.role === 'bride' || g.role === 'groom') ? 'the couple stays' : undefined,
    },
  ];

  const inviteIds = invitable.map((g) => g.guest_id).join(',');

  return (
    <div
      role="region"
      aria-label="Bulk actions for selected guests"
      data-roster-bulk-bar=""
      /* A list mid-selection is not the page to show on the next open — the
         last-seen copy waits until the selection is over. */
      data-last-seen-hold=""
      className="fixed inset-x-3 bottom-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+0.75rem)] z-40 mx-auto max-w-3xl rounded-2xl bg-ink px-3 py-2.5 text-cream shadow-[0_18px_40px_-14px_rgba(26,26,26,0.6)] lg:bottom-6"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm">
          <span className="font-semibold">{formatCount(count)} selected</span>
          {notYet > 0 ? <span className="text-cream/70"> · {formatCount(notYet)} not yet invited</span> : null}
        </p>
        {count < allIds.length ? (
          <button
            type="button"
            onClick={() => guestSelection.selectAllInView(allIds)}
            className="inline-flex min-h-[44px] items-center px-1 text-sm text-cream underline-offset-4 hover:underline"
          >
            Select all {formatCount(allIds.length)}
          </button>
        ) : null}
        <button
          type="button"
          onClick={done}
          className="inline-flex min-h-[44px] items-center px-1 text-sm text-cream/70 underline-offset-4 hover:text-cream hover:underline"
        >
          {selectMode ? 'Done' : 'Clear'}
        </button>
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
          {invitable.length > 0 ? (
            <Link
              href={`/dashboard/${eventId}/guests/send?ids=${inviteIds}`}
              className="inline-flex min-h-[44px] items-center rounded-full bg-cream px-4 text-sm font-medium text-ink"
              data-bulk-invite=""
            >
              Invite selected
            </Link>
          ) : null}
          <PickMenu
            label="Set group"
            value={null}
            buttonText="Set group"
            options={[
              ...groups.map((g) => ({ key: g.group_id, label: g.label })),
              { key: NEW_GROUP_KEY, label: 'New group…' },
            ]}
            onPick={(key) => (key === NEW_GROUP_KEY ? setNewGroup(true) : apply('group_id', key))}
            dataAttr="data-bulk-set-group"
          />
          <PickMenu
            label="Set table"
            value={null}
            buttonText="Set table"
            options={[{ key: '', label: 'No table' }, ...tables.map((t) => ({ key: t.tableId, label: tableWords(t.label) }))]}
            onPick={(key) => apply('table', key || 'none')}
            dataAttr="data-bulk-set-table"
          />
          <PickMenu
            label="More for the selected guests"
            value={null}
            buttonText="⋯"
            options={moreOptions}
            onPick={(key) => {
              if (key.startsWith('side:')) apply('side', key.slice(5));
              else if (key.startsWith('role:')) apply('role', key.slice(5));
              else if (key === 'mark') markInvited();
              else if (key === 'remove') {
                setDeleteError(null);
                setConfirmDelete(true);
              }
            }}
            dataAttr="data-bulk-more"
          />
        </div>
      </div>
      {busy ? <p className="pt-1 text-xs text-cream/70">Saving…</p> : null}
      {/* The one in-page warning (owner 2026-10-03) — never a browser confirm(). */}
      <DeleteGuestSheet
        open={confirmDelete}
        names={picked.map((g) => guestFullName(g) ?? guestDisplayName(g))}
        busy={removing}
        error={deleteError}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const refused = await remove(selectedIds, () => setConfirmDelete(false));
          setDeleteError(refused);
        }}
      />
      <Sheet open={newGroup} onClose={() => setNewGroup(false)} labelledById="bulk-new-group-title" rise>
        <div className="space-y-3 p-5 text-ink">
          <h2 id="bulk-new-group-title" className="font-display text-xl">
            New group for {formatCount(count)} {count === 1 ? 'guest' : 'guests'}
          </h2>
          <NewGroupInlineForm eventId={eventId} selectedIds={selectedIds} onClose={() => setNewGroup(false)} />
        </div>
      </Sheet>
    </div>
  );
}


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

function MobileListRow({
  guest,
  eventId,
  displayUrl,
  selectMode,
  selected,
  onToggle,
  palette,
  groups,
  groupsById,
  groupIds,
  currentGroupId,
  bulkRoleSections,
  seat,
  nameById,
  linked,
  column,
  facts,
}: {
  guest: GuestRow;
  eventId: string;
  displayUrl?: string;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  palette: RolePalette;
  groupIds: string[];
  groups: GuestGroupWithCount[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
  bulkRoleSections: RoleSection[];
  seat?: { placed: string | null; suggested: string | null };
  /** guest_id → display name — "+1 of <bringer>". */
  nameById: Record<string, string>;
  /** An account holds this invitation; null = not measured. */
  linked: boolean | null;
  /** The phone's one column slot — drawn under the dashed line. */
  column: RosterColumn;
  facts: RowFacts;
}) {
  const hasSides = useContext(GuestListHasSidesContext);
  const isHost = HOST_ROLES.has(guest.role);
  // The couple can never be removed (the server refuses them), and select mode
  // owns the row — no swipe in either case.
  const swipeable = !selectMode && guest.role !== 'bride' && guest.role !== 'groom';
  // Frame G (owner 2026-09-29): "+3 (2 named)", an unnamed seat reads "+2 · TBA".
  const extraSeats = useBringerSeats(guest.guest_id);
  const seatLabel = usePlaceholderLabel(guest.guest_id);
  const shownName = seatLabel ?? guestFullName(guest) ?? guestDisplayName(guest);
  const bringer = guest.plus_one_of_guest_id ? (nameById[guest.plus_one_of_guest_id] ?? null) : null;
  // One "Table" word: a couple's "Sweetheart Table" is printed as named (lib/table-words.ts).
  const table = seat?.placed && guest.rsvp_status !== 'declined' ? tableWords(seat.placed) : null;

  // Long-press any row to start selecting (frame C). A plain tap then ticks.
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const startPress = () => {
    longPressed.current = false;
    if (press.current) clearTimeout(press.current);
    press.current = setTimeout(() => {
      longPressed.current = true;
      guestSelection.enter();
      if (!selected) onToggle();
      if (typeof navigator !== 'undefined') navigator.vibrate?.(12);
    }, 480);
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };

  const row = (
    <div
      onPointerDown={selectMode ? undefined : startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => {
        if (longPressed.current) e.preventDefault();
      }}
      onClickCapture={(e) => {
        // The long press already ticked the row — its lift is not a tap.
        if (longPressed.current) {
          e.preventDefault();
          e.stopPropagation();
          longPressed.current = false;
        }
      }}
      onClick={(e) => {
        // ⚖ Owner 2026-10-03: a tap on the card's white space opens the guest
        // card — the SAME trigger as the name (so the same panel, the same
        // way) — and every control on the row keeps its own tap (row-tap.ts).
        // While picking rows, white space ticks the row instead.
        if (!isWhiteSpaceTap(e.target, e.currentTarget)) return;
        if (selectMode) onToggle();
        else e.currentTarget.querySelector<HTMLElement>('[data-row-name]')?.click();
      }}
      className={`relative cursor-pointer select-none overflow-hidden rounded-xl border bg-cream px-3 py-3 ${
        selected ? 'border-[var(--sn-gold-500,#b8923a)] bg-[var(--sn-gold-100)]' : 'border-ink/10'
      } ${bringer ? 'ml-5' : ''}`}
      data-guest-row=""
    >
      <div className="flex items-start gap-3">
        {selectMode ? (
          <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Select ${shownName}`}
              className="h-5 w-5 rounded-full border-ink/30 text-terracotta focus:ring-terracotta"
            />
          </label>
        ) : (
          // The avatar ALREADY carries the side (its tint), so it is the side's
          // control — no extra pixels in a row whose point is density.
          <span className="relative z-20 shrink-0">
            {hasSides ? (
              <SideChipEditor eventId={eventId} guest={guest}>
                <RowAvatar guest={guest} displayUrl={displayUrl} />
              </SideChipEditor>
            ) : (
              <RowAvatar guest={guest} displayUrl={displayUrl} />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {selectMode ? (
            <button type="button" onClick={onToggle} className="block w-full truncate text-left font-display text-[16px] leading-snug text-ink">
              {shownName}
            </button>
          ) : (
            /* Tap the name for the full guest card. */
            <InspectorTrigger
              inspectId={guest.guest_id}
              href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
              data-row-name=""
              className="block min-w-0 truncate rounded-md text-left font-display text-[16px] leading-snug text-ink"
            >
              {shownName}
            </InspectorTrigger>
          )}
          {/* ONE line about them — side · role · groups · +N · Table (frame A).
              Each word that the desktop row can edit is its editor here too, so
              a phone is never read-only; the line SCROLLS, it never wraps. */}
          {guest.passed_away ? (
            <p className="truncate text-xs text-ink/55" data-passed-away="">
              {PASSED_AWAY_LINE}
            </p>
          ) : (
            <div className="m-no-scrollbar -mx-0.5 mt-0.5 overflow-x-auto px-0.5 text-xs text-ink/55">
              {/* ✂ The TABLE never runs off the card (owner 2026-10-05,
                  maria-and-jose at 375 px: "Table Sweetheart Table" was cut off
                  at the card's edge — "truncate gracefully or wrap"). The
                  editors keep their words whole in a group that never shrinks.
                  The table name stays on the line when it fits (the couple's
                  "· Sweetheart Table"); when it does not — a sponsor's
                  "Principal Sponsor (Ninong)" leaves it ~13 px — it moves
                  under the line, whole, and only a name wider than the card
                  ends in "…". Measured on the lab copy of the event's roster. */}
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="flex shrink-0 items-center gap-1.5">
                {bringer ? <span data-plus-one-of="">+1 of {bringer.split(/\s+/)[0]}</span> : null}
                <RoleChipEditor eventId={eventId} guest={guest} roleSections={bulkRoleSections}>
                  <RoleTexts guest={guest} palette={palette} />
                </RoleChipEditor>
                <GroupChipList
                  eventId={eventId}
                  guestId={guest.guest_id}
                  groupIds={groupIds}
                  groupsById={groupsById}
                  currentGroupId={currentGroupId}
                  compact
                  plain
                />
                <AddToGroupControl eventId={eventId} guest={guest} groups={groups} memberGroupIds={groupIds} />
                {!isHost && (plusOneSeats(guest) > 0 || extraSeats.some((s) => s.named)) ? (
                  <span className="whitespace-nowrap">
                    · <PlusOneSeatsSummary count={plusOneSeats(guest)} seats={extraSeats} />
                  </span>
                ) : null}
                </span>
                {table ? (
                  <span className="min-w-0 max-w-full truncate" title={table} data-row-table="">
                    · {table}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0">
          {/* The reply pill — unless the one column already IS the reply. */}
          {guest.passed_away || column === 'rsvp' ? null : (
            <RsvpChipEditor eventId={eventId} guest={guest} seatedTableLabel={seat?.placed ?? null}>
              <RsvpText status={guest.rsvp_status} host={isHost} />
            </RsvpChipEditor>
          )}
        </div>
      </div>
      {/* Under the dashed line: the ONE column this phone shows — Invite · ⋯
          and the status by default (frame A), or whatever the "Showing"
          dropdown picked, through the same cell the computer's columns use.
          While picking rows it hides, so a row is just a thing to tick. */}
      {selectMode ? null : (
        <div className="mt-2.5 border-t border-dashed border-ink/15 pt-2.5" data-roster-cell={column}>
          {column === 'invite' && isHost ? (
            <p className="flex items-center justify-between text-xs text-ink/55">
              <span className="font-medium">Host</span>
              {linked === null ? null : <span>{linked ? 'Linked' : 'Not linked'}</span>}
            </p>
          ) : (
            <RosterCell column={column} guest={guest} facts={facts} size="phone" />
          )}
        </div>
      )}
    </div>
  );

  return (
    <li className="list-none">
      {swipeable ? (
        <SwipeToDelete
          eventId={eventId}
          guestId={guest.guest_id}
          guestName={guestDisplayName(guest)}
          radiusClass="rounded-xl"
        >
          {row}
        </SwipeToDelete>
      ) : (
        row
      )}
      {/* More names than seats — below the row, where its Removes can be tapped. */}
      <PlusOneOverNote
        eventId={eventId}
        guestName={shownName}
        count={plusOneSeats(guest)}
        seats={extraSeats}
        className="mx-3"
      />
    </li>
  );
}

// -----------------------------------------------------------------------
// SwipeToDelete — wraps a mobile guest card so a left-swipe reveals a Delete
// action (owner directive 2026-06-03). Delete opens the ONE in-page warning
// (`DeleteGuestSheet`, owner 2026-10-03 — any reply state may be deleted), and
// deletion goes through `useGuestRemoval` (guest-delete.tsx) — the SAME path
// the bulk bar and the guest card's ⋯ use — so the delete is a recoverable
// SOFT one, a refusal is said where they swiped, AND the released seat is
// captured so an undo can re-place it. Touch-only — the desktop table keeps
// its own row affordances. Rendered by the phone list (MobileListRow) — the
// photo-card grid it once also served was removed on the owner's ruling
// (2026-09-20: "make it same sa row view only").
// -----------------------------------------------------------------------
function SwipeToDelete({
  eventId,
  guestId,
  guestName,
  children,
  // The clipping wrapper rounds to match the card it wraps — the grid card is
  // rounded-lg, the compact list row rounded-xl. Passing it keeps the swipe
  // container from shaving the child's corners.
  radiusClass = 'rounded-lg',
}: {
  eventId: string;
  guestId: string;
  guestName: string;
  children: ReactNode;
  radiusClass?: string;
}) {
  const REVEAL = 84; // px width of the revealed Delete action
  const { removing, remove } = useGuestRemoval(eventId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    <div className={`relative overflow-hidden ${radiusClass}`}>
      {/* Delete action, revealed behind the card on a left-swipe. */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: REVEAL }}
      >
        {/* NOT a form post any more. It used to submit to `bulkSoftDeleteGuests`,
            which releases the guest's seat WITHOUT capturing it — so a swipe
            permanently dropped their chair and offered no undo, while the same
            act from the desktop bulk bar could be taken back in full. Both now
            go through `useGuestRemoval`. */}
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setConfirmDelete(true);
          }}
          disabled={removing}
          aria-label={`Delete ${guestName}`}
          tabIndex={tx === 0 ? -1 : 0}
          className="flex w-full flex-col items-center justify-center gap-0.5 bg-danger-600 text-cream disabled:opacity-70"
        >
          <Trash2 aria-hidden className="h-5 w-5" strokeWidth={2} />
          <span className="text-[11px] font-semibold">
            {removing ? '…' : 'Delete'}
          </span>
        </button>
      </div>

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
          // No transform at rest: a transform (even translateX(0)) makes this
          // box the frame for every `position: fixed` inside the row, so the
          // row's own sheets (New QR · Unlink from its ⋯) were cut to the row.
          transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
      {/* Swipe → Delete → the one in-page warning (owner 2026-10-03). A refusal
          is said HERE, where they swiped, as well as in the toast. */}
      <DeleteGuestSheet
        open={confirmDelete}
        names={[guestName]}
        busy={removing}
        error={deleteError}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const refused = await remove([guestId], () => setTx(0));
          if (refused) setDeleteError(refused);
          else setConfirmDelete(false);
        }}
      />
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
  plain = false,
}: {
  eventId: string;
  guestId: string;
  groupIds: string[];
  groupsById: Record<string, GuestGroupWithCount>;
  currentGroupId: string | null;
  compact?: boolean;
  /** Roster presentation (owner 2026-09-20): the group's NAME, no capsule. The
   *  team-side tint moves onto the text so the bride/groom cue survives. The
   *  mobile card keeps its chips — see the ROSTER TEXT VARIANTS note. */
  plain?: boolean;
}) {
  const hasSides = useContext(GuestListHasSidesContext);
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
            className={
              plain
                ? 'inline-flex items-center gap-1 text-[11px] text-ink/60'
                : `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TEAM_SIDE_CHIP[grp.team_side]}`
            }
            title={hasSides ? `${grp.label} · ${TEAM_SIDE_LABELS[grp.team_side]}` : grp.label}
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

// GuestPhoto — the card hero. Renders the resolved display photo (selfie or
// Gmail avatar) with object-cover, or a side-tinted initials block when the
// guest has no photo yet. Raw <img> (not next/image) because display URLs are
// short-lived presigned R2 URLs — same house rule as the hero-photo surface.
function GuestPhoto({
  guest,
  displayUrl,
}: {
  guest: GuestRow;
  displayUrl?: string;
}) {
  if (displayUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={displayUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex h-full w-full items-center justify-center ${SIDE_TINT_FILL[guest.side]}`}
    >
      <span className="text-3xl font-semibold tracking-tight">
        {guestInitials(guest)}
      </span>
    </div>
  );
}

/* The Side column's word. Short because the column header already says "Side",
   and because it sits beside a 2px edge carrying the same fact in colour — the
   edge is for scanning, the word is what a colour-blind reader and a screen
   reader get. */
const ROSTER_SIDE_LABEL: Record<GuestSide, string> = {
  bride: "Bride's",
  groom: "Groom's",
  both: 'Both',
};

function SideText({ side }: { side: GuestRow['side'] }) {
  return <span className="text-xs text-ink/60">{ROSTER_SIDE_LABEL[side]}</span>;
}

/* The reply as a small pill (owner 2026-09-30, the Fable rows) — attending →
   success, no reply / maybe → warning, not coming → danger. */
const ROSTER_RSVP_PILL: Record<RsvpStatus, string> = {
  attending: 'bg-success-50 text-success-800 ring-1 ring-success-200',
  maybe: 'bg-warn-50 text-warn-900 ring-1 ring-warn-200',
  pending: 'bg-warn-50 text-warn-900 ring-1 ring-warn-200',
  declined: 'bg-danger-50 text-danger-800 ring-1 ring-danger-200',
};

/** The reply pill — Attending · No reply · Not coming (· Maybe), and Always for the hosts. */
function RsvpText({ status, host = false }: { status: RsvpStatus; host?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        host ? 'bg-ink/[0.06] text-ink/70' : ROSTER_RSVP_PILL[status]
      }`}
    >
      {host ? 'Always' : ROW_RSVP_WORDS[status]}
    </span>
  );
}

/** guest_id → the guest's Access — TRUE by construction, derived from the live
 *  seat (owner 2026-09-28 "make it true"); absent = the read did not answer.
 *  Drawn by the Access column (`RowAccess`), which replaced the "+Co-host" tag
 *  that used to trail the role (2026-09-30). */
const GuestAccessContext = createContext<{
  byGuest: Readonly<Record<string, GuestAccessState>>;
  canManage: boolean;
}>({ byGuest: NO_ACCESS, canManage: false });

function RoleTexts({ guest, palette }: { guest: GuestRow; palette: RolePalette }) {
  const roleNames = useRoleNames();
  const primary = roleTextStyle(guest.role, palette);
  const extras = guest.extra_roles ?? [];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className={`text-xs font-medium ${primary.textClass ?? ''}`} style={primary.style ?? undefined}>
        {guestRoleLabel(guest.role, roleNames)}
      </span>
      {extras.map((r) => {
        const extra = roleTextStyle(r, palette);
        return (
          <span
            key={r}
            title={`Also ${guestRoleLabel(r, roleNames)}`}
            className={`text-[10px] ${extra.textClass ?? ''}`}
            style={extra.style ?? undefined}
          >
            +{guestRoleLabel(r, roleNames)}
          </span>
        );
      })}
    </span>
  );
}
