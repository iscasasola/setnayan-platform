'use client';

/**
 * MobileGuestCarousel — the Guests-page control surface on phones/tablets
 * (iteration 0001, 2026-06-02 · re-homed to TOP-OF-PAGE TABS 2026-06-15).
 *
 * Owner directive 2026-06-15 (nav patch FIX B): the Guests page had TWO
 * stacked bottom bars — the global journey nav AND this carousel's own
 * bottom-docked sheet (a second fixed bar with the 5 pills + a search input +
 * sort/filter). The owner picked: drop the second bottom bar and present the
 * five sub-views (Summary · Search · Add · Customize · Journey) as TOP-OF-PAGE
 * pill tabs using the app's canonical in-page menu pattern `.sn-seg`. So this
 * component is now an IN-FLOW block at the top of the mobile guest area — a
 * `.sn-seg` tab row with the active panel rendered directly below it — NOT a
 * fixed sheet docked above the bottom nav. Net result on the Guests page:
 * exactly ONE bottom bar (the global journey nav); the Guests sub-views are
 * top tabs.
 *
 * The FIVE panels are unchanged in function (only their host moved):
 *   1. Summary  — [Total][Attending][Pending][Declined] as boxed,
 *                 animated count-up boxes; each box is also an RSVP filter
 *                 link, so mobile keeps RSVP filtering (Total clears it)
 *   2. Search   — LiveSearch + filter/sort icons that open the same filter +
 *                 sort bottom sheets (Side + RSVP toggles, Role + Group +
 *                 Tags dropdowns, sort list)
 *   3. Add      — inline rapid quick-add form (+ Quick-add list + Import CSV)
 *   4. Customize — select guests + bulk-assign Side / Role / Group via the
 *                 Assign sheet (a "switch to list" hint in mind-map mode)
 *   5. Journey  — the guest lifecycle (Build→Invite→Confirm→Seat→Day-of) +
 *                 the List/Mind-map view switch (redesign Phase 1; the mobile
 *                 twin of the desktop ribbon + switcher)
 *
 * Tab switching is state-driven (`active`) + tap-to-switch on the `.sn-seg`
 * pills. Horizontal swipe between panels is retained (the panels still live in
 * a scroll-snap track) so the original swipe gesture keeps working. All
 * `lg:hidden` — desktop keeps the inline Toolbar + sticky FacetsSidebar +
 * SummaryStrip untouched.
 *
 * The filter + sort + assign bottom SHEETS (modal overlays opened from the
 * Search panel / Customize panel) are kept as-is — they're transient dialogs,
 * not a persistent second nav bar, so they don't violate the one-bottom-bar
 * rule.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, BarChart3, Check, ChevronLeft, ChevronRight, CircleCheck, LayoutGrid, List, Network, PencilLine, QrCode, Route, Search, Send, SlidersHorizontal, UserPlus, X } from 'lucide-react';
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
import { BULK_ROLE_SECTIONS } from './guest-list-multiselect';
import { guestSelection, useGuestSelection } from './guest-selection-store';

type Opt = { key: string; label: string };
type Group = { group_id: string; label: string; member_count?: number };

const PANELS = [
  { key: 'summary', label: 'Summary', icon: BarChart3 },
  { key: 'find', label: 'Search', icon: Search },
  { key: 'add', label: 'Add', icon: UserPlus },
  { key: 'customize', label: 'Customize', icon: SlidersHorizontal },
  // Journey — the guest lifecycle (Build → Invite → Confirm → Seat → Day-of)
  // + the List/Mind-map view switch, mobile home (redesign Phase 1; the desktop
  // ribbon + switcher live in the page chrome, which is hidden below lg).
  { key: 'journey', label: 'Journey', icon: Route },
] as const;

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
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  // Filter / sort bottom sheets opened from the search compose-bar icons
  // (owner directive 2026-06-03 — Messenger-style icons left of the search).
  const [filterSheet, setFilterSheet] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

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

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    setActive(i);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) setActive(i);
  };

  const hasActiveFilter =
    Boolean(currentGroupId) ||
    (Boolean(activeView) && activeView !== 'all') ||
    Boolean(activeTag);

  const currentRsvp = searchParams.get('rsvp') ?? '';
  // In Mind-map mode the guest LIST isn't rendered (page swaps in GuestMindMap),
  // so the carousel's bulk-select would act on guests the user can't see. Gate
  // Customize to a "switch to list" hint while the map is up.
  const mapMode = searchParams.get('gview') === 'map';

  return (
    <>
      {/* TOP-OF-PAGE TAB BAR (FIX B 2026-06-15) — the five Guests sub-views as
          `.sn-seg` pill tabs, the app's canonical in-page menu pattern. This is
          an IN-FLOW block at the top of the mobile guest area (mounted above the
          guest list on the page), NOT a fixed bottom-docked sheet — so the page
          shows exactly ONE bottom bar (the global journey nav). lg:hidden:
          desktop keeps the inline Toolbar + sticky FacetsSidebar. */}
      <div className="lg:hidden">
        <nav aria-label="Guest panels" role="tablist">
          <ul className="sn-seg w-full">
            {PANELS.map((p, i) => {
              const Icon = p.icon;
              const isActive = active === i;
              return (
                <li key={p.key} className="contents">
                  <button
                    type="button"
                    role="tab"
                    onClick={() => goTo(i)}
                    aria-selected={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    className={`sn-seg-item flex-col gap-0.5 px-1 ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={1.75}
                      className="h-[20px] w-[20px]"
                    />
                    <span
                      className={`text-[10px] tracking-wide ${isActive ? 'font-semibold' : ''}`}
                    >
                      {p.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* swipe track — the 5 panels, scroll-snap, in-flow below the tabs.
              Tap a pill above OR swipe to jump between panels. The active
              panel's intrinsic height drives this block's height (no fixed
              sheet, no measured open-height, no grabber). */}
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="mt-3 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
          {/* 1 — Summary: animated RSVP counts (also filter links). Four
              stats sit on ONE row so the panel is as low as the search row. */}
          <section className="w-full shrink-0 snap-center px-1 py-3">
            {/* Pax-target meter (Adaptive Pax Pricing Phase 2) — sure-attending
                vs the couple's minimum pax. Hidden when no target is set. */}
            {paxProgress ? (
              <div className="mb-3">
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
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full ${paxProgress.exceeded ? 'bg-terracotta-700' : 'bg-terracotta'}`}
                    style={{ width: `${paxProgress.exceeded ? 100 : paxProgress.progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
              <StatBox
                label="Total"
                value={total}
                tint="text-ink"
                href={buildHref({ rsvp: null })}
                active={!currentRsvp}
              />
              <StatBox
                label="Attending"
                value={attending}
                tint="text-success-700"
                href={buildHref({ rsvp: 'attending' })}
                active={currentRsvp === 'attending'}
              />
              <StatBox
                label="Pending"
                value={pending}
                tint="text-warn-700"
                href={buildHref({ rsvp: 'pending' })}
                active={currentRsvp === 'pending'}
              />
              <StatBox
                label="Declined"
                value={declined}
                tint="text-danger-700"
                href={buildHref({ rsvp: 'declined' })}
                active={currentRsvp === 'declined'}
              />
            </div>
          </section>

          {/* 2 — Search: Messenger-style compose bar — the search input with
              filter + sort as icons on its LEFT (owner directive 2026-06-03 —
              "filtering and sorting will be similar to the icons on the left of
              the search bar"). The filters + sort live in bottom sheets opened
              from the icons. */}
          <section className="flex w-full shrink-0 snap-center flex-col justify-start px-1 py-3">
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
            </div>
          </section>

          {/* 3 — Add: inline quick-entry form. */}
          <section className="flex w-full shrink-0 snap-center flex-col justify-start px-1 py-3">
            <QuickAddInlineForm eventId={eventId} />
          </section>

          {/* 4 — Customize: select guests + bulk-assign (owner directive
              2026-06-03). Tap "Select" → checkboxes appear on the cards; the
              select-all + live count + Assign live here; Assign opens the
              bottom sheet (Side / Role / Group, with a create-new text box). */}
          {mapMode ? (
            <section className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-2 px-6 py-6 text-center">
              <p className="text-sm text-ink/60">
                Bulk-select works in list view. The mind map adds people with its
                own <span aria-hidden>+</span> buttons.
              </p>
              <Link
                href={buildHref({ gview: null })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
              >
                <List className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Switch to list
              </Link>
            </section>
          ) : (
            <CustomizePanel
              allVisibleIds={allVisibleIds}
              onAssign={() => setAssignOpen(true)}
            />
          )}

          {/* 5 — Journey: the guest lifecycle + the List/Mind-map view switch
              (redesign Phase 1). Mobile twin of the desktop ribbon + switcher. */}
          <section className="w-full shrink-0 snap-center space-y-3 px-1 py-3">
            <div className="flex items-center gap-0.5 overflow-x-auto overscroll-x-contain">
              {(
                [
                  { key: 'build', label: 'Build', Icon: PencilLine, href: buildHref({}), active: true },
                  { key: 'invite', label: 'Invite', Icon: Send, href: `/dashboard/${eventId}/guests/claims`, badge: unsent, word: 'to send' },
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
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] ${
                      'active' in s && s.active
                        ? 'bg-terracotta/10 font-medium text-terracotta-700'
                        : 'text-ink/60'
                    }`}
                  >
                    <s.Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
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
            <div role="tablist" aria-label="Guest list view" className="flex rounded-lg border border-ink/15 bg-cream p-0.5">
              <Link
                href={buildHref({ gview: null })}
                role="tab"
                aria-selected={searchParams.get('gview') !== 'map'}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm ${
                  searchParams.get('gview') !== 'map'
                    ? 'bg-white font-medium text-ink shadow-sm'
                    : 'text-ink/55'
                }`}
              >
                <List className="h-4 w-4" strokeWidth={1.75} aria-hidden /> List
              </Link>
              <Link
                href={buildHref({ gview: 'map' })}
                role="tab"
                aria-selected={searchParams.get('gview') === 'map'}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm ${
                  searchParams.get('gview') === 'map'
                    ? 'bg-white font-medium text-ink shadow-sm'
                    : 'text-ink/55'
                }`}
              >
                <Network className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Mind map
              </Link>
            </div>
          </section>
          </div>
        </nav>
      </div>

      {/* Assign bottom sheet — sibling of the carousel (not a child) so the
          carousel's overflow-hidden doesn't clip it. */}
      <AssignSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        eventId={eventId}
        groups={groups}
      />

      {/* Filter bottom sheet — opened from the compose-bar filter icon. Reuses
          the SegRow/Seg/SelectFilter controls; each writes a URL param so the
          list updates live behind the sheet (owner directive 2026-06-03). */}
      {filterSheet ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
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
          className="fixed inset-0 z-50 lg:hidden"
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

function StatBox({
  label,
  value,
  tint,
  href,
  active,
}: {
  label: string;
  value: number;
  tint: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center transition-colors ${
        active ? 'border-terracotta bg-terracotta/5' : 'border-ink/10 hover:border-ink/25'
      }`}
    >
      <span className="font-mono text-[8px] uppercase tracking-[0.04em] text-ink/50 whitespace-nowrap">
        {label}
      </span>
      <span className={`text-[22px] font-semibold leading-tight tabular-nums ${tint}`}>
        <AnimatedCount value={value} />
      </span>
    </Link>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setN(0);
      return;
    }
    let raf = 0;
    const dur = 700;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString('en-US')}</>;
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
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  groups: Group[];
}) {
  const { ids: selectedIds } = useGuestSelection();
  const count = selectedIds.length;
  const [step, setStep] = useState<'menu' | 'side' | 'role' | 'group'>('menu');
  const [newGroup, setNewGroup] = useState('');
  const [, startTransition] = useTransition();

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
      className="fixed inset-0 z-50 lg:hidden"
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
            {BULK_ROLE_SECTIONS.map((section) => (
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
