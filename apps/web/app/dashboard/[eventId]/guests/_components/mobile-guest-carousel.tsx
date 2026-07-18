'use client';

/**
 * MobileGuestCarousel — the Guests-page control surface on phones/tablets
 * (iteration 0001, 2026-06-02 · TOP-OF-PAGE TABS 2026-06-15 · re-homed to the
 * LIVING ROSTER single surface 2026-07-11, P4).
 *
 * Living Roster P4 (2026-07-11): the five-tab `.sn-seg` swipe carousel
 * (Summary · Search · Add · Customize · Journey) is retired in favour of the
 * prototype's single scrolling surface, so mobile matches the merged desktop
 * reskin (P0–P3). Top-to-bottom:
 *   • Sticky masthead — "N guests" + Invite (native share / copy link) +
 *     Needs-you (self-join badge → /guests/claims), the pax-target meter, and
 *     the passive Build → Invite → Confirm → Seat → Day-of progress ribbon.
 *   • Tools — the search compose row (filter · sort icons · LiveSearch · Add),
 *     the 3-MODE segment Roster / Groups / Day-of, the RSVP pills, and a
 *     grid/list DENSITY toggle, then the bulk-select Customize row.
 *
 * The 3-mode segment and every pill are URL-DRIVEN and reuse the SAME `buildHref`
 * param contract the desktop facet bar writes — NO second encoder (PAGE_LAYOUT
 * risk #3): Roster = `?sort=importance`, Groups = `?sort=group` (the roster's
 * groupMode), Day-of routes to the dedicated `/guests/checkin` desk, density
 * writes `?density=list` (an additive display param the shared
 * GuestListMultiselect reads — the filter params q/rsvp/view/group/team/tag/sort/
 * gview are still emitted identically). The guest ROWS render in
 * `GuestListMultiselect` below (one source of truth — this stays a control
 * surface, it does not fork the row list). All `lg:hidden`; desktop keeps its
 * inline chrome. The filter + sort + assign bottom SHEETS are kept verbatim.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, CircleCheck, Clock, LayoutGrid, List, PencilLine, QrCode, Send, Share2, SlidersHorizontal, UserPlus, X } from 'lucide-react';
import {
  ROLE_LABELS,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
  type PaxProgress,
} from '@/lib/guests';
import { LiveSearch } from './live-search';
import { quickAddGuest } from '../quick-add-actions';
import { trackFailure } from '@/lib/telemetry/track-error';
import { bulkApplyRoleAndGroup, createGuestGroup } from '../groups-actions';
import { bulkRoleSectionsFor, type RoleSection } from './guest-list-multiselect';
import { guestSelection, useGuestSelection } from './guest-selection-store';
import { useModalA11y } from '@/lib/use-modal-a11y';

type Opt = { key: string; label: string };
type Group = { group_id: string; label: string; member_count?: number };

const SIDES: GuestSide[] = ['bride', 'groom', 'both'];

export function MobileGuestCarousel({
  eventId,
  q,
  sorts,
  currentSort,
  views,
  activeView,
  groups,
  currentGroupId,
  tags,
  activeTag,
  allVisibleIds,
  total,
  attending,
  pending,
  declined,
  paxProgress,
  teamFilter,
  pendingClaims,
  unsent = 0,
  unseated = 0,
  arrived = 0,
  roleSetKey,
  joinUrl = null,
}: {
  eventId: string;
  q: string;
  sorts: Opt[];
  currentSort: string;
  views: Opt[];
  activeView: string;
  groups: Group[];
  currentGroupId: string | null;
  tags: string[];
  activeTag: string;
  allVisibleIds: string[];
  total: number;
  attending: number;
  pending: number;
  declined: number;
  /** Pax-target progress (Adaptive Pax Pricing Phase 2); null = no target set. */
  paxProgress: PaxProgress | null;
  teamFilter: 'all' | 'bride' | 'groom';
  // Pending invite-claims (review queue) — badges the Journey panel's Confirm
  // step, mirroring the desktop ribbon (redesign Phase 1).
  pendingClaims: number;
  // Phase 3 live-progress badges, mirroring the desktop ribbon: invitations
  // not yet sent · attending guests without a seat · day-of arrivals.
  unsent?: number;
  unseated?: number;
  arrived?: number;
  // Iteration 0053 P4 Unit 5: event's role-set key → bulk-assign picker sections.
  roleSetKey?: string | null;
  // Living Roster P4: the share-invite link for the masthead Invite button
  // (fetched server-side in page.tsx); null when RLS/read failed → button hides.
  joinUrl?: string | null;
}) {
  // Per-event-type bulk-assign sections (shared with the desktop SelectionBar).
  const bulkRoleSections = bulkRoleSectionsFor(roleSetKey);
  const [assignOpen, setAssignOpen] = useState(false);
  // Inline rapid-add toggle (Living Roster P4) — the toolbar's Add affordance
  // reveals the same quick-entry form the retired Add tab held.
  const [addOpen, setAddOpen] = useState(false);
  // Filter / sort bottom sheets opened from the search compose-bar icons
  // (owner directive 2026-06-03 — Messenger-style icons left of the search).
  const [filterSheet, setFilterSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Focus management for the two compose-bar bottom sheets (filter + sort).
  // Each overlay carries its own ref + its own useModalA11y wired to its own
  // open-state + close handler (focus trap, Esc-to-close, body-scroll-lock,
  // focus-restore). Hooks run unconditionally — the overlays mount below.
  const filterSheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: filterSheet,
    onClose: () => setFilterSheet(false),
    containerRef: filterSheetRef,
  });
  const sortSheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: sortSheet,
    onClose: () => setSortSheet(false),
    containerRef: sortSheetRef,
  });

  // Belt-and-suspenders: after a bulk apply redirects back with a flash, make
  // sure the Assign sheet is closed (the apply handler already closes it +
  // clears the selection optimistically; this covers any path that didn't).
  useEffect(() => {
    if (
      searchParams.get('bulk_assigned') ||
      searchParams.get('bulk_sided') ||
      searchParams.get('bulk_grouped') ||
      searchParams.get('group_created')
    ) {
      setAssignOpen(false);
    }
  }, [searchParams]);

  // Client mirror of the server FacetsSidebar buildHref so active state +
  // clearing stay in sync with the live URL.
  const buildHref = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      return `${pathname}${qs ? `?${qs}` : ''}`;
    },
    [pathname, searchParams],
  );

  const hasActiveFilter =
    Boolean(currentGroupId) ||
    (Boolean(activeView) && activeView !== 'all') ||
    Boolean(activeTag);

  const currentRsvp = searchParams.get('rsvp') ?? '';
  // In Mind-map mode the guest LIST isn't rendered (page swaps in GuestMindMap),
  // so the carousel's bulk-select would act on guests the user can't see. Gate
  // the select/density controls to a "back to roster" hint while the map is up.
  const mapMode = searchParams.get('gview') === 'map';
  // 3-mode (Living Roster P4). Groups = the group-bucketed roster (`?sort=group`,
  // GuestListMultiselect's groupMode='group'); Roster = any other sort; Day-of
  // routes to the dedicated check-in desk. Same params the desktop sort control
  // writes — no second encoder.
  const isGroupsMode = currentSort === 'group' && !mapMode;
  const isRosterMode = !isGroupsMode && !mapMode;
  // Grid/list density for the roster below — the toggle writes `?density=list`,
  // which GuestListMultiselect reads (one URL-driven state, both surfaces).
  const density = searchParams.get('density') === 'list' ? 'list' : 'grid';

  return (
    <>
      {/* Living Roster · mobile control surface (P4 · 2026-07-11). Replaces the
          five-tab `.sn-seg` swipe carousel with the prototype's single sticky
          surface: masthead (title · Invite · Needs-you) + pax meter + a passive
          progress ribbon, then a 3-mode segment (Roster / Groups / Day-of), the
          RSVP pills, and a grid/list density toggle. Every control writes the
          SAME URL params the desktop facet bar does — filtering stays URL-driven
          + SSR, no second encoder. lg:hidden: desktop keeps its inline chrome.
          `gl-settle` eases the surface in once on mount (frozen under
          prefers-reduced-motion by the global freeze block). */}
      <div className="gl-settle space-y-3 lg:hidden">
        {/* Sticky masthead — title, Invite + Needs-you, pax meter, ribbon. */}
        <div className="sticky top-[calc(env(safe-area-inset-top)+0.25rem)] z-30 -mx-1 space-y-2.5 rounded-b-2xl bg-cream/85 px-1 pb-2.5 pt-1 backdrop-blur">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                Guest list
              </p>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink">
                {total} {total === 1 ? 'guest' : 'guests'}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {joinUrl ? <InviteButton joinUrl={joinUrl} /> : null}
              <Link
                href={`/dashboard/${eventId}/guests/claims`}
                aria-label={`${pendingClaims} ${pendingClaims === 1 ? 'guest needs' : 'guests need'} you`}
                className="inline-flex items-center gap-1.5 rounded-full border border-danger-200 bg-danger-50 px-2.5 py-1.5 text-xs font-medium text-danger-700"
              >
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                  {pendingClaims}
                </span>
                Needs you
              </Link>
            </div>
          </div>

          {/* Pax-target meter (Adaptive Pax Pricing Phase 2) — sure-attending vs
              the couple's minimum pax. Hidden when no target is set. */}
          {paxProgress ? (
            <div>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-mono uppercase tracking-[0.12em] text-terracotta">
                  {paxProgress.exceeded ? 'Now planning for' : 'Guest target'}
                </span>
                <span className="tabular-nums text-ink/70">
                  {paxProgress.exceeded
                    ? `${paxProgress.headcount} · ${paxProgress.overBy} over ${paxProgress.target}`
                    : `${paxProgress.headcount} of ${paxProgress.target} · ${paxProgress.progressPct}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                <div
                  className={`h-full rounded-full ${paxProgress.exceeded ? 'bg-terracotta-700' : 'bg-terracotta'}`}
                  style={{ width: `${paxProgress.exceeded ? 100 : paxProgress.progressPct}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Passive progress ribbon — reflects counts, links to each stage. */}
          <div className="flex items-center gap-0.5 overflow-x-auto overscroll-x-contain">
            {(
              [
                { key: 'build', label: 'Build', Icon: PencilLine, href: buildHref({}), active: true },
                { key: 'invite', label: 'Invite', Icon: Send, href: `/dashboard/${eventId}/guests/invite`, badge: unsent, word: 'to send' },
                { key: 'confirm', label: 'Confirm', Icon: CircleCheck, href: `/dashboard/${eventId}/guests/claims`, badge: pendingClaims, word: 'to review' },
                { key: 'seat', label: 'Seat', Icon: LayoutGrid, href: `/dashboard/${eventId}/seating`, badge: unseated, word: 'to seat' },
                { key: 'dayof', label: 'Day-of', Icon: QrCode, href: `/dashboard/${eventId}/guests/checkin`, badge: arrived, done: true, word: 'arrived' },
              ] as const
            ).map((s, i) => (
              <span key={s.key} className="flex shrink-0 items-center gap-0.5">
                {i > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 text-ink/30" strokeWidth={1.75} aria-hidden />
                ) : null}
                <Link
                  href={s.href}
                  aria-current={'active' in s && s.active ? 'step' : undefined}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] ${
                    'active' in s && s.active
                      ? 'bg-terracotta/10 font-medium text-terracotta-700'
                      : 'text-ink/60'
                  }`}
                >
                  <s.Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {s.label}
                  {'badge' in s && s.badge ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-semibold ${
                        'done' in s && s.done
                          ? 'bg-success-100 text-success-800'
                          : 'bg-terracotta/15 text-terracotta-700'
                      }`}
                    >
                      {s.badge}
                      {'word' in s && s.word ? (
                        <span className="ml-1 font-normal opacity-80">{s.word}</span>
                      ) : null}
                    </span>
                  ) : null}
                </Link>
              </span>
            ))}
          </div>
        </div>

        {/* Tools — search compose row + Add, then 3-mode / RSVP / density. */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              aria-label="Filter guests"
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
            >
              <SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              {hasActiveFilter || teamFilter !== 'all' || currentRsvp ? (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-terracotta ring-2 ring-cream"
                />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setSortSheet(true)}
              aria-label="Sort guests"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
            >
              <ArrowUpDown className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            </button>
            <div className="flex-1">
              <LiveSearch initialValue={q} placeholder="Search names, roles…" />
            </div>
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              aria-pressed={addOpen}
              aria-label="Add a guest"
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                addOpen
                  ? 'bg-terracotta/10 text-terracotta-700'
                  : 'text-ink/55 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <UserPlus className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          {addOpen ? (
            <div className="rounded-xl border border-ink/10 bg-cream/60 p-3">
              <QuickAddInlineForm eventId={eventId} />
            </div>
          ) : null}

          {/* 3-mode segment (prototype `.segmode`). Roster / Groups write the
              same `sort` param the desktop uses; Day-of routes to the check-in
              desk. */}
          <div
            role="tablist"
            aria-label="Guest view mode"
            className="flex gap-0.5 rounded-full border border-ink/10 bg-ink/[0.04] p-0.5"
          >
            <ModeSeg href={buildHref({ sort: 'importance', gview: null })} active={isRosterMode}>
              Roster
            </ModeSeg>
            <ModeSeg href={buildHref({ sort: 'group', gview: null })} active={isGroupsMode}>
              Groups
            </ModeSeg>
            <ModeSeg
              href={`/dashboard/${eventId}/guests/checkin`}
              active={false}
              badge={arrived}
            >
              Day-of
            </ModeSeg>
          </div>

          {/* RSVP pills (prototype `mPills`). */}
          <div className="flex gap-1.5">
            <MPill href={buildHref({ rsvp: 'attending' })} active={currentRsvp === 'attending'} tone="attending">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {attending}
            </MPill>
            <MPill href={buildHref({ rsvp: 'pending' })} active={currentRsvp === 'pending'} tone="pending">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {pending}
            </MPill>
            <MPill href={buildHref({ rsvp: 'declined' })} active={currentRsvp === 'declined'} tone="declined">
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {declined}
            </MPill>
            <MPill href={buildHref({ rsvp: null })} active={!currentRsvp} tone="all">
              All
            </MPill>
          </div>

          {/* Density toggle + live count — or the map-mode escape hatch. */}
          {mapMode ? (
            <div className="flex items-center justify-between gap-2 text-xs text-ink/55">
              <span>Mind map is showing.</span>
              <Link
                href={buildHref({ gview: null })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-1.5 font-medium text-ink"
              >
                <List className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Back to roster
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                {isGroupsMode ? 'Your groups' : `${allVisibleIds.length} shown`}
              </span>
              {/* Density only drives the phone card grid (`sm:hidden`); on tablet
                  the desktop table renders regardless, so hide the toggle there
                  rather than dangle a no-op control. */}
              <div className="flex items-center gap-1 sm:hidden" role="group" aria-label="Card or list density">
                <DensityBtn href={buildHref({ density: null })} active={density === 'grid'} label="Card view">
                  <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </DensityBtn>
                <DensityBtn href={buildHref({ density: 'list' })} active={density === 'list'} label="Compact list view">
                  <List className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </DensityBtn>
              </div>
            </div>
          )}

          {/* Bulk select + assign (owner directive 2026-06-03) — hidden while the
              mind map is up (its own +buttons manage adds there). */}
          {mapMode ? null : (
            <CustomizePanel allVisibleIds={allVisibleIds} onAssign={() => setAssignOpen(true)} />
          )}
        </div>
      </div>

      {/* Assign bottom sheet — sibling of the carousel (not a child) so the
          carousel's overflow-hidden doesn't clip it. */}
      <AssignSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        eventId={eventId}
        groups={groups}
        bulkRoleSections={bulkRoleSections}
      />

      {/* Filter bottom sheet — opened from the compose-bar filter icon. Reuses
          the SegRow/Seg/SelectFilter controls; each writes a URL param so the
          list updates live behind the sheet (owner directive 2026-06-03). */}
      {filterSheet ? (
        <div
          ref={filterSheetRef}
          className="fixed inset-0 z-50 focus:outline-none lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filter guests"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setFilterSheet(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_-20px_rgba(30,34,41,0.4)]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Filter</h2>
              {hasActiveFilter || teamFilter !== 'all' || currentRsvp ? (
                <Link
                  href={buildHref({ team: null, rsvp: null, view: null, group: null, tag: null })}
                  onClick={() => setFilterSheet(false)}
                  className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-ink/55 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Clear all
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setFilterSheet(false)}
                  aria-label="Close"
                  className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>

            <SegRow label="Side">
              <Seg href={buildHref({ team: null })} active={teamFilter === 'all'}>
                All
              </Seg>
              <Seg href={buildHref({ team: 'bride' })} active={teamFilter === 'bride'}>
                Bride
              </Seg>
              <Seg href={buildHref({ team: 'groom' })} active={teamFilter === 'groom'}>
                Groom
              </Seg>
            </SegRow>

            <SegRow label="RSVP">
              <Seg href={buildHref({ rsvp: null })} active={!currentRsvp}>
                All
              </Seg>
              <Seg href={buildHref({ rsvp: 'attending' })} active={currentRsvp === 'attending'}>
                Going
              </Seg>
              <Seg href={buildHref({ rsvp: 'pending' })} active={currentRsvp === 'pending'}>
                Pending
              </Seg>
              <Seg href={buildHref({ rsvp: 'declined' })} active={currentRsvp === 'declined'}>
                Declined
              </Seg>
            </SegRow>

            <div className="grid grid-cols-2 gap-2">
              {/* Role + Group are independent filters now (2026-06-13) — each
                  writes its OWN param (`view` / `group`) so a host can pick a
                  role view AND a custom group at once. */}
              <SelectFilter
                label="Role"
                allLabel="All roles"
                value={activeView !== 'all' ? activeView : ''}
                options={views
                  .filter((v) => v.key !== 'all')
                  .map((v) => ({ value: v.key, label: v.label }))}
                onChange={(v) => router.push(buildHref({ view: v || null }))}
              />
              <SelectFilter
                label="Group"
                allLabel="All groups"
                value={currentGroupId ?? ''}
                disabled={groups.length === 0}
                options={groups.map((g) => ({ value: g.group_id, label: g.label }))}
                onChange={(v) => router.push(buildHref({ group: v || null }))}
              />
            </div>

            {tags.length > 0 ? (
              <SelectFilter
                label="Tags"
                allLabel="All tags"
                value={activeTag}
                options={tags.map((t) => ({ value: t, label: t }))}
                onChange={(v) => router.push(buildHref({ tag: v || null }))}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Sort bottom sheet — opened from the compose-bar sort icon. */}
      {sortSheet ? (
        <div
          ref={sortSheetRef}
          className="fixed inset-0 z-50 focus:outline-none lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Sort guests"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSortSheet(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_-20px_rgba(30,34,41,0.4)]">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Sort by</h2>
              <button
                type="button"
                onClick={() => setSortSheet(false)}
                aria-label="Close"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="grid gap-1">
              {sorts.map((s) => (
                <Link
                  key={s.key}
                  href={buildHref({ sort: s.key })}
                  onClick={() => setSortSheet(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors ${
                    currentSort === s.key
                      ? 'bg-terracotta/10 font-semibold text-terracotta-700'
                      : 'text-ink/80 hover:bg-ink/5'
                  }`}
                >
                  {s.label}
                  {currentSort === s.key ? (
                    <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// SegRow / Seg — an iOS-style segmented toggle (label + a connected pill
// group) for the small fixed-set filters (Side, RSVP). Each Seg is a Link
// that flips one URL param, so filters compose and survive refresh.
function SegRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/45">
        {label}
      </span>
      <div className="flex flex-1 gap-0.5 rounded-lg bg-ink/5 p-0.5">{children}</div>
    </div>
  );
}

function Seg({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`flex-1 rounded-md py-1.5 text-center text-[11px] font-medium transition-colors ${
        active ? 'bg-cream text-terracotta-700 shadow-sm ring-1 ring-ink/5' : 'text-ink/55 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

// SelectFilter — a compact native <select> (label prefix + value) for the
// larger / variable-length filters (Role, Group, Tags) and Sort. Native on
// purpose: the OS picker handles long option lists without taking panel
// height. onChange navigates via the router (client) using the shared
// buildHref so the change merges with the live params.
function SelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`flex min-w-0 items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-2.5 py-2 ${
        disabled ? 'opacity-50' : 'focus-within:border-terracotta'
      } ${className ?? ''}`}
    >
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/45">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-[12px] font-medium text-ink focus:outline-none disabled:cursor-not-allowed"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// InviteButton — the masthead's Invite affordance (Living Roster P4). Opens the
// native share sheet when the device offers it, otherwise copies the join link
// to the clipboard with a transient "Copied" confirmation. `joinUrl` is the
// couple's share-invite URL, fetched server-side in page.tsx.
function InviteButton({ joinUrl }: { joinUrl: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'You’re invited', url: joinUrl });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — the desktop ShareDropdown remains the fallback.
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share the guest invite link"
      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/80 hover:border-ink/30"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} aria-hidden />
      ) : (
        <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      )}
      {copied ? 'Copied' : 'Invite'}
    </button>
  );
}

// ModeSeg — one segment of the 3-mode Roster / Groups / Day-of switch. A Link
// (URL-driven, no client state) styled as a segmented-control tab; role=tab +
// aria-selected give it correct a11y semantics inside the tablist.
function ModeSeg({
  href,
  active,
  badge,
  children,
}: {
  href: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium transition-colors ${
        active ? 'bg-cream text-ink shadow-sm ring-1 ring-ink/5' : 'text-ink/55 hover:text-ink'
      }`}
    >
      {children}
      {badge ? (
        <span className="rounded-full bg-success-100 px-1.5 text-[10px] font-semibold text-success-800">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

// MPill — an RSVP filter pill (prototype `mPills`). A Link that flips the `rsvp`
// URL param; aria-current marks the live filter for assistive tech.
function MPill({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone: 'attending' | 'pending' | 'declined' | 'all';
  children: React.ReactNode;
}) {
  const on: Record<typeof tone, string> = {
    attending: 'border-transparent bg-success-100 text-success-800',
    pending: 'border-transparent bg-warn-100 text-warn-800',
    declined: 'border-transparent bg-danger-100 text-danger-800',
    all: 'border-transparent bg-ink/10 text-ink/80',
  };
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
        active ? on[tone] : 'border-ink/15 text-ink/55 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

// DensityBtn — one of the grid / list density toggles for the roster below. A
// Link that flips the `density` URL param (GuestListMultiselect reads it), with
// aria-current so the active layout is announced.
function DensityBtn({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      title={label}
      className={`inline-flex h-8 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
          : 'border-ink/12 text-ink/45 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Inline quick-entry form for the Add carousel panel.
 *
 * Flow (endless cycle — there is no "finish" key; the panel simply stays
 * ready for the next guest. Owner directive 2026-06-03: no more double-Enter):
 *   Enter on first name  → moves focus to last name (no-op if first is empty)
 *   Enter on last name   → adds the guest, clears both fields, loops to first name
 */
function QuickAddInlineForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [addError, setAddError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  const addGuest = async () => {
    // Both names are required (the server enforces this too, but check
    // client-side first so the user gets instant feedback).
    if (!first.trim() || !last.trim() || busy) return;
    setAddError('');
    setBusy(true);
    try {
      const result = await quickAddGuest(eventId, {
        first_name: first.trim(),
        last_name: last.trim(),
        side: 'both',
        role: 'guest',
      });
      if (!result.ok) {
        // Server returned a specific error (validation, DB constraint, etc.).
        // Surface it immediately rather than silently clearing the form.
        setAddError(result.error);
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Add guest',
          filePath:
            'app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx',
          error: result.error,
          payload: { eventId },
        });
        return;
      }
      setCount((n) => n + 1);
      setFirst('');
      setLast('');
      router.refresh();
      // Return the cursor to First name for the next rapid entry. DEFERRED a
      // tick on purpose: at this point the inputs are still disabled={busy}
      // (busy resets in the finally below, which hasn't run yet), and focus()
      // is a no-op on a disabled element — so a synchronous call here silently
      // failed to loop back (owner-reported 2026-06-03). The timeout lets React
      // flush busy=false + re-enable the field first. Mirrors QuickAddSheet.
      setTimeout(() => firstRef.current?.focus(), 0);
    } catch {
      setAddError('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Empty first name + Enter is a no-op — the rapid-add loop never "finishes"
    // (owner directive 2026-06-03: no more double-Enter to end the session).
    if (!first.trim()) return;
    lastRef.current?.focus();
  };

  const handleLastKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Require last name before submitting — don't fire addGuest on an empty field.
    if (!last.trim()) return;
    void addGuest();
  };

  const inputCls =
    'w-full rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none disabled:opacity-50';

  return (
    // The session count sits above the inputs; first + last share one row so
    // the panel stays compact under the top tab bar.
    <div className="flex flex-col gap-3">
      {addError ? (
        <p className="text-center text-xs font-medium text-danger-600">{addError}</p>
      ) : count > 0 ? (
        <p className="text-center text-xs text-ink/50">
          {count} {count === 1 ? 'guest' : 'guests'} added this session
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <input
          ref={firstRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="First name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={handleFirstKeyDown}
          disabled={busy}
          className={inputCls}
        />
        <input
          ref={lastRef}
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Last name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={handleLastKeyDown}
          disabled={busy}
          className={inputCls}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Customize panel — select guests + bulk-assign (owner directive
// 2026-06-03). Reads/writes the shared selection store so the card
// checkboxes (in GuestListMultiselect) and this panel stay in lockstep.
// `selectMode` off → a "Select guests" entry button; on → select-all +
// live count + Assign (which opens the bottom sheet).
// -----------------------------------------------------------------------
function CustomizePanel({
  allVisibleIds,
  onAssign,
}: {
  allVisibleIds: string[];
  onAssign: () => void;
}) {
  const { selectMode, ids: selectedIds } = useGuestSelection();
  const count = selectedIds.length;
  const allSelected = allVisibleIds.length > 0 && count === allVisibleIds.length;
  const someSelected = count > 0 && !allSelected;

  // Entry button only when nothing is going on. If anything is selected (e.g.
  // via the always-on desktop/tablet table checkboxes) show the select bar so
  // the selection isn't stranded behind the entry button.
  if (!selectMode && count === 0) {
    return (
      <section className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6 py-6 text-center">
        <button
          type="button"
          onClick={() => guestSelection.enter()}
          className="inline-flex items-center gap-2 rounded-xl bg-mulberry px-4 py-2.5 text-sm font-semibold text-cream hover:bg-mulberry-600"
        >
          <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
          Select guests
        </button>
      </section>
    );
  }

  return (
    <section className="flex w-full shrink-0 snap-center flex-row items-center justify-between gap-2 px-1 py-3">
      <label className="inline-flex shrink-0 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={() =>
            allSelected
              ? guestSelection.clear()
              : guestSelection.setAll(allVisibleIds)
          }
          aria-label={allSelected ? 'Deselect all' : 'Select all guests in view'}
          className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
        />
        Select all
      </label>

      <button
        type="button"
        onClick={onAssign}
        disabled={count === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-2.5 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Assign{count > 0 ? ` ${count}` : ''}
      </button>

      <button
        type="button"
        onClick={() => guestSelection.exit()}
        className="shrink-0 text-[11px] font-medium text-ink/55 hover:text-ink"
      >
        Done
      </button>
    </section>
  );
}

// -----------------------------------------------------------------------
// Assign bottom sheet — Side / Role / Group, with a create-new-group text
// box under Group (owner directive 2026-06-03). Two-step: pick a dimension,
// then a value. Each value dispatches the existing bulk server action with
// the current selection, then optimistically clears selection + closes.
// -----------------------------------------------------------------------
function AssignSheet({
  open,
  onClose,
  eventId,
  groups,
  bulkRoleSections,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  groups: Group[];
  bulkRoleSections: RoleSection[];
}) {
  const { ids: selectedIds } = useGuestSelection();
  const count = selectedIds.length;
  const [step, setStep] = useState<'menu' | 'side' | 'role' | 'group'>('menu');
  const [newGroup, setNewGroup] = useState('');
  const [, startTransition] = useTransition();

  // Focus management for the Assign bottom sheet (focus trap, Esc-to-close,
  // body-scroll-lock, focus-restore). `open` is passed straight through so the
  // hook tracks the parent's open-state even though the body early-returns null
  // while closed (the hook must run unconditionally before any return).
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  // Reset to the menu each time the sheet opens.
  useEffect(() => {
    if (open) {
      setStep('menu');
      setNewGroup('');
    }
  }, [open]);

  if (!open) return null;

  const dispatch = (
    build: (fd: FormData) => void,
    action: (eventId: string, formData: FormData) => Promise<void>,
  ) => {
    if (selectedIds.length === 0) return;
    const fd = new FormData();
    for (const id of selectedIds) fd.append('guest_ids[]', id);
    build(fd);
    startTransition(async () => {
      await action(eventId, fd);
    });
    // Optimistic: the FormData snapshot already holds the ids, so clearing
    // the selection + closing now is safe and feels instant. The server
    // action revalidates the list either way.
    guestSelection.exit();
    onClose();
  };

  const applySide = (side: GuestSide) =>
    dispatch((fd) => fd.set('side', side), bulkApplyRoleAndGroup);
  const applyRole = (role: GuestRole) =>
    dispatch((fd) => fd.set('role', role), bulkApplyRoleAndGroup);
  const applyGroup = (groupId: string) =>
    dispatch((fd) => fd.set('group_id', groupId), bulkApplyRoleAndGroup);
  const createAndAdd = () => {
    const label = newGroup.trim();
    if (!label) return;
    dispatch((fd) => {
      fd.set('label', label);
      fd.set('team_side', 'both');
    }, createGuestGroup);
  };

  const title =
    step === 'side'
      ? 'Set side'
      : step === 'role'
        ? 'Set role'
        : step === 'group'
          ? 'Add to group'
          : `Assign ${count} guest${count === 1 ? '' : 's'}`;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 focus:outline-none lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Assign to selected guests"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_-20px_rgba(30,34,41,0.4)]">
        <div className="mb-3 flex items-center gap-2">
          {step !== 'menu' ? (
            <button
              type="button"
              onClick={() => setStep('menu')}
              aria-label="Back"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {step === 'menu' ? (
          <div className="grid gap-2">
            <SheetChoice
              label="Side"
              hint="Bride · Groom · Both"
              onClick={() => setStep('side')}
            />
            <SheetChoice
              label="Role"
              hint="Wedding party, sponsors, family…"
              onClick={() => setStep('role')}
            />
            <SheetChoice
              label="Group"
              hint="Add to a group or create a new one"
              onClick={() => setStep('group')}
            />
          </div>
        ) : null}

        {step === 'side' ? (
          <div className="flex flex-wrap gap-2">
            {SIDES.map((s) => (
              <SheetPill key={s} onClick={() => applySide(s)}>
                {SIDE_LABELS[s]}
              </SheetPill>
            ))}
          </div>
        ) : null}

        {step === 'role' ? (
          <div className="space-y-3">
            {bulkRoleSections.map((section) => (
              <div key={section.label}>
                <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  {section.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {section.roles.map((r) => (
                    <SheetPill key={r} onClick={() => applyRole(r)}>
                      {ROLE_LABELS[r]}
                    </SheetPill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {step === 'group' ? (
          <div className="space-y-3">
            {groups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <SheetPill key={g.group_id} onClick={() => applyGroup(g.group_id)}>
                    {g.label}
                  </SheetPill>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink/50">No groups yet — create one below.</p>
            )}
            <div className="flex items-center gap-2 border-t border-ink/10 pt-3">
              <input
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                maxLength={64}
                placeholder="New group name"
                className="flex-1 rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
              />
              <button
                type="button"
                onClick={createAndAdd}
                disabled={!newGroup.trim()}
                className="inline-flex items-center rounded-xl bg-mulberry px-4 py-2.5 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SheetChoice({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-ink/15 bg-cream px-4 py-3 text-left hover:border-ink/30"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-[11px] text-ink/50">{hint}</span>
      </span>
      <ChevronLeft
        className="h-4 w-4 rotate-180 text-ink/40"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}

function SheetPill({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-ink/15 bg-ink/5 px-3 py-1.5 text-sm text-ink/80 hover:border-terracotta/40 hover:bg-terracotta/10 hover:text-terracotta-700"
    >
      {children}
    </button>
  );
}
