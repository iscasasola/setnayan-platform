'use client';

import dynamic from 'next/dynamic';

/**
 * guest-setup-lazy.tsx — the three shared Setup parts, as the Maker loads them:
 * in their own chunk, not in the Maker's first load (its 507 KB gzipped ceiling,
 * `scripts/check-maker-js-budget.mjs` — measured 507.4 KB with them inline,
 * 506.7 KB lazy, 2026-10-07), and warmed at idle by `MAKER_TOOLS`
 * (`launch/_components/maker-tools.tsx`) so the first tap does not wait.
 * Guests › Setup imports the parts directly.
 */
export const GuestsGetIn = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-setup" */ './guests-get-in').then((m) => m.GuestsGetIn),
);
export const RsvpAsks = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-setup" */ './rsvp-asks').then((m) => m.RsvpAsks),
);
export const ReplyBy = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-setup" */ './reply-by').then((m) => m.ReplyBy),
);
