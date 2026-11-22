'use client';

import { ThumbDock } from '@/components/thumb-dock';
import { ThumbRow } from '@/components/thumb-row';
import { submitOrderAction } from '@/app/dashboard/[eventId]/checkout/actions';
import { EventServicesView, type CartDock, type EventServicesBodyProps } from './event-services-view';

/**
 * 🛒 Event services on the page: the view (`event-services-view.tsx`) with its cart bar standing in the one thumb dock
 * (`ThumbDock` + a mode `ThumbRow`, the house row at the thumb). Split only so the view renders in a unit test — the dock
 * carries a CSS module and the order's post a server-only module, neither of which the unit runner loads.
 */
const ThumbCartDock: CartDock = ({ children }) => (
  <ThumbDock>
    <ThumbRow name="event-services-cart">{children}</ThumbRow>
  </ThumbDock>
);

export function EventServicesBody(props: EventServicesBodyProps) {
  return <EventServicesView {...props} Dock={ThumbCartDock} submit={submitOrderAction} />;
}
