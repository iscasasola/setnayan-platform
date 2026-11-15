'use client';

import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { DATES_FROM_SHOP_KEY } from './check-a-date-sheet';

/**
 * 📅 "Check a date" beside Inquire · Share on the shop page (supplier website by plan, owner-approved 2026-10-30).
 * SHOP-02 v7 (14 Nov 2026): it no longer leaves the shop — it opens the Check a date sheet OVER it (the shop's own
 * `?dates` address, `CheckADateSheet`), and notes that it did, so × is one step back onto the shop. The caller writes
 * the address as a literal `href`, so the route map (`port:baseline`, `ugat:screens`) sees the door on the page.
 */
export function CheckADateLink({ href, className }: { href: string | null; className: string }) {
  // `null` — the sample shop page (`SampleShopPage`): the same door, drawn, with no calendar behind it to open.
  if (href === null) {
    return (
      <span data-shop-check-a-date="" className={className}>
        <CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Check a date
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        try {
          window.sessionStorage.setItem(DATES_FROM_SHOP_KEY, window.location.pathname);
        } catch {
          /* private mode: × then replaces the address instead of stepping back — still the shop */
        }
      }}
      data-shop-check-a-date=""
      className={className}
    >
      <CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      Check a date
    </Link>
  );
}
