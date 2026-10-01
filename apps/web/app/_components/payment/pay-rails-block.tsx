'use client';

/**
 * app/_components/payment/pay-rails-block.tsx — THE RAILS, DROP-IN, FOR A
 * SERVER PAGE.
 *
 * Owner, 2026-09-20, after the first two surfaces were merged: *"again all
 * payments entering us should be one paying style."* No exceptions — so a page
 * that is not the checkout drawer and not /pay still shows the same cards, the
 * same code and the same account rows.
 *
 * ── WHY THIS THIN WRAPPER EXISTS ────────────────────────────────────────────
 * `ChannelToggle` and `PaymentDetailsBlock` need one piece of state between
 * them: which rail is selected. A React Server Component cannot hold it, so
 * without this every server page would grow its own client component to do the
 * same three lines — which is precisely the duplication this whole change is
 * undoing, one level down.
 *
 * ⚠ IT TAKES RENDERED IMAGES, NOT PAYLOADS. `mintedUrl` comes from
 * `mintedQrImage` on the server. Handing a payload down for the browser to draw
 * leaves the STATIC merchant code — scannable, worth ₱0 — on screen until the
 * `qrcode` chunk lands, and the owner paid through that window on a real
 * ₱837.50 booking fee. A server page has no excuse: it can mint before it
 * sends the HTML.
 *
 * ── A LIST, NOT TWO PROPS (owner, 2026-10-01) ────────────────────────────────
 * The rails are Setnayan's receiving-accounts list, already narrowed to the
 * OPEN ones and already in the admin's order (`openRailsFromSettings`). The
 * first one is selected — the admin puts the account that costs the payer
 * nothing (GCash, ahead of an InstaPay fee into a bank) at the top.
 */

import { useState } from 'react';

import {
  ChannelToggle,
  PaymentDetailsBlock,
  type RailInfo,
} from './payment-rails';

export type PayRail = RailInfo;

export function PayRailsBlock({
  rails,
  amountPhp,
  referenceCode,
}: {
  /** The OPEN rails, in order. Empty renders nothing — the page says why. */
  rails: readonly PayRail[];
  amountPhp: number;
  referenceCode: string;
}) {
  const [channel, setChannel] = useState<string>(rails[0]?.id ?? '');
  if (rails.length === 0) return null;

  // A rail that is switched off must never be the one on screen, including
  // when it was selected before the owner closed it.
  const shown = rails.find((r) => r.id === channel) ?? rails[0]!;

  return (
    <div className="space-y-4">
      <ChannelToggle channel={shown.id} onChange={setChannel} rails={rails} />
      <PaymentDetailsBlock
        info={shown}
        referenceCode={referenceCode}
        amountPhp={amountPhp}
      />
    </div>
  );
}
