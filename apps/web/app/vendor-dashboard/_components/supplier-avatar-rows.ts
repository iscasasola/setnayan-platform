import type { ShopRow } from '@/app/_components/account-switcher/account-switcher';

/**
 * THE SUPPLIER'S ROWS IN THE ACCOUNT PANEL (simpler supplier dashboard steps 5 + 6, 2026-10-14 — prototype
 * `SHEETS.avatar`: "Your details · Your page · Your collections · Helpers · Plan · Settings · Switch shop · Sign out").
 *
 * Every row goes to a page that exists today. "Switch shop" and "Sign out" are the panel's own "Switch to" rail and
 * Sign out, which every surface already carries. Step 5 built the first three rows; step 6 owns the finished sheet:
 * Settings goes to the Settings list, Plan never shows in the store shell (the route is refused there), and a scoped
 * team member sees Settings alone. No counts: the panel renders on every supplier page, and "4 of 6 done" would put
 * the documents and payment reads on all of them — the count is on Your details itself.
 *
 * THE ONE BUILD (2026-11-08): "Your collections" left — its photos and videos are the bar's Portfolio tab now. "Your page"
 * stays (the editor at /vendor-dashboard/website; View page ↗ under the shop row is the public page). Settings stays —
 * the ONLY door to More tools (A1 §7 R4). Help is the sheet's Help tile (→ /vendor-dashboard/help), never a row too.
 */
export function supplierAvatarRows(opts: { storeShell?: boolean } = {}): ShopRow[] {
  return [
    { key: 'details', href: '/vendor-dashboard/profile', label: 'Your details', sub: 'Name · documents · how clients pay you' },
    { key: 'page', href: '/vendor-dashboard/website', label: 'Your page', sub: 'See it as couples do · edit · share' },
    { key: 'helpers', href: '/vendor-dashboard/team', label: 'Helpers', sub: 'Who can see your schedule' },
    ...(opts.storeShell
      ? []
      : [{ key: 'plan', href: '/vendor-dashboard/subscription', label: 'Plan', sub: 'What you pay · what it gives you' }]),
    { key: 'settings', href: '/vendor-dashboard/settings', label: 'Settings', sub: 'Notifications · getting paid · help' },
  ];
}

/** A scoped team member's sheet (step 6): Settings alone — the owner rooms are not theirs. */
export function scopedMemberAvatarRows(): ShopRow[] {
  return [{ key: 'settings', href: '/vendor-dashboard/settings', label: 'Settings', sub: 'Notifications · help' }];
}
