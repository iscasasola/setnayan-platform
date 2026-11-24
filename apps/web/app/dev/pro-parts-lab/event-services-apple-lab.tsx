'use client';

import { useMemo } from 'react';
import { EventServicesView, type AppleKit } from '@/app/dashboard/[eventId]/studio/website-pro/_components/event-services-view';
import type { EventServicesFacts, EventServicesPick } from '@/lib/event-services';
import type { IapScreen } from '@/lib/iap/iap-outcome';

/**
 * 🧪 The iPhone frames of Event services (v4 frames 08 · 08b · 08c · 08e · 08f) — the SHIPPED view with a stand-in
 * StoreKit: sample Apple price strings, and an Apple sheet that answers after a moment. `second` decides what the second
 * payment answers ('on' · 'cancelled'), so a walk can press Pay and watch 1 of 2 → 2 of 2 → the honest state.
 * Dev only (the lab page 404s in production); nothing is bought.
 */
export function EventServicesAppleLab({
  facts,
  products,
  prices,
  silent,
  second,
  initialPick,
}: {
  facts: EventServicesFacts;
  products: Record<string, string>;
  /** Sample StoreKit `displayPrice` strings, by product id. */
  prices: Record<string, string>;
  silent: boolean;
  second: 'on' | 'cancelled';
  initialPick: EventServicesPick;
}) {
  const apple: AppleKit = useMemo(() => {
    let n = 0;
    return {
      products,
      prices: silent ? { state: 'silent', display: new Map() } : { state: 'ready', display: new Map(Object.entries(prices)) },
      buy: () =>
        new Promise<IapScreen>((resolve) => {
          n += 1;
          const answer: IapScreen = n === 1 ? { kind: 'on' } : second === 'on' ? { kind: 'on' } : { kind: 'cancelled' };
          setTimeout(() => resolve(answer), 900);
        }),
      refresh: () => {},
    };
  }, [products, prices, silent, second]);
  return (
    <EventServicesView
      eventId="00000000-0000-4000-8000-000000000000"
      facts={facts}
      ordersHref="/dev/pro-parts-lab"
      initialPick={initialPick}
      initialOpen
      apple={apple}
    />
  );
}
