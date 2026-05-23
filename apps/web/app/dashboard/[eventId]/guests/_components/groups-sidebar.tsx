'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus, Users, X } from 'lucide-react';
import {
  createGuestGroup,
  deleteGuestGroup,
  updateGuestGroup,
} from '../groups-actions';
import {
  TEAM_SIDE_CHIP,
  TEAM_SIDE_LABELS,
  type GuestGroupTeamSide,
  type GuestGroupWithCount,
} from '@/lib/guests';

// -----------------------------------------------------------------------
// GroupsSidebar · custom-groups section beneath the locked role-group
// views in the existing FacetsSidebar. Lives in its own client component
// because it owns "is the New Group form open?" + "which group's kebab
// is open?" UI state.
// -----------------------------------------------------------------------

// Per-side row tint · owner directive 2026-05-23 PM: "pink for bride,
// blue for groom, amethyst for both". `idle` is the resting state;
// `active` deepens the same hue when the group is the currently-viewed
// filter. `icon` colors the Users icon to match. `count` colors the
// member-count chip on the right.
const ROW_TINT_BY_SIDE: Record<
  GuestGroupTeamSide,
  { idle: string; active: string; icon: string; count: string }
> = {
  bride: {
    idle: 'bg-rose-50 text-rose-900 hover:bg-rose-100',
    active: 'bg-rose-100 font-medium text-rose-800',
    icon: 'text-rose-500',
    count: 'text-rose-500/70',
  },
  groom: {
    idle: 'bg-sky-50 text-sky-900 hover:bg-sky-100',
    active: 'bg-sky-100 font-medium text-sky-800',
    icon: 'text-sky-500',
    count: 'text-sky-500/70',
  },
  // Amethyst = purple — distinct from both bride (rose/pink) and groom
  // (sky/blue) so "Both sides" groups read as their own category.
  both: {
    idle: 'bg-purple-50 text-purple-900 hover:bg-purple-100',
    active: 'bg-purple-100 font-medium text-purple-800',
    icon: 'text-purple-500',
    count: 'text-purple-500/70',
  },
};

type Props = {
  eventId: string;
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
  // 7th-pass hotfix 2026-05-23 — pre-resolved href per group_id.
  // Replaces the previous `buildHref` callback which was a function
  // serialized across the RSC → Client boundary, throwing
  // "Functions cannot be passed directly to Client Components" with
  // Sentry digest 3284377371. Plain string map crosses the boundary
  // cleanly.
  hrefByGroupId: Record<string, string>;
};

