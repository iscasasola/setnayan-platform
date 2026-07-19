'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus, Users, X } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createGuestGroup,
  deleteGuestGroup,
  updateGuestGroup,
} from '../groups-actions';
import {
  TEAM_SIDE_LABELS,
  type GuestGroupTeamSide,
  type GuestGroupWithCount,
} from '@/lib/guests';
import { SIDE_DOT, SIDE_ROW_TINT } from '@/lib/side-colors';

// -----------------------------------------------------------------------
// GroupsSidebar · custom-groups section beneath the locked role-group
// views in the existing FacetsSidebar. Lives in its own client component
// because it owns "is the New Group form open?" + "which group's kebab
// is open?" UI state.
// -----------------------------------------------------------------------

// Per-side row tint — the canonical side-colour map (lib/side-colors.ts ·
// SIDE_ROW_TINT), retinted to the Atelier/glass side identity (owner-locked
// 2026-07-12, superseding the 2026-05-23 "pink/blue/amethyst"): bride → gold,
// groom → info-slate, both → a lighter gold. `idle` is the resting state;
// `active` deepens the same family when the group is the currently-viewed
// filter; `icon` + `count` follow.
const ROW_TINT_BY_SIDE = SIDE_ROW_TINT;

// Inline-pill side dot (Living Roster P0) — the horizontal `layout="inline"`
// variant drops the full-row team tint (no room in a pill row) for a compact
// leading dot instead. Same canonical map (SIDE_DOT): gold / info-slate /
// lighter gold.
const SIDE_DOT_BY_TEAM = SIDE_DOT;

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
  // Layout (Living Roster P0 · 2026-07-11). 'rail' = the original vertical
  // sidebar list (kept intact). 'inline' = horizontal filter pills for the
  // summary-facet bar — SAME server actions + state machine (create / rename /
  // delete), just laid out as a wrapping pill row instead of stacked rows.
  layout?: 'rail' | 'inline';
};

