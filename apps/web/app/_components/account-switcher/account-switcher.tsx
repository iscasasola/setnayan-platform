'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Clapperboard,
} from 'lucide-react';
import type { SwitcherData } from './get-switcher-data';
import { useModalA11y } from '@/lib/use-modal-a11y';

type Props = {
  data: SwitcherData;
  /** When provided, shown next to the avatar in the trigger pill (e.g. event display name). */
  currentEventName?: string | null;
  /** Panel "Home" item label override (couple surfaces pass
   *  "Home · all your events" — see SwitcherPanelBody). */
  homeLabel?: string;
};

/**
 * AccountSwitcher — unified identity panel (account-switcher iteration).
 *
 * Triggers (all open the same SwitcherPanelBody):
 *   – <AccountSwitcher> avatar pill — mobile top bars + the launcher/account
 *     slim top bar. Bottom sheet on mobile / side drawer on desktop.
 *   – <SwitcherPlaqueTrigger> — the desktop-rail identity plaque (event /
 *     business / HQ), Council Verdict 2026-07-16 "Plaque-as-Menu": the plaque
 *     is THE popup trigger on desktop rails; the old email pill
 *     (AccountSwitcherStandalone) is retired. Going home is the rail
 *     wordmark's job (DoorwaySidebarHeader), not the plaque's.
 *
 * Motion:
 *   – Mobile: bottom sheet slides up (translateY 100% → 0) + backdrop fades in
 *   – Desktop: drawer slides in from left (translateX -100% → 0) + backdrop fades in
 *   Both: CSS transitions 0.3s ease
 */
/**
 * SwitcherPanelBody — the ONE shared interior of the mobile bottom-sheet, the
 * launcher avatar drawer, and the desktop-rail plaque drawer. Kept in ONE
 * place so the triggers can never drift.
 *
 * Slimmed to a home-hub jump (owner 2026-07-10); identity header added by the
 * 2026-07-16 council verdict (the retired desktop email pill was the only
 * signed-in-account disclosure on the couple rail — that disclosure now lives
 * here, one click away on every surface).
 *
 *   1. Identity header — avatar + "Signed in as {name} · {email}".
 *   2. Home — /dashboard (the home hub: events, add-event, Collection).
 *      ⚠ LOAD-BEARING on mobile: event/vendor/admin mobile top bars have NO
 *      wordmark, so this item is mobile's ONLY path home. Do not remove in a
 *      future slimming pass.
 *   3. Console rail (conditional) — vendor / Setnayan-team only. Home already
 *      covers the User console, so the rail only offers Shop / HQ.
 *   4. Footer — Profile & settings (→ /dashboard/profile) · Setnayan AI ·
 *      Your Story (→ /dashboard/creator, the Storyteller chapters surface —
 *      doorway added per the 2026-07-16 creator readiness verdict B4) ·
 *      Secure-your-plan (anonymous) / Sign out. (The Hosts link moved to the
 *      event Overview's Hosts card, owner 2026-07-12.)
 *
 * Home / Shop / HQ are real <Link>s (not router.push buttons) so middle-click
 * / new-tab work and screen readers announce navigation semantics.
 */
