'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatEventDate } from '@/lib/events';
import { EventMonogram } from '@/app/_components/event-monogram';

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
 * Switcher contents (top to bottom):
 *   1. `+ Add event` row at top.
 *   2. Event list — primary first, marked with ★; each row monogram + name
 *      + date pill (or "date TBD" when event_date is null).
 *   3. Role-switch rows separated by a thin border:
 *        - Shop console (visible when user has vendor access)
 *        - Admin console (visible when user has admin grant)
 *
 * Set-primary affordance is **scope-cut to V1.1** — the existing `events.is_primary`
 * column already drives the ★ marker on the most recent / primary event,
 * but the long-press-row / kebab UI to flip the flag from the switcher is
 * not in this PR. Couples can still set primary via the existing
 * `/dashboard/profile`-side controls until V1.1 ships.
 */

export type SwitcherEvent = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  is_primary: boolean;
  monogram_text: string | null;
  monogram_color: string | null;
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
  events: SwitcherEvent[];
  hasVendorAccess: boolean;
  hasAdminAccess: boolean;
  vendorProfiles: SwitcherVendorTarget[];
};

export function EventSwitcher({
  currentEventId,
  currentEventName,
  currentEventDate,
  currentMonogramText,
  currentMonogramColor,
  events,
  hasVendorAccess,
  hasAdminAccess,
  vendorProfiles,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressFiredRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
          }}
          size="md"
        />
      </Link>
      <button
        type="button"
        aria-label="Switch events"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
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

      {open ? (
        <div
          role="menu"
          aria-label="Switch event or console"
          className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-cream p-2 shadow-lg"
        >
          <div className="max-h-[60vh] overflow-y-auto">
            <Link
              role="menuitem"
              href="/dashboard/create-event"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-terracotta-700 hover:bg-terracotta/10"
              onClick={() => setOpen(false)}
            >
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-terracotta/40 text-base leading-none"
              >
                +
              </span>
              Add event
            </Link>

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
                        onClick={() => setOpen(false)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <EventMonogram
                            event={{
                              display_name: ev.display_name,
                              monogram_text: ev.monogram_text,
                              monogram_color: ev.monogram_color,
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
                    onClick={() => setOpen(false)}
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
                        onClick={() => setOpen(false)}
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
                    onClick={() => setOpen(false)}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-800"
                    >
                      S
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">Admin console</span>
                      <span className="text-[11px] text-ink/55">Setnayan admin</span>
                    </span>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
