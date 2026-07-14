'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  LogOut,
  Store,
  ShieldCheck,
  Home,
  UserRound,
  ChevronDown,
  Wand2,
} from 'lucide-react';
import type { SwitcherData } from './get-switcher-data';
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
 *   3. Slim footer: Profile & settings · Sign out
 *
 * Motion:
 *   – Mobile: bottom sheet slides up (translateY 100% → 0) + backdrop fades in
 *   – Desktop: drawer slides in from left (translateX -100% → 0) + backdrop fades in
 *   Both: CSS transitions 0.3s ease
 */
/**
 * SwitcherPanelBody — the shared interior of both the mobile bottom-sheet and
 * the desktop drawer. Kept in ONE place so the two triggers can never drift.
 *
 * Slimmed to a home-hub jump (owner 2026-07-10): the panel used to re-list every
 * event, add-event, and Collection — all of which the home hub already shows.
 * The switcher now just gets you back home (or to another console) and out.
 *
 *   1. Home — jumps to /dashboard (the home hub: events, add-event, Collection).
 *   2. Console rail (conditional) — vendor / Setnayan-team only. Home already
 *      covers the User console, so the rail only offers Shop / HQ.
 *   3. Footer — Profile & settings (→ /dashboard/profile) · Secure-your-plan
 *      (anonymous) / Sign out. (The Hosts link moved to the event Overview's
 *      Hosts card, owner 2026-07-12.)
 */
function SwitcherPanelBody({
  data,
  close,
  navigate,
}: {
  data: SwitcherData;
  close: () => void;
  navigate: (href: string) => void;
}) {
  const showShop = data.context.hasVendor;
  const showHQ = data.context.isAdmin;
  const showContextRail = showShop || showHQ;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Home — the switcher just jumps back to the home hub ── */}
      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-3 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700"
        >
          <Home aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          Home
        </button>
      </div>

      {/* ── Console rail — vendor / Setnayan-team only ── */}
      {showContextRail ? (
        <div className="border-t border-ink/10 px-4 pt-3 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Switch to
          </span>
          <div className="mt-2 flex gap-1.5">
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

      {/* ── Footer — Profile & settings (left) · Secure-your-plan (anon) /
          Sign out (pushed right, set apart) ── */}
      <div className="border-t border-ink/10 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {/* Profile & settings — the account-level personal profile
              (/dashboard/profile). Restored here 2026-07-13 after the panel was
              slimmed to a home-hub jump on 2026-07-10 and lost it. */}
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center gap-1 font-medium text-ink/70 hover:text-terracotta"
            onClick={close}
          >
            <UserRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Profile &amp; settings
          </Link>
          {/* Setnayan AI — moved into the avatar "You" menu by the four-surface
              home remodel (owner-approved 2026-07-15): the launcher's on-page
              "Your account" section is gone, so the account-level Setnayan AI
              surface (/dashboard/setnayan-ai) lives here beside Profile.
              Hidden for anon-drafts (they get the Secure-your-plan CTA instead
              of account surfaces, matching the Sign-out swap below). */}
          {!data.isAnonymous ? (
            <Link
              href="/dashboard/setnayan-ai"
              className="inline-flex items-center gap-1 font-medium text-ink/70 hover:text-terracotta"
              onClick={close}
            >
              <Wand2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Setnayan AI
            </Link>
          ) : null}
          {data.isAnonymous ? (
            <Link
              href="/signup"
              className="ml-auto inline-flex items-center gap-1 font-medium text-mulberry hover:text-mulberry-600"
              onClick={close}
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
  );
}

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

        <SwitcherPanelBody data={data} close={close} navigate={navigate} />
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

  const initial = data.email?.charAt(0).toUpperCase() ?? '?';

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
                <SwitcherPanelBody data={data} close={close} navigate={navigate} />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
