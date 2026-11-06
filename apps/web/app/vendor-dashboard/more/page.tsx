import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/more — a redirect stub since 2026-10-21.
 *
 * The supplier bar is **Today · Customers · Shop · Hub** (owner, verbatim: "Yes
 * to all", to the supplier-dashboard audit `shots-2026-10-21/supplier-dash-audit/
 * AUDIT.md`). More's last two rows found their homes — the Event Hub is the Hub
 * tab, and Settings (with More tools) opens from the profile picture — so this
 * page no longer has anything of its own to hold. A bookmark, a stored
 * notification link or an old app build that still opens it lands on Settings,
 * the room most of its rows already pointed into.
 *
 * `vendor-bar-is-four.test.ts` holds that every route the old More reached is
 * still reachable from the new shape.
 */
export default function RedirectVendorMore(): never {
  redirect('/vendor-dashboard/settings');
}
