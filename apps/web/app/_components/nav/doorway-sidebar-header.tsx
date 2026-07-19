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
 * v2 — Council Verdict 2026-07-16 "Plaque-as-Menu, Wordmark-as-Home":
 *   – The WORDMARK is a <Link href="/dashboard"> — the universal logo-goes-home
 *     convention, and the rail's ONLY 1-click home (owner lock: the launcher
 *     is THE home). Same destination as the launcher top-bar wordmark; the
 *     "wordmark = home" model must never fork.
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
            the accent. Links home: the rail's 1-click path to /dashboard. */}
        <Link
          href="/dashboard"
          aria-label="Setnayan — home"
          title="Home"
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
      {/* Collapsed 64px rail — icon-only home link (the mark alone; the
          wordmark text can't fit). Keeps 1-click home alive on collapse. */}
      <div className="hidden py-3 [[data-sidebar-collapsed='1']_&]:flex [[data-sidebar-collapsed='1']_&]:justify-center">
        <Link
          href="/dashboard"
          aria-label="Setnayan — home"
          title="Home"
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
