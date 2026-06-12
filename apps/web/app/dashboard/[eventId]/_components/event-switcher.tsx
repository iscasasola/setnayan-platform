'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatEventDate } from '@/lib/events';
import { EventMonogram } from '@/app/_components/event-monogram';
import { EventTypeCarousel } from '@/app/dashboard/create-event/_components/event-type-carousel';

/**
 * Event switcher — iteration 0000 chrome (locked 2026-05-14 single-strip
 * top-nav + 2026-05-15 event-lifecycle add-event entry-point).
 *
 * The top-strip anchor is a **monogram chip** (per-event circular badge from
 * `events.monogram_text` / derived initials of `display_name`):
 *   - **Tap monogram** → routes to the event dashboard.
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
 *     first, ★-marked), then the role-switch rows ("Switch view": Shop / Admin
 *     consoles, gated on access).
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

type Props = {
  currentEventId: string;
  currentEventName: string;
  currentEventDate: string | null;
  currentMonogramText: string | null;
  currentMonogramColor: string | null;
  currentMonogramFrameKey?: string | null;
  currentMonogramFontKey?: string | null;
  events: SwitcherEvent[];
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: SwitcherVendorTarget[];
};

type View = 'events' | 'addtype';

export function EventSwitcher({
  currentEventId,
  currentEventName,
  currentEventDate,
  currentMonogramText,
  currentMonogramColor,
  currentMonogramFrameKey,
  currentMonogramFontKey,
  events,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
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
            ctaLabel="Continue &rarr;"
            sizes="(max-width: 640px) 78vw, 248px"
            onSelect={(type) => {
              const href =
                type.key === 'wedding' ? '/onboarding/wedding' : '/dashboard/create-event';
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

        {hasVendorAccess || hasAdminAccess ? (
          <div className="mt-2 border-t border-ink/10 pt-2">
            <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Switch view
            </p>
            {hasVendorAccess && vendorProfiles.length === 1 ? (
              <Link
                role="menuitem"
                href="/vendor-dashboard"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10"
                onClick={closeMenu}
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700"
                >
                  S
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">Shop console</span>
                  <span className="text-[11px] text-ink/55">
                    {vendorProfiles[0]?.business_name ?? 'Vendor profile'}
                  </span>
                </span>
              </Link>
            ) : hasVendorAccess && vendorProfiles.length > 1 ? (
              <div className="space-y-0.5">
                <p className="px-3 text-xs text-ink/55">Shop console</p>
                {vendorProfiles.map((vp) => (
                  <Link
                    role="menuitem"
                    key={vp.vendor_profile_id}
                    href="/vendor-dashboard"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10"
                    onClick={closeMenu}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700"
                    >
                      {vp.business_name.charAt(0).toUpperCase() || 'V'}
                    </span>
                    <span className="truncate">{vp.business_name}</span>
                  </Link>
                ))}
              </div>
            ) : null}
            {hasAdminAccess ? (
              <Link
                role="menuitem"
                href="/admin"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-purple-50"
                onClick={closeMenu}
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-800"
                >
                  S
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">Setnayan HQ</span>
                  <span className="text-[11px] text-ink/55">Setnayan admin</span>
                </span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center gap-1">
      <Link
        href={`/dashboard/${currentEventId}`}
        className="flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onClick={onMonogramClick}
        aria-label={`${currentEventName} dashboard · long-press to switch events`}
      >
        <EventMonogram
          event={{
            display_name: currentEventName,
            monogram_text: currentMonogramText,
            monogram_color: currentMonogramColor,
            monogram_frame_key: currentMonogramFrameKey,
            monogram_font_key: currentMonogramFontKey,
          }}
          size="md"
        />
      </Link>
      <button
        type="button"
        aria-label="Switch events"
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
          date surface only inside the switcher. */}
      <span className="ml-1 hidden min-w-0 items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700 sm:inline-flex">
        <span className="max-w-[14rem] truncate font-medium">{currentEventName}</span>
        {currentEventDate ? (
          <span className="text-xs text-terracotta-700/80">
            · {formatEventDate(currentEventDate)}
          </span>
        ) : null}
      </span>

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
