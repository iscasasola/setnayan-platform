'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ShieldCheck, Store, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatEventDate } from '@/lib/events';
import { EventMonogram, EmptyEventMonogram } from '@/app/_components/event-monogram';
import { EventTypeCarousel } from '@/app/dashboard/create-event/_components/event-type-carousel';
import {
  EVENT_TYPES_FALLBACK,
  type EventTypeRow,
} from '@/app/dashboard/create-event/_components/event-types';

/**
 * Unified switcher — iteration 0000 chrome (locked 2026-05-14 single-strip
 * top-nav + 2026-05-15 event-lifecycle add-event entry-point; unified
 * 2026-06-12 per owner directive "single switcher" — this component is now
 * the ONE switching affordance across all three doorways, covering both the
 * account's events AND the consoles it can enter: Customer view / Shop
 * console / Setnayan HQ. It absorbs and retires the standalone
 * `RoleSwitchPill` that used to duplicate the role rows in every doorway's
 * sidebar footer + mobile top bar).
 *
 * The top-strip anchor is a **monogram chip** (per-event circular badge from
 * `events.monogram_text` / derived initials of `display_name`):
 *   - **Tap monogram** → routes to the event dashboard (or
 *     `/dashboard/create-event` via the empty "+" monogram when the account
 *     holds zero events — the switcher still opens via the caret so role
 *     switching never disappears for event-less vendor/admin accounts).
 *   - **Long-press monogram (mobile)** → opens the switcher.
 *   - **Caret ▾ (desktop)** → opens the switcher popover.
 *
 * Responsive popover (2026-06-02, "Both"): the open switcher renders as an
 * **anchored dropdown on desktop (≥ sm)** and a **bottom sheet that slides up
 * from the bottom on mobile (< sm)**. The same `renderMenu()` body feeds both
 * surfaces — exactly one is visible per breakpoint (`hidden sm:block` on the
 * dropdown, `sm:hidden` on the portaled sheet). The mobile sheet is
 * `createPortal`-ed to `document.body` so its `fixed` positioning is robust
 * against any ancestor transforms in the chrome.
 *
 * Two in-place views inside the popover:
 *   - `events` — the default. `+ Add event` row, then the event list (primary
 *     first, ★-marked), then the role-switch rows ("Switch view": the consoles
 *     the account can enter OTHER than the one it's on — `currentRole` is
 *     implied by the surface, so it isn't listed as a target).
 *   - `addtype` — `+ Add event` swaps the popover body to a carousel of event
 *     types (the same roster the full /dashboard/create-event page uses, shared
 *     from `event-types.ts`). Picking **Wedding** continues to
 *     `/onboarding/wedding`; **Debut** continues to `/dashboard/create-event`;
 *     coming-soon types render disabled. `‹ Back` returns to the event list.
 *   The whole add-event path is therefore sheet-based on mobile without
 *   navigating away — but `/dashboard/create-event` stays un-orphaned (the
 *   empty-state monogram "+" still links to it, and Debut routes there).
 *
 * Set-primary affordance is **scope-cut to V1.1** — the existing
 * `events.is_primary` column already drives the ★ marker on the most recent /
 * primary event, but the long-press-row / kebab UI to flip the flag from the
 * switcher is not in this PR. Couples can still set primary via the existing
 * `/dashboard/profile`-side controls until V1.1 ships.
 */

export type SwitcherEvent = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  is_primary: boolean;
  monogram_text: string | null;
  monogram_color: string | null;
  // Onboarding free-monogram design (owner-locked 2026-06-03) — optional so
  // older / non-onboarding events and the admin chrome stay backward-compatible.
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
};

export type SwitcherVendorTarget = {
  vendor_profile_id: string;
  business_name: string;
  logo_url: string | null;
};

export type SwitcherRole = 'customer' | 'vendor' | 'admin';

type Props = {
  /** Which console this switcher is mounted on — that console is implied
      by the surface, so it isn't listed as a "Switch view" target. */
  currentRole: SwitcherRole;
  /** Null on surfaces with no anchor event (zero couple events) — the
      anchor renders the empty "+" monogram but the menu still opens. */
  currentEventId: string | null;
  currentEventName: string | null;
  currentEventDate: string | null;
  currentMonogramText: string | null;
  currentMonogramColor: string | null;
  currentMonogramFrameKey?: string | null;
  currentMonogramFontKey?: string | null;
  events: SwitcherEvent[];
  hasCustomerAccess: boolean;
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: SwitcherVendorTarget[];
  /** DB-driven creatable event types (2026-06-13 cutover) — fetched by the
      server layout that mounts the switcher (getCreatableEventTypes()) and
      threaded down for the add-event sheet's carousel. Optional with the
      pre-cutover constant as fallback so any unmounted surface degrades to
      yesterday's roster instead of crashing. */
  eventTypes?: readonly EventTypeRow[];
};