function SwitcherPanelBody({
  data,
  close,
  homeLabel = 'Home',
}: {
  data: SwitcherData;
  close: () => void;
  homeLabel?: string;
}) {
  const showShop = data.context.hasVendor;
  const showHQ = data.context.isAdmin;
  const showContextRail = showShop || showHQ;
  const initial = data.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Identity header — who is signed in ── */}
      <div className="flex items-center gap-2.5 border-b border-ink/10 px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta/15 text-xs font-semibold text-terracotta-700">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Signed in as
          </p>
          <p className="truncate text-sm font-semibold text-ink">
            {data.displayName ?? (data.email || 'Guest — draft plan')}
          </p>
          {data.displayName && data.email ? (
            <p className="truncate text-xs text-ink/50">{data.email}</p>
          ) : null}
        </div>
      </div>

      {/* ── Home — the switcher jumps back to the home hub ──
          🔑 `?hub=1` IS LOAD-BEARING, not a tidy-up. Plain `/dashboard` re-fires
          the launcher's auto-jump for a single-event non-console user, so this
          button landed them straight back in the event they were trying to leave
          — the hub was unreachable for the core persona, permanently. The owner
          ruled 2026-08-11 that the board is "the user's collection of events, on
          going and completed", and this parameter is what makes Home mean the
          collection from anywhere. Removing it silently restores the trap. */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/dashboard?hub=1"
          onClick={close}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-700 px-3 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-800"
        >
          <Home aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          {homeLabel}
        </Link>
      </div>

      {/* ── Console rail — vendor / Setnayan-team only ── */}
      {showContextRail ? (
        <div className="border-t border-ink/10 px-4 pt-3 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Switch to
          </span>
          <div className="mt-2 flex gap-1.5">
            {showShop ? (
              <Link
                href="/vendor-dashboard"
                onClick={close}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-terracotta/10"
              >
                <Store aria-hidden className="h-5 w-5 text-terracotta-700" strokeWidth={1.75} />
                <span>Shop</span>
                {data.context.vendorName ? (
                  <span className="max-w-full truncate text-[10px] font-normal text-ink/50">
                    {data.context.vendorName}
                  </span>
                ) : null}
              </Link>
            ) : null}

            {showHQ ? (
              <Link
                href="/admin"
                onClick={close}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-ink/15 px-3 py-2.5 text-center text-xs font-medium text-ink/80 hover:bg-purple-50"
              >
                <ShieldCheck aria-hidden className="h-5 w-5 text-purple-700" strokeWidth={1.75} />
                <span>HQ</span>
                <span className="text-[10px] font-normal text-ink/50">Setnayan</span>
              </Link>
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
          {/* 🔒 Setnayan AI link REMOVED 2026-08-01. It pointed at
              /dashboard/setnayan-ai — the ACCOUNT-level per-USER subscription
              surface — which is deleted. Owner decision: "it is per event", so
              there is no account-scoped Setnayan AI to link to. The live surface
              is /dashboard/[eventId]/studio/setnayan-ai, reached from an event.
              Do not re-add an account-level doorway here. */}
          {/* Your Story — the Storyteller chapters surface (/dashboard/creator).
              The authoring funnel had NO doorway anywhere (creator readiness
              verdict 2026-07-16 · B4 — the wayfinding rule: a page ships with
              its doorway). Hidden for anon-drafts, matching Setnayan AI. */}
          {!data.isAnonymous ? (
            <Link
              href="/dashboard/creator"
              className="inline-flex items-center gap-1 font-medium text-ink/70 hover:text-terracotta"
              onClick={close}
            >
              <Clapperboard aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Your Story
            </Link>
          ) : null}
          {/* Create your shop — the SAME defect as Your Story above, in the same
              panel, found 2026-08-10: /open-shop is a finished wizard whose only
              doorways in the entire app were the PUBLIC /vendors marketing page
              and /vendor-dashboard/shop — which you can only reach if you
              already have a shop. A signed-in customer had no way in.
              (The `no-vendor → /open-shop` redirect in shop/page.tsx is dead
              code: the vendor-dashboard LAYOUT bounces a non-vendor to
              /dashboard before that page ever runs.)

              This link — not the launcher tile — is what reaches a couple with
              exactly ONE event: they are redirected straight into that event and
              never see the launcher at all. The switcher is on every surface.

              Gated on `canOpenShop` (shops they OWN vs the cap), NOT on
              `!hasVendor`. `hasVendor` is also true for a TEAM MEMBER of
              someone else's shop who owns nothing — gating on it hid this door
              from exactly the people most likely to want their own shop (a
              second shooter, an assistant), even though the cap allows them
              one. A vendor who already owns one gets `canOpenShop === false`
              and sees the "Shop" console tile in the rail above instead.
              Hidden for anon-drafts, matching Your Story. */}
          {!data.isAnonymous && data.context.canOpenShop ? (
            <Link
              href="/open-shop"
              className="inline-flex items-center gap-1 font-medium text-ink/70 hover:text-terracotta"
              onClick={close}
            >
              <Store aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Create your shop
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

export function AccountSwitcher({ data, currentEventName, homeLabel }: Props) {
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

  /*
    🔑 THE NAME IS THE MARK, AND THE EMAIL IS ONLY THE FALLBACK. The panel
    header two hundred lines up already reads `displayName ?? email` — the
    trigger read the email alone, so a person whose account carries a real name
    was still identified by whatever their mail provider happens to start with.
    Same source, same order, one answer.
  */
  const initial =
    (data.displayName?.trim() || data.email)?.charAt(0).toUpperCase() ?? '?';

  /*
    ⚠ WHAT THE OWNER SAW (2026-08-17, a zoom of the top-right corner):
    *"what happened to the top nav?"* — a box with an arrow in it and nothing
    else. The bar was whole; this control was the empty-looking part of it.

    🔑 A CIRCLE AT 1.17:1 IS NOT A CIRCLE. The avatar was `bg-terracotta/15`
    — the gold slot at 15% over the cream pill, which measures #F0E9DD against
    the white page: 1.20:1. WCAG 1.4.11 asks 3:1 of a control's own shape, and GOLD
    CANNOT REACH IT AT ANY ALPHA (solid gold is 3.37:1, so every tint of it is
    worse). So the shape was invisible, the initial inside it measured 4.17:1 —
    under the 4.5:1 AA floor — and for this account the initial is "I", a single
    vertical stroke. Ink solid: 13.82:1 both ways.

    🪤 AND THE TWO GUARDS THAT WATCH FOR THIS COULD NOT SEE IT.
    `palette-lock.test.ts` checks token DEFINITIONS, and the token is fine —
    the defect is the ALPHA at the call site. `lint-label-on-fill-contrast.mjs`
    judges only pairings where BOTH sides are opaque, and by its own docblock
    skips an alpha fill. The same seam that hid `#9A8F86` on five public
    routes. `identity-is-visible.test.ts` is the guard that can.

    🔒 THE PANEL'S OWN pale-gold circle is DELIBERATELY UNCHANGED. It sits
    beside "Signed in as {name}" — the words carry the identification there, so
    the circle is decoration and its faintness costs nothing. This one had to
    carry it alone.
  */
  const accountLabel = data.displayName?.trim() || data.email || null;

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
          /*
            ⚠ ON DESKTOP THIS USED TO BE A FULL-HEIGHT DRAWER PINNED TO THE FAR
            LEFT, AND THE OWNER ASKED WHY (2026-08-17): *"sign in is a pop up on
            the upper left?"* He had pressed the account button at the TOP RIGHT.

            🔑 THE TRIGGER MOVED AND THE PANEL'S GEOMETRY STAYED. The left
            drawer was correct when it was written: the pill was `lg:hidden`,
            so desktop opened this panel from the RAIL plaque in the bottom-left
            — and `SwitcherPlaqueTrigger` still does, from its own left drawer
            two hundred lines below, deliberately untouched. Then the pill was
            promoted to every width and became THE desktop account menu on all
            six top bars (admin · account · launcher · event · shop · the shared
            cluster), and nobody re-derived where its panel should appear. A menu
            that opens across the screen from the thing you pressed reads as a
            different feature opening by mistake.
            See [[feedback_a_ruling_outlives_the_premise_it_was_decided_on]].

            Desktop is now a card under the pill, in the corner it belongs to.
            `--fd-bar` is the shared bar's own height token — but it is declared
            on `.fd`, and this panel is PORTALED TO `document.body`, so it can
            never inherit it and the 56px fallback is what actually renders.
            That is two numbers for one measurement, which this repo has paid
            for before, so `menu-opens-where-you-pressed.test.ts` pins the
            fallback to the token's declared value and fails when either moves.

            🪤 THE UNDERSCORES IN THE `calc()` ARE NOT STYLE — WITHOUT THEM THIS
            PANEL LANDS 2,213px DOWN AN EMPTY PAGE. Tailwind turns `_` into a
            space, and CSS `calc()` REQUIRES whitespace around `+`. I first wrote
            `calc(var(--fd-bar,56px)+8px)` and measured it in a real browser on
            the live stylesheet: the parser KEEPS the declaration — nothing is
            dropped, nothing throws, no warning — and computes `top: 2213.2px`.
            The spaced form computes `64px`. Another member of the family this
            repo keeps meeting: the engine DECLINES quietly and the only symptom
            is that something is not where it should be. Test 4 pins it.
          */
          'lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-[calc(var(--fd-bar,56px)_+_8px)] lg:w-80 lg:max-h-[min(80vh,34rem)] lg:rounded-2xl lg:border lg:border-ink/10 lg:pb-0',
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
            /* Drops from under the pill instead of flying in from the far
               edge — the motion has to agree with where the control is. */
            @keyframes sn-switcher-in {
              from { transform: translateY(-8px); opacity: 0; }
              to   { transform: translateY(0); opacity: 1; }
            }
          }
        `}</style>

        {/* Drag handle (mobile only) */}
        <div aria-hidden className="mx-auto mb-1 mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/15 lg:hidden" />

        <SwitcherPanelBody data={data} close={close} homeLabel={homeLabel} />
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
        className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-cream px-2 pr-3 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta-700"
      >
        {/* Avatar circle — solid ink so the shape and the initial are both
            legible with nothing else in the pill (see the docblock above). */}
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-xs font-semibold text-cream">
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
        ) : accountLabel ? (
          /*
            WHO IS SIGNED IN, IN WORDS. On the event / shop / HQ surfaces the
            slot above already names the room you are standing in, and that is
            the more useful sentence — so this only fills the slot when nothing
            else claims it, which is the launcher and the front door.

            ⚠ FROM `lg` UP ONLY, and that is a width decision, not a taste one.
            The shared bar carries identity, the search and this cluster on ONE
            row — the second row is what the owner struck down on 2026-07-30 —
            and "+ Create event" beside it is already hidden below 1024 for the
            same reason. On a phone the avatar is the whole mark, which is why
            it had to become visible before this line could be gated at all.
          */
          <span className="hidden max-w-[150px] truncate text-xs font-medium text-ink/80 lg:inline">
            {accountLabel}
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
      className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-sm font-semibold text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus:outline-none focus-visible:border-terracotta"
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
 * SwitcherPlaqueTrigger — the desktop-rail identity plaque that IS the account
 * menu (Council Verdict 2026-07-16 "Plaque-as-Menu, Wordmark-as-Home",
 * superseding the retired AccountSwitcherStandalone email pill).
 *
 * ONE component, three parameterizations — never fork per doorway:
 *   – couple:  chip = event monogram ("C&I") · title = event name · metaLine =
 *              "{Type} · {date}" · homeLabel = "Home · all your events"
 *   – vendor:  chip = <VendorAvatar> · title = business name · metaLine =
 *              "Verified vendor" / "Unverified"
 *   – admin:   chip = shield glyph · title = "Setnayan HQ" · metaLine = name
 *
 * Anatomy: a single whole-surface <button aria-haspopup="dialog"> styled as
 * the dark-glass plaque (atelier kit), with a trailing ChevronDown as VISUAL
 * AFFORDANCE ONLY (not a separate click zone — a split control was rejected by
 * the council as the "2 things there" ambiguity the owner asked to remove).
 * Going home is NOT this control's job — the rail wordmark link above it
 * (DoorwaySidebarHeader) carries 1-click home; the panel's Home item is the
 * 2-click fallback.
 *
 * Collapsed 64px rail: the plaque hides and the shipped
 * AccountSwitcherIconTrigger (avatar circle) takes over — same open state,
 * same panel, so the five account actions never vanish with the rail.
 */
export function SwitcherPlaqueTrigger({
  data,
  chip,
  title,
  metaLine,
  ariaLabel,
  homeLabel,
}: {
  data: SwitcherData;
  /** Content of the 36px identity chip — text initials ("C&I"), a
   *  <VendorAvatar>, or an icon glyph. The trigger owns the chip frame. */
  chip: ReactNode;
  /** Plaque headline — event name / business name / "Setnayan HQ". */
  title: string;
  /** Optional mono sub-line — "{Type} · {date}" / verification / admin name. */
  metaLine?: string | null;
  /** Honest menu semantics, e.g. `"Cale & Ice — account menu"` — never
   *  "switch events": the slimmed panel holds no event list. */
  ariaLabel: string;
  /** Panel "Home" label override (couple: "Home · all your events"). */
  homeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
  }

  // Focus trap, Esc-to-close, body-scroll-lock, focus-restore (shared hook).
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  return (
    <>
      {/* Expanded plaque — dark glass mini-card (design:
          event_dashboard_v2_2026-07-15.html), hidden on the 64px collapsed
          rail where the icon trigger below takes over. */}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [[data-sidebar-collapsed='1']_&]:hidden"
        style={{
          background:
            'radial-gradient(70% 60% at 85% -10%, rgba(203,167,102,.18), transparent 60%), var(--sn-glass-dark-bg, rgba(23,22,15,.82))',
          borderColor: 'var(--sn-glass-dark-line, rgba(255,255,255,.18))',
          color: 'var(--sn-gold-100, #F3ECDF)',
          outlineColor: 'var(--sn-gold-500, #CBA766)',
        }}
      >
        <span
          className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-xl text-[11px] font-extrabold"
          style={{
            background: 'linear-gradient(135deg, #8a6b39, #5a3b28)',
            border: '1.5px solid rgba(255,255,255,.35)',
            color: '#FFFDF8',
          }}
        >
          {chip}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold tracking-[-0.01em]">
            {title}
          </span>
          {metaLine ? (
            <span
              className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{ color: 'rgba(243,236,223,.6)' }}
            >
              {metaLine}
            </span>
          ) : null}
        </span>
        {/* Menu affordance — load-bearing, not polish: a name-card that is
            secretly a button is undiscoverable without it. */}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          style={{ color: 'rgba(243,236,223,.55)' }}
        />
      </button>

      {/* Collapsed 64px rail — avatar icon trigger, same open state + panel. */}
      <span className="hidden justify-center [[data-sidebar-collapsed='1']_&]:flex">
        <AccountSwitcherIconTrigger
          data={data}
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
      </span>

      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close account menu"
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
                aria-label="Account menu"
                className="focus:outline-none fixed inset-y-0 left-0 z-[52] flex w-80 flex-col overflow-hidden rounded-r-2xl border-r border-ink/10 bg-[var(--m-paper)] shadow-2xl"
                style={{ animation: 'sn-switcher-drawer-in 0.3s ease' }}
              >
                <SwitcherPanelBody data={data} close={close} homeLabel={homeLabel} />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
