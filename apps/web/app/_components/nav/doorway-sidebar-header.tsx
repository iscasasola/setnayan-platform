import { LogoMark } from '@/app/_components/brand-marks';
import { AccountSwitcherStandalone } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

/**
 * DoorwaySidebarHeader — the ONE shared sidebar header for every dashboard
 * doorway (account-customer · event-customer · vendor · admin).
 *
 * WHY: each doorway used to hand-roll its own `sidebarHeader` block into
 * <SidebarShell>. Vendor + admin already converged on `Wordmark` + an
 * `m-label-mono` eyebrow + `AccountSwitcherStandalone`; the customer event
 * header was a partial (switcher only, no Wordmark/eyebrow) and the account
 * surface wasn't on the shell at all. Extracting the block here parameterised
 * by `label` makes all four headers one design system — change the chrome once,
 * every doorway moves together (owner directive 2026-06-20 "universal style of
 * side bar").
 *
 * The `label` is the doorway eyebrow: "Account" · "Planning" · "Vendor" ·
 * "Setnayan HQ". Reuses the existing `Wordmark`, the global `m-label-mono`
 * class (globals.css), and the unified `AccountSwitcherStandalone`.
 */
export function DoorwaySidebarHeader({
  label,
  switcherData,
  accentColor,
}: {
  label: string;
  switcherData: SwitcherData;
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
      <header className="px-4 py-3">
        {/* Dark-panel wordmark — the gold mark glyph + the white "SETNA" with
            the gold-accent "YAN" span (`--m-sidebar-accent-fg`, shared by every
            doorway since the Glass PR-1 violet retirement). Full "SETNAYAN"
            spelling preserved (brand lock); only the last three letters carry
            the accent. */}
        <span className="inline-flex items-center" style={{ gap: '9px', lineHeight: 1 }}>
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
        </span>
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
      <div className="px-3 pb-3">
        <AccountSwitcherStandalone data={switcherData} />
      </div>
    </>
  );
}