export function GroupsSidebar({
  eventId,
  groups,
  currentGroupId,
  hrefByGroupId,
  layout = 'rail',
}: Props) {
  const [showNew, setShowNew] = useState(false);
  const [openKebabId, setOpenKebabId] = useState<string | null>(null);

  if (layout === 'inline') {
    // The group being renamed (openKebabId is overloaded as `edit:<id>` for the
    // active edit form — same convention as the rail below).
    const editingId = openKebabId?.startsWith('edit:')
      ? openKebabId.slice('edit:'.length)
      : null;
    const editingGroup = editingId
      ? groups.find((g) => g.group_id === editingId) ?? null
      : null;

    // Returns a Fragment so the pills + "New group" flow inline after the
    // "Group" lens label (in the facet bar's flex-wrap row), while the
    // create / edit forms carry `w-full` to break onto their own line below.
    return (
      <>
        {groups.map((g) => {
          const isCurrent = currentGroupId === g.group_id;
          return (
            <span
              key={g.group_id}
              className="group/pill relative inline-flex items-center"
            >
              <Link
                href={
                  hrefByGroupId[g.group_id] ??
                  `/dashboard/${eventId}/guests?group=${g.group_id}`
                }
                aria-current={isCurrent ? 'true' : undefined}
                title={`${g.label} · ${TEAM_SIDE_LABELS[g.team_side]}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  isCurrent
                    ? 'border-terracotta bg-terracotta/10 font-semibold text-terracotta-700'
                    : 'border-ink/15 text-ink/70 hover:border-ink/30'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${SIDE_DOT_BY_TEAM[g.team_side]}`}
                />
                <span className="max-w-[12ch] truncate">{g.label}</span>
                {g.member_count > 0 ? (
                  <span
                    className={`tabular-nums ${isCurrent ? 'text-terracotta-700/70' : 'text-ink/40'}`}
                  >
                    {g.member_count}
                  </span>
                ) : null}
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
                compact
              />
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          aria-expanded={showNew}
          className="inline-flex min-h-0 items-center gap-1 rounded-full border border-dashed border-terracotta/50 px-2.5 py-1 text-xs font-medium text-terracotta-700 transition-colors hover:border-terracotta hover:bg-terracotta/5"
        >
          {showNew ? (
            <X aria-hidden className="h-3 w-3" strokeWidth={2} />
          ) : (
            <Plus aria-hidden className="h-3 w-3" strokeWidth={2} />
          )}
          {showNew ? 'Cancel' : 'New group'}
        </button>

        {showNew ? (
          <div className="w-full">
            <NewGroupForm eventId={eventId} onSubmitted={() => setShowNew(false)} />
          </div>
        ) : null}

        {editingGroup ? (
          <div className="w-full">
            <EditGroupForm
              eventId={eventId}
              group={editingGroup}
              onClose={() => setOpenKebabId(null)}
            />
          </div>
        ) : null}
      </>
    );
  }

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
                    href={hrefByGroupId[g.group_id] ?? `/dashboard/${eventId}/guests?group=${g.group_id}`}
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
                    {/* Side cue is now carried by the row tint itself
                     *  (pink/blue/purple per ROW_TINT_BY_SIDE) — owner
                     *  directive 2026-05-23 dropped the redundant "B" /
                     *  "G" / "B+G" letter chip. Member count stays on
                     *  the right when non-zero, tinted to match the
                     *  row. The TEAM_SIDE_LABELS title attribute is
                     *  preserved on the parent Link for accessibility
                     *  (screen-reader users still get the full side
                     *  label on hover/focus). */}
                    {g.member_count > 0 ? (
                      <span
                        className={`shrink-0 text-[10px] ${rowTint.count}`}
                        title={TEAM_SIDE_LABELS[g.team_side]}
                      >
                        {g.member_count}
                      </span>
                    ) : null}
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

function KebabMenu({
  groupId,
  isOpen,
  onToggle,
  onEdit,
  eventId,
  groupLabel,
  compact = false,
}: {
  groupId: string;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  eventId: string;
  groupLabel: string;
  // Inline (facet-bar) layout: a smaller, sub-44px kebab that reveals on
  // hover of its pill (`group/pill`) so a wrapping pill row stays tidy. The
  // rail keeps the original 28px button revealed on row hover (`group`).
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Actions for ${groupLabel}`}
        className={
          compact
            ? 'ml-0.5 inline-flex h-6 w-6 min-h-0 items-center justify-center rounded-md text-ink/40 opacity-0 transition-opacity hover:bg-ink/5 hover:text-ink/70 focus:opacity-100 group-hover/pill:opacity-100'
            : 'inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/40 opacity-0 transition-opacity hover:bg-ink/5 hover:text-ink/70 group-hover:opacity-100 focus:opacity-100'
        }
      >
        <MoreHorizontal aria-hidden className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.75} />
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
          {/* In-app `<ConfirmForm>` (upgraded 2026-05-30) replaces the prior
              `<form onSubmit={confirm()}>` pattern · no UI block, brand-voice
              copy + portaled dialog for proper focus trap + ESC. */}
          <ConfirmForm
            action={deleteGuestGroup.bind(null, eventId, groupId)}
            title="Delete this group?"
            message={`Delete "${groupLabel}"? Guest assignments will be unlinked. This does not delete the guests themselves.`}
            confirmLabel="Delete group"
            destructive
            className="block"
          >
            <SubmitButton
              pendingLabel="Removing…"
              className="block w-full px-3 py-1.5 text-left text-xs text-danger-700 hover:bg-danger-50"
            >
              Delete group
            </SubmitButton>
          </ConfirmForm>
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
      <SubmitButton
        pendingLabel="Creating…"
        className="inline-flex h-8 w-full items-center justify-center rounded-md bg-mulberry text-xs font-medium text-cream hover:bg-mulberry-600"
      >
        Create group
      </SubmitButton>
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
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-mulberry text-xs font-medium text-cream hover:bg-mulberry-600"
        >
          Save
        </SubmitButton>
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
