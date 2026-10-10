'use client';

/**
 * customers-segments.tsx — People · Dates · Money, the ONE segmented control at
 * the top of Customers (supplier redesign S-PR2; corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 "Customers = People ·
 * Dates · Money (one segmented control, the Suppliers/Guests shape)"; prototype
 * frame 03).
 *
 * It is the app's own pill selector (`app/_components/pill-selector.tsx`) — a
 * switch between VIEWS of one place, which is what that control is for — and
 * each segment is a LINK: a view has its own address, so it opens in a new tab,
 * deep-links, and comes back on Back. The page stays server-rendered.
 *
 * `SegmentHashLander` is the other half of the anchors table: a link saved
 * before Customers had segments names only a fragment (`#payday`), which the
 * server never sees. If the fragment's section lives on another segment, this
 * goes there — so an old notification still lands on what it named.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PillSelector } from '@/app/_components/pill-selector';
import { formatCount } from '@/lib/format-number';
import {
  ANCHOR_SEGMENT,
  CUSTOMER_SEGMENTS,
  CUSTOMER_SEGMENT_LABEL,
  customersSegmentHref,
  type CustomerSegment,
} from '../anchors';

export function CustomersSegments({
  active,
  waiting,
}: {
  active: CustomerSegment;
  /** How many customers are waiting on the shop — said on People, when any are. */
  waiting: number;
}) {
  return (
    <nav aria-label="Customers view" className="flex w-full" data-customers-segments={active}>
      <PillSelector
        label="Customers view"
        value={active}
        link={Link}
        data="customers"
        options={CUSTOMER_SEGMENTS.map((seg) => ({
          key: seg,
          href: customersSegmentHref(seg),
          label:
            seg === 'people' && waiting > 0 ? (
              <>
                {CUSTOMER_SEGMENT_LABEL[seg]}
                <span className="font-medium opacity-80" data-customers-waiting="">
                  {formatCount(waiting)}
                </span>
              </>
            ) : (
              CUSTOMER_SEGMENT_LABEL[seg]
            ),
        }))}
      />
    </nav>
  );
}

export function SegmentHashLander({ active }: { active: CustomerSegment }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const land = () => {
      const want = ANCHOR_SEGMENT[window.location.hash];
      if (!want || want === active) return;
      // Already there in the DOM (two segments never share an id) → nothing to do.
      if (document.getElementById(window.location.hash.slice(1))) return;
      const q = new URLSearchParams(params.toString());
      q.set('seg', want);
      q.delete('page');
      router.replace(`${pathname}?${q.toString()}${window.location.hash}`);
    };
    land();
    window.addEventListener('hashchange', land);
    return () => window.removeEventListener('hashchange', land);
  }, [active, params, pathname, router]);
  return null;
}
