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
   * Optional doorway accent — a small leading dot before the eyebrow label
   * ("Energy, not skin" 2026-07-09: couple = wine, vendor = wine+blue, admin =
   * wine+violet). Pass a CSS color (e.g. `var(--a-violet)`); omitted = no dot,
   * zero visual change for doorways that haven't adopted an accent yet.
   */
  accentColor?: string;
}) {
  return (
    <>
      <header className="px-4 py-3">
        {/* Dark-panel wordmark — the gold mark glyph (reads on obsidian) + the
            white "SETNA" with the doorway-accent "YAN" span (wine for couple +
            vendor, violet for admin — driven by `--m-sidebar-accent-fg`, which
            `.sn-sidebar--violet` flips). Full "SETNAYAN" spelling preserved
            (brand lock); only the last three letters carry the accent. */}
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
