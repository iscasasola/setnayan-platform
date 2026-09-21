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
 */

import { useState } from 'react';

import {
  ChannelToggle,
  PaymentDetailsBlock,
  type RailInfo,
} from './payment-rails';

export type PayRail = RailInfo & { enabled: boolean };

export function PayRailsBlock({
  gcash,
  bdo,
  amountPhp,
  referenceCode,
}: {
  gcash: PayRail;
  bdo: PayRail;
  amountPhp: number;
  referenceCode: string;
}) {
  // GCash first: a GCash payer sends for free, a bank transfer into BDO costs
  // them ₱10–15 in InstaPay fees. Default to the rail that does not charge
  // them — unless it is switched off.
  const [channel, setChannel] = useState<'gcash' | 'bdo'>(
    gcash.enabled ? 'gcash' : 'bdo',
  );
  const open = [
    ...(gcash.enabled ? (['gcash'] as const) : []),
    ...(bdo.enabled ? (['bdo'] as const) : []),
  ];
  if (open.length === 0) return null;

  // A rail that is switched off must never be the one on screen, including
  // when it was selected before the owner closed it.
  const shown = open.includes(channel) ? channel : open[0]!;

  return (
    <div className="space-y-4">
      <ChannelToggle channel={shown} onChange={setChannel} open={open} />
      <PaymentDetailsBlock
        channel={shown}
        info={shown === 'gcash' ? gcash : bdo}
        referenceCode={referenceCode}
        amountPhp={amountPhp}
      />
    </div>
  );
}
