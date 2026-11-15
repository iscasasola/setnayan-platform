'use client';

import type { ComponentProps } from 'react';
import { CheckADateSheet } from './check-a-date-sheet';
import { CheckADateCalendar } from '../dates/_components/check-a-date-calendar';

type CalendarProps = Omit<ComponentProps<typeof CheckADateCalendar>, 'onClose'>;

/** The sheet and its calendar together, on the client — × is the sheet's close (SHOP-02 v7). */
export function CheckADateOverShopView({ shopHref, ...calendar }: CalendarProps & { shopHref: string }) {
  return <CheckADateSheet shopHref={shopHref}>{(close) => <CheckADateCalendar {...calendar} onClose={close} />}</CheckADateSheet>;
}

/** The read failed: the sheet still opens over the shop and says so — it never guesses which days are free. */
export function CheckADateUnreadableView({ shopHref, retryHref }: { shopHref: string; retryHref: string }) {
  return (
    <CheckADateSheet shopHref={shopHref}>
      {(close) => (
        <div className="px-4 pb-16 pt-6" data-check-date-unreadable="">
          <h1 className="text-[22px] font-semibold">Check a date</h1>
          <p role="alert" className="mt-2 text-[15px] text-ink/75">
            We couldn&rsquo;t load this shop&rsquo;s dates just now, so we won&rsquo;t guess which days are free.
          </p>
          <div className="mt-4 flex gap-2">
            <a href={retryHref} className="button-secondary inline-flex items-center gap-2">
              Try again
            </a>
            <button type="button" onClick={close} className="button-secondary inline-flex items-center gap-2">
              Back to the shop
            </button>
          </div>
        </div>
      )}
    </CheckADateSheet>
  );
}
