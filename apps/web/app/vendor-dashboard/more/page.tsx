import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/more — RETIRED 2026-07-16.
 *
 * Under the 5-page IA (owner-locked 2026-07-12) the mobile bottom nav and the
 * desktop sidebar are the SAME five destinations (Overview · My Shop · My
 * Customers · My Performance · On the Day), and every former sub-surface lives
 * as a tab INSIDE its hub. So the old "More" overflow landing rendered cards for
 * exactly the five bottom-nav tabs already on screen — a 1:1 duplicate. It now
 * forwards to the dashboard root; the topbar "More" link was removed with it.
 */
export default function RedirectMore() {
  redirect('/vendor-dashboard');
}
