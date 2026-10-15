import type { ShopRow } from '@/app/_components/account-switcher/account-switcher';

/**
 * THE SUPPLIER'S ROWS IN THE ACCOUNT PANEL (simpler supplier dashboard step 5, 2026-10-14 — prototype `SHEETS.avatar`:
 * "Your details · Your page · Your collections · Helpers · Plan · Settings · Switch shop · Sign out").
 *
 * Every row goes to a page that exists today. "Switch shop" and "Sign out" are the panel's own "Switch to" rail and
 * Sign out, which every surface already carries; Settings is More until step 6 builds the Settings list (shared file —
 * step 6 owns the finished sheet). No counts: the panel renders on every supplier page, and "4 of 6 done" would put
 * the documents and payment reads on all of them — the count is on Your details itself.
 */
export function supplierAvatarRows(): ShopRow[] {
  return [
    { key: 'details', href: '/vendor-dashboard/profile', label: 'Your details', sub: 'Name · documents · how clients pay you' },
    { key: 'page', href: '/vendor-dashboard/website', label: 'Your page', sub: 'See it as couples do · edit · share' },
    { key: 'collections', href: '/vendor-dashboard/collections', label: 'Your collections', sub: 'Photos and videos in one place' },
    { key: 'helpers', href: '/vendor-dashboard/team', label: 'Helpers', sub: 'Who can see your schedule' },
    { key: 'plan', href: '/vendor-dashboard/subscription', label: 'Plan', sub: 'What you are on · what it gives you' },
    { key: 'settings', href: '/vendor-dashboard/more', label: 'Settings', sub: 'Notifications · getting paid · help' },
  ];
}
