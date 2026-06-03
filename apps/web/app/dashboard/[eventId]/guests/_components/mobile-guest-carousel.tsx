'use client';

/**
 * MobileGuestCarousel — the lower-third control surface on phones/tablets
 * for the Guests page (iteration 0001, 2026-06-02).
 *
 * Owner directive: "mobile version — the top part of the screen will be
 * just the guest list, scrollable, and the lower third is a carousel:
 * first is searching and sorting, second is adding, third is customizing
 * the list / changing details."
 *
 * Layout: the guest list scrolls in the top region; this component docks a
 * fixed, ~one-third-height panel sheet at the bottom of the screen, with the
 * 4 guest menus rendered as a real bottom-nav bar pinned to the very bottom
 * edge BELOW the sheet (owner directive 2026-06-03 — "place the 4 menus of
 * guest as bottom nav, not on the top of carousel"). In FOCUS MODE the global
 * 5-tab nav is already hidden on the Guests page, so this 4-item menu IS the
 * page's bottom navigation. It is four swipeable panels (owner directive
 * 2026-06-02 — the top is now JUST
 * the guest list, so the RSVP counts that used to sit in the page's top
 * StatsStrip move into the Summary panel here):
 *   1. Summary  — [Total][Attending][Pending][Declined] as boxed,
 *                 animated count-up boxes; each box is also an RSVP filter
 *                 link, so mobile keeps RSVP filtering (Total clears it)
 *   2. Find     — LiveSearch + the 4-dimension filter laid out to fit with
 *                 NO vertical scroll: Side + RSVP as segmented toggles, Role
 *                 + Group (+ Tags when present) as dropdowns, plus a Sort
 *                 dropdown (owner directive 2026-06-03)
 *   3. Add      — opens the existing QuickAddSheet (rapid add + dup detect
 *                 + multi-role) + Quick-add list + Import CSV
 *   4. Customize — select guests + bulk-assign Side / Role / Group via the
 *                 Assign sheet
 *
 * Supersedes the single docked MobileActionBar. The 4-item bottom nav (the
 * guest menus, rendered below the sheet) jumps between panels; horizontal
 * swipe works too. All `lg:hidden` — desktop keeps the inline Toolbar +
 * sticky FacetsSidebar + StatsStrip untouched.
 *
 * Sheet height comes from `--gcar-h` set on the page <section>; the component
 * renders an in-flow spacer covering the sheet + the bottom-nav strip so the
 * guest list's last rows clear both. Sheet + nav sit at z-40 (above page
 * content). The global 5-tab nav is suppressed on the Guests route
 * (CustomerBottomNav returns null in focus mode), so the only bottom chrome
 * is this panel sheet + its 4-item menu nav.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Check, ChevronDown, ChevronLeft, Search, SlidersHorizontal, UserPlus, X } from 'lucide-react';
import {
  ROLE_LABELS,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { LiveSearch } from './live-search';
import { quickAddGuest } from '../quick-add-actions';
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
] as const;

const SIDES: GuestSide[] = ['bride', 'groom', 'both'];

// useKeyboardInset — the on-screen keyboard's height in px (0 when closed) via
// the VisualViewport API. iOS Safari keeps window.innerHeight at the full
// LAYOUT height and shrinks visualViewport when the keyboard opens, so the gap
// below the visual viewport IS the keyboard (+ its accessory bar). We use it to
// pin the fixed sheet directly above the keyboard instead of letting iOS float
// it into the middle of the screen with dead space (owner-reported 2026-06-03).
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const gap = window.innerHeight - vv.height - vv.offsetTop;
        setInset(gap > 0 ? Math.round(gap) : 0);
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

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
  teamFilter,
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
  teamFilter: 'all' | 'bride' | 'groom';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  // Collapse the panel sheet down to just its grabber handle so the guest list
  // above stretches (owner 2026-06-03). The keyboard state takes precedence.
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // When the keyboard is open, pin the sheet right above it (and hide the
  // bottom nav) so typing in Add/Search isn't shoved into the middle of the
  // screen — the guest list keeps the rest of the height. The > 100 guard
  // ignores small visual-viewport jitters so only a real keyboard triggers it.
  const kbInset = useKeyboardInset();
  const kbOpen = kbInset > 100;

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

  return (
    <>
      {/* in-flow spacer covering the panel sheet + the bottom-nav strip so the
          guest list's last rows clear both fixed elements */}
      <div
        aria-hidden
        className="h-[calc(var(--gcar-h)+4rem+env(safe-area-inset-bottom))] lg:hidden"
        style={
          // Keep the collapse-grabber feature, but do NOT collapse this spacer
          // when the keyboard opens — that 348px→0 shift was the reflow that
          // made iOS deliver the tap to a guest card (owner-reported 2026-06-03).
          !kbOpen && collapsed
            ? { height: 'calc(2.25rem + 4rem + env(safe-area-inset-bottom))' }
            : undefined
        }
      />

      {/* Panel content sheet — docked directly ABOVE the guest bottom nav (the
          4-menu strip rendered after this block). One soft upward shadow + a
          single hairline ring + rounded top reads as "window above / nav
          below". Owner directive 2026-06-03: the 4 menus moved OUT of the top
          of this sheet and BECAME the bottom nav, so this sheet now holds only
          the active panel. */}
      <div
        className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex h-[var(--gcar-h)] flex-col overflow-hidden rounded-t-2xl bg-cream shadow-[0_-12px_30px_-18px_rgba(30,34,41,0.28)] ring-1 ring-ink/10 lg:hidden ${kbOpen ? '' : 'transition-[height] duration-200 ease-out'}`}
        style={
          kbOpen
            ? { bottom: kbInset, height: active === 2 ? 190 : undefined }
            : collapsed
              ? { height: '2.25rem' }
              : undefined
        }
      >
        {/* Grabber — tap to collapse the panel down to this handle so the guest
            list above stretches; tap again to expand. Hidden while typing. */}
        {!kbOpen && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            className="flex h-9 shrink-0 items-center justify-center gap-2 text-ink/40 transition-colors active:text-ink/70"
          >
            <span aria-hidden className="h-1.5 w-9 rounded-full bg-ink/25" />
            <ChevronDown
              aria-hidden
              strokeWidth={2.5}
              className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        )}
        {/* swipe track — 4 panels, scroll-snap; full sheet height now that the
            tab strip moved to the bottom nav. Tap a nav item OR swipe to jump. */}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* 1 — Summary: animated RSVP counts (also filter links) */}
          <section className="w-full shrink-0 snap-center overflow-y-auto px-4 py-3">
            <div className="grid h-full grid-cols-2 content-center gap-2.5">
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
                tint="text-emerald-700"
                href={buildHref({ rsvp: 'attending' })}
                active={currentRsvp === 'attending'}
              />
              <StatBox
                label="Pending"
                value={pending}
                tint="text-amber-700"
                href={buildHref({ rsvp: 'pending' })}
                active={currentRsvp === 'pending'}
              />
              <StatBox
                label="Declined"
                value={declined}
                tint="text-rose-700"
                href={buildHref({ rsvp: 'declined' })}
                active={currentRsvp === 'declined'}
              />
            </div>
          </section>

          {/* 2 — Find: search + the 4-dimension filter (Side · RSVP · Role ·
              Group), laid out to fit WITHOUT vertical scroll (owner directive
              2026-06-03 — "show all of these without scrolling"). Side + RSVP
              are inline segmented toggles (small fixed sets); Role + Group are
              dropdowns (larger/variable), two-up to save height; Sort is a
              compact dropdown. Tags stay searchable via the box above + get an
              optional dropdown only when the couple added custom tags. */}
          <section
            className={`flex w-full shrink-0 snap-center flex-col gap-2.5 overflow-y-auto px-4 py-3 ${
              kbOpen ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* SIDE — segmented. "Bride"/"Groom" include both-side guests,
                matching the desktop team filter, so there's no separate Both. */}
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

            {/* RSVP — segmented */}
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

            {/* ROLE + GROUP — dropdowns. They share the ?view param, so picking
                one resets the other to "All" (the server filters by one at a
                time). Two-up to keep the whole panel within one screen. */}
            <div className="grid grid-cols-2 gap-2">
              <SelectFilter
                label="Role"
                allLabel="All roles"
                value={!currentGroupId && activeView !== 'all' ? activeView : ''}
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
                onChange={(v) => router.push(buildHref({ view: v ? `group:${v}` : null }))}
              />
            </div>

            {/* TAGS — optional dropdown, only when custom tags exist. */}
            {tags.length > 0 ? (
              <SelectFilter
                label="Tags"
                allLabel="All tags"
                value={activeTag}
                options={tags.map((t) => ({ value: t, label: t }))}
                onChange={(v) => router.push(buildHref({ tag: v || null }))}
              />
            ) : null}

            {/* SORT dropdown + Clear-all */}
            <div className="flex items-center gap-2">
              <SelectFilter
                className="flex-1"
                label="Sort"
                value={currentSort}
                options={sorts.map((s) => ({ value: s.key, label: s.label }))}
                onChange={(v) => router.push(buildHref({ sort: v }))}
              />
              {hasActiveFilter || teamFilter !== 'all' || currentRsvp ? (
                <Link
                  href={buildHref({ team: null, rsvp: null, view: null, tag: null })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium text-ink/55 hover:bg-ink/5 hover:text-ink"
                >
                  <X className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Clear
                </Link>
              ) : null}
            </div>

            {/* Search box LAST so it sits flush above the keyboard (owner
                directive 2026-06-03 — "place the search box at the bottom and
                above it are the filters"). */}
            <LiveSearch initialValue={q} placeholder="Name, side, role, group…" />
          </section>

          {/* 3 — Add: inline quick-entry form. justify-end when the keyboard is
              up so the two inputs sit flush above it. */}
          <section
            className={`flex w-full shrink-0 snap-center flex-col px-4 py-3 ${
              kbOpen ? 'justify-end' : 'justify-center'
            }`}
          >
            <QuickAddInlineForm eventId={eventId} kbOpen={kbOpen} />
          </section>

          {/* 4 — Customize: select guests + bulk-assign (owner directive
              2026-06-03). Tap "Select" → checkboxes appear on the cards; the
              select-all + live count + Assign live here; Assign opens the
              bottom sheet (Side / Role / Group, with a create-new text box). */}
          <CustomizePanel
            allVisibleIds={allVisibleIds}
            onAssign={() => setAssignOpen(true)}
          />
        </div>
      </div>

      {/* The 4 guest menus AS a bottom nav (owner directive 2026-06-03 — "place
          the 4 menus of guest as bottom nav, not on the top of carousel").
          Pinned to the very bottom edge, it mirrors the global BottomNav visual
          language (icon + label · terracotta active). Tapping an item jumps the
          sheet above to that panel; the active panel highlights here. */}
      <nav
        aria-label="Guest panels"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden ${
          kbOpen ? 'hidden' : ''
        }`}
      >
        <ul className="grid grid-cols-4 px-1 py-1">
          {PANELS.map((p, i) => {
            const Icon = p.icon;
            const isActive = active === i;
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex min-h-[56px] min-h-[44pt] w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-ink/5"
                >
                  <Icon
                    aria-hidden
                    strokeWidth={1.75}
                    className={`h-[22px] w-[22px] ${isActive ? 'text-terracotta' : 'text-ink/45'}`}
                  />
                  <span
                    className={`text-[10px] tracking-wide ${
                      isActive ? 'font-semibold text-ink' : 'text-ink/55'
                    }`}
                  >
                    {p.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Assign bottom sheet — sibling of the carousel (not a child) so the
          carousel's overflow-hidden doesn't clip it. */}
      <AssignSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        eventId={eventId}
        groups={groups}
      />
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
      className={`flex flex-col justify-center rounded-xl border px-3.5 py-2 transition-colors ${
        active ? 'border-terracotta bg-terracotta/5' : 'border-ink/10 hover:border-ink/25'
      }`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/50">
        {label}
      </span>
      <span className={`mt-0.5 text-[26px] font-semibold leading-tight tabular-nums ${tint}`}>
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
function QuickAddInlineForm({ eventId, kbOpen }: { eventId: string; kbOpen: boolean }) {
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
    // Inputs LAST so they sit flush above the keyboard (owner directive
    // 2026-06-03 — "keyboard then straight to the text box"); the helper +
    // session count move above them. justify-end docks the stack to the
    // bottom while the keyboard is up.
    <div
      className={`flex h-full flex-col gap-3 ${
        kbOpen ? 'justify-end' : 'justify-center'
      }`}
    >
      {addError ? (
        <p className="text-center text-xs font-medium text-rose-600">{addError}</p>
      ) : (
        <p className="text-center text-[11px] leading-snug text-ink/40">
          Enter after first name moves to last name · Enter after last name adds &amp; loops back
        </p>
      )}

      {count > 0 && !addError && (
        <p className="text-center text-xs text-ink/50">
          {count} {count === 1 ? 'guest' : 'guests'} added this session
        </p>
      )}

      <div className="space-y-2">
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
      <section className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-3 px-6 py-3 text-center">
        <p className="text-sm font-semibold text-ink">Select &amp; assign</p>
        <p className="max-w-[260px] text-xs leading-snug text-ink/55">
          Pick several guests, then set their side, role, or group in one go.
        </p>
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
    <section className="flex w-full shrink-0 snap-center flex-col justify-center gap-3 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-ink">
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
          onClick={() => guestSelection.exit()}
          className="text-[11px] font-medium text-ink/55 hover:text-ink"
        >
          Done
        </button>
      </div>

      <p className="text-center text-sm">
        <span className="text-base font-semibold text-terracotta-700">{count}</span>{' '}
        <span className="text-ink/60">selected</span>
      </p>

      <button
        type="button"
        onClick={onAssign}
        disabled={count === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-mulberry px-4 py-3 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Assign{count > 0 ? ` ${count}` : ''}
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
