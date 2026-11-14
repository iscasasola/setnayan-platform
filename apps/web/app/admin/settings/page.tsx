import { redirect } from 'next/navigation';

/**
 * /admin/settings — the old Settings studio (four tabs) → the avatar's screens (owner go 14 Nov 2026: *"Yes, queue the
 * builds"*; the approved drawing is `Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html`). Each tab moved,
 * nothing dropped:
 *
 *   ?tab=settings (and no tab) → /admin/business            Business identity · brand icon · loader · Sentry · doors
 *   ?tab=compliance            → /admin/business#compliance  the RA 10173 facts
 *   ?tab=notifications         → /admin/email-delivery       delivery log · morning digest · push · the bell
 *   ?tab=demo-mode             → /admin/switches#demo-mode   demo mode (+ the /sample switch, now Switches › Couples)
 *
 * 🔑 THE FLASH PARAMS ARE FORWARDED. The settings actions still redirect to `/admin/settings?…&saved=1` /
 * `error=…` / `brand_icon=1` / `brand_icon_removed=1` / `loader_saved=1` (that file is held by another open PR), and
 * the demo-mode toggle's older redirect carries `toggled=`. Dropping them here would turn every save into a silent
 * one. `/admin/settings/payment-methods` is its own page and is untouched.
 */
export const dynamic = 'force-dynamic';

const FORWARD = ['saved', 'error', 'brand_icon', 'brand_icon_removed', 'loader_saved', 'toggled'] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Where a tab of the old studio lives now. */
function settingsTabHome(tab: string | undefined): { path: string; hash: string } {
  switch (tab) {
    case 'compliance':
      return { path: '/admin/business', hash: '#compliance' };
    case 'notifications':
      return { path: '/admin/email-delivery', hash: '' };
    case 'demo-mode':
      return { path: '/admin/switches', hash: '#demo-mode' };
    default:
      return { path: '/admin/business', hash: '' };
  }
}

export default async function SettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const { path, hash } = settingsTabHome(first(search.tab));
  const out = new URLSearchParams();
  for (const k of FORWARD) {
    const v = first(search[k]);
    if (v !== undefined) out.set(k, v);
  }
  const tail = `${out.toString() ? `?${out.toString()}` : ''}${hash}`;
  // The default home first, written out, so the admin map reads this file as a stub of /admin/business.
  if (path === '/admin/business') redirect(`/admin/business${tail}`);
  redirect(`${path}${tail}`);
}
