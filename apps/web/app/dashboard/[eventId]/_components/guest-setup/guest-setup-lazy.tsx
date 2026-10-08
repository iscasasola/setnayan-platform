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

/**
 * 📥 THE REQUESTS ROWS' THREE CLIENT PARTS — Link ▾, the Keep quick add, and the
 * Send invite of a request just accepted (`guests/claims/page.tsx`). The Maker's
 * page imports that page (RSVP › Requests draws it in place), so its client
 * parts sat in the Maker's FIRST LOAD — 7.3 KB gzipped (chunk measured
 * 2026-10-08, train `rd/train-2026-10-08-a`: 509.5 KB of 507) for rows that are
 * drawn only when somebody has asked to come. Behind this door they are a chunk
 * of their own, and — because `MAKER_TOOLS` already loads this file and warms
 * every export — still downloaded at idle, so the first tap does not wait.
 * The Requests page itself (`/guests/claims`) draws them through the same door:
 * the server still renders them, so nothing on that page changes.
 */
export const LinkPicker = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-requests" */ '../../guests/claims/link-picker').then((m) => m.LinkPicker),
);
export const KeepQuickAdd = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-requests" */ '../../guests/claims/keep-quick-add').then((m) => m.KeepQuickAdd),
);
export const SendInviteActions = dynamic(() =>
  import(/* webpackChunkName: "maker-guest-requests" */ '../../guests/_components/send-invite').then((m) => m.SendInviteActions),
);
