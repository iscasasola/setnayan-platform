'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbDock } from '@/components/thumb-dock';
import { ThumbRow } from '@/components/thumb-row';
import { submitOrderAction } from '@/app/dashboard/[eventId]/checkout/actions';
import { buyWithApple } from '@/lib/iap/native-store';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { EventServicesView, type AppleKit, type CartDock, type EventServicesBodyProps } from './event-services-view';

/**
 * 🛒 Event services on the page: the view (`event-services-view.tsx`) with its cart bar standing in the one thumb dock
 * (`ThumbDock` + a mode `ThumbRow`, the house row at the thumb), the web's one order (`submitOrderAction`), and — in the
 * iPhone app — StoreKit: Apple's prices for the products the page names, and Apple's sheet per item. Split only so the
 * view renders in a unit test: the dock carries a CSS module and the order's post and StoreKit server-only modules,
 * none of which the unit runner loads.
 */
const ThumbCartDock: CartDock = ({ children }) => (
  <ThumbDock>
    <ThumbRow name="event-services-cart">{children}</ThumbRow>
  </ThumbDock>
);

export function EventServicesBody({
  appleProducts = null,
  ...props
}: EventServicesBodyProps & {
  /** 🍎 In the iPhone app: catalogue code → App Store product id (`lib/iap/products.ts`). Null on the web. */
  appleProducts?: Readonly<Record<string, string>> | null;
}) {
  const router = useRouter();
  const ids = useMemo(() => (appleProducts ? Object.values(appleProducts) : []), [appleProducts]);
  const prices = useAppStorePrices(ids, appleProducts !== null && !props.lab);
  const apple: AppleKit | null = useMemo(
    () =>
      appleProducts
        ? {
            products: appleProducts,
            prices: { state: prices.state, display: new Map([...prices.products].map(([id, p]) => [id, p.displayPrice])) },
            buy: (productId: string) => buyWithApple({ eventId: props.eventId, productId }),
            refresh: () => router.refresh(),
          }
        : null,
    [appleProducts, prices, props.eventId, router],
  );
  return <EventServicesView {...props} Dock={ThumbCartDock} submit={submitOrderAction} apple={apple} />;
}
