import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/app/_components/brand-marks';

/**
 * DoorwaySidebarHeader — the ONE shared sidebar header for every dashboard
 * doorway (event-customer · vendor · admin).
 *
 * WHY: each doorway used to hand-roll its own `sidebarHeader` block into
 * <SidebarShell>. Extracting the block here parameterised by `label` makes all
 * headers one design system — change the chrome once, every doorway moves
 * together (owner directive 2026-06-20 "universal style of side bar").
 *
 * v3 — 2026-08-13, Redesign Session 6 "the seam". ⚠ THIS REVERSES PART OF THE
 * 2026-07-16 COUNCIL VERDICT BELOW, on the owner's own newer sentence:
 * *"The WORDMARK is the way out of the app, still signed in."* It is also what
 * the binding prototype draws — `front_door_and_seam_2026-08-12.html` renders
 * the app wordmark as `data-act="exit" title="Back to the public site"` — and
 * what `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` §3.6 describes.
 *
 *   – The WORDMARK now goes to `/`, the public front door, STILL SIGNED IN.
 *     Before this there was no way out of the app at all: a search of the whole
 *     dashboard / vendor / admin chrome found ZERO links to `/`. A member who
 *     wanted to read an article had to type the address or sign out.
 *   – 1-CLICK HOME IS NOT LOST, it moved. The verdict's real concern was that
 *     the rail must always offer home in one press, and it still does: inside
 *     an event the rail's first row is "← All your events" (added in the same
 *     change, and the same row the prototype draws), and the account panel's
 *     Home item — explicitly the "2-click fallback", and mobile's ONLY path
 *     home since mobile bars carry no wordmark — is untouched.
 *   – The front door answers the press with a rail whose first row reads
 *     "Back to your events", so the trip is a round trip rather than an exit.
 *
 * v2 — Council Verdict 2026-07-16 "Plaque-as-Menu, Wordmark-as-Home":
 *   – The WORDMARK was a <Link href="/dashboard"> — the universal
 *     logo-goes-home convention, and the rail's ONLY 1-click home (owner lock:
 *     the launcher is THE home). Superseded by v3 above; the "wordmark" model
 *     still must never fork, it just points somewhere else now.
 *   – The old AccountSwitcherStandalone email pill is RETIRED. In its slot the
 *     header takes a REQUIRED `identity` node — each doorway passes its
 *     <SwitcherPlaqueTrigger> (event plaque / vendor card / HQ plaque), which
 *     opens the account menu. Required so pill-deletion and trigger-presence
 *     can never diverge per doorway: no rail can silently ship without a
 *     panel trigger (wayfinding lock).
 *   – COLLAPSED 64px rail: SidebarShell no longer blanket-hides this slot; the
 *     expanded header hides itself via the data-attr and a compact LogoMark
 *     icon-link renders instead (the identity trigger handles its own
 *     collapsed avatar variant), so home + the five account actions survive
 *     collapse.
 *
 * The `label` is the doorway eyebrow: "Planning" · "Vendor" · "Setnayan HQ".
 */
export function DoorwaySidebarHeader({
  label,
  identity,
  accentColor,
}: {
  label: string;
  /** The doorway's identity plaque trigger — a <SwitcherPlaqueTrigger>.
   *  Required: every rail must carry the account-menu doorway. */
  identity: ReactNode;
  /**
   * Optional doorway accent — a small leading dot before the eyebrow label.
   * Pass a CSS color (e.g. `var(--m-sidebar-accent)` = Atelier gold); omitted =
   * no dot. The former per-doorway colour forks (wine/blue/violet) were retired
   * in Glass PR-1 (2026-07-15) — every doorway shares the gold accent.
   */
  accentColor?: string;
}) {
  return (
    <>
      {/* Expanded header — hidden on the 64px collapsed rail (the compact
          block below takes over). */}
      <header className="px-4 py-3 [[data-sidebar-collapsed='1']_&]:hidden">
        {/* Dark-panel wordmark — the gold mark glyph + the white "SETNA" with
            the gold-accent "YAN" span (`--m-sidebar-accent-fg`, shared by every
            doorway since the Glass PR-1 violet retirement). Full "SETNAYAN"
            spelling preserved (brand lock); only the last three letters carry
            the accent.
            THE WAY OUT: it goes to the public front door, still signed in —
            see the v3 note at the top of this file. */}
        <Link
          href="/"
          aria-label="Setnayan — back to the public site"
          title="Back to the public site"
          className="inline-flex items-center rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ gap: '9px', lineHeight: 1, outlineColor: 'var(--m-sidebar-accent, #CBA766)' }}
        >
          <LogoMark size={28} />
          <span
            style={{
              fontFamily: 'var(--font-condensed), "Saira Condensed", sans-serif',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              lineHeight: 1,
              textTransform: 'uppercase',
              color: 'var(--m-sidebar-fg)',
            }}
          >
            SETNA<span style={{ color: 'var(--m-sidebar-accent-fg)' }}>YAN</span>
          </span>
        </Link>
        <p className="m-label-mono mt-1.5" style={{ color: 'var(--m-sidebar-fg-muted)' }}>
          {accentColor ? (
            <span
              aria-hidden
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: accentColor }}
            />
          ) : null}
          {label}
        </p>
      </header>
      {/* Collapsed 64px rail — icon-only mark (the wordmark text can't fit).
          Same destination as the expanded wordmark; the two can never differ,
          which is the whole reason they live in one file. */}
      <div className="hidden py-3 [[data-sidebar-collapsed='1']_&]:flex [[data-sidebar-collapsed='1']_&]:justify-center">
        <Link
          href="/"
          aria-label="Setnayan — back to the public site"
          title="Back to the public site"
          className="inline-flex rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: 'var(--m-sidebar-accent, #CBA766)' }}
        >
          <LogoMark size={28} />
        </Link>
      </div>
      {/* Identity slot — the doorway's plaque trigger (expanded) / avatar icon
          trigger (collapsed); the trigger component owns that switch. */}
      <div className="px-3 pb-3 [[data-sidebar-collapsed='1']_&]:px-2">{identity}</div>
    </>
  );
}
