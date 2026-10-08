'use client';

import dynamic from 'next/dynamic';
import { SlotFill } from '../../../launch/_components/lazy-slot';

/**
 * ⚡ Studio › Love Story's cards, loaded the first time they are drawn. The launch page renders the
 * Love Story page on the server, so every client piece it imports joins the Maker's FIRST LOAD
 * (`scripts/check-maker-js-budget.mjs`, 507 KB, never raised). The cards only ever draw in the new
 * Maker's Studio, so they wait for it here — same name, same props.
 */
export const MomentOrderCards = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './moment-order-cards').then((m) => m.MomentOrderCards),
  { loading: SlotFill },
);
