'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Users,
  UserCircle,
  Settings,
  LogOut,
  Store,
  ShieldCheck,
  User,
  Plus,
  Image,
  Heart,
  Newspaper,
  ChevronDown,
} from 'lucide-react';
import type { SwitcherData } from './get-switcher-data';
import { formatEventDate } from '@/lib/events';

type Tab = 'gallery' | 'favorites' | 'editorials';

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
 * Panel sections (top → bottom):
 *   1. User header: avatar · display name · email
 *   2. Events section: scroll of events the user organises OR attends
 *   3. Three tabs: Gallery | Favorites | Editorials
 *   4. Profile actions: Hosts · Profile · Settings · Sign out
 *   5. Context rail (conditional):
 *       – hidden for plain users (no vendor, not admin)
 *       – [User | Shop] for vendor accounts
 *       – [User | HQ] for admin-only accounts
 *       – [User | Shop | HQ] for admin + vendor accounts
 *
 * Motion:
 *   – Mobile: bottom sheet slides up (translateY 100% → 0) + backdrop fades in
 *   – Desktop: drawer slides in from left (translateX -100% → 0) + backdrop fades in
 *   Both: CSS transitions 0.3s ease
 */
export function AccountSwitcher({ data, currentEventName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('gallery');
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // SSR-safe portal
  useEffect(() => setMounted(true), []);

  // Escape key + click-away
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const initial = data.email?.charAt(0).toUpperCase() ?? '?';

  function close() {
    setOpen(false);
  }

  function navigate(href: string) {
    close();
    router.push(href);
  }

  // Context rail: which console tabs to show
  const showShop = data.context.hasVendor;
  const showHQ = data.context.isAdmin;
  const showContextRail = showShop || showHQ;

  // ─── Inner panel content ────────────────────────────────────────────────

  function renderTabContent() {
    if (activeTab === 'gallery') {
      if (data.gallery.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Image aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
            <p className="text-sm text-ink/50">No photos yet</p>
            <p className="mt-1 text-xs text-ink/35">
              Photos will appear here after your event
            </p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {data.gallery.map((album) => (
            <div
              key={album.event_id}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-terracotta/10">
                <Image aria-hidden className="h-6 w-6 text-terracotta/60" strokeWidth={1.5} />
              </div>
              <p className="truncate text-center text-[10px] text-ink/60">
                {album.photo_count > 0 ? `${album.photo_count} photos` : 'No photos yet'}
              </p>
              <p className="truncate text-center text-[10px] font-medium text-ink/80">
                {album.event_display_name}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'favorites') {
      if (data.favorites.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Heart aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
            <p className="text-sm text-ink/50">No saved vendors yet</p>
            <p className="mt-1 text-xs text-ink/35">
              Vendors you save will appear here
            </p>
          </div>
        );
      }
      return (
        <ul className="space-y-1">
          {data.favorites.map((fav) => (
            <li key={fav.vendor_profile_id}>
              <Link
                href={`/vendors/${fav.vendor_profile_id}`}
                onClick={close}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10"
              >
                {fav.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fav.logo_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-medium text-terracotta-700">
                    {fav.business_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 truncate font-medium">{fav.business_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    }

    // editorials
    if (data.editorials.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Newspaper aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
          <p className="text-sm text-ink/50">No editorial pages yet</p>
          <p className="mt-1 text-xs text-ink/35">
            Your wedding editorial will appear here
          </p>
        </div>
      );
    }
    return (
      <ul className="space-y-1">
        {data.editorials.map((ed) => (
          <li key={ed.editorial_id}>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85">
              <Newspaper aria-hidden className="h-4 w-4 shrink-0 text-terracotta/60" strokeWidth={1.5} />
              <span className="min-w-0 flex-1 truncate">{ed.event_display_name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  ed.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-ink/10 text-ink/50'
                }`}
              >
                {ed.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderPanel() {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account switcher"
        className={[
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
          {/* ── 1. User header ─────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-lg font-semibold text-ink/80">
              {data.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 flex-1">
              {data.displayName ? (
                <p className="truncate text-sm font-semibold text-ink">
                  {data.displayName}
                </p>
              ) : null}
              <p className="truncate text-xs text-ink/55">{data.email}</p>
            </div>
          </div>

          {/* ── 2. Events section ──────────────────────────────── */}
          <div className="border-t border-ink/10 px-4 pt-3 pb-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                Events
              </span>
              <Link
                href="/dashboard/create-event"
                onClick={close}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-terracotta/50 px-2.5 py-0.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
              >
                <Plus aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                Add
              </Link>
            </div>

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
                      {/* Event monogram initial */}
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700">
                        {ev.display_name.charAt(0).toUpperCase()}
                      </span>
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
                            ? 'bg-amber-100 text-amber-700'
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

          {/* ── 3. Tabs: Gallery | Favorites | Editorials ─────── */}
          <div className="border-t border-ink/10 px-4 pt-3 pb-1">
            <div
              role="tablist"
              className="mb-3 flex gap-0.5 rounded-xl bg-ink/5 p-0.5"
            >
              {(
                [
                  { key: 'gallery', label: 'Gallery', Icon: Image },
                  { key: 'favorites', label: 'Favorites', Icon: Heart },
                  { key: 'editorials', label: 'Editorials', Icon: Newspaper },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === key
                      ? 'bg-[var(--m-paper)] text-ink shadow-sm'
                      : 'text-ink/55 hover:text-ink/80'
                  }`}
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
            <div role="tabpanel">{renderTabContent()}</div>
          </div>

          {/* ── 4. Profile actions ─────────────────────────────── */}
          <div className="border-t border-ink/10 px-4 pt-3 pb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Account
            </span>

            {/* 2×2 grid on mobile, full-width list on desktop */}
            <div className="mt-2 grid grid-cols-2 gap-1 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard/hosts')}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-ink"
              >
                <Users aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={1.75} />
                Hosts
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/profile')}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-ink"
              >
                <UserCircle aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={1.75} />
                Profile
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/profile#settings')}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-ink"
              >
                <Settings aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={1.75} />
                Settings
              </button>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {/* ── 5. Context rail ────────────────────────────────── */}
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
  const [activeTab, setActiveTab] = useState<Tab>('gallery');
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
  }

  function navigate(href: string) {
    close();
    router.push(href);
  }

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
                className="fixed inset-y-0 left-0 z-[52] flex w-80 flex-col overflow-hidden rounded-r-2xl border-r border-ink/10 bg-[var(--m-paper)] shadow-2xl"
                style={{ animation: 'sn-switcher-drawer-in 0.3s ease' }}
              >
                <div className="flex-1 overflow-y-auto">

                  {/* User header */}
                  <div className="flex items-center gap-3 px-4 pb-3 pt-5">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-lg font-semibold text-ink/80">
                      {data.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initial
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      {data.displayName ? (
                        <p className="truncate text-sm font-semibold text-ink">
                          {data.displayName}
                        </p>
                      ) : null}
                      <p className="truncate text-xs text-ink/55">{data.email}</p>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="border-t border-ink/10 px-4 pt-3 pb-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Events</span>
                      <Link href="/dashboard/create-event" onClick={close} className="inline-flex items-center gap-1 rounded-full border border-dashed border-terracotta/50 px-2.5 py-0.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10">
                        <Plus aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                        Add
                      </Link>
                    </div>
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
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700">
                                {ev.display_name.charAt(0).toUpperCase()}
                              </span>
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
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${ev.role === 'couple' ? 'bg-amber-100 text-amber-700' : 'bg-ink/10 text-ink/55'}`}>
                                {ev.role === 'couple' ? 'Organizing' : 'Attending'}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="border-t border-ink/10 px-4 pt-3 pb-1">
                    <div role="tablist" className="mb-3 flex gap-0.5 rounded-xl bg-ink/5 p-0.5">
                      {([
                        { key: 'gallery', label: 'Gallery', Icon: Image },
                        { key: 'favorites', label: 'Favorites', Icon: Heart },
                        { key: 'editorials', label: 'Editorials', Icon: Newspaper },
                      ] as const).map(({ key, label, Icon }) => (
                        <button key={key} role="tab" aria-selected={activeTab === key} type="button" onClick={() => setActiveTab(key)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === key ? 'bg-[var(--m-paper)] text-ink shadow-sm' : 'text-ink/55 hover:text-ink/80'}`}>
                          <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <div role="tabpanel">
                      {activeTab === 'gallery' && (
                        data.gallery.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Image aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
                            <p className="text-sm text-ink/50">No photos yet</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {data.gallery.map((album) => (
                              <div key={album.event_id} className="flex flex-col items-center gap-1">
                                <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-terracotta/10">
                                  <Image aria-hidden className="h-6 w-6 text-terracotta/60" strokeWidth={1.5} />
                                </div>
                                <p className="text-center text-[10px] text-ink/60">{album.photo_count > 0 ? `${album.photo_count} photos` : 'No photos yet'}</p>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                      {activeTab === 'favorites' && (
                        data.favorites.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Heart aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
                            <p className="text-sm text-ink/50">No saved vendors yet</p>
                          </div>
                        ) : (
                          <ul className="space-y-1">
                            {data.favorites.map((fav) => (
                              <li key={fav.vendor_profile_id}>
                                <Link href={`/vendors/${fav.vendor_profile_id}`} onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85 hover:bg-terracotta/10">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-medium text-terracotta-700">
                                    {fav.business_name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 truncate font-medium">{fav.business_name}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                      {activeTab === 'editorials' && (
                        data.editorials.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Newspaper aria-hidden className="mb-2 h-8 w-8 text-ink/25" strokeWidth={1.5} />
                            <p className="text-sm text-ink/50">No editorial pages yet</p>
                          </div>
                        ) : (
                          <ul className="space-y-1">
                            {data.editorials.map((ed) => (
                              <li key={ed.editorial_id}>
                                <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink/85">
                                  <Newspaper aria-hidden className="h-4 w-4 shrink-0 text-terracotta/60" strokeWidth={1.5} />
                                  <span className="min-w-0 flex-1 truncate">{ed.event_display_name}</span>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${ed.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/10 text-ink/50'}`}>{ed.status}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </div>
                  </div>

                  {/* Profile actions */}
                  <div className="border-t border-ink/10 px-4 pt-3 pb-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Account</span>
                    <div className="mt-2 space-y-0.5">
                      {[
                        { label: 'Hosts', Icon: Users, href: '/dashboard/hosts' },
                        { label: 'Profile', Icon: UserCircle, href: '/dashboard/profile' },
                        { label: 'Settings', Icon: Settings, href: '/dashboard/profile#settings' },
                      ].map(({ label, Icon, href }) => (
                        <button key={label} type="button" onClick={() => navigate(href)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink/80 hover:bg-terracotta/10 hover:text-ink">
                          <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink/50" strokeWidth={1.75} />
                          {label}
                        </button>
                      ))}
                      <form action="/auth/sign-out" method="post">
                        <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700">
                          <LogOut aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Context rail */}
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
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
