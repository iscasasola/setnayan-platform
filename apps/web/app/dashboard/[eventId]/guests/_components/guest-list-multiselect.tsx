'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
// Union of both sides of a merge: Mail/Phone are the contact-column icons,
// Link2/Link2Off are the pairing affordances. Neither replaced the other.
import {
  ChevronDown,
  Link2 as LinkIcon,
  Link2Off,
  Mail,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import { guestSelection, useGuestSelection } from './guest-selection-store';
import { guestOptimistic, useGuestOptimistic } from './guest-optimistic-store';
import { pushUndo } from './undo-toast';
import { QuickViewButton } from './guest-drawer';
import {
  InspectorTrigger,
  useInspectorContext,
} from '@/app/_components/inspector/inspector-column';
import { SeatChip } from './seat-chip';
import {
  AddToGroupControl,
  RoleChipEditor,
  RsvpChipEditor,
  SideChipEditor,
} from './chip-editors';
import { keepGuestAction, removeGuestAction } from '../claims/actions';
import { pairSelectedGuests, unpairGuestAction } from '../pair-actions';
import { buildUndo, projectGuests } from '@/lib/guest-optimistic';
import { resolveRoleSet } from '@/lib/role-sets';
import {
  bulkApplyRoleAndGroup,
  bulkSoftDeleteGuestsForUndo,
  createGuestGroup,
  removeGuestFromGroup,
  restoreDeletedGuests,
} from '../groups-actions';
import {
  guestDisplayName,
  guestFullName,
  guestInitials,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  SIDE_ORDER,
  TEAM_SIDE_CHIP,
  TEAM_SIDE_LABELS,
  type GuestGroupTeamSide,
  type GuestGroupWithCount,
  type GuestRole,
  type GuestRow,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import { type RolePalette } from '@/lib/mood-board';
import { roleChipStyle, roleTextStyle } from '@/lib/role-chip-style';
import {
  SIDE_AVATAR,
  SIDE_CHIP,
  SIDE_CONTROL_BORDER,
  SIDE_RING,
  SIDE_TINT_FILL,
} from '@/lib/side-colors';
import {
  importanceGroupOf,
  ROLE_GROUP_LABELS,
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
  groupingKeyOf,
  type ArrangeCtx,
  type ArrangeKey,
} from '@/lib/roster-arrangement';
import { ArrangeSheet, ArrangeTh } from './arrange-controls';

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
  /** The honoree's section. Never collapsible: "always first" would otherwise
   *  last exactly until somebody folded it. */
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
  /** The honoree. Shown, never folded — see the section build. */
  pinned?: boolean;
}) {
  const labelEls = (
    <>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </h3>
      <span className="text-[11px] text-ink/35">{count}</span>
      {pinned ? (
        <span className="text-[10px] lowercase tracking-normal text-ink/30">
          always first
        </span>
      ) : null}
    </>
  );
  if (!onToggle || pinned) {
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

// Desktop table row (owner 2026-06-05 "guest on desktop mode will be row/table
// style not grid style"). Photo thumbnail + name in the first cell, then the
// side / role / groups / RSVP / contact columns. The checkbox owns selection;
// the name links to the detail page.
function DesktopRow({
  guest,
  eventId,
  palette,
  displayUrl,
  selected,
  onToggle,
  groupIds,
  groups,
  groupsById,
  currentGroupId,
  bulkRoleSections,
  seat,
  partnerNameById,
}: {
  guest: GuestRow;
  eventId: string;
  palette: RolePalette;
  displayUrl?: string;
  selected: boolean;
  onToggle: () => void;
  groupIds: string[];
  groups: GuestGroupWithCount[];
  groupsById: Record<string, GuestGroupWithCount>;
  /** guest_id → display name, built ONCE from the roster this page already
   *  holds. Resolving a partner per row would be a query per paired guest. */
  partnerNameById: Record<string, string>;
  currentGroupId: string | null;
  bulkRoleSections: RoleSection[];
  // Reactive seat state (Living Roster P3) — undefined only if a guest slips the
  // server-built map (defensively degrades to the suggested/dash path).
  seat?: { placed: string | null; suggested: string | null };
}) {
  // Group labels for the quick-view drawer (Contact + groups live there now).
  const groupLabels = groupIds
    .map((id) => groupsById[id]?.label)
    .filter((label): label is string => Boolean(label));
  // Desktop inspector selection (Inspector P2). When this guest owns the open
  // `?inspect=` column, the whole row wears the quiet gold selected treatment —
  // matching how Studio/Overview mark their selected master item. The name
  // InspectorTrigger below opts OUT of its own default wash (.sn-guest-namelink)
  // so the row isn't double-marked. Below xl there is no InspectorLayout, so
  // `ctx` is null and this is inert (mobile unchanged).
  const inspectorCtx = useInspectorContext();
  const inspected = Boolean(inspectorCtx && inspectorCtx.selectedId === guest.guest_id);
  return (
    <tr
      className={`border-t border-ink/5 align-middle transition-colors ${
        selected
          ? 'bg-terracotta/[0.06]'
          : inspected
            ? 'bg-[var(--sn-gold-100)]'
            : 'hover:bg-terracotta/[0.04]'
      }`}
    >
      {/* ⚖ The side, as an EDGE (owner 2026-09-20: "remove the pill boxes ...
          so it looks neater"). A 2px rule down the left of the row lets a host
          scan "all the bride's people" without reading a word, at zero
          horizontal cost — where 77 tinted capsules cost a column. The Side
          column keeps its label: an edge is for scanning, not a substitute for
          a word a colour-blind reader or a screen reader can use.
          Reusing SIDE_CONTROL_BORDER rather than adding a twelfth near-identical
          side map — it is already exactly "a border colour per side". */}
      <td className={`border-l-2 px-3 py-2.5 ${SIDE_CONTROL_BORDER[guest.side]}`}>
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${(guestFullName(guest) ?? guestDisplayName(guest))}`}
            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
        </label>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Name → the master-detail trigger (Inspector P2). Desktop (≥xl)
              plain click SELECTS this guest into the sticky inspector column and
              keeps the roster; below xl (and on modified / new-tab clicks) it
              navigates to the standalone detail route exactly as before. */}
          <InspectorTrigger
            inspectId={guest.guest_id}
            href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
            className="sn-guest-namelink flex min-w-0 flex-1 items-center gap-3 rounded-md"
          >
            <RowAvatar guest={guest} displayUrl={displayUrl} />
            <div className="min-w-0">
              {/* `title` so a name the column still cannot fit is RECOVERABLE
                  on hover. Truncation is right for a dense roster; silently
                  losing half a guest's name is not. */}
              <p
                className="truncate font-medium text-ink"
                title={guestFullName(guest) ?? guestDisplayName(guest)}
              >
                {(guestFullName(guest) ?? guestDisplayName(guest))}
              </p>
              {guest.plus_one_allowed ? (
                <p className="truncate text-xs text-ink/55">
                  + {guest.plus_one_name ?? 'TBA'}
                </p>
              ) : null}
              {/* 🔑 A PAIR THAT NOTHING RENDERS IS NOT A PAIR. The column has
                  existed since May 2026 with no reader; writing it without
                  showing it would leave the host unable to tell a paired guest
                  from an unpaired one. */}
              <PartnerLine
                eventId={eventId}
                guest={guest}
                partnerName={
                  guest.pair_with_guest_id
                    ? (partnerNameById[guest.pair_with_guest_id] ?? null)
                    : null
                }
              />
            </div>
          </InspectorTrigger>
          {/* Quick-view (P1) — desktop selects the inspector, below xl opens the
              in-context read-only sheet (both show the same GuestDetailBody). */}
          <QuickViewButton guest={guest} groupLabels={groupLabels} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        {/* Inline editors (P2): the chip opens an anchored popover that applies
            through the optimistic overlay + drops an undo toast. */}
        <SideChipEditor eventId={eventId} guest={guest}>
          <SideText side={guest.side} />
        </SideChipEditor>
      </td>
      <td className="px-3 py-2.5">
        <RoleChipEditor eventId={eventId} guest={guest} roleSections={bulkRoleSections}>
          <RoleTexts guest={guest} palette={palette} />
        </RoleChipEditor>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <GroupChipList
            eventId={eventId}
            guestId={guest.guest_id}
            groupIds={groupIds}
            groupsById={groupsById}
            currentGroupId={currentGroupId}
            compact
            plain
          />
          <AddToGroupControl
            eventId={eventId}
            guest={guest}
            groups={groups}
            memberGroupIds={groupIds}
          />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <RsvpChipEditor
          eventId={eventId}
          guest={guest}
          seatedTableLabel={seat?.placed ?? null}
        >
          <RsvpText status={guest.rsvp_status} />
        </RsvpChipEditor>
      </td>
      {/* Reactive seat (Living Roster P3): placed 🪑 T# · declined — · else the
          dashed ~T# suggestion. The +1 badge rides along. */}
      <td className="px-3 py-2.5">
        <SeatChip
          placed={seat?.placed ?? null}
          suggested={seat?.suggested ?? null}
          rsvp={guest.rsvp_status}
          hasPlusOne={guest.plus_one_allowed}
          plain
        />
      </td>
      {/* Owner 2026-09-14: "contact number should just show icon to call." The
          raw +63 string was also the widest value in the row, in the column
          that was squeezing the NAME.

          🔑 THESE LINKS ARE BILLED, NOT SNUCK IN. `no-door-out-of-the-app`
          Rule 1 forbids a couple-facing surface from computing a
          `tel:`/`mailto:`, because a couple who phones a SHOP books
          off-platform. It caught this cell, correctly. Asked, the owner scoped
          the rule the same day: "only for the couple and if coordinator is
          given access."

          A GUEST is not a shop — no booking fee, no in-app booking to protect,
          and the couple typed the number in themselves. And the scope is ACCESS:
          this file renders only inside /dashboard/[eventId]/guests, which is
          already gated by `guest_list` access, so a coordinator without that
          grant never reaches it. The exemption is one exact line in
          GUEST_CONTACT_BILL and is counted — a THIRD link here fails CI. */}
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-1.5">
          {guest.mobile ? (
            <a
              href={`tel:${guest.mobile.replace(/[^\d+]/g, '')}`}
              title={`Call ${guest.mobile}`}
              aria-label={`Call ${guestFullName(guest) ?? guestDisplayName(guest)} on ${guest.mobile}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/45 transition-colors hover:bg-ink/5 hover:text-terracotta-700"
            >
              <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
            </a>
          ) : null}
          {guest.email ? (
            <a
              href={`mailto:${guest.email}`}
              title={`Email ${guest.email}`}
              aria-label={`Email ${guestFullName(guest) ?? guestDisplayName(guest)} at ${guest.email}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/45 transition-colors hover:bg-ink/5 hover:text-terracotta-700"
            >
              <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
            </a>
          ) : null}
          {/* An em dash, not an empty cell: "no contact yet" is a fact the host
              acts on, and a blank reads as a rendering failure. */}
          {!guest.mobile && !guest.email ? (
            <span className="text-xs text-ink/40">—</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

// Self-join "needs you" row (Living Roster P2). People who joined via the
// couple's invite link but whose name didn't match the list arrive as real
// guest rows tagged `entry_source='self_added_unlisted'`; page.tsx threads their
// ids in so the roster surfaces them INLINE (blush-tinted) with the three
// reconcile choices, instead of a couple having to visit /guests/claims. Keep /
// Remove call the SAME claim actions the deep page uses (so the semantics — and
// what clears the "needs you" state — stay identical); Link (a merge into an
// existing guest, which needs a target picker) deep-links to that page.
function SelfJoinDesktopRow({
  guest,
  eventId,
  displayUrl,
}: {
  guest: GuestRow;
  eventId: string;
  displayUrl?: string;
}) {
  const name = guestDisplayName(guest);
  // `align-middle` centres the cells against the 36px avatar instead of letting
  // them sit on its baseline; the 2px edge and px-3 keep this row's columns on
  // the same lines as every other row's.
  return (
    <tr className="border-t border-danger-200/60 bg-danger-50/50 align-middle">
      <td className={`border-l-2 px-3 py-3 ${SIDE_CONTROL_BORDER[guest.side]}`} />
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {displayUrl ? (
            <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-danger-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            </span>
          ) : (
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-100 text-xs font-semibold text-danger-900"
            >
              {guestInitials(guest)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{name}</p>
            <p className="truncate text-xs font-medium text-danger-700">
              joined via your link · not on your list
            </p>
            <p className="truncate text-[11px] text-ink/45">
              Already has their QR &amp; personal page — Keep to add them, Remove to revoke
            </p>
          </div>
        </div>
      </td>
      <td colSpan={6} className="px-3 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form action={keepGuestAction.bind(null, eventId)} className="inline-flex">
            <input type="hidden" name="guest_id" value={guest.guest_id} />
            <SubmitButton
              overlay={false}
              pendingLabel="Keeping…"
              className="inline-flex h-8 items-center rounded-md bg-terracotta-700 px-3 text-xs font-medium text-cream hover:bg-terracotta-800"
            >
              Keep
            </SubmitButton>
          </form>
          <Link
            href={`/dashboard/${eventId}/guests/claims`}
            className="inline-flex h-8 items-center rounded-md border border-ink/15 px-3 text-xs font-medium text-ink/70 hover:border-ink/30"
          >
            Link to invite
          </Link>
          <form action={removeGuestAction.bind(null, eventId)} className="inline-flex">
            <input type="hidden" name="guest_id" value={guest.guest_id} />
            <SubmitButton
              overlay={false}
              pendingLabel="Removing…"
              className="inline-flex h-8 items-center rounded-md border border-danger-300/70 px-3 text-xs font-medium text-danger-700 hover:border-danger-400 hover:bg-danger-100"
            >
              Remove
            </SubmitButton>
          </form>
        </div>
      </td>
    </tr>
  );
}

type Props = {
  eventId: string;
  guests: GuestRow[];
  palette: RolePalette;
  groups: GuestGroupWithCount[];
  groupMemberships: Record<string, string[]>; // guest_id → group_id[]
  currentGroupId: string | null;
  // Self-join reconcile queue (Living Roster P2): guest_ids of unlisted joiners
  // (entry_source='self_added_unlisted'), fetched into page.tsx. Rendered as the
  // blush "needs you" row inline in the roster (Keep / Link / Remove).
  selfJoinIds: string[];
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
};

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
}: Props) {
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

  const bulkRoleSections = bulkRoleSectionsFor(roleSetKey);
  // Which visible rows are unlisted self-joiners → render the blush needs-you
  // variant instead of the normal editable row.
  const selfJoinSet = useMemo(() => new Set(selfJoinIds), [selfJoinIds]);
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
    () => projectGuests(guests, optimistic),
    [guests, optimistic],
  );

  // guest_id → display name, for the "walks with …" line. Built from the FULL
  // roster, not the filtered view: a partner filtered out of the current lens
  // must still be nameable, or a real pair would read as a broken one.
  const partnerNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of rosterGuests) map[g.guest_id] = guestDisplayName(g);
    return map;
  }, [rosterGuests]);

  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
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
    () => rosterGuests.map((g) => g.guest_id).filter((id) => !selfJoinSet.has(id)),
    [rosterGuests, selfJoinSet],
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

  const toggleAll = () =>
    allSelected ? guestSelection.clear() : guestSelection.setAll(allIds);

  // Sections derived from the sort control (redesign Phase 1): role tiers
  // (importance · default), by-side, or one flat grid. Built from the already-
  // sorted `guests`, so order within a section holds + the couple-pin survives.
  const sections = useMemo(() => {
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

    const ctx: ArrangeCtx<GuestRow> = {
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
        if (seat?.placed) return `Table ${seat.placed}`;
        if (seat?.suggested) return `Suggested ${seat.suggested}`;
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
        label: sec.label,
        mobileCols: 'grid-cols-2',
        count: sec.count,
        guests: collapsed.has(sec.key) ? [] : sec.guests,
      });
    }
    return out;
  }, [
    rosterGuests,
    grouping,
    groupMemberships,
    groupsById,
    seatByGuest,
    collapsed,
  ]);

  return (
    <div className="space-y-4">
      {/* Floating bulk-action bar — DESKTOP ONLY (lg+). On phones + tablets
          the carousel's Customize panel + Assign bottom sheet own bulk
          actions (owner directive 2026-06-03), so the floating bar would be
          redundant chrome there. */}
      {selectedIds.length > 0 ? (
        /* 🪤 THE STICKY LIVES HERE, NOT ON THE BAR ITSELF. A sticky element can
           only slide inside its PARENT's box; this wrapper used to be exactly
           as tall as the bar, so there was zero slack and it scrolled away the
           instant the list moved — the bar carried `sticky top-20` and was
           inert, which reads exactly like no sticky at all. Hoisting it to this
           wrapper gives it the full `space-y-4` column as its containing block,
           so it pins under the header for the whole scroll of the roster.
           Keep `z-30`: it must sit above the glass roster panel below. */
        <div className="sticky top-20 z-30 hidden lg:block">
          <SelectionBar
            eventId={eventId}
            count={selectedIds.length}
            selectedIds={selectedIds}
            groups={groups}
            onClear={() => guestSelection.clear()}
            showNewGroupForm={showNewGroupForm}
            setShowNewGroupForm={setShowNewGroupForm}
            bulkRoleSections={bulkRoleSections}
            nameById={partnerNameById}
          />
        </div>
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
        className="hidden overflow-x-auto rounded-tile border lg:block"
        style={{
          background: 'var(--sn-glass-bg)',
          borderColor: 'var(--sn-glass-line)',
          backdropFilter: 'var(--sn-glass-blur)',
          WebkitBackdropFilter: 'var(--sn-glass-blur)',
          boxShadow: 'var(--sn-sh-tile)',
        }}
      >
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-ink/[0.07] font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              {/* 🪤 THE HEADER MUST RESERVE THE ROW'S EDGE. Every body row's first
                  cell carries a 2px side rule; without a matching (transparent)
                  one here the header labels sit 2px off every column beneath
                  them — a misalignment invisible in a diff and obvious on screen. */}
              <th className="w-10 border-l-2 border-transparent px-3 py-2.5">
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
              {/* ── COLUMN WIDTHS · the name gets the leftover, so keep the
                  leftover worth having ──────────────────────────────────────
                  These six fixed columns summed to 78%, leaving Name 22% MINUS
                  the 40px checkbox — and the name cell spends 116px of that on
                  padding, the avatar and the quick-view button before a glyph
                  is drawn, so "Maria Villanueva" rendered "Maria Vil…". With a
                  guest inspected the rail takes clamp(340px,30vw,420px) more,
                  and at 1440px the name had ~0px of text left.
                  🔑 The binding Roster archetype gives the name the free space;
                  it is the one column a couple actually reads. Nothing is
                  REMOVED — which columns exist was never ruled on, only that
                  desktop is rows and not tiles (owner 2026-06-05); the six are
                  simply no longer allowed to eat the table.
                  Role keeps the largest share of the six because it renders
                  CHIPS, not text, and was widest for that reason. The extra
                  comes from Contact, one line of `text-xs`. */}
              {/* 🔑 NAME CARRIES THE LONGEST VALUE IN THE ROW and gets what is
                  left, so every percentage below is taken FROM it. The other six
                  columns claimed 56%, and with the avatar and quick-view button
                  inside the cell the name text measured 96px on the owner's
                  screen — "Indalecio Casasola" was already cut to "Indalecio
                  Casa…" BEFORE full names existed. A formal name is longer
                  still ("Ms. Claire Estoras Buanhog"), so shipping the whole
                  name into an unchanged column would have shown LESS of it than
                  before. Trimmed to 46% total; the chips in those columns are
                  short and fixed-width, so they lose nothing. */}
              {/* ⚖ Owner 2026-09-20 — the header IS the arrangement control:
                  the word sorts, the box beside it groups. Widths unchanged. */}
              {/* ⚖ WIDTHS REBALANCED 2026-09-21 for the checkbox each header now
                  carries. The six kept their pre-control widths when the
                  controls landed, so ~20px of checkbox per column had nowhere
                  to go: the labels spilled over their own cells, every header
                  sat shifted from the column beneath it, the last one was
                  pushed off the right edge reading "CONTA", and the table
                  overflowed its own scroller instead of filling the screen.
                  The six go 46% → 50%; Name keeps the rest.

                  🪤 AND THAT WAS NOT ENOUGH — measured, not guessed. Rendered
                  at 1100px with the real Tailwind config, the table was STILL
                  1,085px inside a 1,066px scroller after the first fix, and
                  "Contact" still read "CONTA": the whole 19px overflow was
                  that one plain-text header, whose word needs ~72px in a 53px
                  cell. The first fix's own spill check read it as zero,
                  because it measured child elements and this cell has none.
                  Contact goes 5% → 8% (it now reads in full down to ~900px),
                  and every header cell carries `overflow-hidden` so no single
                  word can widen the table again.

                  ⛔ PADDING IS NOT WHERE THE SPACE COMES FROM. Trimming these
                  to px-2 buys 8px a column and puts the header 4px left of
                  every cell under it — the exact crookedness
                  `the-roster-lines-up.test.ts` exists to stop. One padding,
                  header and body, always.

                  🔑 Truncation in ArrangeTh is the floor under all of it:
                  these widths make truncating RARE, they do not prevent it,
                  and nothing here may depend on a label fitting. */}
              <ArrangeTh column="name" grouping={grouping} sort={sort} className="px-3 py-2.5 font-medium" />
              <ArrangeTh column="side" grouping={grouping} sort={sort} className="w-[7%] px-3 py-2.5 font-medium" />
              <ArrangeTh column="role" grouping={grouping} sort={sort} className="w-[12%] px-3 py-2.5 font-medium" />
              <ArrangeTh column="group" grouping={grouping} sort={sort} className="w-[10%] px-3 py-2.5 font-medium" />
              <ArrangeTh column="rsvp" grouping={grouping} sort={sort} className="w-[8%] px-3 py-2.5 font-medium" />
              <ArrangeTh column="seat" grouping={grouping} sort={sort} className="w-[8%] px-3 py-2.5 font-medium" />
              <th className="w-[8%] overflow-hidden px-3 py-2.5 font-medium">
                <span className="block truncate">Contact</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <Fragment key={sec.key}>
                {sec.label ? (
                  <tr>
                    <td
                      colSpan={8}
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
                {sec.guests.map((guest) =>
                    selfJoinSet.has(guest.guest_id) ? (
                      <SelfJoinDesktopRow
                        key={guest.guest_id}
                        guest={guest}
                        eventId={eventId}
                        displayUrl={faceFor(guest)}
                      />
                    ) : (
                      <DesktopRow
                        key={guest.guest_id}
                        guest={guest}
                        eventId={eventId}
                        palette={palette}
                        displayUrl={faceFor(guest)}
                        selected={selectedSet.has(guest.guest_id)}
                        onToggle={() => guestSelection.toggle(guest.guest_id)}
                        groupIds={groupMemberships[guest.guest_id] ?? []}
                        groups={groups}
                        groupsById={groupsById}
                        currentGroupId={currentGroupId}
                        bulkRoleSections={bulkRoleSections}
                        seat={seatByGuest[guest.guest_id]}
                        partnerNameById={partnerNameById}
                      />
                    ),
                  )}
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
        {/* The phone has no header row to hold six boxes, so the same choices
            live behind one icon (owner 2026-09-20). */}
        <ArrangeSheet grouping={grouping} sort={sort} />
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
                {sec.guests.map((guest) =>
                  selfJoinSet.has(guest.guest_id) ? (
                    <li key={guest.guest_id} className="list-none">
                      <MobileSelfJoinCard
                        guest={guest}
                        eventId={eventId}
                        displayUrl={faceFor(guest)}
                      />
                    </li>
                  ) : (
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
                    />
                  ),
                )}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
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
  nameById,
  setShowNewGroupForm,
  bulkRoleSections,
}: {
  eventId: string;
  count: number;
  selectedIds: string[];
  groups: GuestGroupWithCount[];
  onClear: () => void;
  /** guest_id → display name, so the bar can SAY who is selected. */
  nameById: Record<string, string>;
  showNewGroupForm: boolean;
  setShowNewGroupForm: (v: boolean) => void;
  bulkRoleSections: RoleSection[];
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions for selected guests"
      /* Sticky positioning is owned by the mount wrapper (see the note at the
         SelectionBar call site) — it is the element with room to slide. This
         div keeps only the card's appearance. */
      className="rounded-xl border border-terracotta/40 bg-cream/95 p-3 shadow-md backdrop-blur"
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
          *  bulkApplyRoleAndGroup, Delete goes through useGuestRemoval).
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
          bulkRoleSections={bulkRoleSections}
        />

        {/* Delete affordance · owner directive 2026-05-23. Living Roster P1
         *  (2026-07-11): the blocking confirm dialog is replaced by an
         *  OPTIMISTIC remove + 6s undo snackbar — the rows vanish instantly and
         *  a soft-delete is now reversible from the host UI (undo restores the
         *  guests AND the seats the delete released). Same server gates
         *  (couple-protected, RSVP-set-blocked) enforced server-side. */}
        <OptimisticDeleteButton
          eventId={eventId}
          selectedIds={selectedIds}
          count={count}
        />

        {/* Pair · Filipino entourages walk in pairs (groomsman↔bridesmaid,
         *  ninong↔ninang). Shown ONLY at exactly two selected: "pair these 3"
         *  has no meaning, and pairing the first two of a bigger selection
         *  would be guessing which two the host meant. The server action
         *  re-checks the count — this is the affordance, not the guard. */}
        <PairSelectedForm eventId={eventId} selectedIds={selectedIds} count={count} />
      </div>

      {/* 🔑 WHO is selected, not just HOW MANY.
          Owner 2026-09-14: "when selecting someone, can we place them
          persistent? so it will be easier to see which ones we are selecting?"
          Pairing is the case that forces it — the two people you pair are
          usually far apart in a long roster, so the tinted rows that say who
          you picked are off-screen from each other AND from this bar. A count
          alone cannot be checked against intent; a name can.
          Each chip removes just that guest, so a wrong pick costs one click
          instead of Clear selection and starting over. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink/[0.07] pt-2">
        {selectedIds.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-2 py-0.5 text-xs text-ink/75"
          >
            {/* A selected guest the current filter hides still has to be
                nameable — otherwise narrowing the lens would turn part of your
                own selection into blanks. */}
            <span className="max-w-[18ch] truncate">{nameById[id] ?? 'Not in this view'}</span>
            <button
              type="button"
              onClick={() => guestSelection.toggle(id)}
              aria-label={`Remove ${nameById[id] ?? 'this guest'} from the selection`}
              className="inline-flex items-center rounded-full p-0.5 text-ink/40 hover:bg-ink/10 hover:text-ink"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            </button>
          </span>
        ))}
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

// Optimistic bulk-delete (Living Roster P1). Hides the selected rows via the
// optimistic overlay, clears the selection (so the SelectionBar retracts), then
// calls the return-based `bulkSoftDeleteGuestsForUndo`. On success it drops a 6s
// undo snackbar whose Undo restores the guests + their released seats; on a
// server-side gate rejection (couple/RSVP) it rolls the overlay back and toasts
// the reason. No confirm dialog — undo is the safety net.
/**
 * useGuestRemoval — the ONE way this page removes a guest.
 *
 * ⚠ IT EXISTS BECAUSE THERE WERE TWO, AND ONLY ONE OF THEM COULD BE UNDONE.
 * The desktop bulk bar called `bulkSoftDeleteGuestsForUndo`, which CAPTURES the
 * seats it releases so an undo can re-place them. The mobile swipe posted a
 * plain form to `bulkSoftDeleteGuests`, which does not — and
 * `event_seat_assignments` rows are HARD deleted (a soft delete does not trip
 * the FK cascade, so the seat is dropped on purpose). So the same act, from a
 * phone, permanently lost the guest's chair with no undo offered, and a host
 * who re-added them found a hole in the seating plan they had to rediscover.
 *
 * Two call sites, one rule. A test asserts this hook is the only thing that
 * calls the delete action.
 */
function useGuestRemoval(eventId: string) {
  const toast = useToast();
  const [removing, setRemoving] = useState(false);

  /** @param onRemoved runs only after the server confirms; the swipe uses it to
   *  reset its own gesture state, the bulk bar has nothing to reset. */
  async function remove(guestIds: string[], onRemoved?: () => void) {
    if (removing) return;
    const ids = [...guestIds];
    if (ids.length === 0) return;
    const mutation = { kind: 'remove' as const, guestIds: ids };

    setRemoving(true);
    guestOptimistic.apply(mutation); // hide rows now
    guestSelection.clear(); // retract the bar (the acted-on guests are gone)

    let result;
    try {
      result = await bulkSoftDeleteGuestsForUndo(eventId, ids);
    } catch {
      guestOptimistic.clear(mutation); // rollback the hide
      setRemoving(false);
      toast.error('Could not remove — check your connection and try again.');
      return;
    }
    setRemoving(false);

    if (!result.ok) {
      guestOptimistic.clear(mutation); // rollback — server refused (gate)
      toast.error(result.error);
      return;
    }
    onRemoved?.();

    // buildUndo carries the released seats through, so restore re-places them.
    const plan = buildUndo(
      { kind: 'remove', guestIds: result.removedIds },
      [],
      result.releasedSeats,
    );
    const n = result.removedIds.length;
    pushUndo({
      label: `${n} guest${n === 1 ? '' : 's'} removed`,
      undo: async () => {
        if (plan.kind !== 'restore') return;
        const r = await restoreDeletedGuests(eventId, plan.guestIds, plan.seats);
        if (r.ok) {
          guestOptimistic.clear(mutation); // un-hide the restored rows
        } else {
          toast.error('Could not undo — refresh and try again.');
        }
      },
    });
  }

  return { removing, remove };
}

/**
 * "Pair these 2" — visible only when the selection is exactly two guests.
 *
 * A plain form posting to a server action, matching BulkApplyForm and
 * NewGroupInlineForm rather than inventing a client-side flow: pairing writes
 * both halves in one SQL statement and the list must re-render from the server
 * afterwards, so there is nothing useful to do optimistically.
 */
/**
 * The "walks with <name>" line under a paired guest, plus its unpair control.
 *
 * `partnerName` is resolved by the caller from the roster it already has —
 * never by a per-row fetch, which would be one query per paired guest.
 * A partner the host cannot see (filtered out of the current view) still
 * renders as a pair, with the id standing in for the name, so a pair never
 * silently looks like no pair.
 */
function PartnerLine({
  eventId,
  guest,
  partnerName,
}: {
  eventId: string;
  guest: GuestRow;
  partnerName: string | null;
}) {
  if (!guest.pair_with_guest_id) return null;
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-ink/55">
      <LinkIcon aria-hidden className="h-3 w-3 flex-none" strokeWidth={1.9} />
      <span className="truncate">walks with {partnerName ?? 'a guest not in this view'}</span>
      <form action={unpairGuestAction.bind(null, eventId, guest.guest_id)}>
        <button
          type="submit"
          title="Unpair"
          aria-label={`Unpair ${guest.first_name}`}
          className="inline-flex items-center rounded p-0.5 text-ink/40 hover:text-danger-700"
        >
          <Link2Off aria-hidden className="h-3 w-3" strokeWidth={1.9} />
        </button>
      </form>
    </span>
  );
}

function PairSelectedForm({
  eventId,
  selectedIds,
  count,
}: {
  eventId: string;
  selectedIds: string[];
  count: number;
}) {
  if (count !== 2) return null;
  return (
    <form action={pairSelectedGuests.bind(null, eventId)}>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="guest_ids[]" value={id} />
      ))}
      <SubmitButton
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/20 bg-cream px-3 text-sm font-medium text-ink hover:border-ink/40"
        pendingLabel="Pairing…"
      >
        <LinkIcon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        Pair these 2
      </SubmitButton>
    </form>
  );
}

function OptimisticDeleteButton({
  eventId,
  selectedIds,
  count,
}: {
  eventId: string;
  selectedIds: string[];
  count: number;
}) {
  const { removing: deleting, remove } = useGuestRemoval(eventId);

  async function handleDelete() {
    await remove(selectedIds);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      aria-label={`Remove ${count} selected guest${count === 1 ? '' : 's'}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-danger-300/60 bg-danger-50 px-3 text-xs font-medium text-danger-700 hover:border-danger-400 hover:bg-danger-100 disabled:opacity-60"
    >
      <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {deleting ? 'Removing…' : `Delete ${count}`}
    </button>
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
  bulkRoleSections,
}: {
  eventId: string;
  selectedIds: string[];
  groups: GuestGroupWithCount[];
  onNewGroupClick: () => void;
  onClear: () => void;
  count: number;
  bulkRoleSections: RoleSection[];
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
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-terracotta-700 px-2 text-xs font-semibold text-cream">
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
          {bulkRoleSections.map((section) => (
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

      {/* ⚖ Part of the host — owner 2026-09-20: *"on guestlist. we can also
          assign if they will be part of the host."* Rides the SAME Apply as
          role/side/group, because one Apply button is the decision (owner
          2026-05-23 PM), and writes the `host` hat into `extra_roles` rather
          than a column — see lib/host-hat.ts for why.
          ⛔ It does not pin anybody to the top of the list; the CELEBRANT does
          that, and at most celebrations they are different people. */}
      <label className="sr-only" htmlFor="bulk-host">
        Mark selected guests as part of the host
      </label>
      <div className="relative">
        <select
          id="bulk-host"
          name="host"
          defaultValue=""
          className="h-9 appearance-none rounded-md border border-ink/20 bg-cream px-3 pr-8 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        >
          <option value="">Hosting…</option>
          <option value="yes">Part of the host</option>
          <option value="no">Not part of the host</option>
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

      {/* Single Apply button at the end · owner directive. SubmitButton gives
          it the same in-flight "Applying…" + disabled feedback as Delete. */}
      <SubmitButton
        pendingLabel="Applying…"
        className="inline-flex h-9 items-center rounded-md bg-mulberry px-4 text-xs font-medium text-cream hover:bg-mulberry-600"
      >
        Apply
      </SubmitButton>

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

function MobileListRow({
  guest,
  eventId,
  displayUrl,
  selectMode,
  selected,
  onToggle,
  palette,
  groupIds,
  groups,
  groupsById,
  currentGroupId,
  bulkRoleSections,
  seat,
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
}) {
  // Select mode owns the row for checkbox bulk ops, and the couple can never
  // be removed (the server refuses them, so don't
  // dangle a Delete that can only fail).
  const swipeable =
    !selectMode && guest.role !== 'bride' && guest.role !== 'groom';

  const row = (
    <div
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-cream px-3 py-2.5 ${
        selected ? 'border-terracotta ring-2 ring-terracotta/40' : SIDE_RING[guest.side]
      }`}
    >
      {/* Stretched detail link (z-0); content sits above it (z-10) and the
          interactive bits re-enable pointer events (z-20). */}
      <Link
        href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
        aria-label={guestDisplayName(guest)}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
      />
      {selectMode ? (
        <label
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 inline-flex shrink-0 cursor-pointer items-center"
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${(guestFullName(guest) ?? guestDisplayName(guest))}`}
            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
        </label>
      ) : (
        // The avatar ALREADY carries the side (RowAvatar tints it, and
        // SIDE_RING tints the row's border), so making it the side trigger adds
        // no pixels to a row whose whole point is density — it turns an existing
        // signal into the control for the thing it signals.
        <span className="pointer-events-auto relative z-20">
          <SideChipEditor eventId={eventId} guest={guest}>
            <RowAvatar guest={guest} displayUrl={displayUrl} />
          </SideChipEditor>
        </span>
      )}
      <div className="relative z-10 min-w-0 flex-1">
        <p className="pointer-events-none truncate text-sm font-medium text-ink">
          {(guestFullName(guest) ?? guestDisplayName(guest))}
        </p>
        {/* Sub-line. Role and groups CANNOT be edited without being shown, so
            allowing that here costs a second line on rows that previously had
            one (owner call 2026-09-05 — "allow it if possible"). It is kept to
            one flex line that scrolls rather than wraps, so a guest with four
            groups never grows the row a third time. */}
        <div className="m-no-scrollbar pointer-events-auto -mx-0.5 mt-0.5 overflow-x-auto px-0.5">
          {/* `w-max` so the chips keep their natural width and scroll instead of
              squashing — the row has no space to give, and a half-width role
              chip is worse than one the host has to nudge sideways. */}
          <div className="flex w-max items-center gap-1">
          <RoleChipEditor
            eventId={eventId}
            guest={guest}
            roleSections={bulkRoleSections}
          >
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
          <AddToGroupControl
            eventId={eventId}
            guest={guest}
            groups={groups}
            memberGroupIds={groupIds}
          />
          {guest.plus_one_allowed ? (
            <span className="pointer-events-none whitespace-nowrap text-xs text-ink/55">
              + {guest.plus_one_name ?? 'TBA'}
            </span>
          ) : null}
          </div>
        </div>
      </div>
      <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1.5">
        <RsvpChipEditor
          eventId={eventId}
          guest={guest}
          mobileCycle
          seatedTableLabel={seat?.placed ?? null}
        >
          <RsvpText status={guest.rsvp_status} />
        </RsvpChipEditor>
        <SeatChip
          placed={seat?.placed ?? null}
          suggested={seat?.suggested ?? null}
          rsvp={guest.rsvp_status}
          hasPlusOne={guest.plus_one_allowed}
          plain
        />
      </div>
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
    </li>
  );
}

// MobileSelfJoinCard — the mobile twin of SelfJoinDesktopRow (Living Roster P4).
// A blush "needs you" card for an unlisted joiner surfaced inline in the roster:
// Keep / Link / Remove call the SAME claim actions the desktop row + the
// /guests/claims deep page use, so the semantics (and what clears the "needs you"
// state) stay identical.
function MobileSelfJoinCard({
  guest,
  eventId,
  displayUrl,
}: {
  guest: GuestRow;
  eventId: string;
  displayUrl?: string;
}) {
  const name = guestDisplayName(guest);
  return (
    <div className="overflow-hidden rounded-xl border border-danger-200/70 bg-danger-50/60">
      <div className="flex items-center gap-3 p-3">
        {displayUrl ? (
          <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-danger-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-100 text-xs font-semibold text-danger-900"
          >
            {guestInitials(guest)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{name}</p>
          <p className="truncate text-xs font-medium text-danger-700">joined via your link</p>
        </div>
      </div>
      <p className="px-3 pb-2 text-[11px] text-ink/55">
        Already has their QR &amp; page — Keep to add them, Remove to revoke.
      </p>
      <div className="flex items-center gap-2 px-3 pb-3">
        <form action={keepGuestAction.bind(null, eventId)} className="flex-1">
          <input type="hidden" name="guest_id" value={guest.guest_id} />
          <SubmitButton
            overlay={false}
            pendingLabel="Keeping…"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-terracotta-700 px-3 text-xs font-medium text-cream hover:bg-terracotta-800"
          >
            Keep
          </SubmitButton>
        </form>
        <Link
          href={`/dashboard/${eventId}/guests/claims`}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-ink/15 px-3 text-xs font-medium text-ink/70 hover:border-ink/30"
        >
          Link
        </Link>
        <form action={removeGuestAction.bind(null, eventId)} className="flex-1">
          <input type="hidden" name="guest_id" value={guest.guest_id} />
          <SubmitButton
            overlay={false}
            pendingLabel="Removing…"
            className="inline-flex h-9 w-full items-center justify-center rounded-md border border-danger-300/70 px-3 text-xs font-medium text-danger-700 hover:border-danger-400 hover:bg-danger-100"
          >
            Remove
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// SwipeToDelete — wraps a mobile guest card so a left-swipe reveals a Delete
// action (owner directive 2026-06-03). The swipe-then-tap IS the confirmation
// (iOS-style), and deletion goes through `useGuestRemoval` — the SAME path
// the desktop bulk bar uses — so the same gates apply (couple blocked upstream
// · RSVP'd guests get the reset-first message), the delete is a recoverable
// SOFT one, AND the released seat is captured so an undo can re-place it. Touch-only — the desktop table keeps
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
          onClick={() => remove([guestId], () => setTx(0))}
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

/* A dot, not a filled pill — the status still reads at a glance, and the four
   tones keep the roster proto's warm semantics (attending → success, maybe →
   warning, pending → neutral ink, declined → danger). */
const ROSTER_RSVP_DOT: Record<RsvpStatus, string> = {
  attending: 'bg-success-600',
  maybe: 'bg-warn-500',
  pending: 'bg-ink/25',
  declined: 'bg-danger-600',
};

function RsvpText({ status }: { status: RsvpStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink/70">
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${ROSTER_RSVP_DOT[status]}`} />
      {RSVP_LABELS[status]}
    </span>
  );
}

function RoleTexts({ guest, palette }: { guest: GuestRow; palette: RolePalette }) {
  const primary = roleTextStyle(guest.role, palette);
  const extras = guest.extra_roles ?? [];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className={`text-xs font-medium ${primary.textClass ?? ''}`} style={primary.style ?? undefined}>
        {ROLE_LABELS[guest.role]}
      </span>
      {extras.map((r) => {
        const extra = roleTextStyle(r, palette);
        return (
          <span
            key={r}
            title={`Also ${ROLE_LABELS[r]}`}
            className={`text-[10px] ${extra.textClass ?? ''}`}
            style={extra.style ?? undefined}
          >
            +{ROLE_LABELS[r]}
          </span>
        );
      })}
    </span>
  );
}
