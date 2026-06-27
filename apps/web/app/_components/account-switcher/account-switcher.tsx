'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Users,
  LogOut,
  Store,
  ShieldCheck,
  User,
  Plus,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react';
import type { SwitcherData } from './get-switcher-data';
import { formatEventDate } from '@/lib/events';
import { EventMonogram } from '@/app/_components/event-monogram';
import { useModalA11y } from '@/lib/use-modal-a11y';

type Props = {
  data: SwitcherData;
  /** When provided, shown next to the avatar in the trigger pill (e.g. event display name). */
  currentEventName?: string | null;
};

/**
 * AccountSwitcher — unified identity panel (account-switcher iteration).
 *
 * Trigger: avatar pill in the app header (top-left on mobile, icon-rail on
 * desktop). Opens a bottom sheet on mobile / side drawer on desktop.
 *
 * Panel sections (top → bottom) — events-first redesign (owner 2026-06-22):
 *   1. Events: a prominent "Add event" button + the events the user organises
 *      OR attends (active ★ first). The only content couples need.
 *   2. Context rail (conditional) — vendor / Setnayan-team only:
 *       – hidden for plain users (no vendor, not admin)
 *       – [User | Shop] for vendor accounts
 *       – [User | HQ] for admin-only accounts
 *       – [User | Shop | HQ] for admin + vendor accounts
 *   3. Slim footer: Profile · Settings · Sign out (+ Hosts when co-hosting)
 *
 * Motion:
 *   – Mobile: bottom sheet slides up (translateY 100% → 0) + backdrop fades in
 *   – Desktop: drawer slides in from left (translateX -100% → 0) + backdrop fades in
 *   Both: CSS transitions 0.3s ease
 */