export function GroupsSidebar({ eventId, groups, currentGroupId, hrefByGroupId }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);

  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        <span>Groups</span>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          aria-label={showNew ? 'Cancel new group' : 'Create a new group'}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink/50 hover:bg-ink/5 hover:text-ink"
        >
          {showNew ? (
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </h3>

      {showNew ? (
        <NewGroupForm
          eventId={eventId}
          onSubmitted={() => setShowNew(false)}
        />
      ) : null}

      {groups.length === 0 && !showNew ? (
        <p className="text-xs text-ink/45">
          No custom groups yet. Use{' '}
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="underline decoration-dotted underline-offset-2 hover:text-ink/70"
          >
            + new group
          </button>{' '}
          to organize friends, coworkers, or family circles.
        </p>
      ) : null}

      <ul className="space-y-1">
        {groups.map((g) => {
          const isCurrent = currentGroupId === g.group_id;
          const editing = openKebabId === `edit:${g.group_id}`;
          // Owner directive 2026-05-23 PM — color-code the group row
          // itself by team_side. Pink for Team Bride, blue for Team
          // Groom, amethyst (purple) for Both sides. The earlier
          // "subtle chip-only" treatment didn't read at a glance —
          // wrapping the whole row in the team tint makes Team Bride
          // groups visually distinct from Team Groom groups in the
          // sidebar list. Active state (isCurrent) deepens the tint
          // for the currently-viewed group.
          const rowTint = ROW_TINT_BY_SIDE[g.team_side];
          return (
            <li key={g.group_id} className="group">
              {editing ? (
                <EditGroupForm
                  eventId={eventId}
                  group={g}
                  onClose={() => setOpenKebabId(null)}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <Link
                    href={hrefByGroupId[g.group_id] ?? `/dashboard/${eventId}/guests?view=group:${g.group_id}`}
                    className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isCurrent ? rowTint.active : rowTint.idle
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Users
                        aria-hidden
                        className={`h-3.5 w-3.5 shrink-0 ${rowTint.icon}`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{g.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${TEAM_SIDE_CHIP[g.team_side]}`}
                        title={TEAM_SIDE_LABELS[g.team_side]}
                      >
                        {teamSideShort(g.team_side)}
                      </span>
                      {g.member_count > 0 ? (
                        <span className={`text-[10px] ${rowTint.count}`}>{g.member_count}</span>
                      ) : null}
                    </span>
                  </Link>
                  <KebabMenu
                    groupId={g.group_id}
                    isOpen={openKebabId === g.group_id}
                    onToggle={() =>
                      setOpenKebabId((v) => (v === g.group_id ? null : g.group_id))
                    }
                    onEdit={() => setOpenKebabId(`edit:${g.group_id}`)}
                    eventId={eventId}
                    groupLabel={g.label}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function teamSideShort(side: GuestGroupTeamSide): string {
  if (side === 'bride') return 'B';
  if (side === 'groom') return 'G';
  return 'B+G';
}

function KebabMenu({
  groupId,
  isOpen,
  onToggle,
  onEdit,
  eventId,
  groupLabel,
}: {
  groupId: string;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  eventId: string;
  groupLabel: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Actions for ${groupLabel}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/40 opacity-0 transition-opacity hover:bg-ink/5 hover:text-ink/70 group-hover:opacity-100 focus:opacity-100"
      >
        <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-8 z-10 w-36 rounded-md border border-ink/15 bg-cream py-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              onEdit();
              onToggle();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-ink/80 hover:bg-ink/5"
          >
            Rename / Side
          </button>
          <form
            action={deleteGuestGroup.bind(null, eventId, groupId)}
            className="block"
            onSubmit={(e) => {
              if (
                !confirm(
                  `Delete "${groupLabel}"? Guest assignments will be unlinked. This does not delete the guests themselves.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="block w-full px-3 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50"
            >
              Delete group
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function NewGroupForm({
  eventId,
  onSubmitted,
}: {
  eventId: string;
  onSubmitted: () => void;
}) {
  return (
    <form
      action={createGuestGroup.bind(null, eventId)}
      className="mb-2 space-y-2 rounded-md border border-ink/10 bg-cream/60 p-2"
      onSubmit={() => {
        // Reset is purely cosmetic — the server action redirects on
        // success so the form unmounts on the next render anyway.
        onSubmitted();
      }}
    >
      <input
        type="text"
        name="label"
        maxLength={64}
        required
        placeholder="Group name"
        className="h-8 w-full rounded-md border border-ink/15 bg-cream px-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        autoFocus
      />
      <TeamSideSelect />
      <button
        type="submit"
        className="inline-flex h-8 w-full items-center justify-center rounded-md bg-terracotta text-xs font-medium text-cream hover:bg-terracotta-600"
      >
        Create group
      </button>
    </form>
  );
}

function EditGroupForm({
  eventId,
  group,
  onClose,
}: {
  eventId: string;
  group: GuestGroupWithCount;
  onClose: () => void;
}) {
  return (
    <form
      action={updateGuestGroup.bind(null, eventId, group.group_id)}
      className="space-y-2 rounded-md border border-ink/15 bg-cream/60 p-2"
    >
      <input
        type="text"
        name="label"
        maxLength={64}
        required
        defaultValue={group.label}
        className="h-8 w-full rounded-md border border-ink/15 bg-cream px-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        autoFocus
      />
      <TeamSideSelect defaultSide={group.team_side} />
      <div className="flex gap-1">
        <button
          type="submit"
          className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-terracotta text-xs font-medium text-cream hover:bg-terracotta-600"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center justify-center rounded-md border border-ink/15 bg-cream px-2 text-xs text-ink/70 hover:border-ink/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Team side picker — owner directive 2026-05-23 swapped the 3-chip
// radio group for a native <select>. Same `name="team_side"` + same
// 'bride' | 'groom' | 'both' values, so the createGuestGroup +
// updateGuestGroup server actions consume them unchanged. Native
// select keeps the create+edit forms compact; the sidebar already has
// narrow horizontal room.
function TeamSideSelect({
  defaultSide = 'both',
}: {
  defaultSide?: GuestGroupTeamSide;
}) {
  return (
    <select
      name="team_side"
      defaultValue={defaultSide}
      aria-label="Team side"
      className="h-8 w-full appearance-none rounded-md border border-ink/15 bg-cream px-2 pr-7 text-[11px] text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
    >
      {(['bride', 'groom', 'both'] as GuestGroupTeamSide[]).map((side) => (
        <option key={side} value={side}>
          {TEAM_SIDE_LABELS[side]}
        </option>
      ))}
    </select>
  );
}
