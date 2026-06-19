import { Wordmark } from '@/app/_components/brand-marks';
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
}: {
  label: string;
  switcherData: SwitcherData;
}) {
  return (
    <>
      <header className="px-4 py-3">
        <Wordmark />
        <p className="m-label-mono mt-1.5" style={{ color: 'var(--m-slate-2)' }}>
          {label}
        </p>
      </header>
      <div className="px-3 pb-3">
        <AccountSwitcherStandalone data={switcherData} />
      </div>
    </>
  );
}
