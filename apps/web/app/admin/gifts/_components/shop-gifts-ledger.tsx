import { Gift } from 'lucide-react';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { GIFT_SHARE_OF_FEE_PCT } from '@/lib/setnayan-gift';
import { formatCount } from '@/lib/format-number';
import type { ShopGiftHoldRow, ShopGiftLedgerRow } from '@/lib/shop-gifts.server';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/**
 * 🎁 ADMIN › GIFTS & COMPS › SUPPLIER GIFTS (owner 2026-11-04) — every credit a shop bought, gave or had reversed, and
 * what live quotes still promise. Read-only: the money moves through the order (approve / refund on Orders) and the one
 * delivery door. Presentational — the page reads; `/dev/supplier-plan-lab?s=gifts-admin` mounts the same component.
 */
export function ShopGiftsLedger({
  ledger,
  ledgerError,
  holds,
  holdsError,
}: {
  ledger: ShopGiftLedgerRow[] | null;
  ledgerError: { message: string } | null;
  holds: ShopGiftHoldRow[] | null;
  holdsError: { message: string } | null;
}) {
  return (
    <section className="mb-10" data-admin-shop-gifts="">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">Supplier gifts</h2>
      <p className="mb-4 text-xs text-ink/60">
        A shop&rsquo;s gifts on one booking are capped at {GIFT_SHARE_OF_FEE_PCT}% of that booking&rsquo;s fee, at the
        price couples pay — the same share as the Setnayan gift. The smallest Papic pack is always allowed. Gift prices
        are the catalogue&rsquo;s.
      </p>

      <ConsoleTable<ShopGiftLedgerRow>
        rows={ledger}
        readError={ledgerError}
        readPermitted
        reads="the supplier gift ledger"
        label="Supplier gift ledger"
        cap={200}
        minWidth="36rem"
        rowKey={(r) => r.entryId}
        empty={{
          Icon: Gift,
          title: 'No supplier has bought gifts yet',
          blurb: 'A purchase lands here once its payment is approved on Orders.',
        }}
        columns={[
          { header: 'When', mono: true, cell: (r) => fmtDay(r.createdAt) },
          { header: 'Shop', cell: (r) => r.shopName ?? r.vendorProfileId },
          {
            header: 'What',
            cell: (r) =>
              r.kind === 'bought'
                ? `Bought${r.orderReference ? ` · ${r.orderReference}` : ''}`
                : r.kind === 'given'
                  ? `Given to ${r.eventName ?? 'an event'}${r.landed ? '' : ' · not in the pool'}`
                  : `Reversed${r.orderReference ? ` · ${r.orderReference}` : ''}`,
          },
          {
            header: 'Credits',
            mono: true,
            align: 'right',
            cell: (r) => `${r.delta > 0 ? '+' : '−'}${formatCount(Math.abs(r.delta))}`,
          },
        ]}
      />

      <h3 className="mb-2 mt-6 text-xs font-medium text-ink/60">On quotes, not given yet</h3>
      <ConsoleTable<ShopGiftHoldRow>
        rows={holds}
        readError={holdsError}
        readPermitted
        reads="the gift lines on live quotes"
        label="Gifts on live quotes"
        cap={100}
        rowKey={(h) => h.proposalId}
        empty={{
          Icon: Gift,
          title: 'No live quote carries a supplier gift',
          blurb: 'A gift on a sent or accepted quote shows here until the couple’s first payment clears.',
        }}
        columns={[
          { header: 'Shop', cell: (h) => h.shopName ?? '—' },
          { header: 'Event', cell: (h) => h.eventName ?? '—' },
          { header: 'Quote', cell: (h) => (h.status === 'accepted' ? 'Accepted' : 'Sent') },
          { header: 'Credits', mono: true, align: 'right', cell: (h) => formatCount(h.credits) },
        ]}
      />
    </section>
  );
}