export function AccountSwitcher({ data, currentEventName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // SSR-safe portal
  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
  }

  // Focus trap, Esc-to-close, body-scroll-lock, focus-restore (shared hook).
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  const initial = data.email?.charAt(0).toUpperCase() ?? '?';

  function navigate(href: string) {
    close();
    router.push(href);
  }

  // Hosts is event-scoped (/dashboard/[eventId]/hosts) — no /dashboard/hosts
  // route exists. Target the user's primary OWNED event (role 'couple'),
  // falling back to the first owned event; null when they organize none.
  const ownedEvents = data.events.filter((e) => e.role === 'couple');
  const hostsEvent = ownedEvents.find((e) => e.is_primary) ?? ownedEvents[0] ?? null;
  const hostsHref = hostsEvent ? `/dashboard/${hostsEvent.event_id}/hosts` : null;

  // Context rail: which console tabs to show
  const showShop = data.context.hasVendor;
  const showHQ = data.context.isAdmin;
  const showContextRail = showShop || showHQ;

  // ─── Inner panel content ────────────────────────────────────────────────


  function renderPanel() {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account switcher"
        className={[
          'focus:outline-none',
          // Mobile: bottom sheet — inset-x + fixed bottom, slides up
          'fixed inset-x-0 bottom-0 z-[52] flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border-t border-ink/10 bg-[var(--m-paper)] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl',
          // Desktop: left drawer — fixed left full-height, slides from left
          'lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:bottom-auto lg:top-0 lg:w-80 lg:rounded-none lg:rounded-r-2xl lg:border-t-0 lg:border-r lg:border-ink/10',
        ].join(' ')}
        style={{
          animation: 'sn-switcher-in 0.3s ease',
        }}
      >
        <style>{`
          @keyframes sn-switcher-in {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @media (min-width: 1024px) {
            @keyframes sn-switcher-in {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
          }
        `}</style>

        {/* Drag handle (mobile only) */}
        <div aria-hidden className="mx-auto mb-1 mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/15 lg:hidden" />

        {/* Scrollable interior */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Events — the only content (couples). Prominent "Add event" leads the
                 section so the core action is the first, biggest target (owner 2026-06-22:
                 events on top, no user header, add-event more accessible). ── */}
          <div className="px-4 pt-4 pb-2">
            <Link
              href="/dashboard/create-event"
              onClick={close}
              className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-3 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2.5} />
              Add event
            </Link>

            {data.events.length === 0 ? (
              <p className="py-2 text-center text-xs text-ink/40">
                No events yet —{' '}
                <Link
                  href="/dashboard/create-event"
                  onClick={close}
                  className="text-terracotta-700 underline underline-offset-2"
                >
                  create one
                </Link>
              </p>
            ) : (
              <ul className="space-y-0.5">
                {data.events.map((ev) => (
                  <li key={ev.event_id}>
                    <Link
                      href={`/dashboard/${ev.event_id}`}
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-ink/85 hover:bg-terracotta/10"
                    >
                      {/* The couple's REAL mark (EventMonogram cascade), not a
                          generic first-initial — matches the chrome chip + hero. */}
                      <EventMonogram event={ev} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          {ev.is_primary ? (
                            <span aria-label="Primary event" className="text-terracotta">★</span>
                          ) : null}
                          <span className="truncate font-medium">{ev.display_name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-ink/50">
                          <span className="capitalize">{ev.event_type}</span>
                          {ev.event_date ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{formatEventDate(ev.event_date)}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      {/* Role badge */}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          ev.role === 'couple'
                            ? 'bg-warn-100 text-warn-700'
                            : 'bg-ink/10 text-ink/55'
                        }`}
                      >
                        {ev.role === 'couple' ? 'Organizing' : 'Attending'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Library — the cross-event hub (Photos & Videos · Saved Vendors ·
              Editorials). Surfaced here so it's reachable on MOBILE, where the
              switcher IS the account nav (the sidebar is desktop-only). */}
          <div className="border-t border-ink/10 px-4 py-2">
            <Link
              href="/dashboard/library"
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium text-ink/85 hover:bg-terracotta/10"
            >
              <LayoutGrid aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
              Collection
            </Link>
          </div>

          {/* ── Console rail (account-style) — vendor / Setnayan-team only ── */}
          {showContextRail ? (
            <div className="border-t border-ink/10 px-4 pt-3 pb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                Switch to
              </span>
              <div className="mt-2 flex gap-1.5">
                {/* User (always shown in context rail) */}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 bg-terracotta/5 px-3 py-2.5 text-center text-xs font-medium text-ink hover:bg-terracotta/10"
                >
                  <User aria-hidden className="h-5 w-5 text-terracotta-700" strokeWidth={1.75} />
                  <span>User</span>
                </button>

                {showShop ? (
                  <button
                    type="button"
                    onClick={() => navigate('/vendor-dashboard')}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-terracotta/10"
                  >
                    <Store aria-hidden className="h-5 w-5 text-terracotta-700" strokeWidth={1.75} />
                    <span>Shop</span>
                    {data.context.vendorName ? (
                      <span className="max-w-full truncate text-[10px] font-normal text-ink/50">
                        {data.context.vendorName}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {showHQ ? (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-purple-50"
                  >
                    <ShieldCheck aria-hidden className="h-5 w-5 text-purple-700" strokeWidth={1.75} />
                    <span>HQ</span>
                    <span className="text-[10px] font-normal text-ink/50">Setnayan</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Slim account footer — Sign out only. The switcher is for switching;
              Profile & Settings now live in the Collection hub. Hosts shows only
              when there's a co-host context. */}
          <div className="border-t border-ink/10 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {hostsHref ? (
                <button type="button" onClick={() => navigate(hostsHref)} className="inline-flex items-center gap-1 text-ink/60 hover:text-terracotta-700">
                  <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Hosts
                </button>
              ) : null}
              {data.isAnonymous ? (
                <Link
                  href="/signup"
                  className="ml-auto inline-flex items-center gap-1 font-medium text-mulberry hover:text-mulberry-600"
                >
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Secure your plan
                </Link>
              ) : (
                <form action="/auth/sign-out" method="post" className="ml-auto">
                  <button type="submit" className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                    <LogOut aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Sign out
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Trigger pill ──────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Open account switcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-cream px-2 pr-3 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta"
      >
        {/* Avatar circle */}
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        {currentEventName ? (
          <span className="max-w-[120px] truncate text-xs font-medium text-ink/80">
            {currentEventName}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      {/* ── Backdrop + Panel (portaled to body) ───────────────── */}
      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              {/* Backdrop */}
              <button
                type="button"
                aria-label="Close account switcher"
                onClick={close}
                className="fixed inset-0 z-[51] bg-ink/40 backdrop-blur-[2px]"
                style={{ animation: 'sn-switcher-backdrop 0.3s ease' }}
              />
              <style>{`
                @keyframes sn-switcher-backdrop {
                  from { opacity: 0; }
                  to   { opacity: 1; }
                }
              `}</style>
              {renderPanel()}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Desktop icon-rail trigger — avatar circle only (54px rail, no text).
 * Used instead of the pill trigger when we're in the narrow icon sidebar.
 */
export function AccountSwitcherIconTrigger({
  data,
  open,
  onToggle,
}: {
  data: SwitcherData;
  open: boolean;
  onToggle: () => void;
}) {
  const initial = data.email?.charAt(0).toUpperCase() ?? '?';
  return (
    <button
      type="button"
      aria-label="Open account switcher"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onToggle}
      className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-sm font-semibold text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:border-terracotta"
    >
      {data.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </button>
  );
}

/**
 * Standalone desktop drawer wrapper — for use in sidebars where the panel
 * needs to be self-contained with its own open/close state.
 * Renders the icon trigger (used in the desktop icon rail) + the full panel.
 */
export function AccountSwitcherStandalone({ data }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
  }

  // Focus trap, Esc-to-close, body-scroll-lock, focus-restore (shared hook).
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  function navigate(href: string) {
    close();
    router.push(href);
  }

  // Hosts is event-scoped (/dashboard/[eventId]/hosts) — no /dashboard/hosts
  // route exists. Target the user's primary OWNED event (role 'couple'),
  // falling back to the first owned event; null when they organize none.
  const ownedEvents = data.events.filter((e) => e.role === 'couple');
  const hostsEvent = ownedEvents.find((e) => e.is_primary) ?? ownedEvents[0] ?? null;
  const hostsHref = hostsEvent ? `/dashboard/${hostsEvent.event_id}/hosts` : null;

  const initial = data.email?.charAt(0).toUpperCase() ?? '?';
  const showShop = data.context.hasVendor;
  const showHQ = data.context.isAdmin;
  const showContextRail = showShop || showHQ;

  return (
    <>
      {/* Expanded row trigger — matches SidebarRow visual language exactly:
          same rounded-md radius, px-3 py-2.5 spacing, gap-3, min-h-[44px]
          touch target, and --m-paper hover so it reads as one nav family. */}
      <button
        type="button"
        aria-label="Open account switcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--m-paper)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: 'var(--m-orange)', color: 'var(--m-ink)' }}
      >
        {/* Avatar — slightly larger than a nav icon to signal identity, not a
            destination. Shares the terracotta/15 tint with active nav items. */}
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold"
          style={{ background: 'rgba(201,107,58,0.15)', color: 'var(--m-orange-2)' }}
        >
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ color: 'var(--m-ink)' }}>
            {data.displayName ?? data.email}
          </span>
          {data.displayName ? (
            <span className="block truncate text-xs" style={{ color: 'var(--m-slate)' }}>
              {data.email}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          style={{ color: 'var(--m-slate-2)' }}
        />
      </button>
      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close account switcher"
                onClick={close}
                className="fixed inset-0 z-[51] bg-ink/40 backdrop-blur-[2px]"
                style={{ animation: 'sn-switcher-backdrop 0.3s ease' }}
              />
              <style>{`
                @keyframes sn-switcher-backdrop { from { opacity:0; } to { opacity:1; } }
                @keyframes sn-switcher-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
              `}</style>
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Account switcher"
                className="focus:outline-none fixed inset-y-0 left-0 z-[52] flex w-80 flex-col overflow-hidden rounded-r-2xl border-r border-ink/10 bg-[var(--m-paper)] shadow-2xl"
                style={{ animation: 'sn-switcher-drawer-in 0.3s ease' }}
              >
                <div className="flex-1 overflow-y-auto">

                  {/* Events — the only content (couples). Prominent "Add event" leads. */}
                  <div className="px-4 pt-5 pb-2">
                    <Link href="/dashboard/create-event" onClick={close} className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-3 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700">
                      <Plus aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                      Add event
                    </Link>
                    {data.events.length === 0 ? (
                      <p className="py-2 text-center text-xs text-ink/40">
                        No events yet —{' '}
                        <Link href="/dashboard/create-event" onClick={close} className="text-terracotta-700 underline underline-offset-2">create one</Link>
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {data.events.map((ev) => (
                          <li key={ev.event_id}>
                            <Link href={`/dashboard/${ev.event_id}`} onClick={close} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-ink/85 hover:bg-terracotta/10">
                              {/* The couple's REAL mark (EventMonogram cascade),
                                  not a generic first-initial. */}
                              <EventMonogram event={ev} size="md" />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1">
                                  {ev.is_primary ? <span aria-label="Primary" className="text-terracotta">★</span> : null}
                                  <span className="truncate font-medium">{ev.display_name}</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-[11px] text-ink/50">
                                  <span className="capitalize">{ev.event_type}</span>
                                  {ev.event_date ? (<><span aria-hidden>·</span><span>{formatEventDate(ev.event_date)}</span></>) : null}
                                </span>
                              </span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${ev.role === 'couple' ? 'bg-warn-100 text-warn-700' : 'bg-ink/10 text-ink/55'}`}>
                                {ev.role === 'couple' ? 'Organizing' : 'Attending'}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Library — cross-event hub; reachable on mobile via the switcher. */}
                  <div className="border-t border-ink/10 px-4 py-2">
                    <Link
                      href="/dashboard/library"
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium text-ink/85 hover:bg-terracotta/10"
                    >
                      <LayoutGrid aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
                      Collection
                    </Link>
                  </div>

                  {/* Console rail (account-style) — vendor / Setnayan-team only */}
                  {showContextRail ? (
                    <div className="border-t border-ink/10 px-4 pt-3 pb-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Switch to</span>
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" onClick={() => navigate('/dashboard')} className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 bg-terracotta/5 px-3 py-2.5 text-center text-xs font-medium text-ink hover:bg-terracotta/10">
                          <User aria-hidden className="h-5 w-5 text-terracotta-700" strokeWidth={1.75} />
                          <span>User</span>
                        </button>
                        {showShop ? (
                          <button type="button" onClick={() => navigate('/vendor-dashboard')} className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-terracotta/10">
                            <Store aria-hidden className="h-5 w-5 text-terracotta-700" strokeWidth={1.75} />
                            <span>Shop</span>
                            {data.context.vendorName ? (
                              <span className="max-w-full truncate text-[10px] font-normal text-ink/50">{data.context.vendorName}</span>
                            ) : null}
                          </button>
                        ) : null}
                        {showHQ ? (
                          <button type="button" onClick={() => navigate('/admin')} className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-purple-50">
                            <ShieldCheck aria-hidden className="h-5 w-5 text-purple-700" strokeWidth={1.75} />
                            <span>HQ</span>
                            <span className="text-[10px] font-normal text-ink/50">Setnayan</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Slim account footer — Sign out only (Profile & Settings live in the Collection hub). */}
                  <div className="border-t border-ink/10 px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {hostsHref ? (
                        <button type="button" onClick={() => navigate(hostsHref)} className="inline-flex items-center gap-1 text-ink/60 hover:text-terracotta-700">
                          <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Hosts
                        </button>
                      ) : null}
                      {data.isAnonymous ? (
                        <Link
                          href="/signup"
                          className="ml-auto inline-flex items-center gap-1 font-medium text-mulberry hover:text-mulberry-600"
                        >
                          <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Secure your plan
                        </Link>
                      ) : (
                        <form action="/auth/sign-out" method="post" className="ml-auto">
                          <button type="submit" className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                            <LogOut aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Sign out
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
