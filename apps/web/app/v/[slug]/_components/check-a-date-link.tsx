import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';

/**
 * 📅 "Check a date" beside Inquire · Share on the shop page (supplier website by plan, owner-approved 2026-10-30) —
 * the door to the approved public landing `/v/[slug]/dates` (DECISION_LOG 2026-10-28 "CHECK A DATE — APPROVED"):
 * Available · Not bookable, never another couple's asks. One component for the action row and the desktop rail, so
 * the address is written once.
 */
export function checkADateHref(slug: string): string {
  return `/v/${encodeURIComponent(slug)}/dates`;
}

export function CheckADateLink({ slug, className }: { slug: string; className: string }) {
  return (
    <Link href={checkADateHref(slug)} data-shop-check-a-date="" className={className}>
      <CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      Check a date
    </Link>
  );
}