type View = 'events' | 'addtype';

export function EventSwitcher({
  currentRole,
  currentEventId,
  currentEventName,
  currentEventDate,
  currentMonogramText,
  currentMonogramColor,
  currentMonogramFrameKey,
  currentMonogramFontKey,
  events,
  hasCustomerAccess,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
  eventTypes = EVENT_TYPES_FALLBACK,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('events');
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressFiredRef = useRef(false);

  // SSR-safe portal: only render the mobile sheet portal after mount so
  // `document.body` is guaranteed to exist (avoids a hydration/SSR crash).
  useEffect(() => setMounted(true), []);

  // Closing always resets the popover back to the event list so the next open
  // starts on `events`, never mid-carousel.
  const closeMenu = () => {
    setOpen(false);
    setView('events');
  };

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      const target = e.target as Node;
      // Taps inside the anchored dropdown (in `containerRef`) or inside the
      // portaled mobile sheet (`sheetRef`) keep the menu open; everything else
      // — including the sheet backdrop — closes it.
      if (containerRef.current?.contains(target)) return;
      if (sheetRef.current?.contains(target)) return;
      setOpen(false);
      setView('events');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setView('events');
      }
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Long-press handling for mobile — fire the switcher when the user
  // holds the monogram for ≥400ms. Pointer events handle touch + mouse + pen.
  const startLongPress = () => {
    isLongPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressFiredRef.current = true;
      setView('events');
      setOpen(true);
    }, 400);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // If long-press fired we eat the subsequent tap so the link doesn't navigate.
  const onMonogramClick = (e: React.MouseEvent) => {
    if (isLongPressFiredRef.current) {
      e.preventDefault();
      isLongPressFiredRef.current = false;
    }
  };

  // "Switch view" targets — every console the account can enter OTHER than
  // the one it's on (currentRole is implied by the surface). Lifted verbatim
  // from the retired RoleSwitchPill so the unified switcher is the single
  // owner of cross-console hopping (owner directive 2026-06-12).
  const roleTargets: Array<{
    role: SwitcherRole;
    label: string;
    href: string;
    sub: string | null;
    Icon: typeof User;
  }> = [];
  if (currentRole !== 'customer' && hasCustomerAccess) {
    roleTargets.push({
      role: 'customer',
      label: 'Customer view',
      href: '/dashboard',
      sub: 'Your events',
      Icon: User,
    });
  }
  if (currentRole !== 'vendor' && hasVendorAccess) {
    roleTargets.push({
      role: 'vendor',
      label: 'Shop console',
      href: '/vendor-dashboard',
      sub:
        vendorProfiles.length === 1
          ? vendorProfiles[0]?.business_name ?? null
          : vendorProfiles.length > 1
            ? `${vendorProfiles.length} vendor profiles`
            : null,
      Icon: Store,
    });
  }
  if (currentRole !== 'admin' && hasAdminAccess) {
    roleTargets.push({
      role: 'admin',
      label: 'Setnayan HQ',
      href: '/admin',
      sub: 'Setnayan admin',
      Icon: ShieldCheck,
    });
  }

  // Shared popover body — rendered into BOTH the desktop dropdown and the
  // mobile bottom sheet. Exactly one wrapper is visible per breakpoint.
  function renderMenu() {
    if (view === 'addtype') {
      // Enabled cards route on tap: Wedding → the onboarding flow (captures
      // names/date/region/pax/budget/style + commits the event); every other
      // enabled type (debut) → the full create-event page. Coming-soon cards
      // are inert. The hero-photo filmstrip + arrows + dots all live in the
      // shared EventTypeCarousel (also used by the full-page picker).
      return (
        <div className="max-h-[72vh] overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => setView('events')}
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
          >
            ‹ Back to events
          </button>

          <p className="mt-2 px-1 text-sm font-medium text-ink">
            What kind of event are you planning?
          </p>
          <p className="mb-3 px-1 text-xs text-ink/55">
            Swipe through and tap the one you&apos;re planning.
          </p>

          <EventTypeCarousel
            types={eventTypes}
            ctaLabel="Continue &rarr;"
            sizes="(max-width: 640px) 78vw, 248px"
            onSelect={(type) => {
              // DB-driven (2026-06-13): a type with a tailored onboarding
              // jumps straight in (wedding → /onboarding/wedding); everything
              // else lands on the create-event name form — same behavior the
              // hardcoded wedding-special-case produced for the live roster.
              const href = type.onboardingHref ?? '/dashboard/create-event';
              closeMenu();
              router.push(href);
            }}
          />
        </div>
      );
    }

    // Default: the event list.
    return (
      <div className="max-h-[72vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => setView('addtype')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-terracotta-700 hover:bg-terracotta/10"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-terracotta/40 text-base leading-none"
          >
            +
          </span>
          Add event
        </button>

        {events.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {events.map((ev) => {
              const isCurrent = ev.event_id === currentEventId;
              return (
                <li key={ev.event_id} role="none">
                  <Link
                    role="menuitem"
                    href={`/dashboard/${ev.event_id}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-terracotta/10 ${
                      isCurrent ? 'bg-terracotta/5 text-ink' : 'text-ink/85'
                    }`}
                    onClick={closeMenu}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <EventMonogram
                        event={{
                          display_name: ev.display_name,
                          monogram_text: ev.monogram_text,
                          monogram_color: ev.monogram_color,
                          monogram_frame_key: ev.monogram_frame_key,
                          monogram_font_key: ev.monogram_font_key,
                        }}
                        size="sm"
                      />
                      <span className="flex min-w-0 items-center gap-1">
                        {ev.is_primary ? (
                          <span
                            aria-label="Primary event"
                            title="Primary event"
                            className="text-terracotta"
                          >
                            ★
                          </span>
                        ) : null}
                        <span className="truncate font-medium">{ev.display_name}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      {ev.event_date ? formatEventDate(ev.event_date) : 'date TBD'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {roleTargets.length > 0 ? (
          <div className="mt-2 border-t border-ink/10 pt-2">
            <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Switch view
            </p>
            {roleTargets.map((t) => {
              const TargetIcon = t.Icon;
              const isAdminTone = t.role === 'admin';
              return (
                <Link
                  role="menuitem"
                  key={t.role}
                  href={t.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 ${
                    isAdminTone ? 'hover:bg-purple-50' : 'hover:bg-terracotta/10'
                  }`}
                  onClick={closeMenu}
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isAdminTone
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-terracotta/15 text-terracotta-700'
                    }`}
                  >
                    <TargetIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{t.label}</span>
                    {t.sub ? (
                      <span className="truncate text-[11px] text-ink/55">{t.sub}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center gap-1">
      {/* Anchor — the current event's monogram, or the empty "+" monogram
          when the account holds zero events. Either way the caret beside it
          opens the same unified menu, so role switching is never lost on
          event-less vendor/admin accounts. */}
      <Link
        href={currentEventId ? `/dashboard/${currentEventId}` : '/dashboard/create-event'}
        className="flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onClick={onMonogramClick}
        aria-label={
          currentEventId
            ? `${currentEventName} dashboard · long-press to switch events`
            : 'Create your first event · long-press to switch view'
        }
      >
        {currentEventId ? (
          <EventMonogram
            event={{
              display_name: currentEventName ?? '',
              monogram_text: currentMonogramText,
              monogram_color: currentMonogramColor,
              monogram_frame_key: currentMonogramFrameKey,
              monogram_font_key: currentMonogramFontKey,
            }}
            size="md"
          />
        ) : (
          <EmptyEventMonogram size="md" />
        )}
      </Link>
      <button
        type="button"
        aria-label="Switch event or view"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) closeMenu();
          else {
            setView('events');
            setOpen(true);
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-terracotta/10 hover:text-terracotta"
      >
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {/* Desktop-only event-name + date pill. On mobile the chrome is
          monogram-only per 2026-05-14 single-strip lock; the event name +
          date surface only inside the switcher. Zero-event accounts get the
          "Add event" eyebrow the old empty-state Link carried. */}
      {currentEventId ? (
        <span className="ml-1 hidden min-w-0 items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700 sm:inline-flex">
          <span className="max-w-[14rem] truncate font-medium">{currentEventName}</span>
          {currentEventDate ? (
            <span className="text-xs text-terracotta-700/80">
              · {formatEventDate(currentEventDate)}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="ml-1 hidden font-mono text-xs uppercase tracking-[0.2em] text-ink/60 sm:inline">
          Add event
        </span>
      )}

      {/* Desktop (≥ sm): anchored dropdown. */}
      {open ? (
        <div
          role="menu"
          aria-label="Switch event or console"
          className="absolute left-0 top-full z-30 mt-2 hidden w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-cream p-2 shadow-lg sm:block"
        >
          {renderMenu()}
        </div>
      ) : null}

      {/* Mobile (< sm): bottom sheet that slides up from the bottom. Portaled
          to document.body so `fixed` positioning ignores any ancestor
          transform in the chrome. The whole subtree is `sm:hidden` so it never
          shows on desktop (where the anchored dropdown above is used). */}
      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="sm:hidden">
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
                className="fixed inset-0 z-40 bg-ink/40"
              />
              <div
                ref={sheetRef}
                role="menu"
                aria-label="Switch event or console"
                className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
                style={{ animation: 'sn-sheet-up 0.22s ease-out' }}
              >
                <style>{`@keyframes sn-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
                <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
                {renderMenu()}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
