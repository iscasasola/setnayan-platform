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

type Props = {
  eventId: string;
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
  buildHref: (overrides: Record<string, string | null>) => string;
};

export function GroupsSidebar({ eventId, groups, currentGroupId, buildHref }: Props) {
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
                    href={buildHref({ view: `group:${g.group_id}` })}
                    className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isCurrent
                        ? 'bg-terracotta/10 font-medium text-terracotta-700'
                        : 'text-ink/70 hover:bg-ink/5'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Users
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0"
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
                        <span className="text-[10px] text-ink/45">{g.member_count}</span>
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
      <TeamSideRadios />
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
      <TeamSideRadios defaultSide={group.team_side} />
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

function TeamSideRadios({
  defaultSide = 'both',
}: {
  defaultSide?: GuestGroupTeamSide;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Team side</legend>
      <div className="flex gap-1">
        {(['bride', 'groom', 'both'] as GuestGroupTeamSide[]).map((side) => (
          <label
            key={side}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-ink/15 bg-cream px-2 py-1 text-[11px] text-ink/80 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5 has-[:checked]:text-terracotta-700"
          >
            <input
              type="radio"
              name="team_side"
              value={side}
              defaultChecked={side === defaultSide}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                side === 'bride'
                  ? 'bg-rose-400'
                  : side === 'groom'
                    ? 'bg-sky-400'
                    : 'bg-amber-400'
              }`}
            />
            {TEAM_SIDE_LABELS[side]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
