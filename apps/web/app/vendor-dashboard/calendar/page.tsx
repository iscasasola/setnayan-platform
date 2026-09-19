import { redirect } from 'next/navigation';
import { CALENDAR_ANCHOR } from '../customers/anchors';

/**
 * /vendor-dashboard/calendar — folded into the My Customers hub (owner 5-page IA,
 * 2026-07-12: "overview, my shop, my customers, my performance, BEO are all
 * 1-page each with the different features integrated"). The surface lives on
 * in ./surface.tsx, rendered by the hub's ?tab=calendar. This stub keeps every
 * old deep-link working and forwards its params (pattern: /vendor-dashboard/
 * services → My Shop, owner 2026-07-02).
 */
export default async function RedirectCalendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'calendar');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  // 🔑 A BARE /calendar LINK NAMES THE CALENDAR (S43 · 3). "View on calendar",
  // "Open calendar" and the Upcoming KPI all arrive with no params, and used to
  // land at the TOP of My Customers — the roster — with the month grid out of
  // sight. They now scroll to the grid (`<div id="calendar">` on the hub).
  // A link carrying params (`?m=` / `?pool=` from the Availability tools, the
  // day page's back link) keeps landing on those tools, exactly as before.
  const bare = qs.toString() === 'tab=calendar';
  redirect(`/vendor-dashboard/customers?${qs.toString()}${bare ? CALENDAR_ANCHOR : ''}`);
}
