import { notFound, redirect } from 'next/navigation';
import { daySheetHref } from '@/lib/vendor-dates';

/**
 * /vendor-dashboard/calendar/[date] — one day now lives on Customers › Dates as its day sheet (S-PR3; plan § 8 gap
 * 11: "`calendar/[date]` → Dates › day sheet (35) … URL `?seg=dates&day=2026-10-03` (redirect from the old route)").
 * Every old link — a month cell, a notification, a bookmark — lands on the same day. Its controls (block the day,
 * reopen a hold, tell the waiting list) are there, posting the same actions.
 */
export default async function RedirectCalendarDay({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const { notice } = await searchParams;
  redirect(`${daySheetHref(date)}${notice && /^[a-z_]{1,40}$/.test(notice) ? `&notice=${notice}` : ''}`);
}
