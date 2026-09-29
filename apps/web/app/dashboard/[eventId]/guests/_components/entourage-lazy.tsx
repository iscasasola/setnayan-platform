'use client';

import dynamic from 'next/dynamic';
import { SlotButton, SlotRows } from '../../launch/_components/lazy-slot';

/**
 * ⚡ THE MARCH PANEL'S CLIENT PIECES, LOADED WHEN THE MARCH IS OPENED.
 *
 * `EntourageOrderPanel` is drawn by the Event Hub Maker's Details › The march
 * (`launch/_components/details-your-event-load.tsx`), so the Maker's server
 * graph reaches it — and Next puts every `'use client'` module a route's server
 * files import into that route's FIRST LOAD, eagerly. The walking-order lines
 * and the move buttons are loaded when the panel renders instead
 * (`launch/_components/details-lazy.tsx` explains the mechanism;
 * `details-pieces-are-lazy.test.ts` holds it). Same names, same props.
 */
export const WalkingOrderLines = dynamic(() => import(/* webpackChunkName: "maker-details" */ './walking-order-lines').then((m) => m.WalkingOrderLines), { loading: SlotRows });
export const MarchButton = dynamic(() => import(/* webpackChunkName: "maker-details" */ './march-button').then((m) => m.MarchButton), { loading: SlotButton });

/** The same imports, asked early (the Maker when idle; The march row on hover or focus). */
export function prefetchEntourage(): Promise<unknown> {
  return Promise.all([import(/* webpackChunkName: "maker-details" */ './walking-order-lines'), import(/* webpackChunkName: "maker-details" */ './march-button')]);
}
